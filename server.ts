import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import {
  SAAS_PLANS,
  normalizeTierId,
  isAdminEmail,
  DurableSaasStore,
  getCurrentMonthKey,
  createEmptyMonthlyCounters,
  type UsageBucket,
  type ServerUserAccountState,
} from './server/billingStore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saasStore = new DurableSaasStore();

// Initialize Firebase Admin SDK for relaunch-bizpulse
let hasAdminCredentials = false;
const adminApp = getApps().length === 0
  ? (() => {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          hasAdminCredentials = true;
          return initializeApp({
            credential: cert(cred),
            projectId: 'relaunch-bizpulse',
          });
        } catch (e: any) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT, falling back to projectId:', e.message);
          return initializeApp({ projectId: 'relaunch-bizpulse' });
        }
      }
      return initializeApp({ projectId: 'relaunch-bizpulse' });
    })()
  : getApps()[0];

const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);

interface AuthenticatedRequest extends express.Request {
  user?: DecodedIdToken;
  rawBody?: Buffer;
}

// ==========================================
// SERVER-SIDE SAAS PLAN CATALOG & METERING
// ==========================================
const isStripeConfiguredEnv = Boolean(
  process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY.startsWith('sk_') &&
    process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder_key'
);
const billingModeResolved: 'live' | 'test' | 'unconfigured' =
  process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
    ? 'live'
    : isStripeConfiguredEnv
    ? 'test'
    : 'unconfigured';

function getOrInitUserState(uid: string, email?: string): ServerUserAccountState {
  return saasStore.getOrInitUser(uid, email);
}

async function syncUserStateFromAdminFirestore(uid: string): Promise<void> {
  if (!hasAdminCredentials) return;
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('account').doc('billing').get();
    if (snap.exists) {
      const data = snap.data() || {};
      const userState = getOrInitUserState(uid);
      if (data.email && !userState.email) userState.email = String(data.email);
      if (data.subscriptionTier) userState.subscriptionTier = normalizeTierId(data.subscriptionTier);
      if (data.subscriptionStatus) userState.subscriptionStatus = String(data.subscriptionStatus);
      if (data.stripeCustomerId) userState.stripeCustomerId = String(data.stripeCustomerId);
      if (data.stripeSubscriptionId) userState.stripeSubscriptionId = String(data.stripeSubscriptionId);
      if (data.currentPeriodEnd) userState.currentPeriodEnd = String(data.currentPeriodEnd);
      const monthKey = getCurrentMonthKey();
      if (data.monthlyUsage?.[monthKey]) {
        const fsMonth = data.monthlyUsage[monthKey];
        const localMonth = userState.monthlyUsage[monthKey] || createEmptyMonthlyCounters();
        localMonth.coachMessages = Math.max(localMonth.coachMessages, Number(fsMonth.coachMessages) || 0);
        localMonth.documentAudits = Math.max(localMonth.documentAudits, Number(fsMonth.documentAudits) || 0);
        localMonth.recommendations = Math.max(localMonth.recommendations, Number(fsMonth.recommendations) || 0);
        localMonth.promptTokens = Math.max(localMonth.promptTokens, Number(fsMonth.promptTokens) || 0);
        localMonth.outputTokens = Math.max(localMonth.outputTokens, Number(fsMonth.outputTokens) || 0);
        localMonth.thinkingTokens = Math.max(localMonth.thinkingTokens, Number(fsMonth.thinkingTokens) || 0);
        localMonth.totalTokens = Math.max(localMonth.totalTokens, Number(fsMonth.totalTokens) || 0);
        localMonth.estimatedCostUsd = Math.max(localMonth.estimatedCostUsd, Number(fsMonth.estimatedCostUsd) || 0);
        localMonth.requestCount = Math.max(localMonth.requestCount, Number(fsMonth.requestCount) || 0);
        userState.monthlyUsage[monthKey] = localMonth;
      }
      saasStore.save();
    }
  } catch (err: any) {
    console.warn('Firestore billing sync read notice:', err.message);
  }
}

async function persistUserStateToAdminFirestore(uid: string): Promise<void> {
  if (!hasAdminCredentials) return;
  try {
    const userState = getOrInitUserState(uid);
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('account')
      .doc('billing')
      .set(userState, { merge: true });
  } catch (err: any) {
    console.warn('Firestore billing sync write notice:', err.message);
  }
}

function buildAccountUsageSummary(uid: string, stripeConfigured: boolean, email?: string | null) {
  return saasStore.buildAccountUsageSummary(uid, stripeConfigured, billingModeResolved, email);
}

// Per-user sliding window rate limiter (20 AI requests per 60 seconds)
const userMinuteTimestamps = new Map<string, number[]>();
const MAX_AI_REQUESTS_PER_MINUTE = 20;

function checkSlidingRateLimit(uid: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const existing = (userMinuteTimestamps.get(uid) || []).filter((ts) => ts > windowStart);
  if (existing.length >= MAX_AI_REQUESTS_PER_MINUTE) {
    userMinuteTimestamps.set(uid, existing);
    return false;
  }
  existing.push(now);
  userMinuteTimestamps.set(uid, existing);
  return true;
}

async function enforceAiQuota(
  uid: string,
  bucket: UsageBucket,
  stripeConfigured: boolean,
  email?: string | null
): Promise<{ allowed: boolean; statusCode?: number; error?: string; code?: string; accountUsage?: any }> {
  if (!checkSlidingRateLimit(uid)) {
    return {
      allowed: false,
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Too many AI requests in the last minute. Please wait a few seconds before sending another request.',
    };
  }

  await syncUserStateFromAdminFirestore(uid);
  const summary = buildAccountUsageSummary(uid, stripeConfigured, email);

  if (bucket === 'coach' && summary.remaining.coachMessages <= 0) {
    return {
      allowed: false,
      statusCode: 429,
      code: 'QUOTA_EXCEEDED',
      error: `Monthly AI Coaching limit reached (${summary.limits.coachMessagesPerMonth}/${summary.limits.coachMessagesPerMonth} on ${summary.subscription.planName}). All saved diagnostics, CRM, ROI, and exports remain accessible—upgrade or wait for monthly reset to run more AI sessions.`,
      accountUsage: summary,
    };
  }
  if (bucket === 'documents' && summary.remaining.documentAudits <= 0) {
    return {
      allowed: false,
      statusCode: 429,
      code: 'QUOTA_EXCEEDED',
      error: `Monthly Document Intelligence limit reached (${summary.limits.documentAuditsPerMonth}/${summary.limits.documentAuditsPerMonth} on ${summary.subscription.planName}). Upgrade your plan to analyze additional files.`,
      accountUsage: summary,
    };
  }
  if (bucket === 'recommendations' && summary.remaining.recommendations <= 0) {
    return {
      allowed: false,
      statusCode: 429,
      code: 'QUOTA_EXCEEDED',
      error: `Monthly Diagnostic & Review limit reached (${summary.limits.recommendationsPerMonth}/${summary.limits.recommendationsPerMonth} on ${summary.subscription.planName}). Upgrade your plan to run additional diagnostics or monthly/quarterly AI reviews.`,
      accountUsage: summary,
    };
  }

  return { allowed: true, accountUsage: summary };
}

function recordAiUsage(uid: string, bucket: UsageBucket, usageMetadata?: any) {
  const userState = getOrInitUserState(uid);
  const monthKey = getCurrentMonthKey();
  const month = userState.monthlyUsage[monthKey];

  if (bucket === 'coach') month.coachMessages += 1;
  if (bucket === 'documents') month.documentAudits += 1;
  if (bucket === 'recommendations') month.recommendations += 1;

  const promptTokens = Number(usageMetadata?.promptTokenCount) || 0;
  const outputTokens = Number(usageMetadata?.candidatesTokenCount) || 0;
  const thinkingTokens = Number(usageMetadata?.thoughtsTokenCount) || 0;
  const totalTokens = Number(usageMetadata?.totalTokenCount) || promptTokens + outputTokens + thinkingTokens;

  // Conservative commercial blended rate estimate ($1.25 / 1M input, $5.00 / 1M output+thinking)
  const callCostUsd = (promptTokens / 1_000_000) * 1.25 + ((outputTokens + thinkingTokens) / 1_000_000) * 5.0;

  month.promptTokens += promptTokens;
  month.outputTokens += outputTokens;
  month.thinkingTokens += thinkingTokens;
  month.totalTokens += totalTokens;
  month.estimatedCostUsd += callCostUsd;
  month.requestCount += 1;
  userState.updatedAt = new Date().toISOString();

  saasStore.save();
  void persistUserStateToAdminFirestore(uid);
}

// ==========================================
// AUTH & CASE OWNERSHIP MIDDLEWARE
// ==========================================
async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Sign in is required before accessing executive coaching or document analysis.',
      code: 'AUTH_REQUIRED',
    });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    getOrInitUserState(decodedToken.uid, decodedToken.email);
    next();
  } catch (err: any) {
    console.error('Server Firebase ID token verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired session token. Please sign in again.',
      code: 'INVALID_TOKEN',
    });
  }
}

function toSafeApiError(
  err: any,
  fallbackMessage: string,
  defaultStatus = 500
): { status: number; message: string } {
  const statusCode = Number(err?.statusCode);
  const msg = String(err?.message || '');
  if (statusCode === 503 && msg.includes('GEMINI_API_KEY')) {
    return { status: 503, message: msg };
  }
  if (statusCode >= 400 && statusCode < 500 && msg) {
    return { status: statusCode, message: msg };
  }
  if (
    msg.includes('Unsupported file type') ||
    msg.includes('8 MB') ||
    msg.includes('appears to be empty')
  ) {
    return { status: 400, message: msg };
  }
  return {
    status: statusCode >= 500 && statusCode < 600 ? statusCode : defaultStatus,
    message: fallbackMessage,
  };
}

async function verifyCaseOwnership(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user?.uid) {
    return res.status(401).json({ error: 'Unauthorized: User identity missing.' });
  }

  const caseId = String(
    req.body?.caseId || req.params?.caseId || req.body?.businessProfile?.caseId || ''
  ).trim();

  if (!caseId) {
    return res.status(400).json({ error: 'Bad Request: A valid caseId is required for isolation.' });
  }

  if (req.body?.ownerUid && req.body.ownerUid !== req.user.uid) {
    return res.status(403).json({ error: 'Forbidden: Case access denied for this account.' });
  }

  if (caseId === 'case-demo-msp-nz') {
    return next();
  }

  // Enforce case ownership tracking across both Admin SDK mode and durable JSON store mode
  const state = saasStore.load();
  const existingOwner = state.caseOwners[caseId];
  if (existingOwner && existingOwner !== req.user.uid) {
    return res.status(403).json({
      error: 'Forbidden: This business case ID belongs to a different account.',
    });
  }

  if (hasAdminCredentials) {
    try {
      const docSnap = await adminDb
        .collection('users')
        .doc(req.user.uid)
        .collection('cases')
        .doc(caseId)
        .get();
      if (!docSnap.exists) {
        return res.status(403).json({
          error: 'Forbidden: Case record not found in your authenticated workspace.',
        });
      }
    } catch (err: any) {
      console.error('Firestore admin ownership verification failed:', err.message);
      return res.status(503).json({
        error: 'Unable to verify business case ownership right now. Please try again shortly.',
      });
    }
  }

  if (!existingOwner) {
    state.caseOwners[caseId] = req.user.uid;
    const u = getOrInitUserState(req.user.uid, req.user.email);
    if (!u.ownedCaseIds.includes(caseId)) {
      u.ownedCaseIds.push(caseId);
    }
    saasStore.save();
  }

  next();
}

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['.csv', '.txt', '.md', '.json', '.pdf', '.docx', '.xlsx', '.xls', '.png', '.jpg', '.jpeg']);
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB ceiling

