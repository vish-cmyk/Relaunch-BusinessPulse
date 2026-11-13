import React, { useState } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Clock, 
  MessageSquare
} from 'lucide-react';
import { 
  BusinessProfile, 
  HealthDimensionKey, 
  HealthDimensionInput, 
  OverallHealthAssessment, 
  FinancialData, 
  RecommendationOutput 
} from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface RecommendationViewProps {
  profile: BusinessProfile;
  healthInputs: Record<HealthDimensionKey, HealthDimensionInput>;
  financials: FinancialData | null;
  overallHealth: OverallHealthAssessment | null;
  recommendations: RecommendationOutput | null;
  onUpdateRecommendations: (rec: RecommendationOutput) => void;
  onNavigateToConsole: (initialPrompt?: string) => void;
}

export const RecommendationView: React.FC<RecommendationViewProps> = ({
  profile,
  healthInputs,
  financials,
  overallHealth,
  recommendations,
  onUpdateRecommendations,
  onNavigateToConsole,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateRecommendation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/generate-recommendation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          caseId: profile.caseId,
          businessProfile: profile,
          healthInputs,
          financials,
          overallHealth,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server returned an error generating recommendation.');
      }

      const data = await response.json();
      if (data.recommendation) {
        onUpdateRecommendations(data.recommendation);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with Gemini recommendation engine.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Context Card */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#168C83]" />
                Phase 3: Turnaround Diagnostic Engine
              </span>
              <span className="text-[#64748B] text-xs">Dynamic Commercial Advisory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#14283F] tracking-tight">
              Executive Recommendations
            </h2>
            <p className="text-sm text-[#64748B] max-w-2xl leading-relaxed">
              Grounded strictly in your business profile ({profile.industry}, {profile.country}) and 8 health inputs. Identifies the primary commercial issue, immediate actions, and key evidence gaps without lengthy questionnaires.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleGenerateRecommendation}
              disabled={isLoading}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#168C83] hover:bg-[#12726B] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition transform active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Synthesizing...' : recommendations ? 'Regenerate Analysis' : 'Generate Recommendation'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[#64748B] hover:text-[#14283F]">✕</button>
          </div>
        )}
      </div>

      {/* Main Recommendation Content */}
      {recommendations ? (
        <div className="space-y-6">
          {/* 1: Primary Commercial Observation & Why It Matters */}
          <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-[#E6F4F2] text-[#168C83] font-black text-xs flex items-center justify-center border border-[#168C83]/30">
                1
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#168C83]">
                Primary Commercial Observation
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-[#14283F] leading-snug">
              {recommendations.initialObservation}
            </h3>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] text-xs text-[#14283F] space-y-1.5 leading-relaxed">
              <strong className="text-[#D99A35] uppercase tracking-wider text-[11px] block">
                Why This Matters Commercially (Profit, Solvency & Capacity):
              </strong>
              <p className="text-[#64748B] leading-relaxed">{recommendations.commercialWhy}</p>
            </div>
          </div>

          {/* 2: Knowns vs Assumptions vs Unknowns */}
          <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#14283F] font-bold text-xs flex items-center justify-center border border-[#E2E8F0]">
                2
              </span>
              <h4 className="font-bold text-[#14283F] text-base">
                Evidence Audit: Knowns vs. Assumptions vs. Unknowns
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Known Information */}
              <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <span className="font-bold text-[#15803D] uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Established Knowns
                </span>
                <ul className="space-y-1.5 text-[#14283F]">
                  {recommendations.knownsVsAssumptions.knowns.map((k, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#15803D] font-bold">•</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Working Assumptions */}
              <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <span className="font-bold text-[#B45309] uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Working Assumptions
                </span>
                <ul className="space-y-1.5 text-[#14283F]">
                  {recommendations.knownsVsAssumptions.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#B45309] font-bold">?</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Critical Unknowns */}
              <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-2">
                <span className="font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Missing Unknowns
                </span>
                <ul className="space-y-1.5 text-[#14283F]">
                  {recommendations.knownsVsAssumptions.unknowns.map((u, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#64748B] font-bold">!</span>
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 3: Contextual Questions & Missing Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contextual Questions */}
            <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#168C83] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#168C83]" />
                The 2–3 Essential Questions for the Next Decision
              </span>
              <p className="text-xs text-[#64748B]">
                To prevent questionnaire fatigue, answer only these few questions to finalize your action plan:
              </p>
              <div className="space-y-2 pt-1 text-xs">
                {recommendations.contextualQuestions.map((q, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] text-[#14283F] font-medium leading-relaxed">
                    <span className="text-[#168C83] font-bold mr-1.5">{idx + 1}.</span>
                    {q}
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Missing Evidence */}
            <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#14283F] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#64748B]" />
                Critical Evidence Required Before Major Outlays
              </span>
              <p className="text-xs text-[#64748B]">
                Data sources that will materially confirm or alter strategic direction:
              </p>
              <ul className="space-y-2 pt-1 text-xs text-[#14283F]">
                {recommendations.missingEvidence.map((ev, idx) => (
                  <li key={idx} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5EBEF] flex items-start gap-2 leading-relaxed">
                    <span className="text-[#168C83] font-bold">→</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4: Strategic Action Plan & Immediate Action */}
          <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-[#E6F4F2] text-[#168C83] font-black text-xs flex items-center justify-center border border-[#168C83]/30">
                3
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#168C83]">
                Strategic Action Plan & Immediate 48-Hour Step
              </span>
            </div>

            <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-2">
              <span className="font-bold text-[#14283F] text-sm block">Core Turnaround Recommendation:</span>
              <p className="text-xs text-[#14283F] leading-relaxed">
                {recommendations.initialRecommendation}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#E6F4F2] border border-[#168C83]/30 space-y-1.5">
              <span className="font-bold text-[#168C83] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Immediate Action (Next 48–72 Hours):
              </span>
              <p className="text-xs text-[#14283F] leading-relaxed font-semibold">
                {recommendations.immediateAction}
              </p>
            </div>

            {/* Specialist Advice Callout */}
            {recommendations.specialistAdviceNeeded && (
              <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#14283F] flex items-start gap-2.5">
                <Scale className="w-4 h-4 text-[#D99A35] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#B45309]">Specialist Advisory Trigger: </strong>
                  {recommendations.specialistAdviceNeeded}
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EBEF]">
              <span className="text-[11px] text-[#64748B] font-mono">
                Generated {new Date(recommendations.generatedAt).toLocaleString()}
              </span>

              <button
                onClick={() => onNavigateToConsole(`Regarding the recommendation: "${recommendations.initialRecommendation.substring(0, 80)}..." How do I execute this step?`)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white hover:bg-[#F5F6F3] text-[#14283F] text-xs font-semibold border border-[#CBD5E1] transition shadow-2xs"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#168C83]" />
                <span>Discuss with Coach in Console</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-[#E5EBEF] rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#14283F]">
            Ready to Generate Custom Turnaround Recommendations
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
            BizPulse will analyze your {profile.name} profile ({profile.industry}) and your 8 health inputs to deliver an actionable, evidence-based turnaround diagnostic.
          </p>
          <button
            onClick={handleGenerateRecommendation}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#168C83] hover:bg-[#12726B] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'Analyzing Business...' : 'Generate AI Diagnostic Now'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
