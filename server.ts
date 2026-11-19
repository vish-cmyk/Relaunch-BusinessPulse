import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
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

  // Every case, including the per-user demonstration copy, must exist in the
  // authenticated user's own Firestore workspace. Never fail open when the
  // Admin SDK is unavailable or the ownership lookup fails.
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
        code: 'CASE_NOT_OWNED',
      });
    }
  } catch (err: any) {
    console.error('Firestore case ownership verification failed:', err.message);
    return res.status(503).json({
      error: 'Case security verification is temporarily unavailable. Please try again later.',
      code: 'CASE_OWNERSHIP_UNAVAILABLE',
    });
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
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    express.json({
      limit: '12mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Server-side Gemini Client with required telemetry header
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

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
    uploadedDocuments?: any[]
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

COACHING & EVIDENCE RULES:
1. Context Fidelity: Tailor all advice strictly to "${businessName}" (${industry}, ${country}, ${currency}, ${staff}). Never assume it is an IT MSP unless industry is IT & Managed Services.
2. Evidence Discipline: Explicitly distinguish Verified Evidence, Owner-Reported Information, Working Assumptions, and Unknowns / Missing Data.
3. Zero Fabricated Numbers: NEVER invent revenue, profit, cash, debtor, or percentage figures not supplied in the profile, financials, notes, or uploaded documents. If figures are missing, state exactly what figure is needed.
4. Commercial Focus: Highlight sustainability risks, hidden profit leaks/opportunities, and cash conversion/revenue flow improvements with practical actions naming owner role, priority, and timeframe.
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

  // 1. Live AI Coach Query
  app.post('/api/coach/query', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { prompt, businessProfile, healthInputs, financials, overallHealth, uploadedDocuments, userRole, topic } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'A coaching question or prompt is required.' });
      }
      if (prompt.length > 8000) {
        return res.status(400).json({ error: 'Prompt exceeds maximum allowed length (8,000 characters).' });
      }

      const systemInstruction =
        buildDynamicSystemInstruction(businessProfile, healthInputs, financials, overallHealth, uploadedDocuments) +
        `\nSpeaking as: ${userRole || 'Owner/Director'}. Topic: ${topic || 'General Strategy'}. Format concisely using clear bullet points and direct commercial reasoning. Never invent missing financial numbers.`;

      const response = await generateWithGemini4({
        contents: prompt.trim(),
        config: { systemInstruction },
      });

      return res.json({ reply: response.text || 'No response text generated.' });
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
      const { businessProfile, healthInputs, financials, overallHealth, uploadedDocuments } = req.body;

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments
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
      const { challengeText, currentRecommendation, businessProfile, healthInputs, financials, overallHealth, uploadedDocuments } = req.body;

      if (!challengeText || typeof challengeText !== 'string' || !challengeText.trim()) {
        return res.status(400).json({ error: 'Please enter your question or challenge.' });
      }
      if (challengeText.length > 4000) {
        return res.status(400).json({ error: 'Challenge text exceeds 4,000 characters.' });
      }

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile,
        healthInputs,
        financials,
        overallHealth,
        uploadedDocuments
      );

      const prompt = `
The business owner is challenging or asking a follow-up question about your current recommendation.

CURRENT RECOMMENDATION SUMMARY:
- Observation: ${currentRecommendation?.initialObservation || 'N/A'}
- Recommendation: ${currentRecommendation?.initialRecommendation || 'N/A'}
- Immediate Action: ${currentRecommendation?.immediateAction || 'N/A'}

OWNER'S CHALLENGE / FOLLOW-UP:
"${challengeText.trim()}"

Respond directly, respectfully, and rigorously:
- Acknowledge what new evidence or operational reality the owner just raised.
- Clearly state whether the original recommendation holds, needs modification, or depends on testing a missing assumption.
- Provide the concrete next adjustment or verification step without inventing any financial numbers.
`;

      const response = await generateWithGemini4({
        contents: prompt,
        config: { systemInstruction },
      });

      return res.json({
        challengeEntry: {
          id: `chal-${Date.now()}`,
          questionOrChallenge: challengeText.trim(),
          coachResponse: response.text || 'Unable to formulate response.',
          createdAt: new Date().toISOString(),
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

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BizPulse Multi-SME Coach Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