async function extractDocumentContent(fileName: string, mimeType: string, base64Data: string): Promise<{
  textContent: string;
  inlinePart?: { inlineData: { mimeType: string; data: string } };
}> {
  const ext = path.extname(fileName || '').toLowerCase();
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new Error('Document exceeds the 8 MB upload limit.');
  }
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type (${ext || 'unknown'}). Allowed: CSV, TXT, MD, JSON, PDF, DOCX, XLSX, XLS, PNG, JPG.`);
  }

  if (ext === '.pdf') {
    let extractedPdfText = '';
    try {
      const zlib = await import('zlib');
      const rawLatin1 = buffer.toString('latin1');
      const textChunks: string[] = [];

      const extractOperatorsFromContent = (content: string) => {
        // Match PDF literal strings inside (...) before Tj/TJ or inside BT...ET blocks
        const literalMatches = content.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
        for (const m of literalMatches) {
          const decoded = m[1]
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\')
            .replace(/[^\x20-\x7E\u00A0-\u024F]/g, ' ')
            .trim();
          if (decoded.length >= 2 && /[A-Za-z0-9]/.test(decoded)) {
            textChunks.push(decoded);
          }
        }
      };

      // First scan uncompressed PDF content streams
      extractOperatorsFromContent(rawLatin1);

      // Also attempt inflating FlateDecode streams safely
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match: RegExpExecArray | null;
      let inspectedStreams = 0;
      while ((match = streamRegex.exec(rawLatin1)) !== null && inspectedStreams < 40) {
        inspectedStreams++;
        try {
          const rawStreamBuf = Buffer.from(match[1], 'latin1');
          const inflated = zlib.inflateSync(rawStreamBuf).toString('latin1');
          extractOperatorsFromContent(inflated);
        } catch {
          // Non-flate or image stream; safely skip and rely on Gemini multimodal inlinePart
        }
      }

      extractedPdfText = textChunks.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 60000);
    } catch {
      extractedPdfText = '';
    }

    return {
      textContent: extractedPdfText,
      inlinePart: {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data,
        },
      },
    };
  }

  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const safeMime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return {
      textContent: '',
      inlinePart: {
        inlineData: {
          mimeType: safeMime,
          data: base64Data,
        },
      },
    };
  }

  if (ext === '.docx') {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) {
      throw new Error('Could not read text body from DOCX archive.');
    }
    const stripped = docXml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<\/w:tc>/g, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { textContent: stripped.slice(0, 60000) };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetsText: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 6)) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheetsText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
    return { textContent: sheetsText.join('\n\n').slice(0, 60000) };
  }

  const decoded = buffer.toString('utf8').trim();
  if (!decoded) {
    throw new Error('The uploaded file appears to be empty.');
  }
  return { textContent: decoded.slice(0, 60000) };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const envPort = Number(process.env.PORT);
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT) || 3000;
  const PORT = isProduction
    ? (envPort || 3000)
    : (envPort && envPort !== 8080 ? envPort : defaultAppPort);

  app.use(
    express.json({
      limit: '12mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Lazy server-side Gemini Client with required telemetry header
  let aiClient: GoogleGenAI | null = null;
  function getAiClient(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  const stripe = isStripeConfiguredEnv
    ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' as any })
    : null;
  const isStripeConfigured = isStripeConfiguredEnv;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  // Gemini 4 Hydrogen helper with transient backoff & token/quota telemetry recording
  async function generateWithGemini4(
    params: { contents: any; config?: any },
    tracking?: { uid: string; bucket: UsageBucket }
  ): Promise<any> {
    if (!process.env.GEMINI_API_KEY) {
      throw Object.assign(
        new Error('GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.'),
        { statusCode: 503 }
      );
    }

    const cleanConfig = { ...(params.config || {}) };
    delete cleanConfig.temperature;
    delete cleanConfig.topP;
    delete cleanConfig.topK;
    delete cleanConfig.candidateCount;
    delete cleanConfig.thinkingConfig;

    const ai = getAiClient();
    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: params.contents,
          config: cleanConfig,
        });
        if (tracking) {
          recordAiUsage(tracking.uid, tracking.bucket, result?.usageMetadata);
        }
        return result;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isTransient =
          msg.includes('503') || msg.includes('500') || msg.includes('UNAVAILABLE') || msg.includes('ECONNRESET');
        if (!isTransient || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  function buildDynamicSystemInstruction(
    profile: any,
    healthInputs: any,
    financials: any,
    overallHealth: any,
    uploadedDocuments?: any[],
    crmContacts?: any[],
    roiScenarios?: any[],
    recommendations?: any,
    actionPlan?: any[],
    crossDocumentSynthesis?: any,
    continuity?: any
  ): string {
    const businessName = profile?.name || 'Client SME';
    const industry = profile?.industry || 'Small & Medium Enterprise';
    const businessType = profile?.businessType || 'Privately-owned business';
    const country = profile?.country || 'New Zealand';
    const currency = profile?.currency || 'NZD';
    const turnoverRange = profile?.turnoverRange || 'Not specified';
    const staff = `${profile?.employeeCount ?? 'Unspecified'} employees and ${profile?.subcontractorCount ?? '0'} subcontractors`;
    const primaryObjective = profile?.primaryObjective || 'Improve profitability, cash flow, and operational resilience';
    const primaryConcern = profile?.primaryConcern || 'Unspecified commercial pressure';
    const productsServices = profile?.mainProductsServices || 'General products/services';
    const customerTypes = profile?.mainCustomerTypes || 'General clients';

    let healthSummary = 'TWELVE BUSINESS HEALTH CAPABILITIES (Owner-Reported):\n';
    if (healthInputs && typeof healthInputs === 'object') {
      for (const [key, val] of Object.entries<any>(healthInputs)) {
        const evidenceLabel = val.evidenceType ? ` | Evidence: ${val.evidenceType}` : '';
        healthSummary += `- ${val.title || key}: Status=${val.status || 'unanswered'}${evidenceLabel}. Notes: ${val.notes || 'None provided'}\n`;
      }
    } else {
      healthSummary += 'Health capabilities not yet completed by owner.\n';
    }

    if (Array.isArray(overallHealth?.dimensionScores) && overallHealth.dimensionScores.length > 0) {
      const missingDims = overallHealth.dimensionScores
        .filter((d: any) => d.status === 'not_sure' || d.status === 'unanswered')
        .map((d: any) => d.title);
      const riskDims = overallHealth.dimensionScores
        .filter((d: any) => d.status === 'at_risk')
        .map((d: any) => `${d.title} (${d.score ?? 'N/A'}/100)`);
      if (riskDims.length > 0) {
        healthSummary += `CONFIRMED AT-RISK CAPABILITIES: ${riskDims.join('; ')}\n`;
      }
      if (missingDims.length > 0) {
        healthSummary += `INSUFFICIENT INFO / UNVERIFIED CAPABILITIES (DO NOT CONFUSE WITH CONFIRMED RISK): ${missingDims.join('; ')}\n`;
      }
    }

    if (Array.isArray(overallHealth?.topThreePriorities) && overallHealth.topThreePriorities.length > 0) {
      healthSummary += 'TOP 3 DETERMINISTIC IMPROVEMENT PRIORITIES:\n';
      for (const p of overallHealth.topThreePriorities) {
        healthSummary += `  #${p.rank} ${p.title} (${p.status}): ${p.rationale} -> Focus: ${p.recommendedFocus}\n`;
      }
    }

    const fmtNum = (n: any) => (n !== null && n !== undefined && n !== '' && !Number.isNaN(Number(n)) ? `${currency} ${Number(n).toLocaleString()}` : 'Not supplied');
    const fmtPct = (n: any) => (n !== null && n !== undefined && n !== '' && !Number.isNaN(Number(n)) ? `${Number(n)}%` : 'Not supplied');
    const fmtDays = (n: any) => (n !== null && n !== undefined && n !== '' && !Number.isNaN(Number(n)) ? `${Number(n)} days` : 'Not supplied');

    let financialSummary = 'FINANCIAL LEDGER INPUTS (16 Core Fields):\n';
    if (
      financials &&
      Object.values(financials).some((v) => v !== null && v !== undefined && v !== '')
    ) {
      financialSummary += `- Annual Revenue: ${fmtNum(financials.annualRevenue)} | Direct Costs: ${fmtNum(financials.directCosts)} | Operating Expenses: ${fmtNum(financials.operatingExpenses)} | Operating Profit: ${fmtNum(financials.operatingProfit)}\n`;
      financialSummary += `- Cash in Bank: ${fmtNum(financials.cashInBank)} | Accounts Receivable: ${fmtNum(financials.accountsReceivable)} | Overdue >60d: ${fmtNum(financials.overdueReceivables)} | Accounts Payable: ${fmtNum(financials.accountsPayable)}\n`;
      financialSummary += `- Credit Facility Limit: ${fmtNum(financials.creditFacilityLimit)} | Credit Facility Drawn: ${fmtNum(financials.creditFacilityUsed)}\n`;
      financialSummary += `- Customer Count: ${financials.customerCount ?? 'Not supplied'} | Top-5 Concentration: ${fmtPct(financials.top5ConcentrationPercent)} | Top-12 Concentration: ${fmtPct(financials.top12ConcentrationPercent)}\n`;
      financialSummary += `- Standard Payment Terms: ${fmtDays(financials.standardPaymentTermsDays)} | Actual Payment Delay: ${fmtDays(financials.actualPaymentDelayDays)} | Years Since Pricing Review: ${financials.pricingReviewLastYears ?? 'Not supplied'}\n`;
    } else {
      financialSummary += 'No quantitative financial ledger figures supplied yet by owner. NEVER invent or estimate missing numbers.\n';
    }

    let docsSummary = 'UPLOADED BUSINESS DOCUMENTS (Verified vs Assumed):\n';
    if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
      for (const docItem of uploadedDocuments.slice(0, 6)) {
        docsSummary += `- Document "${docItem.fileName}" (${docItem.uploadedAt}): Summary: ${docItem.summary}. Verified Facts: ${(docItem.verifiedFacts || []).slice(0, 4).join('; ')}. Missing Figures: ${(docItem.missingFinancialFigures || []).slice(0, 3).join('; ')}\n`;
      }
      if (crossDocumentSynthesis?.summary) {
        docsSummary += `- Cross-Document Synthesis: ${crossDocumentSynthesis.summary}\n  Trends: ${(crossDocumentSynthesis.trends || []).slice(0, 3).join('; ')}\n  Unusual Movements: ${(crossDocumentSynthesis.unusualMovements || []).slice(0, 3).join('; ')}\n`;
      }
    } else {
      docsSummary += 'No supporting documents uploaded yet.\n';
    }

    let crmSummary = 'CRM & SALES PIPELINE SUMMARY:\n';
    if (Array.isArray(crmContacts) && crmContacts.length > 0) {
      const openPipeline = crmContacts
        .filter((c) => c.salesStage !== 'Won' && c.salesStage !== 'Lost')
        .reduce((acc, c) => acc + (Number(c.opportunityValue) || 0), 0);
      const activeMonthly = crmContacts
        .filter((c) => c.status !== 'Closed Lost')
        .reduce((acc, c) => acc + (Number(c.monthlyValue) || 0), 0);
      const todayIso = new Date().toISOString().slice(0, 10);
      const dueOrRisk = crmContacts.filter(
        (c) =>
          c.status === 'At Risk' ||
          c.status === 'Follow-Up Due' ||
          (c.nextFollowUpDate && c.nextFollowUpDate <= todayIso && c.salesStage !== 'Lost')
      );
      crmSummary += `- Total CRM Records: ${crmContacts.length} | Open Pipeline Opportunity Value: ${currency} ${openPipeline.toLocaleString()} | Active Monthly Recurring Base: ${currency} ${activeMonthly.toLocaleString()}/mo | Follow-Ups Due or At Risk: ${dueOrRisk.length}\n`;
      for (const c of crmContacts.slice(0, 8)) {
        crmSummary += `  • [ID:${c.id}] ${c.companyOrName} (${c.recordType}, Tier: ${c.tier}, Stage: ${c.salesStage}, Status: ${c.status}, Opp: ${currency} ${Number(c.opportunityValue || 0).toLocaleString()}, Monthly: ${currency} ${Number(c.monthlyValue || 0).toLocaleString()}, Follow-up: ${c.nextFollowUpDate || 'Unscheduled'}): ${c.notes || 'No notes'}\n`;
      }
    } else {
      crmSummary += 'No CRM customer or prospect records entered yet.\n';
    }

    let roiSummary = 'ROI & FINANCIAL SCENARIOS:\n';
    if (Array.isArray(roiScenarios) && roiScenarios.length > 0) {
      for (const s of roiScenarios.slice(0, 6)) {
        const monthlyMargin = (Number(s.expectedMonthlyRevenue) || 0) * ((Number(s.grossMarginPct) || 0) / 100);
        const monthlyNet = monthlyMargin - (Number(s.monthlyOperatingCost) || 0);
        const horizon = Math.max(1, Number(s.monthsHorizon) || 12);
        const netBenefit = monthlyNet * horizon - (Number(s.upfrontInvestment) || 0);
        roiSummary += `  • Scenario "${s.name}" (${s.category}${s.linkedCrmLabel ? `, Linked CRM: ${s.linkedCrmLabel}` : ''}): Upfront=${currency} ${Number(s.upfrontInvestment || 0).toLocaleString()}, MonthlyRev=${currency} ${Number(s.expectedMonthlyRevenue || 0).toLocaleString()}, GM=${s.grossMarginPct}%, MonthlyCost=${currency} ${Number(s.monthlyOperatingCost || 0).toLocaleString()}, ${horizon}m Net Benefit=${currency} ${Math.round(netBenefit).toLocaleString()}, Confidence=${s.confidencePct}%\n`;
      }
    } else {
      roiSummary += 'No custom ROI scenarios modeled yet.\n';
    }

    let recommendationsSummary = 'EXISTING DIAGNOSTIC RECOMMENDATIONS, PROFIT OPPORTUNITIES & SUSTAINABILITY:\n';
    if (recommendations && (recommendations.initialObservation || recommendations.initialRecommendation)) {
      recommendationsSummary += `- Observation: ${recommendations.initialObservation || 'N/A'}\n`;
      recommendationsSummary += `- Commercial Why: ${recommendations.commercialWhy || 'N/A'}\n`;
      recommendationsSummary += `- Core Recommendation: ${recommendations.initialRecommendation || 'N/A'}\n`;
      recommendationsSummary += `- Immediate Action: ${recommendations.immediateAction || 'N/A'}\n`;
      if (Array.isArray(recommendations.profitOpportunities) && recommendations.profitOpportunities.length > 0) {
        recommendationsSummary += `- Structured Profit Opportunities (${recommendations.profitOpportunities.length}): ${recommendations.profitOpportunities.slice(0, 6).map((o: any) => `${o.title} [${o.horizon}, ${o.area}]`).join('; ')}\n`;
      }
      if (recommendations.sustainabilityAssessment) {
        const sust = recommendations.sustainabilityAssessment;
        const weakAreas = (sust.areas || [])
          .filter((a: any) => a.status === 'At Risk' || a.status === 'Needs Attention')
          .map((a: any) => `${a.area} (${a.status})`)
          .join(', ');
        recommendationsSummary += `- Sustainability & Business Choice: Recommended Choice=${sust.recommendedChoice || 'Stabilise'}. Current Position: ${sust.currentPosition || 'N/A'}. Outlook: ${sust.futureOutlook || 'N/A'}.${weakAreas ? ` Flagged Areas: ${weakAreas}.` : ''}\n`;
      }
      if (recommendations.knownsVsAssumptions) {
        recommendationsSummary += `- Flagged Assumptions: ${(recommendations.knownsVsAssumptions.assumptions || []).slice(0, 4).join('; ') || 'None'}\n`;
        recommendationsSummary += `- Missing Unknowns: ${(recommendations.knownsVsAssumptions.unknowns || []).slice(0, 4).join('; ') || 'None'}\n`;
      }
    } else {
      recommendationsSummary += 'No diagnostic recommendation generated yet.\n';
    }

    let actionPlanSummary = '30/60/90-DAY ACTION & ACCOUNTABILITY STATUS:\n';
    if (Array.isArray(actionPlan) && actionPlan.length > 0) {
      const completedCount = actionPlan.filter((a) => a.completed || a.status === 'completed').length;
      const acceptedCount = actionPlan.filter((a) => a.decisionStatus === 'accepted').length;
      const urgentPending = actionPlan
        .filter((a) => !a.completed && a.status !== 'completed' && a.decisionStatus !== 'rejected')
        .slice(0, 6);
      actionPlanSummary += `- Total Planned Actions: ${actionPlan.length} (${completedCount} completed, ${acceptedCount} accepted)\n`;
      for (const act of urgentPending) {
        actionPlanSummary += `  • [${act.horizon || '30 Days'} | ${act.priority || 'Action'} | Status: ${act.status || 'pending'} | Decision: ${act.decisionStatus || 'pending_review'}${act.metricLink ? ` | Metric: ${act.metricLink}` : ''}] ${act.action} (Owner: ${act.accountableRole || 'Owner'}, Due: ${act.targetCompletionDate || act.timeframe || 'TBD'}${act.actualResult ? `, Actual Result: ${act.actualResult}` : ''})\n`;
      }
    } else {
      actionPlanSummary += 'No 30/60/90-day action plan tasks saved yet.\n';
    }

    let continuitySummary = 'MEMBERSHIP CONTINUITY & PROGRESS HISTORY:\n';
    if (continuity && typeof continuity === 'object') {
      if (continuity.joiningBaseline) {
        const b = continuity.joiningBaseline;
        continuitySummary += `- Joining Baseline (${String(b.capturedAt || '').slice(0, 10)}): Starting Health=${b.snapshot?.healthScore ?? 'Pending'}/100 (${b.snapshot?.healthRating || 'Pending'}), Starting Cash=${fmtNum(b.snapshot?.cashInBank)}, Overdue AR=${fmtNum(b.snapshot?.overdueReceivables)}, Initial Concern="${b.primaryConcern || 'N/A'}"\n`;
      }
      if (Array.isArray(continuity.weeklyPulses) && continuity.weeklyPulses.length > 0) {
        const latestWp = continuity.weeklyPulses[0];
        continuitySummary += `- Latest Weekly Pulse (${latestWp.weekOf}): Health=${latestWp.snapshot?.healthScore ?? 'Pending'}/100, Actions Done=${latestWp.snapshot?.actionsCompleted ?? 0}/${latestWp.snapshot?.actionsTotal ?? 0}. Concerns: ${(latestWp.emergingConcerns || []).slice(0, 2).join('; ') || 'None logged'}. Next Priorities: ${(latestWp.nextWeekPriorities || []).slice(0, 3).join('; ') || 'None'}\n`;
      }
      if (Array.isArray(continuity.monthlyReviews) && continuity.monthlyReviews.length > 0) {
        const latestMr = continuity.monthlyReviews[0];
        continuitySummary += `- Latest Monthly Review (${latestMr.reviewMonth}): ${latestMr.executiveSummary || 'Saved'}. Unresolved: ${(latestMr.comparisonToBaseline?.unresolvedIssues || []).slice(0, 3).join('; ') || 'None'}\n`;
      }
      if (Array.isArray(continuity.quarterlyReviews) && continuity.quarterlyReviews.length > 0) {
        const latestQr = continuity.quarterlyReviews[0];
        continuitySummary += `- Latest Quarterly Sustainability (${latestQr.quarterLabel}): Trend=${latestQr.resilienceTrend}, Choice=${latestQr.strategicChoice}.\n`;
      }
      if (
        !continuity.joiningBaseline &&
        (!continuity.weeklyPulses || continuity.weeklyPulses.length === 0) &&
        (!continuity.monthlyReviews || continuity.monthlyReviews.length === 0)
      ) {
        continuitySummary += 'No joining baseline or periodic pulse/review history recorded yet.\n';
      }
    } else {
      continuitySummary += 'No continuity history saved yet.\n';
    }

    return `
You are a seasoned, welcoming yet commercially sharp SME business coach, financial analyst, and turnaround adviser.
You are advising the owner of "${businessName}", an SME operating in the "${industry}" sector (${country}).

ACTIVE BUSINESS CONTEXT:
- Business Name: ${businessName}
- Industry: ${industry} (${businessType})
- Location: ${country} | Currency: ${currency} | Annual Turnover Range: ${turnoverRange}
- Team Size: ${staff}
- Products & Services: ${productsServices}
- Customer Base: ${customerTypes}
- Primary Objective: ${primaryObjective}
- Stated Primary Concern: ${primaryConcern}
- Overall Health Score: ${overallHealth?.overallScore ?? 'Pending'} / 100 (${overallHealth?.overallRating ?? 'Pending Assessment'} | Data Visibility: ${overallHealth?.dataVisibilityScore ?? 'N/A'}%)

${healthSummary}
${financialSummary}
${docsSummary}
${crmSummary}
${roiSummary}
${recommendationsSummary}
${actionPlanSummary}
${continuitySummary}

COACHING & EVIDENCE RULES:
1. Context Fidelity: Tailor all advice strictly to "${businessName}" (${industry}, ${country}, ${currency}, ${staff}, Turnover: ${turnoverRange}). Never assume it is an IT MSP unless industry is IT & Managed Services.
2. Evidence Discipline: Explicitly distinguish Verified Evidence, Owner-Reported Information, Working Assumptions, and Unknowns / Missing Data (Insufficient Information).
3. Zero Fabricated Numbers: NEVER invent revenue, profit, cash, debtor, or percentage figures not supplied in the profile, financials, notes, CRM, ROI scenarios, or uploaded documents. If figures are missing, state clearly what figure is needed.
4. Connected Integration: Connect 12-Capability Health findings, Sustainability Choice, Continuity Progress, and Top 3 Priorities directly to Revenue/Profit Opportunities, CRM priorities (retention, collections, follow-ups), ROI payback & cash headroom, and accountable 30/60/90-day actions.
5. Specialist Triggers: Note clearly whenever a Chartered Accountant, commercial lawyer, HR/employment adviser, or banker should review decisions.
6. Anti-Repetition & Memory: NEVER re-ask for facts, numbers, team sizes, CRM accounts, or capability notes already provided in this context or earlier in the conversation—reference supplied facts directly and move straight to commercial analysis or genuinely missing gaps.
`;
  }

  // ==========================================
  // ACCOUNT USAGE, QUOTA & DELETION ENDPOINTS
  // ==========================================
  app.get('/api/account/usage', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      await syncUserStateFromAdminFirestore(uid);
      return res.json({ accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email) });
    } catch (err: any) {
      console.error('Account usage read error:', err);
      const safe = toSafeApiError(err, 'Unable to load account usage summary.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.get('/api/admin/metrics', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isAdminEmail(req.user?.email)) {
      return res.status(403).json({ error: 'Forbidden: Founder/Admin access required.' });
    }
    return res.json({
      adminMetrics: saasStore.buildAdminMetricsSummary(),
    });
  });

  app.post('/api/account/check-case-limit', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      await syncUserStateFromAdminFirestore(uid);
      const summary = buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email);

      const clientCustomIds = Array.isArray(req.body?.customCaseIds)
        ? req.body.customCaseIds
            .map((id: any) => String(id || '').trim())
            .filter((id: string) => id && id !== 'case-demo-msp-nz')
        : [];
      const clientCount = Math.max(0, Number(req.body?.currentCustomCaseCount) || 0, clientCustomIds.length);

      let authoritativeCount = clientCount;
      if (hasAdminCredentials) {
        const casesSnap = await adminDb.collection('users').doc(uid).collection('cases').get();
        const serverCustomCases = casesSnap.docs.filter((d) => {
          const data = d.data() || {};
          return d.id !== 'case-demo-msp-nz' && !data?.profile?.isDemonstrationCase;
        });
        authoritativeCount = serverCustomCases.length;
      } else {
        const userState = getOrInitUserState(uid, req.user?.email);
        const serverTrackedNonDemo = (userState.ownedCaseIds || []).filter(
          (id) => id && id !== 'case-demo-msp-nz'
        );
        authoritativeCount = Math.max(clientCount, serverTrackedNonDemo.length);
      }

      const allowed = authoritativeCount < summary.limits.maxCustomCases;
      return res.json({
        allowed,
        currentCustomCaseCount: authoritativeCount,
        maxCustomCases: summary.limits.maxCustomCases,
        planName: summary.subscription.planName,
        accountUsage: summary,
      });
    } catch (err: any) {
      console.error('Case limit check error:', err);
      const safe = toSafeApiError(err, 'Unable to verify business session limit.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.post('/api/account/delete', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const userState = getOrInitUserState(uid, req.user?.email);

      // Cancel active Stripe subscription immediately if present
      if (stripe && isStripeConfigured && userState.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(userState.stripeSubscriptionId);
        } catch (stripeErr: any) {
          console.warn('Stripe cancellation during account delete notice:', stripeErr.message);
        }
      }

      // Purge server-side state and owned case tracking
      const state = saasStore.load();
      for (const cid of userState.ownedCaseIds || []) {
        if (state.caseOwners[cid] === uid) {
          delete state.caseOwners[cid];
        }
      }
      delete state.users[uid];
      saasStore.save();

      // If Admin SDK credentials are configured, wipe Firestore subcollections + Auth record cleanly
      if (hasAdminCredentials) {
        try {
          const casesSnap = await adminDb.collection('users').doc(uid).collection('cases').get();
          for (const docSnap of casesSnap.docs) {
            await docSnap.ref.delete();
          }
          await adminDb.collection('users').doc(uid).collection('account').doc('billing').delete().catch(() => {});
          await adminDb.collection('users').doc(uid).delete().catch(() => {});
          await adminAuth.deleteUser(uid).catch(() => {});
        } catch (adminErr: any) {
          console.warn('Admin account cleanup notice:', adminErr.message);
        }
      }

      return res.json({ deleted: true });
    } catch (err: any) {
      console.error('Account deletion error:', err);
      const safe = toSafeApiError(err, 'Failed to delete server-side account state.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // ==========================================
  // STRIPE ACCOUNT-LEVEL SAAS BILLING ENDPOINTS
  // ==========================================
  app.post('/api/payment/create-checkout-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { caseId, businessName, userEmail, tierId } = req.body;
      const uid = req.user!.uid;
      const canonicalTier = normalizeTierId(tierId);
      if (canonicalTier === 'free_trial') {
        return res.status(400).json({ error: 'Please select Starter, Growth, or Business Plus for paid checkout.' });
      }

      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({
          error: 'Live billing is not configured on this server (STRIPE_SECRET_KEY missing). No charges will be made.',
          configured: false,
        });
      }

      const plan = SAAS_PLANS[canonicalTier];
      const appBaseUrl = process.env.APP_URL || req.headers.origin || `http://localhost:${PORT}`;
      const enforcedCurrency = 'nzd';
      const amountCents = plan.priceMonthlyNzd * 100;
      const customerEmail = userEmail || req.user?.email || undefined;
      const userState = getOrInitUserState(uid, customerEmail);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ...(userState.stripeCustomerId ? { customer: userState.stripeCustomerId } : { customer_email: customerEmail }),
        line_items: [
          {
            price_data: {
              currency: enforcedCurrency,
              recurring: { interval: 'month' },
              product_data: {
                name: `BizPulse ${plan.planName} Monthly`,
                description: plan.description,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            userId: uid,
            tierId: canonicalTier,
          },
        },
        metadata: {
          caseId: caseId || '',
          userId: uid,
          businessName: businessName || 'SME Account',
          tierId: canonicalTier,
        },
        success_url: `${appBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&case_id=${encodeURIComponent(caseId || '')}&payment=success`,
        cancel_url: `${appBaseUrl}/?case_id=${encodeURIComponent(caseId || '')}&payment=cancelled`,
      } as any);

      return res.json({
        sessionId: session.id,
        checkoutUrl: session.url,
        mode: stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test',
        configured: true,
      });
    } catch (err: any) {
      console.error('Stripe Session Creation Error:', err);
      const safe = toSafeApiError(err, 'Error creating checkout session.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.post('/api/payment/verify-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, caseId } = req.body;
      const uid = req.user!.uid;
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }
      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({ error: 'Stripe is not configured on this server.' });
      }
      if (!sessionId.startsWith('cs_') || sessionId.startsWith('cs_sandbox_')) {
        return res.status(400).json({ error: 'Invalid checkout session ID format.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.mode === 'subscription' && session.payment_status === 'paid') {
        if (session.metadata?.userId && session.metadata.userId !== uid) {
          return res.status(403).json({ error: 'Payment session belongs to another authenticated account.' });
        }

        const canonicalTier = normalizeTierId(session.metadata?.tierId || 'starter_monthly');
        const plan = SAAS_PLANS[canonicalTier];
        const userState = getOrInitUserState(uid, session.customer_details?.email || req.user?.email);
        userState.subscriptionTier = canonicalTier;
        userState.subscriptionStatus = 'active';
        if (typeof session.customer === 'string') userState.stripeCustomerId = session.customer;
        if (typeof session.subscription === 'string') {
          userState.stripeSubscriptionId = session.subscription;
          try {
            const sub: any = await stripe.subscriptions.retrieve(session.subscription);
            if (sub?.current_period_end) {
              userState.currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
            }
          } catch {}
        }
        userState.updatedAt = new Date().toISOString();
        saasStore.save();
        await persistUserStateToAdminFirestore(uid);

        const record = {
          sessionId: session.id,
          caseId: caseId || session.metadata?.caseId || '',
          amount: (session.amount_total || plan.priceMonthlyNzd * 100) / 100,
          currency: (session.currency || 'nzd').toUpperCase(),
          status: 'paid' as const,
          tier: `BizPulse ${plan.planName} Monthly`,
          unlockedAt: new Date().toISOString(),
          customerEmail: session.customer_details?.email || undefined,
          paymentMode: (stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test') as
            | 'stripe_live'
            | 'stripe_test',
        };

        return res.json({
          paid: true,
          record,
          tierId: canonicalTier,
          accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
        });
      }
      return res.json({ paid: false, status: session.payment_status });
    } catch (err: any) {
      console.error('Session Verification Error:', err);
      const safe = toSafeApiError(err, 'Error verifying checkout session.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.post('/api/payment/create-portal-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({ error: 'Stripe billing portal is not available until live/test Stripe keys are configured.' });
      }
      await syncUserStateFromAdminFirestore(uid);
      const userState = getOrInitUserState(uid, req.user?.email);
      if (!userState.stripeCustomerId) {
        return res.status(400).json({ error: 'No active Stripe customer profile found for this account yet.' });
      }
      const returnUrl = process.env.APP_URL || req.headers.origin || `http://localhost:${PORT}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: userState.stripeCustomerId,
        return_url: returnUrl,
      });
      return res.json({ portalUrl: portalSession.url });
    } catch (err: any) {
      console.error('Billing Portal Error:', err);
      const safe = toSafeApiError(err, 'Unable to create billing portal session.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.post('/api/payment/cancel-subscription', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      await syncUserStateFromAdminFirestore(uid);
      const userState = getOrInitUserState(uid, req.user?.email);

      if (stripe && isStripeConfigured && userState.stripeSubscriptionId) {
        const sub: any = await stripe.subscriptions.update(userState.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        userState.subscriptionStatus = 'canceling';
        if (sub?.current_period_end) {
          userState.currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
      } else {
        userState.subscriptionTier = 'free_trial';
        userState.subscriptionStatus = 'canceled';
      }

      userState.updatedAt = new Date().toISOString();
      saasStore.save();
      await persistUserStateToAdminFirestore(uid);

      return res.json({
        canceled: true,
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
      });
    } catch (err: any) {
      console.error('Subscription Cancellation Error:', err);
      const safe = toSafeApiError(err, 'Unable to cancel subscription.');
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.post('/api/payment/webhook', async (req: any, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any;

    if (!stripe || !isStripeConfigured) {
      return res.status(503).json({ error: 'Stripe is not configured.' });
    }

    if (webhookSecret && webhookSecret !== 'whsec_placeholder_secret') {
      const sig = req.headers['stripe-signature'];
      if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });
      try {
        event = stripe.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, webhookSecret);
      } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      if (isProduction) return res.status(400).json({ error: 'Webhook secret required in production.' });
      event = req.body;
    }

    if (!event || !event.type) return res.status(400).json({ error: 'Invalid webhook payload' });

    if (hasAdminCredentials && event.id) {
      try {
        const evtRef = adminDb.collection('stripeWebhookEvents').doc(String(event.id));
        const existingEvt = await evtRef.get();
        if (existingEvt.exists) {
          return res.json({ received: true, idempotentDuplicate: true });
        }
        await evtRef.set({ type: event.type, processedAt: new Date().toISOString() });
      } catch (err: any) {
        console.warn('Firestore webhook idempotency notice:', err.message);
      }
    }

    const result = saasStore.applyStripeWebhookEvent(event);
    if (result.duplicate) {
      return res.json({ received: true, idempotentDuplicate: true });
    }
    if (result.affectedUid) {
      await persistUserStateToAdminFirestore(result.affectedUid);
    }

    return res.json({ received: true, handled: result.handled });
  });

  app.get('/api/payment/status/:caseId', requireAuth, verifyCaseOwnership, (req: AuthenticatedRequest, res) => {
    const summary = buildAccountUsageSummary(req.user!.uid, isStripeConfigured, req.user?.email);
    const isPaid = summary.subscription.tierId !== 'free_trial' && summary.subscription.status !== 'canceled';
    return res.json({
      isUnlocked: isPaid,
      paymentStatus: isPaid ? 'paid' : 'free',
      accountUsage: summary,
    });
  });

  // ==========================================
  // COACH, DIAGNOSTIC & DOCUMENT ANALYSIS ENDPOINTS
  // ==========================================

  // 1. Live Conversational AI Business Coach Query ("Chat with Coach")
  app.post('/api/coach/query', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'coach', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        prompt,
        conversationHistory,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        continuity,
        userRole,
        topic,
      } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'A coaching question or prompt is required.' });
      }
      if (prompt.length > 8000) {
        return res.status(400).json({ error: 'Prompt exceeds maximum allowed length (8,000 characters).' });
      }

      const systemInstruction =
        buildDynamicSystemInstruction(
          businessProfile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
          recommendations,
          actionPlan,
          crossDocumentSynthesis,
          continuity
        ) +
        `\nCHAT WITH COACH CONVERSATION PROTOCOL:
Speaking with: ${userRole || 'Owner/Director'}. Active Focus Topic: ${topic || 'General Strategy'}.
- Engage in genuine two-way commercial coaching. If the owner disagrees with an earlier recommendation, questions an assumption, or proposes a new idea, address their reasoning directly, weigh risks/margins/cash flow/ROI, and be willing to refine or respectfully push back.
- Ask 1–2 targeted clarifying follow-up questions when key context is missing or before locking in a major decision, rather than immediately producing a generic essay.
- Clearly isolate any AI estimates, rules-of-thumb, or working assumptions in the "estimatesAndAssumptions" array so the owner never confuses an estimate with verified ledger data.
- Whenever the discussion surfaces concrete next steps or client/lead follow-ups, include 1–3 structured items in "suggestedActions" (using targetType: "crm_followup" for customer/prospect outreach or collections, and "action_plan" for internal operational/financial tasks).
Return strictly valid JSON matching the schema.`;

      const contentsTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      if (Array.isArray(conversationHistory)) {
        const recentHistory = conversationHistory
          .filter((m: any) => m && typeof m.text === 'string' && m.text.trim().length > 0 && m.id !== 'm-0' && m.id !== 'm-reset')
          .slice(-14);
        for (const msg of recentHistory) {
          const role: 'user' | 'model' = msg.sender === 'user' ? 'user' : 'model';
          if (contentsTurns.length === 0 && role === 'model') continue;
          const prev = contentsTurns[contentsTurns.length - 1];
          if (prev && prev.role === role) {
            prev.parts[0].text += `\n\n${msg.text.trim()}`;
          } else {
            contentsTurns.push({ role, parts: [{ text: msg.text.trim() }] });
          }
        }
      }

      const lastTurn = contentsTurns[contentsTurns.length - 1];
      if (lastTurn && lastTurn.role === 'user') {
        lastTurn.parts[0].text += `\n\n${prompt.trim()}`;
      } else {
        contentsTurns.push({ role: 'user', parts: [{ text: prompt.trim() }] });
      }

      const response = await generateWithGemini4(
        {
          contents: contentsTurns,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                estimatesAndAssumptions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                followUpQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                suggestedActions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      ownerRole: { type: Type.STRING },
                      priority: { type: Type.STRING },
                      timeframe: { type: Type.STRING },
                      targetType: { type: Type.STRING },
                    },
                    required: ['id', 'title', 'ownerRole', 'priority', 'timeframe', 'targetType'],
                  },
                },
              },
              required: ['reply', 'estimatesAndAssumptions', 'followUpQuestions', 'suggestedActions'],
            },
          },
        },
        { uid, bucket: 'coach' }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      const normalizePriority = (raw?: string): 'Priority 1 (Urgent)' | 'Priority 2 (High)' | 'Priority 3 (Medium)' => {
        if (raw && raw.includes('1')) return 'Priority 1 (Urgent)';
        if (raw && raw.includes('2')) return 'Priority 2 (High)';
        return 'Priority 3 (Medium)';
      };

      const suggestedActions = Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions.map((act: any, idx: number) => ({
            id: act.id || `ca-${Date.now()}-${idx}`,
            title: String(act.title || 'Follow-up task'),
            ownerRole: String(act.ownerRole || 'Owner'),
            priority: normalizePriority(String(act.priority || '')),
            timeframe: String(act.timeframe || 'Within 7 days'),
            targetType: act.targetType === 'crm_followup' ? 'crm_followup' : 'action_plan',
            savedToPlan: false,
          }))
        : [];

      return res.json({
        reply: parsed.reply || 'No response text generated.',
        estimatesAndAssumptions: Array.isArray(parsed.estimatesAndAssumptions) ? parsed.estimatesAndAssumptions : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
        suggestedActions,
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Gemini Coaching Error:', err);
      const safe = toSafeApiError(err, 'Unable to reach AI Coach service.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 2. Dynamic Structured Recommendation & 12-Area Profit Opportunity Engine
  app.post('/api/coach/generate-recommendation', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'recommendations', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        actionPlan,
        continuity,
      } = req.body;

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        null,
        actionPlan,
        crossDocumentSynthesis,
        continuity
      );

      const prompt = `
Analyze the business profile (including turnoverRange), Top 3 Improvement Priorities, 12 Business Health Capabilities, financial ledger inputs (16 fields), uploaded documents/synthesis, CRM pipeline, and ROI scenarios.
Produce a tailored SME Revenue, Margin, Profit Leakage, & Sustainability Diagnostic matching every requirement:
1. Initial commercial observation grounded in actual answers.
2. Commercial rationale explaining impact on cash flow, profitability, and capacity.
3. Sustainability risks (2–4 concrete risks specific to this business).
4. sustainabilityAssessment: Structured "Business Sustainability & Future Earning Potential" covering:
   - currentPositionSummary: honest plain-language summary of current cash, margin, workload, and operational resilience.
   - futureOutlook6to12Months: realistic 6–12 month trajectory if nothing changes vs if priority actions execute.
   - recommendedChoice: MUST be strictly one of "Stabilise", "Improve", "Expand", "Restructure", or "Reconsider".
   - choiceRationale: why this strategic choice fits the evidence (no hype, no false certainty).
   - areas: evaluate ALL 10 sustainability dimensions:
     1) Owner Workload, Burnout & Single-Point Failure
     2) Cash Resilience & Liquidity Stress
     3) Profit Durability & Margin Erosion
     4) Customer & Revenue Concentration
     5) Staff Capability, Retention & Key-Person Risk
     6) Operational Reliability & Scalability
     7) Market Demand & Competition
     8) Pricing Power
     9) Tech, Automation & AI Readiness
     10) Compliance & Financial-Control Risk
     For each: { area, status ("green" | "amber" | "red" | "blue" where blue = insufficient information), assessment, keyDriverOrGap }.
   - keyAssumptions: explicit assumptions behind the sustainability assessment.
   - disclaimer: "Commercial decision-support only — not formal business valuation, tax, legal, or insolvency advice."
