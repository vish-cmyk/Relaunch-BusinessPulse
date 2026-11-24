import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  CreditCard,
  ArrowRight,
  Lock,
  Crown,
  ShieldCheck,
  Info,
  Download,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Activity,
  BarChart3,
} from 'lucide-react';
import { AccountUsageSummary, CaseRecord } from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';
import { PUBLIC_MEMBERSHIP_PLANS, MEMBERSHIP_BILLING_POLICIES } from '../data/membershipPlans';

interface CheckoutModalProps {
  caseRecord: CaseRecord;
  isOpen: boolean;
  onClose: () => void;
  accountUsage: AccountUsageSummary | null;
  userEmail?: string | null;
  onUsageUpdated?: (usage: AccountUsageSummary) => void;
  onExportAllAccountData?: () => void;
  onDeleteAccount?: () => Promise<void>;
}

type PaidTierId = 'starter_monthly' | 'growth_monthly' | 'business_plus_monthly';

interface AdminMetricsData {
  monthKey: string;
  totalRegisteredAccounts: number;
  tierCounts: Record<string, number>;
  pastDueAccounts: number;
  estimatedMonthlyMrrNzd: number;
  targetMrrNzd: number;
  targetProgressPct: number;
  monthlyAiUsage: {
    totalRequests: number;
    totalTokens: number;
    estimatedCostUsd: number;
    estimatedCostNzd: number;
    estimatedGrossMarginNzd: number;
  };
}

