import fs from 'fs';
import path from 'path';

export type CanonicalTierId =
  | 'free_trial'
  | 'starter_monthly'
  | 'growth_monthly'
  | 'business_plus_monthly';
export type UsageBucket = 'coach' | 'documents' | 'recommendations';

export interface PlanDefinition {
  tierId: CanonicalTierId;
  planName: string;
  priceMonthlyNzd: number;
  maxCustomCases: number;
  coachMessagesPerMonth: number;
  documentAuditsPerMonth: number;
  recommendationsPerMonth: number;
  description: string;
}

export const SAAS_PLANS: Record<CanonicalTierId, PlanDefinition> = {
  free_trial: {
    tierId: 'free_trial',
    planName: 'Free Trial',
    priceMonthlyNzd: 0,
    maxCustomCases: 1,
    coachMessagesPerMonth: 15,
    documentAuditsPerMonth: 2,
    recommendationsPerMonth: 3,
    description:
      '1 private business workspace, 15 monthly AI Coach/Challenge turns, 2 document audits, 3 diagnostics.',
  },
  starter_monthly: {
    tierId: 'starter_monthly',
    planName: 'Starter',
    priceMonthlyNzd: 29,
    maxCustomCases: 3,
    coachMessagesPerMonth: 35,
    documentAuditsPerMonth: 10,
    recommendationsPerMonth: 10,
    description:
      'Up to 3 active business workspaces, 35 AI Coach/Challenge turns/mo, 10 document audits/mo, 10 diagnostics/reviews.',
  },
  growth_monthly: {
    tierId: 'growth_monthly',
    planName: 'Growth',
    priceMonthlyNzd: 59,
    maxCustomCases: 10,
    coachMessagesPerMonth: 150,
    documentAuditsPerMonth: 40,
    recommendationsPerMonth: 30,
    description:
      'Up to 10 active business workspaces, 150 AI Coach/Challenge turns/mo, 40 document audits/mo, 30 diagnostics/reviews.',
  },
  business_plus_monthly: {
    tierId: 'business_plus_monthly',
    planName: 'Business Plus',
    priceMonthlyNzd: 99,
    maxCustomCases: 30,
    coachMessagesPerMonth: 500,
    documentAuditsPerMonth: 150,
    recommendationsPerMonth: 100,
    description:
      'Up to 30 multi-entity business workspaces, 500 AI turns/mo, 150 document audits/mo, 100 diagnostics/reviews.',
  },
};

export function normalizeTierId(raw?: string | null): CanonicalTierId {
  if (raw === 'starter_monthly' || raw === 'essential_monthly') return 'starter_monthly';
  if (raw === 'growth_monthly') return 'growth_monthly';
  if (raw === 'business_plus_monthly' || raw === 'founding_monthly') return 'business_plus_monthly';
  return 'free_trial';
}

export interface MonthlyUsageCounters {
  coachMessages: number;
  documentAudits: number;
  recommendations: number;
  promptTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  requestCount: number;
}

export interface ServerUserAccountState {
  uid: string;
  email?: string;
  subscriptionTier: CanonicalTierId;
  subscriptionStatus: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  ownedCaseIds: string[];
  monthlyUsage: Record<string, MonthlyUsageCounters>;
  updatedAt: string;
}

export interface PersistentSaasStoreData {
  users: Record<string, ServerUserAccountState>;
  caseOwners: Record<string, string>;
  processedWebhookEventIds: string[];
}

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function createEmptyMonthlyCounters(): MonthlyUsageCounters {
  return {
    coachMessages: 0,
    documentAudits: 0,
    recommendations: 0,
    promptTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    requestCount: 0,
  };
}

/**
 * Resolves the effective plan for quota enforcement.
 * Paid tiers require an active/trialing/canceling status; past_due, unpaid, or canceled
 * accounts drop safely to Free Trial quotas without deleting saved user data.
 */