5. Hidden profit opportunities (2–4 concise summaries).
6. Revenue flow improvements (2–4 cash collection, billing cadence, or recurring structure improvements).
7. profitOpportunities (6–12 structured opportunities evaluating ALL 16 SME profit & revenue leakage areas and surfacing the highest-value ones):
   1. Pricing Too Low | 2. Unbilled Extra or Out-of-Scope Work | 3. Weak Quoting or Low Win Rates | 4. Slow Invoicing or Late Collections |
   5. Poor Margin Tracking | 6. Unprofitable or Low-Value Customers | 7. Excessive Discounting | 8. Ineffective Marketing or Poor Lead Follow-Up |
   9. High Employee or Contractor Rework | 10. Inefficient Scheduling or Idle Capacity | 11. Poor Inventory or Supplier Cost Control |
   12. Lack of Repeat Business / Upsell / Cross-Sell | 13. Over-Reliance on 1–2 Big Customers or Channels | 14. Software or Admin Duplication |
   15. Missed AI / Automation Time Savings | 16. Tax or Cash Timing Errors.
   For EACH item in profitOpportunities provide all 6 practical parts:
   - id: unique string
   - area: matching numbered area from the 16 areas above
   - title: crisp opportunity name
   - horizon: MUST be strictly one of "0-30 Days", "30-90 Days", or "90-180 Days"
   - evidenceBasis: plain-language explanation citing supplied inputs/CRM/ledger/docs (or noting missing figures)
   - whyHappening: root cause explaining why this leakage occurs in this SME
   - infoNeeded: exact figure/record still needed to verify or size the upside
   - whatToDoFirst: concrete first action this week
   - illustrativeExample: transparent example labeled "Illustrative scenario: ..." showing the math logic if verified baseline figures are incomplete (NEVER pass an illustrative figure off as verified client fact)
   - estimatedFinancialImpact: supplied-data range or qualified estimate requiring verification
   - effortCost: realistic implementation effort/cash cost
   - risks: 1–2 execution or client risks
   - linkedCrmId: optional exact CRM contact ID if applicable
