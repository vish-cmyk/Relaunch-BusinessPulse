import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Check, 
  X, 
  CreditCard, 
  ArrowRight, 
  Lock, 
  HelpCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Bot
} from 'lucide-react';
import { CaseRecord } from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface CheckoutModalProps {
  caseRecord: CaseRecord;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (record: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  caseRecord,
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currency = caseRecord.profile.currency || 'NZD';
  const price = 99;

  const handleStartCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          caseId: caseRecord.id,
          businessName: caseRecord.profile.name,
          currency: currency,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.configured === false) {
        throw new Error(data.error || 'Stripe payment integration is not configured on the server. Please set STRIPE_SECRET_KEY to enable live checkout.');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error initiating checkout.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#E5EBEF] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-[#14283F] space-y-6 p-6 sm:p-8 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5EBEF] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30 flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#168C83] block">
                Executive Upgrade
              </span>
              <h3 className="text-xl font-bold text-[#14283F]">
                Comprehensive Turnaround Diagnostic OS
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#14283F] hover:bg-[#F1F5F9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pricing Banner */}
        <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-[#CBD5E1] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#64748B] block font-medium">One-Time Diagnostic License</span>
            <div className="text-3xl font-extrabold text-[#14283F] mt-0.5 font-mono">
              {currency} ${price}
              <span className="text-xs font-normal text-[#64748B]"> + GST</span>
            </div>
            <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
              No recurring subscription • Lifetime case access
            </span>
          </div>

          <div className="text-right text-xs text-[#64748B] space-y-1">
            <div className="flex items-center justify-end gap-1 text-[#14283F] font-semibold">
              <Lock className="w-3.5 h-3.5 text-[#168C83]" />
              <span>Stripe 256-bit SSL</span>
            </div>
            <div>New Zealand Commercial Terms</div>
          </div>
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block">
            What is Included with this Business License:
          </span>

          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: FileText, title: 'Complete 10-Section Executive Turnaround Memo', desc: 'Case-specific commercial diagnosis, root causes, and 48-hour decision gates.' },
              { icon: DollarSign, title: 'Interactive Working Capital & Overdraft Simulator', desc: 'Real-time modeling of delinquent debt recovery and upfront supplies float.' },
              { icon: TrendingUp, title: 'Customer Economics & Price Review Sensitivity Engine', desc: 'Mathematical sensitivity of 8–12% price adjustments against churn risk.' },
              { icon: Bot, title: 'Live AI Commercial Advisory Console (Gemini 2.5 Flash)', desc: 'Roleplay customer discussions, test strategies, and generate firm legal letters.' },
              { icon: Sparkles, title: 'Universal Export Suite', desc: 'Download Word (.docx), PowerPoint (.pptx), Vector Infographic (.svg), and PDF.' },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF]">
                  <div className="p-1.5 rounded-lg bg-[#E6F4F2] text-[#168C83] shrink-0 mt-0.5 border border-[#168C83]/20">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-[#14283F] block font-semibold">{f.title}</strong>
                    <span className="text-[#64748B] text-[11px]">{f.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleStartCheckout}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#168C83] hover:bg-[#12726B] disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-sm transition transform active:scale-[0.98]"
          >
            <CreditCard className="w-4 h-4" />
            <span>{isLoading ? 'Connecting to Stripe...' : `Proceed to Secure Checkout (${currency} $${price})`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1 font-medium">
            <span>Stripe Encrypted Checkout</span>
            <span className="text-[#14283F] font-mono">Instant Case Access Upon Payment</span>
          </div>
        </div>

      </div>
    </div>
  );
};