const PAID_PLAN_CARDS = PUBLIC_MEMBERSHIP_PLANS.filter(
  (p): p is (typeof PUBLIC_MEMBERSHIP_PLANS)[number] & { id: PaidTierId } => p.id !== 'free_trial'
);
const FREE_PLAN = PUBLIC_MEMBERSHIP_PLANS.find((p) => p.id === 'free_trial')!;

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  caseRecord,
  isOpen,
  onClose,
  accountUsage,
  userEmail,
  onUsageUpdated,
  onExportAllAccountData,
  onDeleteAccount,
}) => {
  const activeTierId = accountUsage?.subscription?.tierId || 'free_trial';
  const [selectedTier, setSelectedTier] = useState<PaidTierId>(
    activeTierId === 'growth_monthly' || activeTierId === 'business_plus_monthly'
      ? activeTierId
      : 'starter_monthly'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(
    null
  );
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetricsData | null>(null);

  useEffect(() => {
    if (
      activeTierId === 'starter_monthly' ||
      activeTierId === 'growth_monthly' ||
      activeTierId === 'business_plus_monthly'
    ) {
      setSelectedTier(activeTierId);
    }
  }, [activeTierId]);

  useEffect(() => {
    if (!isOpen || !accountUsage?.subscription?.isAdmin) {
      setAdminMetrics(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/admin/metrics', { headers: authHeaders });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.adminMetrics) {
          setAdminMetrics(data.adminMetrics);
        }
      } catch {
        // Non-admin or offline; fail quietly
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, accountUsage?.subscription?.isAdmin]);

  if (!isOpen) return null;

  const sub = accountUsage?.subscription;
  const limits = accountUsage?.limits || FREE_PLAN.limits;
  const used = accountUsage?.used || {
    coachMessages: 0,
    documentAudits: 0,
    recommendations: 0,
  };
  const tokens = accountUsage?.tokenUsage || {
    promptTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    estimatedCostNzd: 0,
    requestCount: 0,
  };

  const selectedPlanObj = PAID_PLAN_CARDS.find((p) => p.id === selectedTier) || PAID_PLAN_CARDS[0];
  const isPaidActive = Boolean(sub && sub.tierId !== 'free_trial' && sub.status !== 'canceled');
  const isPastDue = sub?.status === 'past_due';
  const isCanceling = sub?.status === 'canceling';

  const handleCheckoutAction = async () => {
    setIsLoading(true);
    setNotice(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: caseRecord.id,
          businessName: caseRecord.profile.name,
          userEmail: userEmail || undefined,
          tierId: selectedTier,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.configured === false) {
        setNotice({
          tone: 'info',
          text:
            data.error ||
            'Stripe billing is not configured on this server yet. Live card checkout activates once STRIPE_SECRET_KEY is configured.',
        });
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setNotice({ tone: 'info', text: 'Unable to open Stripe Checkout URL.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({
        tone: 'error',
        text: err.message || 'Unable to reach billing service.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/payment/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.portalUrl) {
        setNotice({
          tone: 'info',
          text: data.error || 'Billing portal is only available after a live Stripe subscription is active.',
        });
        return;
      }
      window.location.href = data.portalUrl;
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to open billing portal.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/payment/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to cancel subscription.');
      }
      if (data.accountUsage) {
        onUsageUpdated?.(data.accountUsage);
      }
      setNotice({
        tone: 'success',
        text: 'Subscription cancellation updated cleanly. Your saved business data remains accessible.',
      });
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Cancellation failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteConfirmInput.trim() !== 'DELETE' || !onDeleteAccount || isDeletingAccount) return;
    setIsDeletingAccount(true);
    setNotice(null);
    try {
      await onDeleteAccount();
    } catch (err: any) {
      setNotice({
        tone: 'error',
        text: err.message || 'Unable to delete account completely. Please try signing in again before deleting.',
      });
      setIsDeletingAccount(false);
    }
  };

  const renderUsageMeter = (label: string, usedCount: number, maxCount: number) => {
    const pct = maxCount > 0 ? Math.min(100, Math.round((usedCount / maxCount) * 100)) : 0;
    return (
      <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#475569] font-semibold">{label}</span>
          <span className="font-mono font-bold text-[#0F172A] tabular-nums">
            {usedCount} / {maxCount}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#E4E4E7] rounded overflow-hidden">
          <div
            className={`h-full transition-all ${
              pct >= 90 ? 'bg-[#B91C1C]' : pct >= 70 ? 'bg-[#D97706]' : 'bg-[#15803D]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050811]/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#0F172A]/15 rounded w-full max-w-4xl shadow-2xl overflow-hidden text-[#0F172A] my-6 max-h-[92vh] flex flex-col">
        {/* Charcoal Header */}
        <div className="bizpulse-hero-gradient text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded bg-[#2563EB] text-white flex items-center justify-center border border-white/15">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#60A5FA] block">
                Membership Plan, AI Allowances &amp; Data Ownership
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {sub?.planName || 'Free Trial'} · {userEmail || 'Authenticated Account'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[#CBD5E1] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {isPastDue && (
            <div className="p-3.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Payment Past Due: </strong>
                Your latest renewal payment did not succeed, so AI allowances have temporarily reverted to Free Trial limits while all your saved business records remain safe. Update your card in Manage Billing to restore paid allowances.
              </div>
            </div>
          )}

          {isCanceling && sub?.currentPeriodEnd && (
            <div className="p-3.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#B45309] flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Cancellation Scheduled: </strong>
                Your paid membership remains active until {new Date(sub.currentPeriodEnd).toLocaleDateString()} and will return to Free Trial limits after that date without deleting your saved data.
              </div>
            </div>
          )}

          {!sub?.stripeConfigured && (
            <div className="p-3.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#0F172A] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#1D4ED8]">Account Quotas Active · Billing Not Enabled Yet: </strong>
                Monthly allowances and token metering are actively enforced per account. Card checkout activates automatically once Stripe server keys are connected.
              </div>
            </div>
          )}

          {/* Monthly Account Quotas + Token Metering */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#2563EB]" />
                Monthly Account AI Allowance ({accountUsage?.monthKey || 'Current Month'})
              </span>
              <span className="text-[11px] font-mono text-[#475569] tabular-nums">
                Tokens: {tokens.totalTokens.toLocaleString()} · Est. AI Cost: NZ${tokens.estimatedCostNzd.toFixed(3)} ({tokens.requestCount} calls)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {renderUsageMeter('AI Coach & Challenge', used.coachMessages, limits.coachMessagesPerMonth)}
              {renderUsageMeter('Document Audits', used.documentAudits, limits.documentAuditsPerMonth)}
              {renderUsageMeter('Diagnostics & Reviews', used.recommendations, limits.recommendationsPerMonth)}
              <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                <span className="text-[11px] text-[#475569] font-semibold block">
                  Custom Business Limit
                </span>
                <span className="text-sm font-bold text-[#0F172A] font-mono tabular-nums block">
                  Up to {limits.maxCustomCases} session{limits.maxCustomCases === 1 ? '' : 's'}
                </span>
                <span className="text-[10px] text-[#475569] block">
                  Sample Demo case does not consume slots
                </span>
              </div>
            </div>
          </div>

          {/* Free Trial Baseline Strip */}
          <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-[#0F172A] block">
                Free Trial Plan (NZ$0 / month)
              </span>
              <span className="text-[#475569]">
                1 private business workspace · 15 AI Coach/Challenge turns · 2 document audits · 3 diagnostic plans/reviews per month.
              </span>
            </div>
            {activeTierId === 'free_trial' && (
              <span className="px-2.5 py-1 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] font-bold text-[11px] shrink-0">
                Current Plan
              </span>
            )}
          </div>

          {/* 3-Tier Monthly Plans (Strictly NZD) */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#475569] block">
              Select Paid Monthly Membership (Billed in NZD)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PAID_PLAN_CARDS.map((plan) => {
                const isSelected = selectedTier === plan.id;
                const isCurrent = activeTierId === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedTier(plan.id)}
                    className={`rounded p-5 border-2 cursor-pointer transition flex flex-col justify-between space-y-4 ${
                      plan.id === 'business_plus_monthly'
                        ? isSelected
                          ? 'border-[#2563EB] bg-[#0B1324] text-white'
                          : 'border-[#0B1324] bg-[#0B1324] text-white opacity-95 hover:opacity-100'
                        : isSelected
                        ? 'border-[#2563EB] bg-[#EFF6FF]/70 text-[#0F172A]'
                        : 'border-[#0F172A]/12 bg-white hover:border-[#2563EB]/50 text-[#0F172A]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            plan.id === 'business_plus_monthly' ? 'text-[#60A5FA]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {plan.badge}
                        </span>
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded bg-[#15803D] text-white text-[10px] font-bold">
                            Active Plan
                          </span>
                        ) : isSelected ? (
                          <span className="px-2 py-0.5 rounded bg-[#2563EB] text-white text-[10px] font-bold">
                            Selected
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h4 className="text-base font-bold">{plan.name}</h4>
                        <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                          <span className="text-2xl font-bold">NZ${plan.priceNzd}</span>
                          <span
                            className={`text-xs ${
                              plan.id === 'business_plus_monthly' ? 'text-[#CBD5E1]' : 'text-[#475569]'
                            }`}
                          >
                            / month
                          </span>
                        </div>
                      </div>

                      <ul
                        className={`space-y-2 text-xs pt-2 border-t ${
                          plan.id === 'business_plus_monthly'
                            ? 'border-white/15 text-[#E2E8F0]'
                            : 'border-[#0F172A]/10 text-[#0F172A]'
                        }`}
                      >
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <Check
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                plan.id === 'business_plus_monthly' ? 'text-[#60A5FA]' : 'text-[#15803D]'
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {notice && (
            <div
              className={`p-3.5 rounded border text-xs font-medium ${
                notice.tone === 'error'
                  ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                  : notice.tone === 'success'
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#15803D]'
                  : 'bg-[#F8FAFC] border-[#0F172A]/15 text-[#0F172A]'
              }`}
            >
              {notice.text}
            </div>
          )}

          {/* Subscription Action Buttons */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCheckoutAction}
                disabled={isLoading}
                className="flex-1 min-w-[220px] py-3 px-4 rounded bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition"
              >
                <CreditCard className="w-4 h-4 text-[#60A5FA]" />
                <span>
                  {isLoading
                    ? 'Contacting Billing Server...'
                    : `Continue with ${selectedPlanObj.name} (NZ$${selectedPlanObj.priceNzd}/mo)`}
                </span>
                <ArrowRight className="w-4 h-4 text-[#60A5FA]" />
              </button>

              {isPaidActive && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenBillingPortal}
                    disabled={isLoading}
                    className="px-4 py-3 rounded bg-white hover:bg-[#F8FAFC] border border-[#0F172A]/15 text-xs font-bold text-[#0F172A] flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Manage Billing</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={isLoading}
                    className="px-4 py-3 rounded bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-xs font-bold text-[#B91C1C] transition"
                  >
                    Cancel Subscription
                  </button>
                </>
              )}
            </div>

            <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[11px] text-[#475569] space-y-1">
              <p>
                <strong className="text-[#0F172A]">Billing &amp; Allowance Policy: </strong>
                {MEMBERSHIP_BILLING_POLICIES.currencyNotice} {MEMBERSHIP_BILLING_POLICIES.gstNotice}
              </p>
              <p>{MEMBERSHIP_BILLING_POLICIES.allowancePolicy}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#475569] px-1 font-medium">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Cancel anytime • Rate-limited &amp; metered server-side</span>
              </span>
              <span className="flex items-center gap-1 text-[#0F172A]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Memberships attach strictly to your verified account</span>
              </span>
            </div>
          </div>

          {/* Founder / Admin Unit Economics View (rendered strictly when server confirms ADMIN_EMAILS) */}
          {adminMetrics && (
            <div className="pt-5 border-t border-[#0F172A]/12 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8] flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                <span>Founder Unit Economics ({adminMetrics.monthKey})</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE]">
                  <span className="text-[10px] text-[#1D4ED8] uppercase font-bold block">Est. MRR vs Target</span>
                  <strong className="text-base font-mono text-[#0F172A]">
                    NZ${adminMetrics.estimatedMonthlyMrrNzd.toLocaleString()}
                  </strong>
                  <span className="text-[10px] text-[#475569] block">
                    {adminMetrics.targetProgressPct}% of NZ${adminMetrics.targetMrrNzd.toLocaleString()} target
                  </span>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/12">
                  <span className="text-[10px] text-[#475569] uppercase font-bold block">Accounts by Tier</span>
                  <strong className="text-base font-mono text-[#0F172A]">
                    {adminMetrics.totalRegisteredAccounts} Total
                  </strong>
                  <span className="text-[10px] text-[#475569] block">
                    F:{adminMetrics.tierCounts.free_trial || 0} S:{adminMetrics.tierCounts.starter_monthly || 0} G:{adminMetrics.tierCounts.growth_monthly || 0} B+:{adminMetrics.tierCounts.business_plus_monthly || 0}
                  </span>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/12">
                  <span className="text-[10px] text-[#475569] uppercase font-bold block">Platform AI Cost</span>
                  <strong className="text-base font-mono text-[#0F172A]">
                    NZ${adminMetrics.monthlyAiUsage.estimatedCostNzd.toFixed(2)}
                  </strong>
                  <span className="text-[10px] text-[#475569] block">
                    {adminMetrics.monthlyAiUsage.totalTokens.toLocaleString()} tokens ({adminMetrics.monthlyAiUsage.totalRequests} calls)
                  </span>
                </div>
                <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
                  <span className="text-[10px] text-[#15803D] uppercase font-bold block">Net Margin Before Infra</span>
                  <strong className="text-base font-mono text-[#15803D]">
                    NZ${adminMetrics.monthlyAiUsage.estimatedGrossMarginNzd.toFixed(2)}
                  </strong>
                  <span className="text-[10px] text-[#475569] block">
                    Past-due accounts: {adminMetrics.pastDueAccounts}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Data Ownership & Account Deletion Section */}
          <div className="pt-5 border-t border-[#0F172A]/12 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Data Ownership, Export &amp; Account Deletion
                </h4>
                <p className="text-xs text-[#475569] mt-0.5">
                  Download a complete JSON archive of all saved businesses, diagnostics, continuity logs, CRM records, and ROI models, or permanently erase your account.
                </p>
              </div>
              {onExportAllAccountData && (
                <button
                  type="button"
                  onClick={onExportAllAccountData}
                  className="px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#0F172A]/15 text-xs font-bold text-[#0F172A] flex items-center gap-1.5 shrink-0 transition"
                >
                  <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Export All Account Data (.json)</span>
                </button>
              )}
            </div>

            {onDeleteAccount && (
              <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-3">
                <div className="flex items-start gap-2 text-xs text-[#B91C1C]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Danger Zone — Delete Account Permanently: </strong>
                    This removes all saved business sessions, uploaded document audits, CRM records, and cancels any active subscription immediately. Type <strong>DELETE</strong> to confirm.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="bg-white border border-[#FECACA] rounded px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#B91C1C] w-48"
                  />
                  <button
                    type="button"
                    disabled={deleteConfirmInput.trim() !== 'DELETE' || isDeletingAccount}
                    onClick={handlePermanentDelete}
                    className="px-3.5 py-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeletingAccount ? 'Deleting Account...' : 'Delete Account Permanently'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