8. Knowns vs. Assumptions vs. Unknowns audit.
9. Critical missing evidence needed next.
10. 2–3 focused contextual follow-up questions.
11. Core strategic recommendation + immediate 48–72 hour step.
12. Practical prioritized actionItems (4–6 specific actions with priority, ownerRole, timeframe, action, expectedImpact).
13. Specialist advice trigger (Accountant, Lawyer, HR, Banker if warranted).

Strictly do NOT invent financial facts that were not supplied. Return strictly valid JSON matching the schema.
`;

      const response = await generateWithGemini4(
        {
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                initialObservation: { type: Type.STRING },
                commercialWhy: { type: Type.STRING },
                sustainabilityRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
                sustainabilityAssessment: {
                  type: Type.OBJECT,
                  properties: {
                    currentPositionSummary: { type: Type.STRING },
                    futureOutlook6to12Months: { type: Type.STRING },
                    recommendedChoice: { type: Type.STRING },
                    choiceRationale: { type: Type.STRING },
                    areas: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          area: { type: Type.STRING },
                          status: { type: Type.STRING },
                          assessment: { type: Type.STRING },
                          keyDriverOrGap: { type: Type.STRING },
                        },
                        required: ['area', 'status', 'assessment', 'keyDriverOrGap'],
                      },
                    },
                    keyAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    disclaimer: { type: Type.STRING },
                  },
                  required: [
                    'currentPositionSummary',
                    'futureOutlook6to12Months',
                    'recommendedChoice',
                    'choiceRationale',
                    'areas',
                    'keyAssumptions',
                    'disclaimer',
                  ],
                },
                hiddenProfitOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                revenueFlowImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
                profitOpportunities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      area: { type: Type.STRING },
                      title: { type: Type.STRING },
                      horizon: { type: Type.STRING },
                      evidenceBasis: { type: Type.STRING },
                      whyHappening: { type: Type.STRING },
                      infoNeeded: { type: Type.STRING },
                      whatToDoFirst: { type: Type.STRING },
                      illustrativeExample: { type: Type.STRING },
                      estimatedFinancialImpact: { type: Type.STRING },
                      effortCost: { type: Type.STRING },
                      risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                      linkedCrmId: { type: Type.STRING },
                    },
                    required: [
                      'id',
                      'area',
                      'title',
                      'horizon',
                      'evidenceBasis',
                      'whyHappening',
                      'infoNeeded',
                      'whatToDoFirst',
                      'illustrativeExample',
                      'estimatedFinancialImpact',
                      'effortCost',
                      'risks',
                    ],
                  },
                },
                knownsVsAssumptions: {
                  type: Type.OBJECT,
                  properties: {
                    knowns: { type: Type.ARRAY, items: { type: Type.STRING } },
                    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    unknowns: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['knowns', 'assumptions', 'unknowns'],
                },
                missingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                contextualQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                initialRecommendation: { type: Type.STRING },
                immediateAction: { type: Type.STRING },
                actionItems: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      priority: { type: Type.STRING },
                      ownerRole: { type: Type.STRING },
                      timeframe: { type: Type.STRING },
                      action: { type: Type.STRING },
                      expectedImpact: { type: Type.STRING },
                    },
                    required: ['id', 'priority', 'ownerRole', 'timeframe', 'action', 'expectedImpact'],
                  },
                },
                specialistAdviceNeeded: { type: Type.STRING },
              },
              required: [
                'initialObservation',
                'commercialWhy',
                'sustainabilityRisks',
                'sustainabilityAssessment',
                'hiddenProfitOpportunities',
                'revenueFlowImprovements',
                'profitOpportunities',
                'knownsVsAssumptions',
                'missingEvidence',
                'contextualQuestions',
                'initialRecommendation',
                'immediateAction',
                'actionItems',
              ],
            },
          },
        },
        { uid, bucket: 'recommendations' }
      );

      const parsedJson = JSON.parse((response.text || '{}').trim());
      const normalizeHorizon = (raw?: string): '0-30 Days' | '30-90 Days' | '90-180 Days' => {
        if (raw?.includes('90-180') || raw?.includes('180')) return '90-180 Days';
        if (raw?.includes('30-90') || raw?.includes('60') || raw?.includes('90')) return '30-90 Days';
        return '0-30 Days';
      };

      const normalizeSustChoice = (raw?: string) => {
        const s = String(raw || '').toLowerCase();
        if (s.includes('reconsider')) return 'Reconsider';
        if (s.includes('restruct')) return 'Restructure';
        if (s.includes('expand')) return 'Expand';
        if (s.includes('improv')) return 'Improve';
        return 'Stabilise';
      };

      const normalizeSustStatus = (raw?: string): 'green' | 'amber' | 'red' | 'blue' => {
        const s = String(raw || '').toLowerCase();
        if (s.includes('green') || s.includes('healthy')) return 'green';
        if (s.includes('red') || s.includes('risk')) return 'red';
        if (s.includes('blue') || s.includes('missing') || s.includes('unsure') || s.includes('insufficient')) return 'blue';
        return 'amber';
      };

      const profitOpportunities = Array.isArray(parsedJson.profitOpportunities)
        ? parsedJson.profitOpportunities.map((item: any, idx: number) => ({
            id: item.id || `opp-${Date.now()}-${idx}`,
            area: String(item.area || '1. Pricing Too Low'),
            title: String(item.title || 'Commercial Profit Lever'),
            horizon: normalizeHorizon(String(item.horizon || '')),
            evidenceBasis: String(item.evidenceBasis || 'Owner diagnostic inputs'),
            whyHappening: String(item.whyHappening || 'Pricing, scope, or tracking controls need tightening.'),
            infoNeeded: String(item.infoNeeded || 'Verify job/contract margin breakdown.'),
            whatToDoFirst: String(item.whatToDoFirst || 'Audit top 10 accounts this week.'),
            illustrativeExample: String(item.illustrativeExample || ''),
            estimatedFinancialImpact: String(item.estimatedFinancialImpact || 'Requires baseline figures to quantify'),
            effortCost: String(item.effortCost || 'Low to moderate effort'),
            risks: Array.isArray(item.risks) ? item.risks.map(String) : [],
            ...(item.linkedCrmId ? { linkedCrmId: String(item.linkedCrmId) } : {}),
          }))
        : [];

      const rawSust = parsedJson.sustainabilityAssessment;
      const sustainabilityAssessment = rawSust
        ? {
            currentPositionSummary: String(rawSust.currentPositionSummary || ''),
            futureOutlook6to12Months: String(rawSust.futureOutlook6to12Months || ''),
            recommendedChoice: normalizeSustChoice(rawSust.recommendedChoice),
            choiceRationale: String(rawSust.choiceRationale || ''),
            areas: Array.isArray(rawSust.areas)
              ? rawSust.areas.map((a: any) => ({
                  area: String(a.area || 'Sustainability Area'),
                  status: normalizeSustStatus(a.status),
                  assessment: String(a.assessment || ''),
                  keyDriverOrGap: String(a.keyDriverOrGap || ''),
                }))
              : [],
            keyAssumptions: Array.isArray(rawSust.keyAssumptions) ? rawSust.keyAssumptions.map(String) : [],
            disclaimer:
              String(rawSust.disclaimer || '') ||
              'Commercial decision-support only — not formal business valuation, tax, legal, or insolvency advice.',
          }
        : undefined;

      return res.json({
        recommendation: {
          ...parsedJson,
          profitOpportunities,
          ...(sustainabilityAssessment ? { sustainabilityAssessment } : {}),
          challenges: [],
          generatedAt: new Date().toISOString(),
        },
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Recommendation Generation Error:', err);
      const safe = toSafeApiError(err, 'Unable to generate structured recommendation from Gemini.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 3. Challenge Recommendation / Follow-up Endpoint
  app.post('/api/coach/challenge-recommendation', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'coach', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        challengeText,
        challengeQuestion,
        currentRecommendation,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        actionPlan,
        continuity,
      } = req.body;

      const challengeInput =
        typeof challengeQuestion === 'string' && challengeQuestion.trim()
          ? challengeQuestion.trim()
          : typeof challengeText === 'string'
          ? challengeText.trim()
          : '';

      if (!challengeInput) {
        return res.status(400).json({ error: 'Please enter your question or challenge.' });
      }
      if (challengeInput.length > 4000) {
        return res.status(400).json({ error: 'Challenge text exceeds 4,000 characters.' });
      }

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        currentRecommendation,
        actionPlan,
        crossDocumentSynthesis,
        continuity
      );

      const prompt = `
