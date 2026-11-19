import React, { useState } from 'react';
import {
  Check,
  X,
  CreditCard,
  ArrowRight,
  Lock,
  Crown,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { CaseRecord, SubscriptionTier } from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface CheckoutModalProps {
  caseRecord: CaseRecord;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (record: any) => void;
  onSelectPreviewTier?: (tier: SubscriptionTier) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  caseRecord,
  isOpen,
  onClose,
  onSelectPreviewTier,
}) => {
  const [selectedTier, setSelectedTier] = useState<'essential_monthly' | 'founding_monthly'>(
    caseRecord.subscriptionTier === 'founding_monthly' ? 'founding_monthly' : 'essential_monthly'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const currency = caseRecord.profile.currency || 'NZD';
  const usage = caseRecord.usageStats || {
    coachMessagesCount: 0,
    documentsAnalyzedCount: caseRecord.uploadedDocuments?.length || 0,
    recommendationsCount: caseRecord.recommendations ? 1 : 0,
  };

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
          currency,
          tierId: selectedTier,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.configured === false) {
        onSelectPreviewTier?.(selectedTier);
        setNotice(
          data.error ||
            'Preview Mode: Live Stripe billing is intentionally disabled in this workspace. No payment has been charged.'
        );
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setNotice('Preview Mode: Live checkout is disabled.');
      }
    } catch (err: any) {
      console.error(err);
      setNotice(
        err.message ||
          'Preview Mode: Live billing is disabled while validating diagnostic workflows.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070B14]/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#D9E2F0] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-[#0B1324] my-6">
        {/* Black-to-Blue Header */}
        <div className="bizpulse-hero-gradient text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] text-white flex items-center justify-center border border-white/20">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#93C5FD] block">
                Membership &amp; Usage Transparency
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                Two-Tier Monthly Plans &amp; Founding Membership
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Preview / Billing Disabled Banner */}
          <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#0B1324] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#1D4ED8]">Live Billing Disabled (Preview Only): </strong>
              Pricing tiers and usage quotas are displayed transparently for SME owners. No live charges or recurring Stripe subscriptions are active until explicitly approved.
            </div>
          </div>

          {/* Current Session Usage Counters */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
              <span className="text-[11px] text-[#52627A] font-semibold block">
                AI Coach Queries (This Case)
              </span>
              <span className="text-lg font-extrabold text-[#0B1324] font-mono tabular-nums mt-0.5 block">
                {usage.coachMessagesCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
              <span className="text-[11px] text-[#52627A] font-semibold block">
                Document Audits Uploaded
              </span>
              <span className="text-lg font-extrabold text-[#0B1324] font-mono tabular-nums mt-0.5 block">
                {usage.documentsAnalyzedCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
              <span className="text-[11px] text-[#52627A] font-semibold block">
                Diagnostic Plans Run
              </span>
              <span className="text-lg font-extrabold text-[#0B1324] font-mono tabular-nums mt-0.5 block">
                {usage.recommendationsCount}
              </span>
            </div>
          </div>

          {/* Two-Tier Monthly Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tier 1: Essential Coach Monthly */}
            <div
              onClick={() => setSelectedTier('essential_monthly')}
              className={`rounded-2xl p-5 border-2 cursor-pointer transition flex flex-col justify-between space-y-4 ${
                selectedTier === 'essential_monthly'
                  ? 'border-[#1D4ED8] bg-[#F8FAFF]'
                  : 'border-[#D9E2F0] bg-white hover:border-[#93C5FD]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#52627A]">
                    Tier 1 · Standard Monthly
                  </span>
                  {selectedTier === 'essential_monthly' && (
                    <span className="px-2 py-0.5 rounded bg-[#1D4ED8] text-white text-[10px] font-bold">
                      Selected
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-lg font-extrabold text-[#0B1324]">
                    Essential Business Coach
                  </h4>
                  <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                    <span className="text-2xl font-extrabold text-[#0B1324]">
                      {currency} $49
                    </span>
                    <span className="text-xs text-[#52627A]">/ month (+ GST)</span>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-[#0B1324] pt-2 border-t border-[#E8EEF7]">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <span>Up to <strong>3 active business sessions</strong> with full isolation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <span><strong>25 AI Coach queries &amp; challenges</strong> per month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <span><strong>5 Document financial audits</strong> per month (CSV, PDF, DOCX, XLSX)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <span>Full 8-Dimension scoring + PDF, Word &amp; PowerPoint exports</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Tier 2: Founding Member Growth OS */}
            <div
              onClick={() => setSelectedTier('founding_monthly')}
              className={`rounded-2xl p-5 border-2 cursor-pointer transition flex flex-col justify-between space-y-4 ${
                selectedTier === 'founding_monthly'
                  ? 'border-[#1D4ED8] bg-[#0F172A] text-white'
                  : 'border-[#0F172A] bg-[#0F172A] text-white opacity-95 hover:opacity-100'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#93C5FD]">
                    Tier 2 · Founding Membership
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#1D4ED8] text-white text-[10px] font-bold">
                    {selectedTier === 'founding_monthly' ? 'Selected · Locked Rate' : 'Founding Rate'}
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-extrabold text-white">
                    Founding Member Growth OS
                  </h4>
                  <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                    <span className="text-2xl font-extrabold text-white">
                      {currency} $99
                    </span>
                    <span className="text-xs text-[#CBD5E1]">/ month (+ GST)</span>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-[#E2E8F0] pt-2 border-t border-white/15">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span><strong>Unlimited business sessions</strong> &amp; multi-entity tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span><strong>Unlimited AI Coach queries</strong> &amp; recommendation challenges</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span><strong>Unlimited Document financial audits</strong> &amp; evidence tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span>Price lock guarantee + early access to new cashflow &amp; client tools</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {notice && (
            <div className="p-3.5 rounded-xl bg-[#F3F6FB] border border-[#CBD5E1] text-[#0B1324] text-xs font-medium">
              {notice}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleCheckoutAction}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-sm transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isLoading
                  ? 'Checking Billing Configuration...'
                  : selectedTier === 'founding_monthly'
                  ? `Preview Founding Member Plan (${currency} $99/mo)`
                  : `Preview Essential Coach Plan (${currency} $49/mo)`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#52627A] px-1 font-medium">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Cancel anytime • Transparent SME monthly pricing</span>
              </span>
              <span className="flex items-center gap-1 text-[#0B1324]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                <span>No live card charges processed in preview</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
