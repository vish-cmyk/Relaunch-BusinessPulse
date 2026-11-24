import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Server-side Firebase ID token verification middleware
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
    next();
  } catch (err: any) {
    console.error('Server Firebase ID token verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired session token. Please sign in again.',
      code: 'INVALID_TOKEN',
      details: err.message,
    });
  }
}

// Strict Case Ownership & Payload Scope Verification Middleware
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

  // Reject cross-user spoofing if a different ownerId/userId was injected in payload
  if (req.body?.ownerUid && req.body.ownerUid !== req.user.uid) {
    return res.status(403).json({ error: 'Forbidden: Case access denied for this account.' });
  }

  if (caseId === 'case-demo-msp-nz') {
    return next();
  }

  // When Admin SDK service account is present, verify Firestore ownership directly
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
      console.warn('Firestore admin ownership check notice:', err.message);
    }
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
    return {
      textContent: '',
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

  // Plain text / CSV / JSON / Markdown
  const decoded = buffer.toString('utf8').trim();
  if (!decoded) {
    throw new Error('The uploaded file appears to be empty.');
  }
  return { textContent: decoded.slice(0, 60000) };
}

async function startServer() {
  const app = express();
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

  // Stripe Client Initialization
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const isStripeConfigured = Boolean(
    stripeSecretKey &&
      stripeSecretKey.startsWith('sk_') &&
      stripeSecretKey !== 'sk_test_placeholder_key'
  );
  const stripe = isStripeConfigured
    ? new Stripe(stripeSecretKey!, { apiVersion: '2025-02-24.acacia' as any })
    : null;

  const verifiedPaidCases = new Map<
    string,
    {
      sessionId: string;
      caseId: string;
      amount: number;
      currency: string;
      status: 'paid';
      tier: string;
      unlockedAt: string;
      customerEmail?: string;
      paymentMode: 'stripe_live' | 'stripe_test';
    }
  >();
  const processedWebhookEventIds = new Set<string>();

  // Gemini 4 Hydrogen helper with transient exponential backoff (never passes deprecated params or deprecated models)
  async function generateWithGemini4(params: { contents: any; config?: any }): Promise<any> {
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

    const ai = getAiClient();
    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: params.contents,
          config: cleanConfig,
        });
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isTransient = msg.includes('503') || msg.includes('500') || msg.includes('UNAVAILABLE') || msg.includes('ECONNRESET');
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
    actionPlan?: any[]
  ): string {
    const businessName = profile?.name || 'Client SME';
    const industry = profile?.industry || 'Small & Medium Enterprise';
    const businessType = profile?.businessType || 'Privately-owned business';
    const country = profile?.country || 'New Zealand';
    const currency = profile?.currency || 'NZD';
    const staff = `${profile?.employeeCount ?? 'Unspecified'} employees and ${profile?.subcontractorCount ?? '0'} subcontractors`;
    const primaryObjective = profile?.primaryObjective || 'Improve profitability, cash flow, and operational resilience';
    const primaryConcern = profile?.primaryConcern || 'Unspecified commercial pressure';
    const productsServices = profile?.mainProductsServices || 'General products/services';
    const customerTypes = profile?.mainCustomerTypes || 'General clients';

    let healthSummary = 'EIGHT HEALTH DIMENSIONS (Owner-Reported):\n';
    if (healthInputs && typeof healthInputs === 'object') {
      for (const [key, val] of Object.entries<any>(healthInputs)) {
        healthSummary += `- ${val.title || key}: Status=${val.status || 'unanswered'}. Notes: ${val.notes || 'None provided'}\n`;
      }
    } else {
      healthSummary += 'Health dimensions not yet completed by owner.\n';
    }

    let financialSummary = 'FINANCIAL LEDGER INPUTS:\n';
    if (
      financials &&
      (financials.annualRevenue != null ||
        financials.cashInBank != null ||
        financials.accountsReceivable != null)
    ) {
      financialSummary += `- Annual Revenue: ${currency} ${financials.annualRevenue?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Operating Profit: ${currency} ${financials.operatingProfit?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Cash in Bank: ${currency} ${financials.cashInBank?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Accounts Receivable: ${currency} ${financials.accountsReceivable?.toLocaleString() ?? 'Not supplied'} (Overdue >60d: ${currency} ${financials.overdueReceivables?.toLocaleString() ?? 'Not supplied'})\n`;
      financialSummary += `- Accounts Payable: ${currency} ${financials.accountsPayable?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Credit Facility: ${currency} ${financials.creditFacilityUsed?.toLocaleString() ?? '0'} used of ${currency} ${financials.creditFacilityLimit?.toLocaleString() ?? '0'} limit\n`;
    } else {
      financialSummary += 'No quantitative financial ledger figures supplied yet by owner. NEVER invent or estimate missing numbers.\n';
    }

    let docsSummary = 'UPLOADED BUSINESS DOCUMENTS (Verified vs Assumed):\n';
    if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
      for (const docItem of uploadedDocuments.slice(0, 5)) {
        docsSummary += `- Document "${docItem.fileName}" (${docItem.uploadedAt}): Summary: ${docItem.summary}. Verified Facts: ${(docItem.verifiedFacts || []).slice(0, 4).join('; ')}. Missing Figures: ${(docItem.missingFinancialFigures || []).slice(0, 3).join('; ')}\n`;
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

    let recommendationsSummary = 'EXISTING DIAGNOSTIC RECOMMENDATIONS & EVIDENCE AUDIT:\n';
    if (recommendations && (recommendations.initialObservation || recommendations.initialRecommendation)) {
      recommendationsSummary += `- Observation: ${recommendations.initialObservation || 'N/A'}\n`;
      recommendationsSummary += `- Commercial Why: ${recommendations.commercialWhy || 'N/A'}\n`;
      recommendationsSummary += `- Core Recommendation: ${recommendations.initialRecommendation || 'N/A'}\n`;
      recommendationsSummary += `- Immediate Action: ${recommendations.immediateAction || 'N/A'}\n`;
      if (Array.isArray(recommendations.sustainabilityRisks) && recommendations.sustainabilityRisks.length > 0) {
        recommendationsSummary += `- Sustainability Risks: ${recommendations.sustainabilityRisks.slice(0, 4).join('; ')}\n`;
      }
      if (recommendations.knownsVsAssumptions) {
        recommendationsSummary += `- Flagged Assumptions: ${(recommendations.knownsVsAssumptions.assumptions || []).slice(0, 4).join('; ') || 'None'}\n`;
        recommendationsSummary += `- Missing Unknowns: ${(recommendations.knownsVsAssumptions.unknowns || []).slice(0, 4).join('; ') || 'None'}\n`;
      }
      if (Array.isArray(recommendations.actionItems) && recommendations.actionItems.length > 0) {
        const done = recommendations.actionItems.filter((i: any) => i.completed).length;
        recommendationsSummary += `- Recommendation Action Items: ${done}/${recommendations.actionItems.length} completed\n`;
      }
    } else {
      recommendationsSummary += 'No diagnostic recommendation generated yet.\n';
    }

    let actionPlanSummary = '90-DAY ACTION PLAN STATUS:\n';
    if (Array.isArray(actionPlan) && actionPlan.length > 0) {
      const completedCount = actionPlan.filter((a) => a.completed || a.status === 'completed').length;
      const urgentPending = actionPlan
        .filter((a) => !a.completed && a.status !== 'completed')
        .slice(0, 5);
      actionPlanSummary += `- Total Planned Actions: ${actionPlan.length} (${completedCount} completed)\n`;
      for (const act of urgentPending) {
        actionPlanSummary += `  • [${act.priority || 'Action'}] ${act.action} (Owner: ${act.accountableRole || 'Owner'}, Timeframe: ${act.timeframe || 'TBD'})\n`;
      }
    } else {
      actionPlanSummary += 'No 90-day action plan tasks saved yet.\n';
    }

    return `
You are a seasoned, welcoming yet commercially sharp SME business coach, financial analyst, and turnaround adviser.
You are advising the owner of "${businessName}", an SME operating in the "${industry}" sector (${country}).

ACTIVE BUSINESS CONTEXT:
- Business Name: ${businessName}
- Industry: ${industry} (${businessType})
- Location: ${country} | Currency: ${currency}
- Team Size: ${staff}
- Products & Services: ${productsServices}
- Customer Base: ${customerTypes}
- Primary Objective: ${primaryObjective}
- Stated Primary Concern: ${primaryConcern}
- Overall Health Score: ${overallHealth?.overallScore ?? 'Pending'} / 100 (${overallHealth?.overallRating ?? 'Pending Assessment'})

${healthSummary}
${financialSummary}
${docsSummary}
${crmSummary}
${roiSummary}
${recommendationsSummary}
${actionPlanSummary}

COACHING & EVIDENCE RULES:
1. Context Fidelity: Tailor all advice strictly to "${businessName}" (${industry}, ${country}, ${currency}, ${staff}). Never assume it is an IT MSP unless industry is IT & Managed Services.
2. Evidence Discipline: Explicitly distinguish Verified Evidence, Owner-Reported Information, Working Assumptions, and Unknowns / Missing Data.
3. Zero Fabricated Numbers: NEVER invent revenue, profit, cash, debtor, or percentage figures not supplied in the profile, financials, notes, CRM, ROI scenarios, or uploaded documents. If figures are missing, state exactly what figure is needed.
4. Connected Integration: Connect Business Health risks directly to CRM priorities (retention, collections, follow-ups), ROI payback & cash headroom, and practical actions naming owner role, priority, and timeframe.
5. Specialist Triggers: Note clearly whenever a Chartered Accountant, commercial lawyer, HR/employment adviser, or banker should review decisions.
`;
  }

  // ==========================================
  // STRIPE PAYMENT ENDPOINTS (Gated until STRIPE_SECRET_KEY configured)
  // ==========================================
  app.post('/api/payment/create-checkout-session', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { caseId, businessName, userEmail, currency, tierId } = req.body;
      if (!caseId) {
        return res.status(400).json({ error: 'caseId is required' });
      }

      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({
          error: 'Live billing is currently disabled (preview mode). Subscription checkout is not activated and no charges will be made.',
          configured: false,
        });
      }

      const appBaseUrl = process.env.APP_URL || req.headers.origin || `http://localhost:${PORT}`;
      const safeCurrency = (currency || 'NZD').toLowerCase();
      const isFounding = tierId === 'founding_monthly';
      const amountCents = isFounding ? 9900 : 4900;
      const tierTitle = isFounding ? 'BizPulse Founding Member Growth OS (Monthly)' : 'BizPulse Essential Coach (Monthly)';
      const customerEmail = userEmail || req.user?.email || undefined;

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: customerEmail,
        line_items: [
          {
            price_data: {
              currency: safeCurrency,
              recurring: { interval: 'month' },
              product_data: {
                name: `${tierTitle} — ${businessName || 'SME Workspace'}`,
                description: isFounding
                  ? 'Unlimited cases, AI coaching, document audits, and executive exports.'
                  : 'Up to 3 active business cases, 8D diagnostics, and monthly AI coaching.',
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          caseId,
          userId: req.user?.uid || '',
          businessName: businessName || 'SME Client',
          tierId: tierId || 'essential_monthly',
        },
        success_url: `${appBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&case_id=${encodeURIComponent(caseId)}&payment=success`,
        cancel_url: `${appBaseUrl}/?case_id=${encodeURIComponent(caseId)}&payment=cancelled`,
      } as any);

      return res.json({
        sessionId: session.id,
        checkoutUrl: session.url,
        mode: stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test',
        configured: true,
      });
    } catch (err: any) {
      console.error('Stripe Session Creation Error:', err);
      return res.status(500).json({ error: err.message || 'Error creating checkout session' });
    }
  });

  app.post('/api/payment/verify-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, caseId } = req.body;
      if (!sessionId || !caseId) {
        return res.status(400).json({ error: 'sessionId and caseId are required' });
      }
      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({ error: 'Stripe is not configured on this server.' });
      }
      if (!sessionId.startsWith('cs_') || sessionId.startsWith('cs_sandbox_')) {
        return res.status(400).json({ error: 'Invalid checkout session ID format.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        if (session.metadata?.userId && session.metadata.userId !== req.user?.uid) {
          return res.status(403).json({ error: 'Payment session belongs to another authenticated account.' });
        }

        const record = {
          sessionId: session.id,
          caseId,
          amount: (session.amount_total || 9900) / 100,
          currency: (session.currency || 'nzd').toUpperCase(),
          status: 'paid' as const,
          tier: session.metadata?.tierId === 'founding_monthly' ? 'Founding Member Growth OS Monthly' : 'Essential Coach Monthly',
          unlockedAt: new Date().toISOString(),
          customerEmail: session.customer_details?.email || undefined,
          paymentMode: (stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test') as 'stripe_live' | 'stripe_test',
        };

        verifiedPaidCases.set(caseId, record);

        if (req.user?.uid && hasAdminCredentials) {
          try {
            await adminDb.collection('users').doc(req.user.uid).collection('cases').doc(caseId).set(
              {
                isUnlocked: true,
                paymentStatus: 'paid',
                paymentRecord: record,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch (fsErr: any) {
            console.warn('Direct Firestore payment write notice:', fsErr.message);
          }
        }

        return res.json({ paid: true, record });
      }
      return res.json({ paid: false, status: session.payment_status });
    } catch (err: any) {
      console.error('Session Verification Error:', err);
      return res.status(500).json({ error: err.message || 'Error verifying checkout session' });
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
    if (event.id && processedWebhookEventIds.has(event.id)) {
      return res.json({ received: true, idempotentDuplicate: true });
    }
    if (event.id) processedWebhookEventIds.add(event.id);

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const caseId = session?.metadata?.caseId;
      const userId = session?.metadata?.userId;
      if (caseId && session.payment_status === 'paid') {
        const record = {
          sessionId: session.id,
          caseId,
          amount: (session.amount_total || 9900) / 100,
          currency: (session.currency || 'nzd').toUpperCase(),
          status: 'paid' as const,
          tier: session.metadata?.tierId === 'founding_monthly' ? 'Founding Member Growth OS Monthly' : 'Essential Coach Monthly',
          unlockedAt: new Date().toISOString(),
          customerEmail: session.customer_details?.email,
          paymentMode: (stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test') as 'stripe_live' | 'stripe_test',
        };
        verifiedPaidCases.set(caseId, record);

        if (userId && hasAdminCredentials) {
          try {
            await adminDb.collection('users').doc(userId).collection('cases').doc(caseId).set(
              {
                isUnlocked: true,
                paymentStatus: 'paid',
                paymentRecord: record,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch (fsErr: any) {
            console.warn('Webhook Firestore persistence note:', fsErr.message);
          }
        }
      }
    }

    return res.json({ received: true });
  });

  app.get('/api/payment/status/:caseId', requireAuth, verifyCaseOwnership, (req: AuthenticatedRequest, res) => {
    const { caseId } = req.params;
    const record = verifiedPaidCases.get(caseId);
    if (record) {
      return res.json({ isUnlocked: true, paymentStatus: 'paid', record });
    }
    return res.json({ isUnlocked: false, paymentStatus: 'free', record: null });
  });

  // ==========================================
  // COACH, DIAGNOSTIC & DOCUMENT ANALYSIS ENDPOINTS
  // ==========================================

  // 1. Live Conversational AI Business Coach Query ("Chat with Coach")
  app.post('/api/coach/query', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        prompt,
        conversationHistory,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
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
          actionPlan
        ) +
        `\nCHAT WITH COACH CONVERSATION PROTOCOL:
Speaking with: ${userRole || 'Owner/Director'}. Active Focus Topic: ${topic || 'General Strategy'}.
- Engage in genuine two-way commercial coaching. If the owner disagrees with an earlier recommendation, questions an assumption, or proposes a new idea, address their reasoning directly, weigh risks/margins/cash flow/ROI, and be willing to refine or respectfully push back.
- Ask 1–2 targeted clarifying follow-up questions when key context is missing or before locking in a major decision, rather than immediately producing a generic essay.
- Clearly isolate any AI estimates, rules-of-thumb, or working assumptions in the "estimatesAndAssumptions" array so the owner never confuses an estimate with verified ledger data.
- Whenever the discussion surfaces concrete next steps or client/lead follow-ups, include 1–3 structured items in "suggestedActions" (using targetType: "crm_followup" for customer/prospect outreach or collections, and "action_plan" for internal operational/financial tasks).
Return strictly valid JSON matching the schema.`;

      // Build multi-turn Gemini contents array from recent case-scoped conversationHistory
      const contentsTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      if (Array.isArray(conversationHistory)) {
        const recentHistory = conversationHistory
          .filter((m: any) => m && typeof m.text === 'string' && m.text.trim().length > 0 && m.id !== 'm-0' && m.id !== 'm-reset')
          .slice(-14);
        for (const msg of recentHistory) {
          const role: 'user' | 'model' = msg.sender === 'user' ? 'user' : 'model';
          // Skip leading model turn because Gemini multi-turn chats must begin with a user turn
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

      const response = await generateWithGemini4({
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
      });

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
      });
    } catch (err: any) {
      console.error('Gemini Coaching Error:', err);
      return res.status(err?.statusCode || 502).json({
        error: err?.message || 'Unable to reach AI Coach service.',
      });
    }
  });

  // 2. Dynamic Structured Recommendation & Action Plan Generator
  app.post('/api/coach/generate-recommendation', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
      } = req.body;

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios
      );

      const prompt = `
Analyze the business profile, stated primary concern, 8 health dimension scores/notes, financial inputs (if any), and uploaded documents (if any).
Produce a tailored, practical SME diagnostic matching every requirement:
1. Initial commercial observation grounded in actual answers.
2. Commercial rationale explaining impact on cash flow, profitability, and capacity.
3. Sustainability risks (2–4 concrete risks specific to this business).
4. Hidden profit opportunities (2–4 pricing, margin, waste, or client mix opportunities).
5. Revenue flow improvements (2–4 cash collection, billing cadence, or recurring structure improvements).
6. Knowns vs. Assumptions vs. Unknowns audit.
7. Critical missing evidence needed next.
8. 2–3 focused contextual follow-up questions.
9. Core strategic recommendation + immediate 48–72 hour step.
10. Practical prioritized actionItems (4–6 specific actions with priority, ownerRole, timeframe, action, expectedImpact).
11. Specialist advice trigger (Accountant, Lawyer, HR, Banker if warranted).

Strictly do NOT invent any financial figures that were not supplied. Return strictly valid JSON matching the schema.
`;

      const response = await generateWithGemini4({
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
              hiddenProfitOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              revenueFlowImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
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
              'hiddenProfitOpportunities',
              'revenueFlowImprovements',
              'knownsVsAssumptions',
              'missingEvidence',
              'contextualQuestions',
              'initialRecommendation',
              'immediateAction',
              'actionItems',
            ],
          },
        },
      });

      const parsedJson = JSON.parse((response.text || '{}').trim());
      return res.json({
        recommendation: {
          ...parsedJson,
          challenges: [],
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('Recommendation Generation Error:', err);
      return res.status(err?.statusCode || 502).json({
        error: err?.message || 'Unable to generate structured recommendation from Gemini.',
      });
    }
  });

  // 3. Challenge Recommendation / Follow-up Endpoint
  app.post('/api/coach/challenge-recommendation', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        challengeText,
        challengeQuestion,
        currentRecommendation,
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments,
        crmContacts,
        roiScenarios,
        actionPlan,
      } = req.body;

      const challengeInput = typeof challengeQuestion === 'string' && challengeQuestion.trim()
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
        actionPlan
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

      const response = await generateWithGemini4({
        contents: prompt,
        config: { systemInstruction },
      });

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
      });
    } catch (err: any) {
      console.error('Challenge Recommendation Error:', err);
      return res.status(err?.statusCode || 502).json({
        error: err?.message || 'Unable to process follow-up challenge.',
      });
    }
  });

  // 4. Document Analysis Endpoint (Strictly Case-Scoped, Evidence vs Assumptions, Zero Fabricated Figures)
  app.post('/api/coach/analyze-document', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { caseId, fileName, mimeType, fileSizeBytes, base64Data, businessProfile, healthInputs, financials, overallHealth } = req.body;

      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'fileName and base64Data are required.' });
      }
      if (typeof fileSizeBytes === 'number' && fileSizeBytes > MAX_DOCUMENT_BYTES) {
        return res.status(400).json({ error: 'Uploaded file exceeds the 8 MB limit.' });
      }

      const extracted = await extractDocumentContent(fileName, mimeType || '', base64Data);
      const systemInstruction =
        buildDynamicSystemInstruction(businessProfile, healthInputs, financials, overallHealth) +
        `\nCRITICAL DOCUMENT AUDIT RULE: You are auditing an uploaded business document ("${fileName}") for case "${caseId}". NEVER invent, estimate, or guess financial numbers that are absent from the document. Distinguish verified figures directly present in the file from assumptions and missing data.`;

      const auditInstruction = `
Analyze the attached business document ("${fileName}") for "${businessProfile?.name || 'this SME'}" (${businessProfile?.industry || 'SME'}).
Produce a structured audit JSON with:
- summary: concise factual summary of what the document contains.
- verifiedFacts: concrete facts/figures directly observable inside the document.
- ownerSuppliedClaims: claims from the owner's profile/notes compared against this file.
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

      const response = await generateWithGemini4({
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
      });

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
      });
    } catch (err: any) {
      console.error('Document Analysis Error:', err);
      const statusCode = err?.statusCode || (err?.message?.includes('Unsupported file type') || err?.message?.includes('8 MB') ? 400 : 502);
      return res.status(statusCode).json({
        error: err?.message || 'Unable to analyze uploaded document.',
      });
    }
  });

  // 5. Dynamic Script Generation API
  app.post('/api/coach/generate-script', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { scriptType, businessProfile, details } = req.body;
      const bName = businessProfile?.name || 'Our Company';
      const industry = businessProfile?.industry || 'Business Services';
      const currency = businessProfile?.currency || 'NZD';
      const country = businessProfile?.country || 'New Zealand';

      const prompt = `Generate a realistic, professional commercial communication script for "${bName}" in the ${industry} sector located in ${country} (Currency: ${currency}).