The business owner is challenging or asking a follow-up question about your current recommendation.

CURRENT RECOMMENDATION SUMMARY:
- Observation: ${currentRecommendation?.initialObservation || 'N/A'}
- Recommendation: ${currentRecommendation?.initialRecommendation || 'N/A'}
- Immediate Action: ${currentRecommendation?.immediateAction || 'N/A'}

OWNER'S CHALLENGE / FOLLOW-UP:
"${challengeInput}"

Respond directly, respectfully, and rigorously:
- Acknowledge what new evidence or operational reality the owner just raised.
- Clearly state whether the original recommendation holds, needs modification, or depends on testing a missing assumption.
- Provide the concrete next adjustment or verification step without inventing any financial numbers.
`;

      const response = await generateWithGemini4(
        {
          contents: prompt,
          config: { systemInstruction },
        },
        { uid, bucket: 'coach' }
      );

      const replyText = response.text || 'Unable to formulate response.';
      const createdAt = new Date().toISOString();

      return res.json({
        reply: replyText,
        createdAt,
        challengeEntry: {
          id: `chal-${Date.now()}`,
          questionOrChallenge: challengeInput,
          coachResponse: replyText,
          createdAt,
        },
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Challenge Recommendation Error:', err);
      const safe = toSafeApiError(err, 'Unable to process follow-up challenge.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 4. Document Analysis Endpoint (Full Workspace Context + Zero Fabricated Figures)
  app.post('/api/coach/analyze-document', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'documents', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        caseId,
        fileName,
        mimeType,
        fileSizeBytes,
        base64Data,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
      } = req.body;

      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'fileName and base64Data are required.' });
      }
      if (typeof fileSizeBytes === 'number' && fileSizeBytes > MAX_DOCUMENT_BYTES) {
        return res.status(400).json({ error: 'Uploaded file exceeds the 8 MB limit.' });
      }

      const extracted = await extractDocumentContent(fileName, mimeType || '', base64Data);
      const systemInstruction =
        buildDynamicSystemInstruction(
          businessProfile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
          recommendations,
          actionPlan
        ) +
        `\nCRITICAL DOCUMENT AUDIT RULE: You are auditing a newly uploaded business document ("${fileName}") for case "${caseId}". Compare it with any previously uploaded documents or owner claims listed above, and NEVER invent or estimate financial numbers absent from the document.`;

      const auditInstruction = `
