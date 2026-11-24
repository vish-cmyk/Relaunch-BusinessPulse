import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  TrendingUp,
  Coins,
  FileText,
  Scale,
  Clock,
  MessageSquare,
  Send,
  Circle,
  Check,
} from 'lucide-react';
import {
  BusinessProfile,
  HealthDimensionKey,
  HealthDimensionInput,
  OverallHealthAssessment,
  FinancialData,
  RecommendationOutput,
  UploadedDocument,
  RecommendationChallenge,
  CrmRecord,
  RoiScenario,
} from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface RecommendationViewProps {
  profile: BusinessProfile;
  healthInputs: Record<HealthDimensionKey, HealthDimensionInput>;
  financials: FinancialData | null;
  overallHealth: OverallHealthAssessment | null;
  uploadedDocuments?: UploadedDocument[];
  crmContacts?: CrmRecord[];
  roiScenarios?: RoiScenario[];
  recommendations: RecommendationOutput | null;
  onUpdateRecommendations: (rec: RecommendationOutput) => void;
  onTrackUsage?: (field: 'coachMessagesCount' | 'recommendationsCount') => void;
  onNavigateToConsole: (initialPrompt?: string) => void;
  onOpenChallengeMe?: () => void;
}

export const RecommendationView: React.FC<RecommendationViewProps> = ({
  profile,
  healthInputs,
  financials,
  overallHealth,
  uploadedDocuments = [],
  crmContacts = [],
  roiScenarios = [],
  recommendations,
  onUpdateRecommendations,
  onTrackUsage,
  onNavigateToConsole,
  onOpenChallengeMe,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Challenge / Follow-up state
  const [challengePrompt, setChallengePrompt] = useState('');
  const [isChallenging, setIsChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const handleGenerateRecommendation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/generate-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: profile.caseId,
          businessProfile: profile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server returned an error generating recommendation.');
      }

      const data = await response.json();
      if (data.recommendation) {
        const merged: RecommendationOutput = {
          ...data.recommendation,
          challenges: recommendations?.challenges || [],
        };
        onUpdateRecommendations(merged);
        onTrackUsage?.('recommendationsCount');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with AI coaching engine.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActionItem = (actionId: string) => {
    if (!recommendations?.actionItems) return;
    const updatedItems = recommendations.actionItems.map((item) =>
      item.id === actionId ? { ...item, completed: !item.completed } : item
    );
    onUpdateRecommendations({
      ...recommendations,
      actionItems: updatedItems,
    });
  };

  const handleSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendations || !challengePrompt.trim() || isChallenging) return;

    setIsChallenging(true);
    setChallengeError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/challenge-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: profile.caseId,
          challengeQuestion: challengePrompt.trim(),
          businessProfile: profile,
          healthInputs,
          financials,
          overallHealth,
          currentRecommendation: recommendations,
          uploadedDocuments,
          crmContacts,
          roiScenarios,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Unable to process follow-up question.');
      }

      const data = await response.json();
      const newEntry: RecommendationChallenge = {
        id: data.challengeEntry?.id || `chal-${Date.now()}`,
        questionOrChallenge: challengePrompt.trim(),
        coachResponse:
          data.reply || data.challengeEntry?.coachResponse || 'No response received.',
        createdAt: data.createdAt || data.challengeEntry?.createdAt || new Date().toISOString(),
      };

      onUpdateRecommendations({
        ...recommendations,
        challenges: [...(recommendations.challenges || []), newEntry],
      });
      setChallengePrompt('');
      onTrackUsage?.('coachMessagesCount');
    } catch (err: any) {
      console.error(err);
      setChallengeError(err.message || 'Failed to challenge recommendation.');
    } finally {
      setIsChallenging(false);
    }
  };

  const completedActions = recommendations?.actionItems?.filter((a) => a.completed).length ?? 0;
  const totalActions = recommendations?.actionItems?.length ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Charcoal Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#FBBF24] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                [04] Intelligent Coaching
              </span>
              <span className="text-[#A1A1AA] text-xs font-medium">
                {profile.name || 'Active Business'} · {profile.industry} ({profile.country})
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Diagnostic Coaching &amp; Prioritized Action Plan
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-2xl leading-relaxed">
              Synthesizes your 8 health scores, primary concern, financial figures, and {uploadedDocuments.length} uploaded document{uploadedDocuments.length === 1 ? '' : 's'} into commercial sustainability risks, profit opportunities, and testable 48-hour steps.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleGenerateRecommendation}
              disabled={isLoading}
              className="flex items-center space-x-2 px-5 py-2.5 rounded bg-[#D97706] hover:bg-[#B45309] disabled:opacity-50 text-white font-semibold uppercase tracking-wider text-xs shadow-sm transition whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>
                {isLoading
                  ? 'Analyzing Business...'
                  : recommendations
                  ? 'Refresh Coaching Plan'
                  : 'Generate Coaching Plan'}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-[#B91C1C]/20 border border-[#FCA5A5]/40 text-white text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[#D4D4D8] hover:text-white font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Main Coaching Output */}
      {recommendations ? (
        <div className="space-y-6">
          {/* 1: Primary Commercial Observation & Why It Matters */}
          <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded bg-[#111113] text-white font-mono font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D97706]">
                Primary Commercial Diagnosis
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-[#111113] leading-snug">
              {recommendations.initialObservation}
            </h3>

            <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/10 text-xs sm:text-sm space-y-1.5 leading-relaxed">
              <strong className="text-[#D97706] font-mono uppercase tracking-wider text-[11px] block">
                Commercial Impact (Profitability, Cash Flow &amp; Owner Capacity):
              </strong>
              <p className="text-[#111113] leading-relaxed">{recommendations.commercialWhy}</p>
            </div>
          </div>

          {/* 2: Sustainability Risks, Hidden Profit Opportunities & Revenue Flow Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white border border-[#FECACA] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B91C1C]">
                <ShieldAlert className="w-4 h-4" />
                <span>Sustainability Risks</span>
              </div>
              {recommendations.sustainabilityRisks && recommendations.sustainabilityRisks.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#111113]">
                  {recommendations.sustainabilityRisks.map((risk, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-[#FEF2F2] border border-[#FECACA]/70 leading-relaxed">
                      • {risk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#52525B]">Refresh analysis to populate itemized sustainability risks.</p>
              )}
            </div>

            <div className="bg-white border border-[#A7F3D0] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#15803D]">
                <TrendingUp className="w-4 h-4" />
                <span>Hidden Profit Opportunities</span>
              </div>
              {recommendations.hiddenProfitOpportunities &&
              recommendations.hiddenProfitOpportunities.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#111113]">
                  {recommendations.hiddenProfitOpportunities.map((opp, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-[#ECFDF5] border border-[#A7F3D0]/70 leading-relaxed">
                      • {opp}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#52525B]">Refresh analysis to surface margin and pricing opportunities.</p>
              )}
            </div>

            <div className="bg-white border border-[#FDE68A] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B45309]">
                <Coins className="w-4 h-4 text-[#D97706]" />
                <span>Revenue Flow Improvements</span>
              </div>
              {recommendations.revenueFlowImprovements &&
              recommendations.revenueFlowImprovements.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#111113]">
                  {recommendations.revenueFlowImprovements.map((rev, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A]/80 leading-relaxed">
                      • {rev}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#52525B]">Refresh analysis to surface cash collection improvements.</p>
              )}
            </div>
          </div>

          {/* 3: Evidence Audit — Knowns vs Assumptions vs Unknowns */}
          <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded bg-[#111113] text-white font-mono font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h4 className="font-bold text-[#111113] text-base">
                Evidence Audit: Established Knowns vs. Assumptions vs. Missing Unknowns
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <span className="font-bold text-[#15803D] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Established Knowns
                </span>
                <ul className="space-y-1.5 text-[#111113]">
                  {recommendations.knownsVsAssumptions.knowns.map((k, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#15803D] font-bold">•</span>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <span className="font-bold text-[#B45309] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Working Assumptions
                </span>
                <ul className="space-y-1.5 text-[#111113]">
                  {recommendations.knownsVsAssumptions.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#B45309] font-bold">?</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-[#F1F5F9] border border-[#CBD5E1] space-y-2">
                <span className="font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Missing Financial / Operational Data
                </span>
                <ul className="space-y-1.5 text-[#111113]">
                  {recommendations.knownsVsAssumptions.unknowns.map((u, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#475569] font-bold">!</span>
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 4: Contextual Questions & Critical Missing Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs space-y-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D97706] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#D97706]" />
                Essential Follow-Up Questions
              </span>
              <p className="text-xs text-[#52525B]">
                Clarifying these specific points sharpens your commercial action plan:
              </p>
              <div className="space-y-2 pt-1 text-xs">
                {recommendations.contextualQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded bg-[#F8F7F4] border border-[#111113]/10 text-[#111113] font-medium leading-relaxed"
                  >
                    <span className="text-[#D97706] font-mono font-bold mr-1.5">{idx + 1}.</span>
                    {q}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs space-y-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#111113] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#52525B]" />
                Missing Evidence Before Major Commitments
              </span>
              <p className="text-xs text-[#52525B]">
                Upload or verify these records in the Documents tab before spending capital:
              </p>
              <ul className="space-y-2 pt-1 text-xs text-[#111113]">
                {recommendations.missingEvidence.map((ev, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded bg-[#F8F7F4] border border-[#111113]/10 flex items-start gap-2 leading-relaxed"
                  >
                    <span className="text-[#D97706] font-bold">→</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5: Prioritized Practical Actions Checklist */}
          <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#111113] text-white font-mono font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D97706]">
                  Core Strategy &amp; Prioritized Action Steps
                </span>
              </div>
              {totalActions > 0 && (
                <span className="text-xs font-mono font-bold text-[#111113] bg-[#F8F7F4] px-3 py-1 rounded border border-[#111113]/12 tabular-nums">
                  {completedActions} of {totalActions} Completed
                </span>
              )}
            </div>

            <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2">
              <span className="font-bold text-[#111113] text-sm block">Core Turnaround Recommendation:</span>
              <p className="text-xs sm:text-sm text-[#111113] leading-relaxed">
                {recommendations.initialRecommendation}
              </p>
            </div>

            <div className="p-5 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
              <span className="font-bold text-[#B45309] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#D97706]" />
                Immediate Priority Action (Next 48–72 Hours):
              </span>
              <p className="text-xs sm:text-sm text-[#111113] leading-relaxed font-semibold">
                {recommendations.immediateAction}
              </p>
            </div>

            {recommendations.actionItems && recommendations.actionItems.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#52525B] block">
                  Practical Sequenced Action Plan (Click to Track Execution):
                </span>
                {recommendations.actionItems.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => handleToggleActionItem(act.id)}
                    className={`p-4 rounded border cursor-pointer transition flex items-start justify-between gap-4 ${
                      act.completed
                        ? 'bg-[#F8F7F4] border-[#A7F3D0] opacity-75'
                        : 'bg-white border-[#111113]/12 hover:border-[#D97706]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className="mt-0.5 shrink-0"
                        aria-label={`Mark ${act.action} completed`}
                      >
                        {act.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#A1A1AA]" />
                        )}
                      </button>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                              act.priority.includes('Urgent')
                                ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                : act.priority.includes('High')
                                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                : 'bg-[#F8F7F4] text-[#111113] border-[#111113]/15'
                            }`}
                          >
                            {act.priority}
                          </span>
                          <span className="text-[11px] font-semibold text-[#52525B]">
                            Owner: {act.ownerRole} · {act.timeframe}
                          </span>
                        </div>
                        <p
                          className={`text-xs sm:text-sm font-bold ${
                            act.completed ? 'line-through text-[#52525B]' : 'text-[#111113]'
                          }`}
                        >
                          {act.action}
                        </p>
                        <p className="text-xs text-[#52525B]">
                          Expected Impact: {act.expectedImpact}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recommendations.specialistAdviceNeeded && (
              <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113] flex items-start gap-2.5">
                <Scale className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#B45309]">Specialist Advisory Check: </strong>
                  {recommendations.specialistAdviceNeeded}
                </div>
              </div>
            )}

            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#111113]/10">
              <span className="text-[11px] text-[#52525B] font-mono tabular-nums">
                Generated {new Date(recommendations.generatedAt).toLocaleString()}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenChallengeMe && (
                  <button
                    type="button"
                    onClick={onOpenChallengeMe}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] text-xs font-semibold border border-[#FDE68A] transition whitespace-nowrap"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Launch Challenge Me</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onNavigateToConsole(
                      `Regarding our turnaround priority "${recommendations.initialRecommendation.substring(
                        0,
                        90
                      )}...", help me prepare step-by-step execution details for ${profile.name}.`
                    )
                  }
                  className="flex items-center space-x-1.5 px-4 py-2 rounded bg-white hover:bg-[#F8F7F4] text-[#111113] text-xs font-semibold border border-[#111113]/15 transition whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>Open Chat with Coach</span>
                </button>
              </div>
            </div>
          </div>

          {/* 6: Challenge Recommendation / Follow-Up Questions Inline Thread */}
          <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#111113] text-white font-mono font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h4 className="font-bold text-[#111113] text-base">
                  Challenge Recommendation or Ask a Follow-Up Question
                </h4>
              </div>
              <p className="text-xs text-[#52525B]">
                Push back on any assumption, test an alternative commercial trade-off, or clarify how a step fits your staffing and cash constraints.
              </p>
            </div>

            {recommendations.challenges && recommendations.challenges.length > 0 && (
              <div className="space-y-3 pt-1">
                {recommendations.challenges.map((c) => (
                  <div
                    key={c.id}
                    className="rounded border border-[#111113]/12 overflow-hidden text-xs"
                  >
                    <div className="bg-[#111113] text-white px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-semibold">Owner Challenge / Follow-up: {c.questionOrChallenge}</span>
                      <span className="text-[10px] text-[#FBBF24] font-mono shrink-0">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bg-[#F8F7F4] p-4 text-[#111113] whitespace-pre-wrap leading-relaxed">
                      {c.coachResponse}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {challengeError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded">
                {challengeError}
              </div>
            )}

            <form onSubmit={handleSubmitChallenge} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={challengePrompt}
                onChange={(e) => setChallengePrompt(e.target.value)}
                disabled={isChallenging}
                placeholder="e.g., What if our top client refuses a 10% increase? Or how do we cut overtime without delaying jobs?"
                className="flex-1 bg-[#FCFCFC] border border-[#111113]/15 rounded px-4 py-2.5 text-xs sm:text-sm text-[#111113] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
              <button
                type="submit"
                disabled={isChallenging || !challengePrompt.trim()}
                className="px-5 py-2.5 rounded bg-[#111113] hover:bg-[#27272A] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition shrink-0 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 text-[#D97706]" />
                <span>{isChallenging ? 'Analyzing...' : 'Submit Challenge'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-[#111113]/12 rounded p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#111113]">
            Ready to Generate Business Coaching &amp; Action Plan
          </h3>
          <p className="text-xs sm:text-sm text-[#52525B] max-w-lg mx-auto leading-relaxed">
            BizPulse will analyze {profile.name || 'this business'} ({profile.industry}), all 8 health ratings, and any uploaded documents to deliver prioritized commercial actions, sustainability risks, and profit opportunities.
          </p>
          <button
            type="button"
            onClick={handleGenerateRecommendation}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded bg-[#111113] hover:bg-[#27272A] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider shadow-sm transition"
          >
            <Sparkles className="w-4 h-4 text-[#D97706]" />
            <span>{isLoading ? 'Analyzing Business...' : 'Generate Coaching Plan Now'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