Script Type: ${scriptType}
Context & Objective: ${details || 'Standard commercial request'}

Include:
1. Primary written template (Email or Letter)
2. Phone call talking points & objection handling
3. Escalation follow-up trigger (48–72 hours).`;

      const response = await generateWithGemini4({
        contents: prompt,
        config: {
          systemInstruction: `You are an executive commercial adviser for SME owners in ${country}. Write clear, respectful, commercially firm correspondence.`,
        },
      });

      return res.json({ script: response.text });
    } catch (err: any) {
      console.error('Script Generation Error:', err);
      return res.status(err?.statusCode || 502).json({
        error: err?.message || 'Unable to generate script.',
      });
    }
  });

  // 6. Connected Business Development, Lead Generation & Outreach Plan API
  app.post('/api/coach/business-development', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
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
        actionPlan
      );

      const prompt = `
Build a practical, connected Business Development & Outreach Plan for "${businessProfile?.name || 'this SME'}" (${businessProfile?.industry || 'SME'}).
${focusArea ? `Requested Owner Focus: ${focusArea}` : ''}

Synthesize ALL connected workspace evidence:
1. Business Health realities (especially Money/Cash, Customers/Concentration, Sales, and Operations capacity). If Money or Operations is At Risk, prioritize collecting/stabilizing margin and targeting high-fit/fast-paying buyers rather than low-margin volume.
2. Actual CRM contacts, sales stages, due follow-ups, and at-risk accounts supplied above (reference their exact CRM ID in linkedCrmId when suggesting outreach for an existing CRM record).
3. Modeled ROI scenarios (payback & cash requirements).