Analyze the attached business document ("${fileName}") for "${businessProfile?.name || 'this SME'}" (${businessProfile?.industry || 'SME'}).
Produce a structured audit JSON with:
- summary: concise factual summary of what the document contains.
- verifiedFacts: concrete facts/figures directly observable inside the document.
- ownerSuppliedClaims: claims from the owner's profile/notes or prior uploads compared against this file (note confirmations or discrepancies).
- assumptionsFlagged: assumptions that remain unverified by this document alone (e.g., cash vs accrual timing, missing tax liabilities, unverified collectability).
- missingFinancialFigures: specific financial figures or schedules absent from this file that are still needed.
- earningPotentialAssessment: reasoned assessment of future earning potential based strictly on supplied evidence (no invented numbers).
- risksIdentified: concrete financial or operational risks revealed or left open.
- opportunitiesIdentified: hidden profit, pricing, cost, or cash flow opportunities suggested by the evidence.
- metricsFound: array of key verbatim metrics directly present in the document ({ label, value, sourceBasis: "document_verified" }). Only include metrics explicitly stated in the file!
`;

      const contents = extracted.inlinePart
        ? { parts: [extracted.inlinePart, { text: auditInstruction }] }
        : `${auditInstruction}\n\n=== EXTRACTED DOCUMENT CONTENT (${fileName}) ===\n${extracted.textContent}`;

      const response = await generateWithGemini4(
        {
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                ownerSuppliedClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
                assumptionsFlagged: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingFinancialFigures: { type: Type.ARRAY, items: { type: Type.STRING } },
                earningPotentialAssessment: { type: Type.STRING },
                risksIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
                opportunitiesIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
                metricsFound: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                      sourceBasis: { type: Type.STRING },
                    },
                    required: ['label', 'value', 'sourceBasis'],
                  },
                },
              },
              required: [
                'summary',
                'verifiedFacts',
                'ownerSuppliedClaims',
                'assumptionsFlagged',
                'missingFinancialFigures',
                'earningPotentialAssessment',
                'risksIdentified',
                'opportunitiesIdentified',
                'metricsFound',
              ],
            },
          },
        },
        { uid, bucket: 'documents' }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        documentAnalysis: {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fileName,
          fileType: mimeType || path.extname(fileName) || 'document',
          fileSizeBytes: Number(fileSizeBytes) || Buffer.from(base64Data, 'base64').length,
          uploadedAt: new Date().toISOString(),
          summary: parsed.summary || 'Document analyzed.',
          verifiedFacts: Array.isArray(parsed.verifiedFacts) ? parsed.verifiedFacts : [],
          ownerSuppliedClaims: Array.isArray(parsed.ownerSuppliedClaims) ? parsed.ownerSuppliedClaims : [],
          assumptionsFlagged: Array.isArray(parsed.assumptionsFlagged) ? parsed.assumptionsFlagged : [],
          missingFinancialFigures: Array.isArray(parsed.missingFinancialFigures) ? parsed.missingFinancialFigures : [],
          earningPotentialAssessment: parsed.earningPotentialAssessment || 'Insufficient figures supplied to project earning potential.',
          risksIdentified: Array.isArray(parsed.risksIdentified) ? parsed.risksIdentified : [],
          opportunitiesIdentified: Array.isArray(parsed.opportunitiesIdentified) ? parsed.opportunitiesIdentified : [],
          metricsFound: Array.isArray(parsed.metricsFound) ? parsed.metricsFound : [],
          extractedPreview: extracted.textContent ? extracted.textContent.slice(0, 500) : undefined,
        },
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Document Analysis Error:', err);
      const safe = toSafeApiError(err, 'Unable to analyze uploaded document.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 4b. Cross-Document Financial & Future Earnings Synthesis Endpoint
  app.post('/api/coach/synthesize-documents', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'documents', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
      } = req.body;

      if (!Array.isArray(uploadedDocuments) || uploadedDocuments.length === 0) {
        return res.status(400).json({ error: 'Upload at least one business document before running synthesis.' });
      }

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan
      );

      const docsDetail = uploadedDocuments
        .slice(0, 10)
        .map(
          (d: any, idx: number) =>
            `[Document ${idx + 1}: ${d.fileName} (${d.uploadedAt})]\nSummary: ${d.summary}\nVerified Facts: ${(d.verifiedFacts || []).join(' | ')}\nMetrics Extracted: ${(d.metricsFound || []).map((m: any) => `${m.label}: ${m.value}`).join(' | ')}\nRisks: ${(d.risksIdentified || []).join(' | ')}\nOpportunities: ${(d.opportunitiesIdentified || []).join(' | ')}\nMissing Figures: ${(d.missingFinancialFigures || []).join(' | ')}`
        )
        .join('\n\n---\n\n');

      const prompt = `
Synthesize ALL ${uploadedDocuments.length} uploaded business documents for "${businessProfile?.name || 'this SME'}" together with the owner's financial ledger and CRM data.

UPLOADED DOCUMENTS ARCHIVE:
${docsDetail}

Produce strictly valid JSON:
- summary: cohesive executive synthesis comparing all documents, cash flow vs profit reality, and operational implications.
- trends: 2–5 concrete multi-period or cross-document trends directly supported by the extracted metrics/facts.
- unusualMovements: 1–4 discrepancies, margin squeezes, unusual expense/debtor spikes, or mismatches between documents and owner notes.
- conservativeScenario: realistic future earnings / cash trajectory if pricing stays flat and debtor delays persist (ONLY cite supplied numbers; never invent figures).
- baseScenario: realistic base future earnings trajectory executing core turnaround & CRM follow-ups.
- optimisticScenario: realistic upside earnings drivers when pricing/margin/utilization improvements land cleanly.
- verifiedFiguresUsed: list of exact figures/facts verified from the documents.
- dataGaps: missing schedules or time periods still required to forecast with higher precision.
`;

      const response = await generateWithGemini4(
        {
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                trends: { type: Type.ARRAY, items: { type: Type.STRING } },
                unusualMovements: { type: Type.ARRAY, items: { type: Type.STRING } },
                conservativeScenario: { type: Type.STRING },
                baseScenario: { type: Type.STRING },
                optimisticScenario: { type: Type.STRING },
                verifiedFiguresUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
                dataGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                'summary',
                'trends',
                'unusualMovements',
                'conservativeScenario',
                'baseScenario',
                'optimisticScenario',
                'verifiedFiguresUsed',
                'dataGaps',
              ],
            },
          },
        },
        { uid, bucket: 'documents' }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        crossDocumentSynthesis: {
          summary: parsed.summary || 'Cross-document synthesis complete.',
          trends: Array.isArray(parsed.trends) ? parsed.trends : [],
          unusualMovements: Array.isArray(parsed.unusualMovements) ? parsed.unusualMovements : [],
          conservativeScenario: parsed.conservativeScenario || '',
          baseScenario: parsed.baseScenario || '',
          optimisticScenario: parsed.optimisticScenario || '',
          verifiedFiguresUsed: Array.isArray(parsed.verifiedFiguresUsed) ? parsed.verifiedFiguresUsed : [],
          dataGaps: Array.isArray(parsed.dataGaps) ? parsed.dataGaps : [],
          synthesizedAt: new Date().toISOString(),
        },
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Document Synthesis Error:', err);
      const safe = toSafeApiError(err, 'Unable to synthesize uploaded documents.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 5. Dynamic Script Generation API (Uses Full Case Context)
  app.post('/api/coach/generate-script', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'coach', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        scriptType,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        details,
      } = req.body;
      const bName = businessProfile?.name || 'Our Company';
      const industry = businessProfile?.industry || 'Business Services';
      const currency = businessProfile?.currency || 'NZD';
      const country = businessProfile?.country || 'New Zealand';

      const systemInstruction =
        buildDynamicSystemInstruction(
          businessProfile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
          recommendations,
          actionPlan
        ) +
        `\nCOMMERCIAL SCRIPT PROTOCOL: Write clear, respectful, commercially firm correspondence tailored strictly to "${bName}" in ${country}.`;

      const prompt = `Generate a realistic, professional commercial communication script for "${bName}" in the ${industry} sector located in ${country} (Currency: ${currency}).
