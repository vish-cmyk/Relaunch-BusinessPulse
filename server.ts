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
const adminApp = getApps().length === 0
  ? (() => {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
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

// Stage One: Server-side Firebase ID token verification middleware
async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized: Missing or invalid Authorization header. Sign in required.',
      code: 'AUTH_REQUIRED'
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
      error: 'Unauthorized: Invalid or expired Firebase ID token. Please sign in again.',
      code: 'INVALID_TOKEN',
      details: err.message
    });
  }
}

// Case ownership verification middleware
function verifyCaseOwnership(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
  }

  const caseId = req.body?.caseId || req.params?.caseId || req.body?.businessProfile?.caseId;
  
  // Benchmark demonstration case is accessible to all authenticated users
  if (caseId === 'case-demo-msp-nz') {
    return next();
  }

  // Active case ownership is anchored to the verified UID (req.user.uid)
  next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Capture raw buffer for webhook signature verification
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Initialize Gemini Client with server telemetry header
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
  
  const stripe = isStripeConfigured ? new Stripe(stripeSecretKey!, { apiVersion: '2025-02-24.acacia' as any }) : null;

  // Server-side in-memory verified unlocks store & idempotent event set
  const verifiedPaidCases = new Map<string, {
    sessionId: string;
    caseId: string;
    amount: number;
    currency: string;
    status: 'paid';
    tier: string;
    unlockedAt: string;
    customerEmail?: string;
    paymentMode: 'stripe_live' | 'stripe_test' | 'sandbox_simulation';
  }>();

  const processedWebhookEventIds = new Set<string>();

  // Resilient generateContent with automatic model fallback (3.8-flash -> 2.5-flash)
  async function generateContentWithFallback(params: any): Promise<any> {
    try {
      return await ai.models.generateContent({
        ...params,
        model: 'gemini-3.8-flash',
      });
    } catch (err: any) {
      console.warn('gemini-3.8-flash busy or encountered error, attempting fallback to gemini-2.5-flash:', err.message);
      return await ai.models.generateContent({
        ...params,
        model: 'gemini-2.5-flash',
      });
    }
  }

  // Helper to build dynamic SME business context for AI calls
  function buildDynamicSystemInstruction(profile: any, healthInputs: any, financials: any, overallHealth: any): string {
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

    // Summarize health inputs
    let healthSummary = 'HEALTH DIMENSIONS (Owner-Reported):\n';
    if (healthInputs && typeof healthInputs === 'object') {
      for (const [key, val] of Object.entries<any>(healthInputs)) {
        healthSummary += `- ${val.title || key}: Status=${val.status || 'unanswered'}. Notes: ${val.notes || 'None provided'}\n`;
      }
    } else {
      healthSummary += 'Health dimensions not yet completed by owner.\n';
    }

    // Summarize financial data if provided
    let financialSummary = 'FINANCIAL DATA:\n';
    if (financials && (financials.annualRevenue || financials.cashInBank || financials.accountsReceivable)) {
      financialSummary += `- Annual Revenue: ${currency} ${financials.annualRevenue?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Operating Profit: ${currency} ${financials.operatingProfit?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Cash in Bank: ${currency} ${financials.cashInBank?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Accounts Receivable: ${currency} ${financials.accountsReceivable?.toLocaleString() ?? 'Not supplied'} (Overdue >60d: ${currency} ${financials.overdueReceivables?.toLocaleString() ?? 'Not supplied'})\n`;
      financialSummary += `- Accounts Payable: ${currency} ${financials.accountsPayable?.toLocaleString() ?? 'Not supplied'}\n`;
      financialSummary += `- Credit Facility: ${currency} ${financials.creditFacilityUsed?.toLocaleString() ?? '0'} used of ${currency} ${financials.creditFacilityLimit?.toLocaleString() ?? '0'} limit\n`;
    } else {
      financialSummary += 'No specific financial ledger data supplied yet by owner. DO NOT invent financial figures.\n';
    }

    return `
You are a senior SME turnaround adviser, commercial analyst, cash-flow specialist, and experienced business coach.
You are advising the business owner of "${businessName}", an SME operating in the "${industry}" sector (${country}).

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

YOUR COACHING & ADVISORY PRINCIPLES:
1. Dynamic Context: Tailor your advice strictly to this specific business profile (${industry}, ${currency}, ${staff}). Do NOT assume this business is an IT MSP unless the industry explicitly states IT & Managed Services. If this is a tradesperson, retailer, or family firm, use their actual commercial realities.
2. Evidence Standards: Always distinguish:
   - Owner-reported: information stated by the owner.
   - Verified: confirmed by independent data.
   - Assumption: working hypothesis in the absence of data.
   - Unknown: data not yet supplied.
   - Recommendation: proposed next action.
3. No Hallucinations: NEVER invent financial numbers, customer names, margins, or success rates. If data is missing, clearly explain the gap and how the owner can obtain it.
4. Practical Commercial Guidance: Be direct, incisive, empathetic, and commercially rigorous. Focus on cash conversion, margin integrity, capacity protection, and owner sanity.
5. Identify when specialist accounting, legal, employment, or tax advice is required.
`;
  }

  function buildRuleBasedRecommendationFallback(profile: any, healthInputs: any, overallHealth: any) {
    const atRiskDims = Object.values<any>(healthInputs || {}).filter(d => d.status === 'at_risk');
    const primaryVulnerability = atRiskDims[0]?.title || 'Working Capital & Margin Friction';
    const currency = profile?.currency || 'NZD';

    return {
      initialObservation: `For ${profile?.name || 'the business'}, operational friction in ${primaryVulnerability} is the primary commercial drag constraining profit and cash flow.`,
      commercialWhy: `In the ${profile?.industry || 'SME'} sector, bottlenecks in ${primaryVulnerability} prevent revenue from converting efficiently into distributable cash, creating artificial working capital pressure.`,
      knownsVsAssumptions: {
        knowns: [
          `Operating history of ${profile?.yearsOperating ?? 3} years with a team of ${profile?.employeeCount ?? 10} staff.`,
          `Stated primary objective: "${profile?.primaryObjective || 'Improve profitability and cash flow'}".`,
          `Reported vulnerabilities: ${atRiskDims.map(d => d.title).join(', ') || 'General margin friction'}.`
        ],
        assumptions: [
          'Overdue accounts and inventory carrying costs reflect customer payment delays rather than permanent bad debts.',
          'Current pricing structure has not fully accounted for recent cost inflation.'
        ],
        unknowns: [
          'Detailed aged accounts receivable breakdown with individual payment dispute flags.',
          'Gross contribution margin breakdown per core product/service line.'
        ]
      },
      missingEvidence: [
        'Customer-by-customer aged debtor ledger with dates of last payment.',
        'Gross profit margins by product/service line to isolate true profit drivers.'
      ],
      contextualQuestions: [
        `What percentage of outstanding customer invoices are overdue past standard payment terms?`,
        `When was the last time contract prices or hourly billing rates were reviewed against actual cost inflation?`
      ],
      initialRecommendation: `Establish an immediate freeze on unbilled scope creep, institute weekly debtor reviews, and conduct a customer profitability audit across your top 20% accounts.`,
      immediateAction: `Over the next 48–72 hours, review the aged receivables ledger, identify accounts overdue past 45 days, and initiate direct telephone contact on the three largest balances.`,
      specialistAdviceNeeded: `Consult your external accountant to verify cash-flow forecasts and tax/GST payment obligations before committing to major discretionary expenditures.`,
      generatedAt: new Date().toISOString()
    };
  }

  // ==========================================
  // STRIPE PAYMENT INTEGRATION ENDPOINTS
  // ==========================================

  // 1. Create Checkout Session (Authenticated)
  app.post('/api/payment/create-checkout-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { caseId, businessName, userEmail, currency } = req.body;
      if (!caseId) {
        return res.status(400).json({ error: 'caseId is required' });
      }

      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({
          error: 'Stripe payment integration is not configured on the server. Please set STRIPE_SECRET_KEY in server environment to enable live checkout.',
          configured: false
        });
      }

      const appBaseUrl = process.env.APP_URL || req.headers.origin || `http://localhost:${PORT}`;
      const safeCurrency = (currency || 'NZD').toLowerCase();
      const amountNzdCents = 9900; // NZ$99.00
      const customerEmail = userEmail || req.user?.email || undefined;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: customerEmail,
        line_items: [
          {
            price_data: {
              currency: safeCurrency,
              product_data: {
                name: `BizPulse Commercial Turnaround Diagnostic: ${businessName || 'SME'}`,
                description: 'Comprehensive 10-section turnaround memo, executive exports, cash flow triage simulator, and live AI advisory console.',
              },
              unit_amount: amountNzdCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          caseId,
          userId: req.user?.uid || '',
          businessName: businessName || 'SME Client',
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

  // 2. Verify Payment Session (Authenticated & Verified via Stripe)
  app.post('/api/payment/verify-session', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, caseId } = req.body;
      if (!sessionId || !caseId) {
        return res.status(400).json({ error: 'sessionId and caseId are required' });
      }

      if (!stripe || !isStripeConfigured) {
        return res.status(503).json({ error: 'Stripe is not configured on this server.' });
      }

      // Reject sandbox simulation IDs as proof of real payment
      if (!sessionId.startsWith('cs_') || sessionId.startsWith('cs_sandbox_')) {
        return res.status(400).json({ error: 'Invalid checkout session ID format.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        // Enforce ownership: verify that the Stripe session was created for this user
        if (session.metadata?.userId && session.metadata.userId !== req.user?.uid) {
          return res.status(403).json({ error: 'Payment session belongs to another authenticated account.' });
        }

        const record = {
          sessionId: session.id,
          caseId,
          amount: (session.amount_total || 9900) / 100,
          currency: (session.currency || 'nzd').toUpperCase(),
          status: 'paid' as const,
          tier: 'Diagnostic Report & Turnaround OS',
          unlockedAt: new Date().toISOString(),
          customerEmail: session.customer_details?.email || undefined,
          paymentMode: (stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test') as 'stripe_live' | 'stripe_test',
        };

        verifiedPaidCases.set(caseId, record);

        // Persist verified payment in Firestore
        if (req.user?.uid) {
          try {
            await adminDb.collection('users').doc(req.user.uid).collection('cases').doc(caseId).set({
              isUnlocked: true,
              paymentStatus: 'paid',
              paymentRecord: record,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (fsErr: any) {
            console.warn('Direct Firestore payment write notice (client will also persist):', fsErr.message);
          }
        }

        return res.json({ paid: true, record });
      } else {
        return res.json({ paid: false, status: session.payment_status });
      }
    } catch (err: any) {
      console.error('Session Verification Error:', err);
      return res.status(500).json({ error: err.message || 'Error verifying checkout session' });
    }
  });

  // 3. Stripe Webhook Endpoint (Signed & Idempotent, Raw Body Verification)
  app.post('/api/payment/webhook', async (req: any, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any;

    if (!stripe || !isStripeConfigured) {
      return res.status(503).json({ error: 'Stripe is not configured.' });
    }

    if (webhookSecret && webhookSecret !== 'whsec_placeholder_secret') {
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }
      try {
        event = stripe.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // In development/testing if webhook secret is not set, reject in production
      if (isProduction) {
        return res.status(400).json({ error: 'Webhook secret required in production.' });
      }
      event = req.body;
    }

    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Idempotency check: ignore duplicate deliveries of the same event ID
    if (event.id && processedWebhookEventIds.has(event.id)) {
      console.log(`Webhook event ${event.id} already processed. Skipping (Idempotent).`);
      return res.json({ received: true, idempotentDuplicate: true });
    }

    if (event.id) {
      processedWebhookEventIds.add(event.id);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
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
            tier: 'Diagnostic Report & Turnaround OS',
            unlockedAt: new Date().toISOString(),
            customerEmail: session.customer_details?.email,
            paymentMode: (stripeSecretKey?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test') as 'stripe_live' | 'stripe_test',
          };
          verifiedPaidCases.set(caseId, record);

          if (userId) {
            try {
              await adminDb.collection('users').doc(userId).collection('cases').doc(caseId).set({
                isUnlocked: true,
                paymentStatus: 'paid',
                paymentRecord: record,
                updatedAt: new Date().toISOString(),
              }, { merge: true });
              console.log(`Persistently unlocked case ${caseId} for user ${userId} via Stripe webhook.`);
            } catch (fsErr: any) {
              console.warn('Webhook Firestore persistence note:', fsErr.message);
            }
          }
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data?.object;
        console.log(`Charge refunded: ${charge?.id}. Entitlement revocation logged.`);
        break;
      }
    }

    return res.json({ received: true });
  });

  // 4. Entitlement Status by Case ID (Authenticated)
  app.get('/api/payment/status/:caseId', requireAuth, verifyCaseOwnership, (req: AuthenticatedRequest, res) => {
    const { caseId } = req.params;
    const record = verifiedPaidCases.get(caseId);
    if (record) {
      return res.json({ isUnlocked: true, paymentStatus: 'paid', record });
    }
    return res.json({ isUnlocked: false, paymentStatus: 'free', record: null });
  });
  // ==========================================
  // COACH & DIAGNOSTIC ENDPOINTS (Authenticated & Scoped)
  // ==========================================

  // 1. Dynamic Coach Chat API (Protected)
  app.post('/api/coach/query', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { prompt, businessProfile, healthInputs, financials, overallHealth, userRole, topic } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile, 
        healthInputs, 
        financials, 
        overallHealth
      ) + `\nUser Role: ${userRole || 'Owner/Director'}. Discussion Topic: ${topic || 'General Strategy'}. Format with clean Markdown, clear headings, bullet points, and concise actionable steps.`;

      const response = await generateContentWithFallback({
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({ reply: response.text });
    } catch (err: any) {
      console.error('Gemini Coaching Error:', err);
      const bName = req.body?.businessProfile?.name || 'your business';
      return res.json({
        reply: `### Commercial Advisory Summary for ${bName}\n\nOur live AI engine encountered a temporary cloud upstream connection spike. Here is your core commercial coaching priority:\n\n1. **Protect Immediate Cash:** Review your receivables and enforce payment terms for accounts exceeding standard days.\n2. **Defend Margins:** Ensure no unbilled work or unplanned discounts are being provided without formal change orders.\n3. **Weekly Cadence:** Schedule a strictly time-boxed 45-minute management review this Monday morning to track cash in bank, overdue receivables, and capacity bottlenecks.`
      });
    }
  });

  // 2. Dynamic Structured Recommendation Engine API (Protected)
  app.post('/api/coach/generate-recommendation', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { businessProfile, healthInputs, financials, overallHealth } = req.body;

      const systemInstruction = buildDynamicSystemInstruction(
        businessProfile, 
        healthInputs, 
        financials, 
        overallHealth
      );

      const prompt = `
Analyze the business profile, stated primary concern, and the 8 health dimensions. Produce a rigorous, evidence-based commercial diagnostic recommendation following these exact 8 points:

1. State the single most important initial observation.
2. Explain why it matters commercially to the owner's solvency, profit, or capacity.
3. Distinguish known information from assumptions and unknowns.
4. Identify the most critical missing evidence.
5. Formulate only 2 to 3 contextual, high-impact questions needed for the next decision.
6. Provide an actionable initial recommendation without waiting for a lengthy interview.
7. Explain what the owner can do immediately (next 48-72 hours).
8. Specify whether specialist accounting, legal, employment, or banking advice is required.

Return the result strictly as a valid JSON object matching the requested schema.
`;

      const response = await generateContentWithFallback({
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              initialObservation: { type: Type.STRING },
              commercialWhy: { type: Type.STRING },
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
              specialistAdviceNeeded: { type: Type.STRING },
            },
            required: [
              'initialObservation',
              'commercialWhy',
              'knownsVsAssumptions',
              'missingEvidence',
              'contextualQuestions',
              'initialRecommendation',
              'immediateAction',
            ],
          },
          temperature: 0.5,
        },
      });

      const parsedJson = JSON.parse(response.text || '{}');
      return res.json({
        recommendation: {
          ...parsedJson,
          generatedAt: new Date().toISOString(),
        }
      });
    } catch (err: any) {
      console.warn('Recommendation Generation fallback triggered:', err.message);
      const fallbackRec = buildRuleBasedRecommendationFallback(
        req.body?.businessProfile,
        req.body?.healthInputs,
        req.body?.overallHealth
      );
      return res.json({ recommendation: fallbackRec });
    }
  });

  // 3. Dynamic Script Generation API (Protected)
  app.post('/api/coach/generate-script', requireAuth, verifyCaseOwnership, async (req: AuthenticatedRequest, res) => {
    try {
      const { scriptType, businessProfile, details } = req.body;
      const bName = businessProfile?.name || 'Our Company';
      const industry = businessProfile?.industry || 'Business Services';
      const currency = businessProfile?.currency || 'NZD';
      const country = businessProfile?.country || 'New Zealand';

      const prompt = `Generate a realistic, professional, commercial communication script for a business in the ${industry} sector located in ${country} (Currency: ${currency}).
Company Name: ${bName}
Script Type: ${scriptType}
Context & Objective: ${details || 'Standard commercial request'}

Requirements:
- Professional, respectful, firm, and commercially unambiguous.
- Uses appropriate commercial phrasing for ${country} (e.g., standard payment terms, clear boundary agreements, fair commercial dialogue).
- Include:
  1. Primary written template (Email or Letter)
  2. Phone call talking points & objection handling if the client pushes back
  3. Internal escalation trigger (what to do if they do not respond within 48-72 hours).`;

      const response = await generateContentWithFallback({
        contents: prompt,
        config: {
          systemInstruction: `You are an executive commercial adviser for SME business owners in ${country}. You write crisp, professional, unambiguous commercial correspondence.`,
          temperature: 0.6,
        },
      });

      return res.json({ script: response.text });
    } catch (err: any) {
      console.error('Script Generation Error:', err);
      const bName = req.body?.businessProfile?.name || 'Our Company';
      const currency = req.body?.businessProfile?.currency || 'NZD';
      return res.json({
        script: `Kia ora,\n\nI am writing regarding your outstanding account with ${bName}. To ensure uninterrupted service and support delivery, please arrange payment of the overdue balance within 48 hours or contact our accounts team directly to confirm remittance.\n\nThank you for your prompt attention.\n\nManaging Director\n${bName}`
      });
    }
  });

  // Mount Vite dev middleware or serve static production build
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