Return strictly valid JSON matching the schema:
- idealCustomerProfile: clear description of who this business should target next and why (payment discipline, margin fit, operational load).
- targetOpportunities: 3–5 concrete target market, referral, or partnership opportunities tailored to the industry & country.
- followUpPriorities: 3–5 prioritized follow-up actions covering overdue CRM follow-ups, open proposals, or at-risk retention accounts.
- outreachSuggestions: 3–4 ready-to-use prospecting or follow-up outreach items ({ title, targetSegment, channel, rationale, messageDraft, linkedCrmId }). Do NOT fabricate financial figures.
`;

      const response = await generateWithGemini4({
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
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        businessDevPlan: {
          idealCustomerProfile: parsed.idealCustomerProfile || 'Tailor targeting to high-margin, prompt-paying SMEs.',
          targetOpportunities: Array.isArray(parsed.targetOpportunities) ? parsed.targetOpportunities : [],
          followUpPriorities: Array.isArray(parsed.followUpPriorities) ? parsed.followUpPriorities : [],
          outreachSuggestions: Array.isArray(parsed.outreachSuggestions) ? parsed.outreachSuggestions : [],
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('Business Development Generation Error:', err);
      return res.status(err?.statusCode || 502).json({
        error: err?.message || 'Unable to generate Business Development Plan.',
      });
    }
  });

  // 7. Interactive "Challenge Me" Socratic & Scenario Interrogation Endpoint
  app.post('/api/coach/challenge-me', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
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
        crmContacts,
        roiScenarios,
        recommendations,
        actionPlan,
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
          actionPlan
        ) +
        `\n"CHALLENGE ME" INTERROGATION MODE RULES:
- Role: You are stress-testing the business owner's thinking before capital, time, or team capacity is committed.
- Tone: Constructive, commercially intelligent, direct, and occasionally uncomfortable. Challenge the thinking, assumptions, and numbers—never criticize the person.
- STRICTLY FORBIDDEN: Generic motivational questions ("What inspires you?"), vague platitudes, multi-question checklists (ALWAYS ask strictly ONE sharp, challenging question per round), and inventing unverified financial numbers.
- Ground every contradiction, scenario, and implication in the specific business data above (8D Health notes/statuses, financial ledger/cash/AR, CRM pipeline/at-risk clients, ROI assumptions, and prior recommendations).`;

      if (action === 'start') {
        const startPrompt = `
Conduct a sharp diagnostic scan of "${businessProfile?.name || 'this business'}" under the focus "${focusTopic || 'Full Business Reality Check'}".
1. Identify 2–4 concrete contradictions (e.g., growth goals vs cash/overdraft/overdue debtors; owner dependency vs hiring capacity; unreviewed pricing vs cost inflation; CRM at-risk concentration vs pipeline expectations).
2. Identify 2–4 questionable assumptions evident in the owner's answers, ROI scenarios, or recommendations.
3. Identify 2–3 commercial blind spots or unexamined risks.
4. Design Round 1: pick the single sharpest commercial tension, present a realistic, concrete business scenario testing the owner's decision, and ask ONE pointed, uncomfortable question that forces a real commercial choice or defense.