Script Type: ${scriptType}
Context & Objective: ${details || 'Standard commercial request'}

Include:
1. Primary written template (Email or Letter)
2. Phone call talking points & objection handling
3. Escalation follow-up trigger (48–72 hours).`;

      const response = await generateWithGemini4(
        {
          contents: prompt,
          config: { systemInstruction },
        },
        { uid, bucket: 'coach' }
      );

      return res.json({
        script: response.text,
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Script Generation Error:', err);
      const safe = toSafeApiError(err, 'Unable to generate script.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 6. Connected Business Development, Lead Generation & Outreach Plan API
  app.post('/api/coach/business-development', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'coach', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        focusArea,
      } = req.body;

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        crossDocumentSynthesis
      );

      const prompt = `
Build a practical, connected Business Development & Outreach Plan for "${businessProfile?.name || 'this SME'}" (${businessProfile?.industry || 'SME'}).
${focusArea ? `Requested Owner Focus: ${focusArea}` : ''}

Synthesize ALL connected workspace evidence:
1. Business Health realities (especially Money/Cash, Pricing & Margins, Customers/Concentration, Sales, and Operations capacity). If Money or Operations is At Risk, prioritize collecting/stabilizing margin and targeting high-fit/fast-paying buyers rather than low-margin volume.
2. Actual CRM contacts, sales stages, due follow-ups, and at-risk accounts supplied above (reference their exact CRM ID in linkedCrmId when suggesting outreach for an existing CRM record).
3. Modeled ROI scenarios (payback & cash requirements).

Return strictly valid JSON matching the schema:
- idealCustomerProfile: clear description of who this business should target next and why (payment discipline, margin fit, operational load).
- targetOpportunities: 3–5 concrete target market, referral, or partnership opportunities tailored to the industry & country.
- followUpPriorities: 3–5 prioritized follow-up actions covering overdue CRM follow-ups, open proposals, or at-risk retention accounts.
- outreachSuggestions: 3–4 ready-to-use prospecting or follow-up outreach items ({ title, targetSegment, channel, rationale, messageDraft, linkedCrmId }). Do NOT fabricate financial figures.
`;

      const response = await generateWithGemini4(
        {
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                idealCustomerProfile: { type: Type.STRING },
                targetOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                followUpPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
                outreachSuggestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      targetSegment: { type: Type.STRING },
                      channel: { type: Type.STRING },
                      rationale: { type: Type.STRING },
                      messageDraft: { type: Type.STRING },
                      linkedCrmId: { type: Type.STRING },
                    },
                    required: ['title', 'targetSegment', 'channel', 'rationale', 'messageDraft'],
                  },
                },
              },
              required: [
                'idealCustomerProfile',
                'targetOpportunities',
                'followUpPriorities',
                'outreachSuggestions',
              ],
            },
          },
        },
        { uid, bucket: 'coach' }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        businessDevPlan: {
          idealCustomerProfile: parsed.idealCustomerProfile || 'Tailor targeting to high-margin, prompt-paying SMEs.',
          targetOpportunities: Array.isArray(parsed.targetOpportunities) ? parsed.targetOpportunities : [],
          followUpPriorities: Array.isArray(parsed.followUpPriorities) ? parsed.followUpPriorities : [],
          outreachSuggestions: Array.isArray(parsed.outreachSuggestions) ? parsed.outreachSuggestions : [],
          generatedAt: new Date().toISOString(),
        },
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
      });
    } catch (err: any) {
      console.error('Business Development Generation Error:', err);
      const safe = toSafeApiError(err, 'Unable to generate Business Development Plan.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 7. Interactive "Challenge Me" Socratic & Scenario Interrogation Endpoint
  app.post('/api/coach/challenge-me', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const quota = await enforceAiQuota(uid, 'coach', isStripeConfigured);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const {
        action,
        focusTopic,
        currentSession,
        ownerResponse,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        continuity,
      } = req.body;

      if (!['start', 'respond', 'conclude'].includes(action)) {
        return res.status(400).json({ error: 'Invalid challenge action. Expected "start", "respond", or "conclude".' });
      }

      const systemInstruction =
        buildDynamicSystemInstruction(
          businessProfile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
          recommendations,
          actionPlan,
          crossDocumentSynthesis,
          continuity
        ) +
        `\n"CHALLENGE ME" INTERROGATION MODE RULES:
- Role: You are stress-testing the business owner's thinking before capital, time, or team capacity is committed.
- Tone: Constructive, commercially intelligent, direct, and occasionally uncomfortable. Challenge the thinking, assumptions, and numbers—never criticize the person.
- STRICTLY FORBIDDEN: Generic motivational questions ("What inspires you?"), vague platitudes, multi-question checklists (ALWAYS ask strictly ONE sharp, challenging question per round), and inventing unverified financial numbers.
- Ground every contradiction, scenario, and implication in the specific business data above (12-Capability Health notes/statuses, Top 3 Priorities, financial ledger/cash/AR, CRM pipeline/at-risk clients, ROI assumptions, and prior recommendations).`;

      if (action === 'start') {
        const startPrompt = `
Conduct a sharp diagnostic scan of "${businessProfile?.name || 'this business'}" under the focus "${focusTopic || 'Full Business Reality Check'}".
1. Identify 2–4 concrete contradictions (e.g., growth goals vs cash/overdraft/overdue debtors; owner dependency vs hiring capacity; unreviewed pricing vs cost inflation; CRM at-risk concentration vs pipeline expectations).
2. Identify 2–4 questionable assumptions evident in the owner's answers, ROI scenarios, or recommendations.
3. Identify 2–3 commercial blind spots or unexamined risks.
4. Design Round 1: pick the single sharpest commercial tension, present a realistic, concrete business scenario testing the owner's decision, and ask ONE pointed, uncomfortable question that forces a real commercial choice or defense.

Return strictly valid JSON matching the schema.`;

        const response = await generateWithGemini4(
          {
            contents: startPrompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  contradictionsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
                  questionableAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  blindSpots: { type: Type.ARRAY, items: { type: Type.STRING } },
                  firstRound: {
                    type: Type.OBJECT,
                    properties: {
                      contradictionOrBlindSpot: { type: Type.STRING },
                      scenarioContext: { type: Type.STRING },
                      question: { type: Type.STRING },
                    },
                    required: ['contradictionOrBlindSpot', 'scenarioContext', 'question'],
                  },
                },
                required: ['contradictionsDetected', 'questionableAssumptions', 'blindSpots', 'firstRound'],
              },
            },
          },
          { uid, bucket: 'coach' }
        );

        const parsed = JSON.parse((response.text || '{}').trim());
        return res.json({
          contradictionsDetected: Array.isArray(parsed.contradictionsDetected) ? parsed.contradictionsDetected : [],
          questionableAssumptions: Array.isArray(parsed.questionableAssumptions) ? parsed.questionableAssumptions : [],
          blindSpots: Array.isArray(parsed.blindSpots) ? parsed.blindSpots : [],
          firstRound: parsed.firstRound,
          accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
        });
      }

      if (action === 'respond') {
        if (!ownerResponse || typeof ownerResponse !== 'string' || !ownerResponse.trim()) {
          return res.status(400).json({ error: 'Please enter your response to the challenge question before continuing.' });
        }
        if (ownerResponse.length > 5000) {
          return res.status(400).json({ error: 'Response exceeds maximum length (5,000 characters).' });
        }

        const rounds = Array.isArray(currentSession?.rounds) ? currentSession.rounds : [];
        const roundTranscript = rounds
          .map(
            (r: any, idx: number) =>
              `Round ${idx + 1} (${r.contradictionOrBlindSpot}):\nScenario: ${r.scenarioContext}\nChallenge Question: ${r.question}\nOwner Response: ${
                idx === rounds.length - 1 && !r.ownerResponse ? ownerResponse.trim() : r.ownerResponse || '(pending)'
              }${r.businessImplication ? `\nCoach Implication: ${r.businessImplication}` : ''}`
          )
          .join('\n\n---\n\n');

        const respondPrompt = `
CHALLENGE SESSION FOCUS: ${focusTopic || currentSession?.focusTopic || 'Full Business Reality Check'}
DETECTED CONTRADICTIONS: ${(currentSession?.contradictionsDetected || []).join('; ')}
FLAGGED ASSUMPTIONS: ${(currentSession?.questionableAssumptions || []).join('; ')}