export function resolveEffectivePlan(userState: ServerUserAccountState): PlanDefinition {
  const tier = normalizeTierId(userState.subscriptionTier);
  if (tier === 'free_trial') return SAAS_PLANS.free_trial;
  const status = String(userState.subscriptionStatus || 'free').toLowerCase();
  if (status === 'active' || status === 'trialing' || status === 'canceling') {
    return SAAS_PLANS[tier];
  }
  return SAAS_PLANS.free_trial;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS || '';
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export class DurableSaasStore {
  private filePath: string;
  private cached: PersistentSaasStoreData | null = null;

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath;
    } else {
      const dataDir =
        process.env.BIZPULSE_DATA_DIR?.trim() || path.resolve(process.cwd(), '.bizpulse-data');
      this.filePath = path.join(dataDir, 'saas-state.json');
    }
  }

  getFilePath(): string {
    return this.filePath;
  }

  resetCache(): void {
    this.cached = null;
  }

  load(): PersistentSaasStoreData {
    if (this.cached) return this.cached;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.cached = {
          users: parsed?.users && typeof parsed.users === 'object' ? parsed.users : {},
          caseOwners:
            parsed?.caseOwners && typeof parsed.caseOwners === 'object' ? parsed.caseOwners : {},
          processedWebhookEventIds: Array.isArray(parsed?.processedWebhookEventIds)
            ? parsed.processedWebhookEventIds.slice(-500)
            : [],
        };
        return this.cached;
      }
    } catch (err: any) {
      console.warn('SaaS store read notice, starting fresh:', err?.message || err);
    }
    this.cached = { users: {}, caseOwners: {}, processedWebhookEventIds: [] };
    return this.cached;
  }

  save(): void {
    if (!this.cached) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.cached, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err: any) {
      console.warn('Could not persist SaaS state store:', err?.message || err);
    }
  }

  getOrInitUser(uid: string, email?: string): ServerUserAccountState {
    const state = this.load();
    if (!state.users[uid]) {
      state.users[uid] = {
        uid,
        email,
        subscriptionTier: 'free_trial',
        subscriptionStatus: 'free',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        ownedCaseIds: [],
        monthlyUsage: {},
        updatedAt: new Date().toISOString(),
      };
      this.save();
    } else if (email && !state.users[uid].email) {
      state.users[uid].email = email;
    }
    const monthKey = getCurrentMonthKey();
    if (!state.users[uid].monthlyUsage[monthKey]) {
      state.users[uid].monthlyUsage[monthKey] = createEmptyMonthlyCounters();
    }
    return state.users[uid];
  }

  hasProcessedWebhookEvent(eventId: string): boolean {
    if (!eventId) return false;
    return this.load().processedWebhookEventIds.includes(eventId);
  }

  markWebhookEventProcessed(eventId: string): void {
    if (!eventId) return;
    const state = this.load();
    if (!state.processedWebhookEventIds.includes(eventId)) {
      state.processedWebhookEventIds.push(eventId);
      if (state.processedWebhookEventIds.length > 500) {
        state.processedWebhookEventIds = state.processedWebhookEventIds.slice(-500);
      }
      this.save();
    }
  }

  findUserByStripeIds(subscriptionId?: string | null, customerId?: string | null): ServerUserAccountState | null {
    const users = Object.values(this.load().users);
    if (subscriptionId) {
      const bySub = users.find((u) => u.stripeSubscriptionId === subscriptionId);
      if (bySub) return bySub;
    }
    if (customerId) {
      const byCust = users.find((u) => u.stripeCustomerId === customerId);
      if (byCust) return byCust;
    }
    return null;
  }

  applyStripeWebhookEvent(event: {
    id?: string;
    type: string;
    data?: { object?: any };
  }): { handled: boolean; duplicate: boolean; affectedUid?: string } {
    if (event.id && this.hasProcessedWebhookEvent(event.id)) {
      return { handled: false, duplicate: true };
    }
    if (event.id) {
      this.markWebhookEventProcessed(event.id);
    }

    const obj = event.data?.object || {};
    let affectedUid: string | undefined;

    if (event.type === 'checkout.session.completed') {
      const userId = obj?.metadata?.userId;
      if (userId && obj.payment_status === 'paid') {
        const canonicalTier = normalizeTierId(obj.metadata?.tierId || 'starter_monthly');
        const userState = this.getOrInitUser(userId, obj.customer_details?.email);
        userState.subscriptionTier = canonicalTier;
        userState.subscriptionStatus = 'active';
        if (typeof obj.customer === 'string') userState.stripeCustomerId = obj.customer;
        if (typeof obj.subscription === 'string') userState.stripeSubscriptionId = obj.subscription;
        userState.updatedAt = new Date().toISOString();
        this.save();
        affectedUid = userId;
      }
    } else if (event.type === 'invoice.paid') {
      const subId = typeof obj.subscription === 'string' ? obj.subscription : null;
      const custId = typeof obj.customer === 'string' ? obj.customer : null;
      const targetUser =
        this.findUserByStripeIds(subId, custId) ||
        (obj.subscription_details?.metadata?.userId
          ? this.getOrInitUser(obj.subscription_details.metadata.userId)
          : null);
      if (targetUser) {
        if (targetUser.subscriptionTier === 'free_trial' && obj.subscription_details?.metadata?.tierId) {
          targetUser.subscriptionTier = normalizeTierId(obj.subscription_details.metadata.tierId);
        }
        if (targetUser.subscriptionStatus !== 'canceling') {
          targetUser.subscriptionStatus = 'active';
        }
        const periodEndSec = obj.lines?.data?.[0]?.period?.end;
        if (periodEndSec) {
          targetUser.currentPeriodEnd = new Date(Number(periodEndSec) * 1000).toISOString();
        }
        if (subId) targetUser.stripeSubscriptionId = subId;
        if (custId) targetUser.stripeCustomerId = custId;
        targetUser.updatedAt = new Date().toISOString();
        this.save();
        affectedUid = targetUser.uid;
      }
    } else if (event.type === 'invoice.payment_failed') {
      const subId = typeof obj.subscription === 'string' ? obj.subscription : null;
      const custId = typeof obj.customer === 'string' ? obj.customer : null;
      const targetUser = this.findUserByStripeIds(subId, custId);
      if (targetUser) {
        targetUser.subscriptionStatus = 'past_due';
        targetUser.updatedAt = new Date().toISOString();
        this.save();
        affectedUid = targetUser.uid;
      }
    } else if (event.type === 'customer.subscription.updated') {
      const subId = typeof obj.id === 'string' ? obj.id : null;
      const custId = typeof obj.customer === 'string' ? obj.customer : null;
      const targetUser =
        this.findUserByStripeIds(subId, custId) ||
        (obj.metadata?.userId ? this.getOrInitUser(obj.metadata.userId) : null);
      if (targetUser) {
        if (obj.metadata?.tierId) {
          targetUser.subscriptionTier = normalizeTierId(obj.metadata.tierId);
        }
        const stripeStatus = String(obj.status || '').toLowerCase();
        if (obj.cancel_at_period_end && (stripeStatus === 'active' || stripeStatus === 'trialing')) {
          targetUser.subscriptionStatus = 'canceling';
        } else if (stripeStatus === 'active' || stripeStatus === 'trialing') {
          targetUser.subscriptionStatus = 'active';
        } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
          targetUser.subscriptionStatus = 'past_due';
        } else if (stripeStatus === 'canceled') {
          targetUser.subscriptionTier = 'free_trial';
          targetUser.subscriptionStatus = 'canceled';
          targetUser.stripeSubscriptionId = null;
        }
        if (obj.current_period_end) {
          targetUser.currentPeriodEnd = new Date(Number(obj.current_period_end) * 1000).toISOString();
        }
        targetUser.updatedAt = new Date().toISOString();
        this.save();
        affectedUid = targetUser.uid;
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subId = typeof obj.id === 'string' ? obj.id : null;
      const custId = typeof obj.customer === 'string' ? obj.customer : null;
      const targetUser = this.findUserByStripeIds(subId, custId);
      if (targetUser) {
        targetUser.subscriptionTier = 'free_trial';
        targetUser.subscriptionStatus = 'canceled';
        targetUser.stripeSubscriptionId = null;
        targetUser.updatedAt = new Date().toISOString();
        this.save();
        affectedUid = targetUser.uid;
      }
    } else {
      return { handled: false, duplicate: false };
    }

    return { handled: true, duplicate: false, affectedUid };
  }

  buildAccountUsageSummary(
    uid: string,
    stripeConfigured: boolean,
    billingMode: 'live' | 'test' | 'unconfigured',
    email?: string | null
  ) {
    const userState = this.getOrInitUser(uid, email || undefined);
    const monthKey = getCurrentMonthKey();
    const counters = userState.monthlyUsage[monthKey];
    const effectivePlan = resolveEffectivePlan(userState);
    const storedPlan = SAAS_PLANS[normalizeTierId(userState.subscriptionTier)];
    const USD_TO_NZD = 1.65;

    return {
      monthKey,
      limits: {
        maxCustomCases: effectivePlan.maxCustomCases,
        coachMessagesPerMonth: effectivePlan.coachMessagesPerMonth,
        documentAuditsPerMonth: effectivePlan.documentAuditsPerMonth,
        recommendationsPerMonth: effectivePlan.recommendationsPerMonth,
      },
      used: {
        coachMessages: counters.coachMessages,
        documentAudits: counters.documentAudits,
        recommendations: counters.recommendations,
      },
      remaining: {
        coachMessages: Math.max(0, effectivePlan.coachMessagesPerMonth - counters.coachMessages),
        documentAudits: Math.max(0, effectivePlan.documentAuditsPerMonth - counters.documentAudits),
        recommendations: Math.max(0, effectivePlan.recommendationsPerMonth - counters.recommendations),
      },
      tokenUsage: {
        promptTokens: counters.promptTokens,
        outputTokens: counters.outputTokens,
        thinkingTokens: counters.thinkingTokens,
        totalTokens: counters.totalTokens,
        estimatedCostUsd: Number(counters.estimatedCostUsd.toFixed(4)),
        estimatedCostNzd: Number((counters.estimatedCostUsd * USD_TO_NZD).toFixed(4)),
        requestCount: counters.requestCount,
      },
      subscription: {
        tierId: effectivePlan.tierId,
        planName:
          userState.subscriptionStatus === 'past_due' && storedPlan.tierId !== 'free_trial'
            ? `${storedPlan.planName} (Payment Past Due)`
            : effectivePlan.planName,
        priceMonthlyNzd: storedPlan.priceMonthlyNzd,
        status: userState.subscriptionStatus || 'free',
        currentPeriodEnd: userState.currentPeriodEnd || null,
        stripeCustomerId: userState.stripeCustomerId || null,
        stripeSubscriptionId: userState.stripeSubscriptionId || null,
        stripeConfigured,
        billingMode,
        isAdmin: isAdminEmail(email || userState.email),
      },
    };
  }

  buildAdminMetricsSummary() {
    const state = this.load();
    const monthKey = getCurrentMonthKey();
    const USD_TO_NZD = 1.65;

    const users = Object.values(state.users);
    const tierCounts: Record<CanonicalTierId, number> = {
      free_trial: 0,
      starter_monthly: 0,
      growth_monthly: 0,
      business_plus_monthly: 0,
    };

    let estimatedMonthlyMrrNzd = 0;
    let totalRequests = 0;
    let totalTokens = 0;
    let totalEstimatedCostUsd = 0;
    let pastDueAccounts = 0;

    for (const u of users) {
      const effectivePlan = resolveEffectivePlan(u);
      tierCounts[effectivePlan.tierId] += 1;
      if (effectivePlan.tierId !== 'free_trial') {
        estimatedMonthlyMrrNzd += effectivePlan.priceMonthlyNzd;
      }
      if (u.subscriptionStatus === 'past_due') {
        pastDueAccounts += 1;
      }
      const m = u.monthlyUsage?.[monthKey];
      if (m) {
        totalRequests += m.requestCount || 0;
        totalTokens += m.totalTokens || 0;
        totalEstimatedCostUsd += m.estimatedCostUsd || 0;
      }
    }

    const totalEstimatedCostNzd = Number((totalEstimatedCostUsd * USD_TO_NZD).toFixed(4));
    const targetMrrNzd = 3000;

    return {
      monthKey,
      totalRegisteredAccounts: users.length,
      tierCounts,
      pastDueAccounts,
      estimatedMonthlyMrrNzd,
      targetMrrNzd,
      targetProgressPct: Math.min(100, Math.round((estimatedMonthlyMrrNzd / targetMrrNzd) * 100)),
      monthlyAiUsage: {
        totalRequests,
        totalTokens,
        estimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(4)),
        estimatedCostNzd: totalEstimatedCostNzd,
        estimatedGrossMarginNzd: Number((estimatedMonthlyMrrNzd - totalEstimatedCostNzd).toFixed(2)),
      },
    };
  }
}