Return strictly valid JSON matching the schema.`;

        const response = await generateWithGemini4({
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
        });

        const parsed = JSON.parse((response.text || '{}').trim());
        return res.json({
          contradictionsDetected: Array.isArray(parsed.contradictionsDetected) ? parsed.contradictionsDetected : [],
          questionableAssumptions: Array.isArray(parsed.questionableAssumptions) ? parsed.questionableAssumptions : [],
          blindSpots: Array.isArray(parsed.blindSpots) ? parsed.blindSpots : [],
          firstRound: parsed.firstRound,
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

        const response = await generateWithGemini4({
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
        });

        const parsed = JSON.parse((response.text || '{}').trim());
        return res.json({
          businessImplication: parsed.businessImplication || '',
          shouldConclude: Boolean(parsed.shouldConclude),
          nextRound: parsed.shouldConclude ? null : parsed.nextRound || null,
        });
      }

      // action === 'conclude'
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
3. "nextActions": 3–5 practical, sequenced next actions ({ id, action, ownerRole, priority, timeframe, rationale }) ready to add directly to the 90-Day Action Plan.

Return strictly valid JSON matching the schema.`;

      const response = await generateWithGemini4({
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
      });

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
                timeframe: String(a.timeframe || 'Within 7 days'),
                rationale: String(a.rationale || ''),
                addedToPlan: false,
              }))
            : [],
          concludedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('Challenge Me Error:', err);
      return res.status(err?.statusCode || 502).json({
        error: err?.message || 'Unable to run Challenge Me coaching session.',
      });
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
