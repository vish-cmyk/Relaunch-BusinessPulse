import React, { useState } from 'react';
import { X, MessageSquarePlus, CheckCircle2, AlertTriangle, Send, Star } from 'lucide-react';
import { CaseRecord, PilotFeedbackEntry } from '../types/bizpulse';
import { apiFetchWithAuth } from '../services/firebase';

interface PilotFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  activeCase: CaseRecord;
  onSaveToCase: (entry: PilotFeedbackEntry) => void;
}

const FEEDBACK_AREAS = [
  { id: 'essentials', label: '1. Business Essentials (Profile Setup)' },
  { id: 'health', label: '2. Business Health (12 Capabilities)' },
  { id: 'documents', label: '3. Document Intelligence & Synthesis' },
  { id: 'recommendations', label: '4. Coaching & Actions' },
  { id: 'roadmap', label: '5. Action Plan (30/60/90 Days)' },
  { id: 'memo', label: 'Executive Business Report & Exports' },
  { id: 'cashflow', label: 'Cash Flow & Financial Ledger' },
  { id: 'clientmatrix', label: 'CRM & Clients' },
  { id: 'options', label: 'ROI & Options Calculator' },
  { id: 'dashboard', label: 'Scoreboard, Continuity & KPI Tracker' },
  { id: 'sprint', label: '7-Day Sprint & Templates' },
  { id: 'challengeme', label: 'Challenge Me' },
  { id: 'aicoach', label: 'Chat with Coach' },
  { id: 'general', label: 'Overall Navigation & Clarity' },
];

export const PilotFeedbackModal: React.FC<PilotFeedbackModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  activeCase,
  onSaveToCase,
}) => {
  const defaultArea =
    FEEDBACK_AREAS.find((a) => a.id === activeTab)?.label || 'Overall Navigation & Clarity';

  const [area, setArea] = useState<string>(defaultArea);
  const [rating, setRating] = useState<number>(4);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setArea(FEEDBACK_AREAS.find((a) => a.id === activeTab)?.label || 'Overall Navigation & Clarity');
      setError(null);
      setSubmittedNotice(null);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const history = activeCase.pilotFeedback || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanComment = comment.trim();
    if (!cleanComment || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSubmittedNotice(null);

    try {
      const { data } = await apiFetchWithAuth<{ saved: boolean; entry?: PilotFeedbackEntry }>(
        '/api/pilot/feedback',
        {
          method: 'POST',
          body: {
            caseId: activeCase.id,
            area,
            rating,
            comment: cleanComment,
          },
        }
      );

      const entry: PilotFeedbackEntry = {
        id: data?.entry?.id || `fb-${Date.now()}`,
        area,
        rating,
        comment: cleanComment,
        caseName: activeCase.profile.name,
        createdAt: data?.entry?.createdAt || new Date().toISOString(),
      };

      onSaveToCase(entry);
      setComment('');
      setSubmittedNotice('Thank you — your pilot feedback was recorded for review.');
    } catch (err: any) {
      setError(err?.message || 'Unable to submit feedback right now. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050811]/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#0F172A]/15 rounded w-full max-w-2xl shadow-2xl overflow-hidden text-[#0F172A] my-6 max-h-[90vh] flex flex-col">
        <div className="bizpulse-hero-gradient text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#2563EB] flex items-center justify-center border border-white/15">
              <MessageSquarePlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#60A5FA] block">
                Invitation-Only Pilot Feedback
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Share Feedback on Relaunch BizPulse
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pilot feedback modal"
            className="p-1.5 rounded text-[#CBD5E1] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <p className="text-xs text-[#475569] leading-relaxed">
            Tell us what worked well, what felt confusing, or what was missing while using{' '}
            <strong className="text-[#0F172A]">{activeCase.profile.name}</strong>. Your notes stay private to your pilot workspace and help refine the platform.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#0F172A] block mb-1.5">
                  Section / Feature
                </label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-xs text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  {FEEDBACK_AREAS.map((opt) => (
                    <option key={opt.id} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F172A] block mb-1.5">
                  Clarity &amp; Usefulness (1–5)
                </label>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRating(num)}
                      className={`flex-1 py-2 rounded border text-xs font-bold flex items-center justify-center gap-1 transition ${
                        rating === num
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#0F172A]/15 hover:border-[#2563EB]'
                      }`}
                    >
                      <Star className={`w-3 h-3 ${rating >= num ? 'text-[#F59E0B]' : ''}`} />
                      <span>{num}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#0F172A] block mb-1.5">
                What worked, felt unclear, or needs adjustment? *
              </label>
              <textarea
                rows={4}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g., 'Cash Flow numbers were clear, but I expected to see...' or 'Action Plan steps helped me spot overdue accounts quickly.'"
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3.5 py-2.5 text-xs text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            {error && (
              <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {submittedNotice && (
              <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{submittedNotice}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !comment.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>

          {history.length > 0 && (
            <div className="pt-4 border-t border-[#0F172A]/10 space-y-2.5">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569]">
                Your Submitted Notes ({history.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#0F172A]">{item.area}</span>
                      <span className="font-mono text-[10px] text-[#475569]">
                        {item.rating}/5 · {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[#334155] leading-relaxed">{item.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