SESSION TRANSCRIPT SO FAR (including Owner's latest response on the final round):
${roundTranscript || `Owner Response: ${ownerResponse.trim()}`}

Instructions:
1. In "businessImplication", directly analyze the commercial, cash-flow, margin, customer-concentration, or execution implications of the owner's latest response. Point out where their logic holds up AND where an unverified assumption, cash risk, or contradiction still exposes the business.
2. Decide "shouldConclude": if ${rounds.length} >= 4 OR the core commercial tensions have now been thoroughly tested, set shouldConclude=true. Otherwise set shouldConclude=false and provide "nextRound" probing the next untested blind spot or pushing deeper on a gap exposed by their latest answer (with ONE sharp question and a realistic scenario).

Return strictly valid JSON matching the schema.`;

        const response = await generateWithGemini4(
          {
            contents: respondPrompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  businessImplication: { type: Type.STRING },
                  shouldConclude: { type: Type.BOOLEAN },
                  nextRound: {
                    type: Type.OBJECT,
                    properties: {
                      contradictionOrBlindSpot: { type: Type.STRING },
                      scenarioContext: { type: Type.STRING },
                      question: { type: Type.STRING },
                    },
                    required: ['contradictionOrBlindSpot', 'scenarioContext', 'question'],
                  },
                },
                required: ['businessImplication', 'shouldConclude'],
              },
            },
          },
          { uid, bucket: 'coach' }
        );

        const parsed = JSON.parse((response.text || '{}').trim());
        return res.json({
          businessImplication: parsed.businessImplication || '',
          shouldConclude: Boolean(parsed.shouldConclude),
          nextRound: parsed.shouldConclude ? null : parsed.nextRound || null,
          accountUsage: buildAccountUsageSummary(uid, isStripeConfigured),
        });
      }

      const rounds = Array.isArray(currentSession?.rounds) ? currentSession.rounds : [];
      const transcript = rounds
        .map(
          (r: any, idx: number) =>
            `Round ${idx + 1} — ${r.contradictionOrBlindSpot}\nScenario: ${r.scenarioContext}\nQuestion: ${r.question}\nOwner Response: ${
              r.ownerResponse || 'Skipped / Not answered'
            }\nCommercial Implication: ${r.businessImplication || 'N/A'}`
        )
        .join('\n\n---\n\n');

      const concludePrompt = `
Synthesize the completed "Challenge Me" interrogation for "${businessProfile?.name || 'this SME'}" (${focusTopic || currentSession?.focusTopic || 'Business Reality Check'}).

CONTRADICTIONS & ASSUMPTIONS:
- Contradictions: ${(currentSession?.contradictionsDetected || []).join('; ')}
- Questionable Assumptions: ${(currentSession?.questionableAssumptions || []).join('; ')}
- Blind Spots: ${(currentSession?.blindSpots || []).join('; ')}

CHALLENGE TRANSCRIPT:
${transcript || 'No round responses recorded.'}

Produce a decisive executive wrap-up:
1. "keyInsights": 3–5 sharp commercial takeaways revealed by how the owner answered (separating facts from assumptions).
2. "recommendedDecisions": 2–4 clear stop/start/reprice/defer executive decisions the owner needs to make right now.
3. "nextActions": 3–5 practical, sequenced next actions ({ id, action, ownerRole, priority, timeframe, rationale }) ready to add directly to the 30/60/90-Day Action Plan.

Return strictly valid JSON matching the schema.`;

      const response = await generateWithGemini4(
        {
          contents: concludePrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendedDecisions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nextActions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      action: { type: Type.STRING },
                      ownerRole: { type: Type.STRING },
                      priority: { type: Type.STRING },
                      timeframe: { type: Type.STRING },
                      rationale: { type: Type.STRING },
                    },
                    required: ['id', 'action', 'ownerRole', 'priority', 'timeframe', 'rationale'],
                  },
                },
              },
              required: ['keyInsights', 'recommendedDecisions', 'nextActions'],
            },
          },
        },
        { uid, bucket: 'coach' }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      const normalizePriority = (raw?: string): 'Priority 1 (Urgent)' | 'Priority 2 (High)' | 'Priority 3 (Medium)' => {
        if (raw && raw.includes('1')) return 'Priority 1 (Urgent)';
        if (raw && raw.includes('2')) return 'Priority 2 (High)';
        return 'Priority 3 (Medium)';
      };

      return res.json({
        conclusion: {
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
          recommendedDecisions: Array.isArray(parsed.recommendedDecisions) ? parsed.recommendedDecisions : [],
          nextActions: Array.isArray(parsed.nextActions)
            ? parsed.nextActions.map((a: any, idx: number) => ({
                id: a.id || `cna-${Date.now()}-${idx}`,
                action: String(a.action || ''),
                ownerRole: String(a.ownerRole || 'Owner'),
                priority: normalizePriority(String(a.priority || '')),
                timeframe: String(a.timeframe || 'Within 30 days'),
                rationale: String(a.rationale || ''),
                addedToPlan: false,
              }))
            : [],
          concludedAt: new Date().toISOString(),
        },
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
      });
    } catch (err: any) {
      console.error('Challenge Me Error:', err);
      const safe = toSafeApiError(err, 'Unable to run Challenge Me coaching session.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 8. Membership Continuity Review Generator (Weekly Pulse / Monthly Review / Quarterly Sustainability)
  app.post('/api/continuity/generate-review', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const {
        reviewType,
        ownerReflection,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        continuity,
      } = req.body;

      if (!['weekly', 'monthly', 'quarterly'].includes(reviewType)) {
        return res.status(400).json({ error: 'Invalid reviewType. Expected "weekly", "monthly", or "quarterly".' });
      }

      const bucket: UsageBucket = reviewType === 'weekly' ? 'coach' : 'recommendations';
      const quota = await enforceAiQuota(uid, bucket, isStripeConfigured, req.user?.email);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const systemInstruction =
        buildDynamicSystemInstruction(
          businessProfile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
          recommendations,
          actionPlan,
          crossDocumentSynthesis,
          continuity
        ) +
        `\nCONTINUITY REVIEW STRICT HONESTY RULES:
- Compare ONLY against supplied Joining Baseline, previous reviews, and actual saved case data above.
- NEVER fabricate improvements, revenue gains, cash movements, or missing figures.
- Whenever baseline or financial figures are absent, state what is missing in "missingInfoNeeded".`;

      if (reviewType === 'weekly') {
        const response = await generateWithGemini4(
          {
            contents: `Generate a concise Weekly Business Pulse for "${businessProfile?.name || 'this SME'}".
Owner Weekly Note: "${ownerReflection || 'None provided'}"
Summarize:
- executiveSummary: factual weekly pulse referencing cash, overdue debtors, CRM follow-ups due, and completed vs stalled actions.
- emergingConcerns: 1–3 concrete weekly concerns grounded in supplied facts.
- emergingOpportunities: 1–3 immediate weekly opportunities grounded in CRM/recommendations.
- nextWeekPriorities: exactly 3 practical priorities for the coming 7 days.
- missingInfoNeeded: specific figures still missing from this business case.`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  executiveSummary: { type: Type.STRING },
                  emergingConcerns: { type: Type.ARRAY, items: { type: Type.STRING } },
                  emergingOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  nextWeekPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missingInfoNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'executiveSummary',
                  'emergingConcerns',
                  'emergingOpportunities',
                  'nextWeekPriorities',
                  'missingInfoNeeded',
                ],
              },
            },
          },
          { uid, bucket }
        );

        const parsed = JSON.parse((response.text || '{}').trim());
        return res.json({
          reviewType,
          review: parsed,
          accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
        });
      }

      if (reviewType === 'monthly') {
        const response = await generateWithGemini4(
          {
            contents: `Conduct a Monthly Business Review for "${businessProfile?.name || 'this SME'}".
Owner Monthly Reflection: "${ownerReflection || 'None provided'}"
Compare current health, financial ledger, CRM pipeline, and action outcomes against the Joining Baseline and any prior Monthly Review listed above.
Return strictly valid JSON:
- executiveSummary: honest progress review distinguishing verified progress from unresolved issues.
- improvedAreas: concrete improvements observed in saved scores/cash/actions (empty array if none verified).
- deterioratedAreas: areas that worsened or slipped (empty array if none).
- unresolvedIssues: ongoing issues still requiring owner action.
- revenueOpportunities: 2–4 actionable revenue/pricing/retention opportunities.
- profitLeakageAlerts: 1–3 specific leakage risks.
- cashFlowConcerns: 1–3 factual cash/debtor observations.
- actionOutcomesReviewed: summary of completed or ongoing action outcomes.
- nextThreePriorities: top 3 priorities for next month.
- missingInfoNeeded: figures still missing to verify progress.`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  executiveSummary: { type: Type.STRING },
                  improvedAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  deterioratedAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  unresolvedIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                  revenueOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  profitLeakageAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cashFlowConcerns: { type: Type.ARRAY, items: { type: Type.STRING } },
                  actionOutcomesReviewed: { type: Type.ARRAY, items: { type: Type.STRING } },
                  nextThreePriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missingInfoNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'executiveSummary',
                  'improvedAreas',
                  'deterioratedAreas',
                  'unresolvedIssues',
                  'revenueOpportunities',
                  'profitLeakageAlerts',
                  'cashFlowConcerns',
                  'actionOutcomesReviewed',
                  'nextThreePriorities',
                  'missingInfoNeeded',
                ],
              },
            },
          },
          { uid, bucket }
        );

        const parsed = JSON.parse((response.text || '{}').trim());
        return res.json({
          reviewType,
          review: parsed,
          accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
        });
      }

      const response = await generateWithGemini4(
        {
          contents: `Conduct a Quarterly Sustainability Review for "${businessProfile?.name || 'this SME'}".
Evaluate long-term resilience trend ("Strengthening", "Mixed / Holding", "Under Strain", or "Insufficient Data"), recommended strategic choice ("Stabilise", "Improve", "Expand", "Restructure", "Reconsider", or "Pending Evidence"), owner dependency, customer concentration, long-term risks, long-term opportunities, practical adjustments, and missing information.`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                executiveSummary: { type: Type.STRING },
                resilienceTrend: { type: Type.STRING },
                strategicChoice: { type: Type.STRING },
                longTermRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
                longTermOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendedAdjustments: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingInfoNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                'executiveSummary',
                'resilienceTrend',
                'strategicChoice',
                'longTermRisks',
                'longTermOpportunities',
                'recommendedAdjustments',
                'missingInfoNeeded',
              ],
            },
          },
        },
        { uid, bucket }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        reviewType,
        review: parsed,
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
      });
    } catch (err: any) {
      console.error('Continuity Review Error:', err);
      const safe = toSafeApiError(err, 'Unable to generate continuity review.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  // 9. KPI & Performance Tracker AI Interpretation & Selective Recommendations
  app.post('/api/kpi/interpret', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const uid = req.user!.uid;
      const {
        kpis,
        selectedPreset,
        availableCatalogSummary,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crossDocumentSynthesis,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
        continuity,
      } = req.body;

      if (!Array.isArray(kpis) || kpis.length === 0) {
        return res.status(400).json({ error: 'At least one tracked KPI must be supplied for AI interpretation.' });
      }

      const quota = await enforceAiQuota(uid, 'coach', isStripeConfigured, req.user?.email);
      if (!quota.allowed) {
        return res.status(quota.statusCode || 429).json({
          error: quota.error,
          code: quota.code,
          accountUsage: quota.accountUsage,
        });
      }

      const systemInstruction =
        buildDynamicSystemInstruction(
          businessProfile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
          recommendations,
          actionPlan,
          crossDocumentSynthesis,
          continuity
        ) +
        `\nKPI & PERFORMANCE TRACKER RULES:
- Interpret ONLY the actual computed KPI figures supplied below (baseline, target, previous, latest actual, variance, trend, owner comments).
- NEVER invent numbers or fabricate improvements. When a KPI shows null / Insufficient Data, state clearly which raw input or accounting figure is missing and what the owner should collect next.
- Tailor corrective actions specifically to "${businessProfile?.name || 'this SME'}" (${businessProfile?.industry || 'SME'}, preset: ${selectedPreset || 'general_sme'}).
- For "recommendedAdditionalKpis", return 0 to 2 catalogKeys ONLY if there is a clear commercial blind spot or risk in the business case that is NOT already covered by the tracked KPIs. Return an empty array [] if current tracked KPIs already cover the core risks.`;

      const kpiDigest = kpis.slice(0, 30).map((k: any) => ({
        id: String(k.id || ''),
        catalogKey: k.catalogKey ? String(k.catalogKey) : null,
        name: String(k.name || ''),
        category: String(k.categoryLabel || k.category || ''),
        unit: String(k.unit || 'number'),
        direction: String(k.direction || 'higher_is_better'),
        baselineValue: k.baselineValue ?? null,
        targetValue: k.targetValue ?? null,
        previousValue: k.previousValue ?? null,
        latestActualValue: k.latestActualValue ?? null,
        trend: String(k.trend || 'Insufficient Data'),
        ownerComment: k.ownerComment ? String(k.ownerComment) : '',
      }));

      const response = await generateWithGemini4(
        {
          contents: `Review these ${kpiDigest.length} tracked KPIs for "${businessProfile?.name || 'this SME'}" (preset: ${selectedPreset || 'general_sme'}).
Tracked KPIs JSON:
${JSON.stringify(kpiDigest, null, 2)}

Untracked Catalog Options (you may selectively recommend 0-2 ONLY when strongly justified by case risks/blind spots):
${JSON.stringify(Array.isArray(availableCatalogSummary) ? availableCatalogSummary.slice(0, 30) : [], null, 2)}

Return strictly valid JSON with:
- kpiUpdates: an array containing one entry per tracked KPI id with:
  - id: exact KPI id supplied above
  - aiInterpretation: 1-2 crisp, commercially honest sentences interpreting actual vs target, previous period trend, and business risk/opportunity (or stating missing inputs if Insufficient Data).
  - recommendedAction: 1 specific practical corrective or protective next action grounded in this SME's operations/cash/CRM.
- recommendedAdditionalKpis: 0-2 objects { catalogKey, clearBusinessReason } ONLY where warranted by a clear risk or blind spot in the case data.`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                kpiUpdates: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      aiInterpretation: { type: Type.STRING },
                      recommendedAction: { type: Type.STRING },
                    },
                    required: ['id', 'aiInterpretation', 'recommendedAction'],
                  },
                },
                recommendedAdditionalKpis: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      catalogKey: { type: Type.STRING },
                      clearBusinessReason: { type: Type.STRING },
                    },
                    required: ['catalogKey', 'clearBusinessReason'],
                  },
                },
              },
              required: ['kpiUpdates', 'recommendedAdditionalKpis'],
            },
          },
        },
        { uid, bucket: 'coach' }
      );

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        kpiUpdates: Array.isArray(parsed.kpiUpdates) ? parsed.kpiUpdates : [],
        recommendedAdditionalKpis: Array.isArray(parsed.recommendedAdditionalKpis)
          ? parsed.recommendedAdditionalKpis.slice(0, 2)
          : [],
        accountUsage: buildAccountUsageSummary(uid, isStripeConfigured, req.user?.email),
      });
    } catch (err: any) {
      console.error('KPI Interpretation Error:', err);
      const safe = toSafeApiError(err, 'Unable to interpret KPIs with AI coach.', 502);
      return res.status(safe.status).json({ error: safe.message });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  if (!isProduction) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    let viteMiddleware: express.RequestHandler | null = null;
    const viteReadyPromise = createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: !isHmrDisabled,
        ws: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    })
      .then((vite) => {
        viteMiddleware = vite.middlewares;
        return vite;
      })
      .catch((err) => {
        console.error('Vite middleware initialization failed:', err);
        throw err;
      });

    app.use(async (req, res, next) => {
      try {
        if (!viteMiddleware) {
          await viteReadyPromise;
        }
        return viteMiddleware!(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BizPulse Multi-SME Coach Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
