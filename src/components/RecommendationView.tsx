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
  PlusCircle,
  Calculator,
  Filter,
  Download,
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
  CrossDocumentSynthesis,
  TurnaroundAction,
  ProfitOpportunityItem,
  OpportunityHorizon,
  AccountUsageSummary,
  MembershipContinuity,
  CaseRecord,
} from '../types/bizpulse';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';
import {
  generateCoachingPlanPdfBytes,
  generateCoachingPlanDocxUint8Array,
} from '../services/reportGenerator';

interface RecommendationViewProps {
  profile: BusinessProfile;
  healthInputs: Record<HealthDimensionKey, HealthDimensionInput>;
  financials: FinancialData | null;
  overallHealth: OverallHealthAssessment | null;
  uploadedDocuments?: UploadedDocument[];
  crossDocumentSynthesis?: CrossDocumentSynthesis | null;
  crmContacts?: CrmRecord[];
  roiScenarios?: RoiScenario[];
  actionPlan?: TurnaroundAction[];
  continuity?: MembershipContinuity | null;
  recommendations: RecommendationOutput | null;
  onUpdateRecommendations: (rec: RecommendationOutput) => void;
  onAddOpportunityToPlan?: (opp: ProfitOpportunityItem) => void;
  onTestOpportunityInRoi?: (opp: ProfitOpportunityItem) => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
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
  crossDocumentSynthesis = null,
  crmContacts = [],
  roiScenarios = [],
  actionPlan = [],
  continuity = null,
  recommendations,
  onUpdateRecommendations,
  onAddOpportunityToPlan,
  onTestOpportunityInRoi,
  onAccountUsageUpdate,
  onTrackUsage,
  onNavigateToConsole,
  onOpenChallengeMe,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizonFilter, setHorizonFilter] = useState<'all' | OpportunityHorizon>('all');
  const [addedOppIds, setAddedOppIds] = useState<Record<string, boolean>>({});

  // Challenge / Follow-up state
  const [challengePrompt, setChallengePrompt] = useState('');
  const [isChallenging, setIsChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const buildExportCaseRecord = (): CaseRecord => ({
    id: profile.caseId || 'active-case',
    profile,
    healthInputs,
    overallHealth,
    financials,
    uploadedDocuments,
    crossDocumentSynthesis,
    crmContacts,
    roiScenarios,
    actionPlan,
    continuity,
    recommendations,
    conversations: [],
    dashboardMetrics: [],
    updatedAt: new Date().toISOString(),
  });

  const triggerBlobDownload = (bytes: Uint8Array, filename: string, mimeType: string) => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportCoachingPdf = () => {
    try {
      setIsExporting(true);
      const safeName = (profile.name || 'business').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const bytes = generateCoachingPlanPdfBytes(buildExportCaseRecord());
      triggerBlobDownload(bytes, `${safeName}_coaching_actions_plan.pdf`, 'application/pdf');
      setExportStatus('Coaching & Actions Plan PDF downloaded.');
      setTimeout(() => setExportStatus(null), 3500);
    } catch (err: any) {
      console.error('Coaching PDF export failed:', err);
      setError(`Unable to generate Coaching Plan PDF: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCoachingDocx = async () => {
    try {
      setIsExporting(true);
      const safeName = (profile.name || 'business').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const bytes = await generateCoachingPlanDocxUint8Array(buildExportCaseRecord());
      triggerBlobDownload(
        bytes,
        `${safeName}_coaching_actions_plan.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      setExportStatus('Coaching & Actions Plan Word (.docx) downloaded.');
      setTimeout(() => setExportStatus(null), 3500);
    } catch (err: any) {
      console.error('Coaching DOCX export failed:', err);
      setError(`Unable to generate Coaching Plan Word document: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateRecommendation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apiFetchWithAuth('/api/coach/generate-recommendation', {
        method: 'POST',
        body: {
          caseId: profile.caseId,
          businessProfile: profile,
          healthInputs,
          financials,
          overallHealth,
          uploadedDocuments: sanitizeDocumentsForAiPayload(uploadedDocuments),
          crossDocumentSynthesis,
          crmContacts,
          roiScenarios,
          actionPlan,
          continuity,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);

      if (data.recommendation) {
        const merged: RecommendationOutput = {
          ...data.recommendation,
          challenges: recommendations?.challenges || [],
        };
        onUpdateRecommendations(merged);
        onTrackUsage?.('recommendationsCount');
      } else {
        throw new Error('The AI engine returned an empty coaching plan. Please click Retry.');
      }
    } catch (err: any) {
      console.error('Coaching generation failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
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

  const executeChallengeSubmit = async () => {
    if (!recommendations || !challengePrompt.trim() || isChallenging) return;

    setIsChallenging(true);
    setChallengeError(null);

    try {
      const { data } = await apiFetchWithAuth('/api/coach/challenge-recommendation', {
        method: 'POST',
        body: {
          caseId: profile.caseId,
          challengeQuestion: challengePrompt.trim(),
          businessProfile: profile,
          healthInputs,
          financials,
          overallHealth,
          currentRecommendation: recommendations,
          uploadedDocuments: sanitizeDocumentsForAiPayload(uploadedDocuments),
          crossDocumentSynthesis,
          crmContacts,
          roiScenarios,
          actionPlan,
          continuity,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);

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
      console.error('Challenge recommendation error:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setChallengeError(err.message || 'Failed to challenge recommendation.');
    } finally {
      setIsChallenging(false);
    }
  };

  const handleSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeChallengeSubmit();
  };

  const completedActions = recommendations?.actionItems?.filter((a) => a.completed).length ?? 0;
  const totalActions = recommendations?.actionItems?.length ?? 0;

  const profitOpps = recommendations?.profitOpportunities || [];
  const filteredOpps = profitOpps.filter(
    (opp) => horizonFilter === 'all' || opp.horizon === horizonFilter
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Navy Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#6495ED] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                [04] Revenue &amp; Profit Opportunity Engine
              </span>
              <span className="text-[#94A3B8] text-xs font-medium">
                {profile.name || 'Active Business'} · {profile.industry} ({profile.country})
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Diagnostic Coaching, 16-Area Profit Leakage &amp; Sustainability
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-2xl leading-relaxed">
              Synthesizes your 12 capability scores, Top 3 priorities, financial ledger, CRM pipeline, and {uploadedDocuments.length} uploaded document{uploadedDocuments.length === 1 ? '' : 's'} into a 10-area sustainability verdict, 16-area profit leakage scan, and testable 48-hour steps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleGenerateRecommendation}
              disabled={isLoading}
              className="flex items-center space-x-2 px-5 py-2.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] disabled:opacity-50 text-white font-semibold uppercase tracking-wider text-xs shadow-sm transition whitespace-nowrap"
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

            {(recommendations || actionPlan.length > 0) && (
              <>
                <button
                  type="button"
                  onClick={handleExportCoachingPdf}
                  disabled={isExporting}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold text-xs border border-white/20 transition whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#6495ED]" />
                  <span>Coaching PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCoachingDocx}
                  disabled={isExporting}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold text-xs border border-white/20 transition whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6495ED]" />
                  <span>Word (.docx)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {exportStatus && (
          <div className="mt-4 p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold rounded flex items-center justify-between">
            <span>{exportStatus}</span>
            <button type="button" onClick={() => setExportStatus(null)} className="hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3.5 bg-[#B91C1C]/20 border border-[#FCA5A5]/40 text-white text-xs rounded flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleGenerateRecommendation}
                disabled={isLoading}
                className="px-3 py-1 rounded bg-white text-[#B91C1C] font-bold hover:bg-[#FEF2F2] transition"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-[#CBD5E1] hover:text-white font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Coaching Output */}
      {recommendations ? (
        <div className="space-y-6">
          {/* 1: Primary Commercial Observation & Why It Matters */}
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded bg-[#0A2E6E] text-white font-mono font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
                Primary Commercial Diagnosis
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-snug">
              {recommendations.initialObservation}
            </h3>

            <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-xs sm:text-sm space-y-1.5 leading-relaxed">
              <strong className="text-[#0F52BA] font-mono uppercase tracking-wider text-[11px] block">
                Commercial Impact (Profitability, Cash Flow &amp; Owner Capacity):
              </strong>
              <p className="text-[#0F172A] leading-relaxed">{recommendations.commercialWhy}</p>
            </div>
          </div>

          {/* 1B: Structured 12-Area Revenue & Profit Opportunity Engine */}
          {profitOpps.length > 0 && (
            <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#0F172A]/10 pb-4">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Structured Profit &amp; Revenue Opportunities ({profitOpps.length})
                  </span>
                  <h4 className="font-bold text-[#0F172A] text-base mt-0.5">
                    Evidence-Backed Margin, Pricing &amp; Growth Levers
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#475569] mr-1" />
                  {(['all', '0-30 Days', '30-90 Days', '90-180 Days'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorizonFilter(h)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        horizonFilter === h
                          ? 'bg-[#0A2E6E] text-[#6495ED]'
                          : 'bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/10'
                      }`}
                    >
                      {h === 'all' ? 'All Horizons' : h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {filteredOpps.map((opp) => {
                  const isAdded =
                    addedOppIds[opp.id] ||
                    actionPlan.some((a) => a.action === opp.title || a.sourceTag === opp.id);
                  return (
                    <div
                      key={opp.id}
                      className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-white border border-[#0F172A]/15 font-mono font-bold text-[10px] uppercase tracking-wider text-[#0F172A]">
                            {opp.area}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              opp.horizon === '0-30 Days'
                                ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                                : opp.horizon === '30-90 Days'
                                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                : 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                            }`}
                          >
                            {opp.horizon}
                          </span>
                        </div>

                        <h5 className="font-bold text-[#0F172A] text-sm">{opp.title}</h5>

                        <div className="space-y-1.5 text-[11px] leading-relaxed">
                          <p className="text-[#0F172A]">
                            <strong className="text-[#0F172A]">1. Plain-Language Basis: </strong>
                            {opp.evidenceBasis}
                          </p>
                          {opp.whyHappening && (
                            <p className="text-[#334155]">
                              <strong className="text-[#0F172A]">2. Why It Happens: </strong>
                              {opp.whyHappening}
                            </p>
                          )}
                          {opp.infoNeeded && (
                            <p className="text-[#0F52BA]">
                              <strong>3. Info Still Needed: </strong>
                              {opp.infoNeeded}
                            </p>
                          )}
                          {opp.whatToDoFirst && (
                            <p className="text-[#0F172A]">
                              <strong className="text-[#0F52BA]">4. What To Do First: </strong>
                              {opp.whatToDoFirst}
                            </p>
                          )}
                          {opp.illustrativeExample && (
                            <p className="p-2 rounded bg-[#EDF3FD] border border-[#B7CEF7] text-[#0A2E6E]">
                              <strong>5. Transparent Example: </strong>
                              {opp.illustrativeExample}
                            </p>
                          )}
                          <p className="text-[#15803D]">
                            <strong>Estimated Financial Impact: </strong>
                            {opp.estimatedFinancialImpact}
                          </p>
                          <p className="text-[#475569]">
                            <strong>Effort / Cost: </strong>
                            {opp.effortCost}
                          </p>
                          {opp.risks && opp.risks.length > 0 && (
                            <p className="text-[#B91C1C]">
                              <strong>Watch-Outs: </strong>
                              {opp.risks.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#0F172A]/10 flex flex-wrap items-center gap-2">
                        {onAddOpportunityToPlan && (
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => {
                              onAddOpportunityToPlan(opp);
                              setAddedOppIds((prev) => ({ ...prev, [opp.id]: true }));
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold transition ${
                              isAdded
                                ? 'bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0]'
                                : 'bg-[#0A2E6E] hover:bg-[#0F52BA] text-white'
                            }`}
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-[#6495ED]" />
                            <span>{isAdded ? 'Added to 30/60/90 Plan' : 'Add to 30/60/90 Plan'}</span>
                          </button>
                        )}

                        {onTestOpportunityInRoi && (
                          <button
                            type="button"
                            onClick={() => onTestOpportunityInRoi(opp)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded bg-white hover:bg-[#EDF3FD] text-[#0F172A] border border-[#0F52BA]/30 text-[11px] font-bold transition"
                          >
                            <Calculator className="w-3.5 h-3.5 text-[#0F52BA]" />
                            <span>Test in ROI</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1C: Business Sustainability & Future Earning Potential (10 Areas + 3 Perspectives) */}
          {recommendations.sustainabilityAssessment && (
            <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#0F172A]/10">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA] flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    Business Sustainability &amp; Future Earning Potential (10-Area Audit)
                  </span>
                  <h4 className="font-bold text-[#0F172A] text-base mt-0.5">
                    Current Resilience, 6–12 Month Outlook &amp; Strategic Choice
                  </h4>
                </div>
                <span
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${
                    recommendations.sustainabilityAssessment.recommendedChoice === 'Expand' ||
                    recommendations.sustainabilityAssessment.recommendedChoice === 'Improve'
                      ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                      : recommendations.sustainabilityAssessment.recommendedChoice === 'Stabilise'
                      ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                      : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                  }`}
                >
                  Recommended Path: {recommendations.sustainabilityAssessment.recommendedChoice}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#CBD5E1] space-y-1.5">
                  <span className="font-bold text-[#0F172A] uppercase tracking-wider block text-[11px]">
                    1. Current Position
                  </span>
                  <p className="text-[#334155] leading-relaxed">
                    {recommendations.sustainabilityAssessment.currentPositionSummary}
                  </p>
                </div>
                <div className="p-4 rounded bg-[#EDF3FD] border border-[#B7CEF7] space-y-1.5">
                  <span className="font-bold text-[#0F52BA] uppercase tracking-wider block text-[11px]">
                    2. Future Outlook (6–12 Months)
                  </span>
                  <p className="text-[#0F172A] leading-relaxed">
                    {recommendations.sustainabilityAssessment.futureOutlook6to12Months}
                  </p>
                </div>
                <div className="p-4 rounded bg-[#0A2E6E] text-white space-y-1.5">
                  <span className="font-bold text-[#6495ED] uppercase tracking-wider block text-[11px]">
                    3. Business Choice ({recommendations.sustainabilityAssessment.recommendedChoice})
                  </span>
                  <p className="text-[#E2E8F0] leading-relaxed">
                    {recommendations.sustainabilityAssessment.choiceRationale}
                  </p>
                </div>
              </div>

              {recommendations.sustainabilityAssessment.areas?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {recommendations.sustainabilityAssessment.areas.map((areaItem, idx) => {
                    const cls =
                      areaItem.status === 'green'
                        ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#15803D]'
                        : areaItem.status === 'red'
                        ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                        : areaItem.status === 'blue'
                        ? 'bg-[#EDF3FD] border-[#B7CEF7] text-[#0F52BA]'
                        : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]';
                    const label =
                      areaItem.status === 'green'
                        ? 'Healthy'
                        : areaItem.status === 'red'
                        ? 'At Risk'
                        : areaItem.status === 'blue'
                        ? 'Insufficient Info'
                        : 'Needs Attention';
                    return (
                      <div key={idx} className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#0F172A]">{areaItem.area}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${cls}`}>
                            {label}
                          </span>
                        </div>
                        <p className="text-[#334155] leading-relaxed">{areaItem.assessment}</p>
                        <p className="text-[11px] text-[#475569]">
                          <strong>Key Driver / Gap:</strong> {areaItem.keyDriverOrGap}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] text-[11px] text-[#475569] space-y-1">
                {recommendations.sustainabilityAssessment.keyAssumptions?.length > 0 && (
                  <p>
                    <strong className="text-[#0F172A]">Explicit Assumptions: </strong>
                    {recommendations.sustainabilityAssessment.keyAssumptions.join(' · ')}
                  </p>
                )}
                <p className="italic">{recommendations.sustainabilityAssessment.disclaimer}</p>
              </div>
            </div>
          )}

          {/* 2: Sustainability Risks, Hidden Profit Opportunities & Revenue Flow Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white border border-[#FECACA] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B91C1C]">
                <ShieldAlert className="w-4 h-4" />
                <span>Sustainability Risks</span>
              </div>
              {recommendations.sustainabilityRisks && recommendations.sustainabilityRisks.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#0F172A]">
                  {recommendations.sustainabilityRisks.map((risk, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-[#FEF2F2] border border-[#FECACA]/70 leading-relaxed">
                      • {risk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#475569]">Refresh analysis to populate itemized sustainability risks.</p>
              )}
            </div>

            <div className="bg-white border border-[#A7F3D0] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#15803D]">
                <TrendingUp className="w-4 h-4" />
                <span>Hidden Profit Opportunities</span>
              </div>
              {recommendations.hiddenProfitOpportunities &&
              recommendations.hiddenProfitOpportunities.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#0F172A]">
                  {recommendations.hiddenProfitOpportunities.map((opp, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-[#ECFDF5] border border-[#A7F3D0]/70 leading-relaxed">
                      • {opp}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#475569]">Refresh analysis to surface margin and pricing opportunities.</p>
              )}
            </div>

            <div className="bg-white border border-[#FDE68A] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B45309]">
                <Coins className="w-4 h-4 text-[#D97706]" />
                <span>Revenue Flow Improvements</span>
              </div>
              {recommendations.revenueFlowImprovements &&
              recommendations.revenueFlowImprovements.length > 0 ? (
                <ul className="space-y-2 text-xs text-[#0F172A]">
                  {recommendations.revenueFlowImprovements.map((rev, idx) => (
                    <li key={idx} className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A]/80 leading-relaxed">
                      • {rev}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#475569]">Refresh analysis to surface cash collection improvements.</p>
              )}
            </div>
          </div>

          {/* 3: Evidence Audit — Knowns vs Assumptions vs Unknowns */}
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded bg-[#0A2E6E] text-white font-mono font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h4 className="font-bold text-[#0F172A] text-base">
                Evidence Audit: Established Knowns vs. Assumptions vs. Missing Unknowns
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <span className="font-bold text-[#15803D] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Established Knowns
                </span>
                <ul className="space-y-1.5 text-[#0F172A]">
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
                <ul className="space-y-1.5 text-[#0F172A]">
                  {recommendations.knownsVsAssumptions.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#B45309] font-bold">?</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-[#EDF3FD] border border-[#B7CEF7] space-y-2">
                <span className="font-bold text-[#0F52BA] uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Insufficient Info / Missing Data (Blue)
                </span>
                <ul className="space-y-1.5 text-[#0F172A]">
                  {recommendations.knownsVsAssumptions.unknowns.map((u, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#0F52BA] font-bold">!</span>
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 4: Contextual Questions & Critical Missing Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#0F172A]/12 rounded p-6 shadow-xs space-y-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#0F52BA]" />
                Essential Follow-Up Questions
              </span>
              <p className="text-xs text-[#475569]">
                Clarifying these specific points sharpens your commercial action plan:
              </p>
              <div className="space-y-2 pt-1 text-xs">
                {recommendations.contextualQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[#0F172A] font-medium leading-relaxed"
                  >
                    <span className="text-[#0F52BA] font-mono font-bold mr-1.5">{idx + 1}.</span>
                    {q}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#0F172A]/12 rounded p-6 shadow-xs space-y-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#475569]" />
                Missing Evidence Before Major Commitments
              </span>
              <p className="text-xs text-[#475569]">
                Upload or verify these records in the Documents tab before spending capital:
              </p>
              <ul className="space-y-2 pt-1 text-xs text-[#0F172A]">
                {recommendations.missingEvidence.map((ev, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10 flex items-start gap-2 leading-relaxed"
                  >
                    <span className="text-[#0F52BA] font-bold">→</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5: Prioritized Practical Actions Checklist */}
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#0A2E6E] text-white font-mono font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
                  Core Strategy &amp; Prioritized Action Steps
                </span>
              </div>
              {totalActions > 0 && (
                <span className="text-xs font-mono font-bold text-[#0F172A] bg-[#F8FAFC] px-3 py-1 rounded border border-[#0F172A]/12 tabular-nums">
                  {completedActions} of {totalActions} Completed
                </span>
              )}
            </div>

            <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
              <span className="font-bold text-[#0F172A] text-sm block">Core Turnaround Recommendation:</span>
              <p className="text-xs sm:text-sm text-[#0F172A] leading-relaxed">
                {recommendations.initialRecommendation}
              </p>
            </div>

            <div className="p-5 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
              <span className="font-bold text-[#B45309] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#D97706]" />
                Immediate Priority Action (Next 48–72 Hours):
              </span>
              <p className="text-xs sm:text-sm text-[#0F172A] leading-relaxed font-semibold">
                {recommendations.immediateAction}
              </p>
            </div>

            {recommendations.actionItems && recommendations.actionItems.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
                  Practical Sequenced Action Plan (Click to Track Execution):
                </span>
                {recommendations.actionItems.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => handleToggleActionItem(act.id)}
                    className={`p-4 rounded border cursor-pointer transition flex items-start justify-between gap-4 ${
                      act.completed
                        ? 'bg-[#F8FAFC] border-[#A7F3D0] opacity-75'
                        : 'bg-white border-[#0F172A]/12 hover:border-[#0F52BA]'
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
                          <Circle className="w-5 h-5 text-[#94A3B8]" />
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
                                : 'bg-[#F8FAFC] text-[#0F172A] border-[#0F172A]/15'
                            }`}
                          >
                            {act.priority}
                          </span>
                          <span className="text-[11px] font-semibold text-[#475569]">
                            Owner: {act.ownerRole} · {act.timeframe}
                          </span>
                        </div>
                        <p
                          className={`text-xs sm:text-sm font-bold ${
                            act.completed ? 'line-through text-[#475569]' : 'text-[#0F172A]'
                          }`}
                        >
                          {act.action}
                        </p>
                        <p className="text-xs text-[#475569]">
                          <strong>How to measure progress:</strong> {act.expectedImpact}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recommendations.specialistAdviceNeeded && (
              <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#0F172A] flex items-start gap-2.5">
                <Scale className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#B45309]">Specialist Advisory Check: </strong>
                  {recommendations.specialistAdviceNeeded}
                </div>
              </div>
            )}

            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#0F172A]/10">
              <span className="text-[11px] text-[#475569] font-mono tabular-nums">
                Generated {new Date(recommendations.generatedAt).toLocaleString()}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCoachingPdf}
                  disabled={isExporting}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#EDF3FD] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#0F52BA]" />
                  <span>Download Coaching PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCoachingDocx}
                  disabled={isExporting}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#EDF3FD] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-[#0F52BA]" />
                  <span>Download Word (.docx)</span>
                </button>
                {onOpenChallengeMe && (
                  <button
                    type="button"
                    onClick={onOpenChallengeMe}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#FFF4EC] hover:bg-[#FFE6D4] text-[#C25107] text-xs font-semibold border border-[#F5761A]/50 transition whitespace-nowrap"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-[#F5761A]" />
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
                  className="flex items-center space-x-1.5 px-4 py-2 rounded bg-white hover:bg-[#EDF3FD] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#0F52BA]" />
                  <span>Open Chat with Coach</span>
                </button>
              </div>
            </div>
          </div>

          {/* 6: Challenge Recommendation / Follow-Up Questions Inline Thread */}
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#0A2E6E] text-white font-mono font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h4 className="font-bold text-[#0F172A] text-base">
                  Challenge Recommendation or Ask a Follow-Up Question
                </h4>
              </div>
              <p className="text-xs text-[#475569]">
                Push back on any assumption, test an alternative commercial trade-off, or clarify how a step fits your staffing and cash constraints.
              </p>
            </div>

            {recommendations.challenges && recommendations.challenges.length > 0 && (
              <div className="space-y-3 pt-1">
                {recommendations.challenges.map((c) => (
                  <div
                    key={c.id}
                    className="rounded border border-[#0F172A]/12 overflow-hidden text-xs"
                  >
                    <div className="bg-[#0A2E6E] text-white px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-semibold">Owner Challenge / Follow-up: {c.questionOrChallenge}</span>
                      <span className="text-[10px] text-[#6495ED] font-mono shrink-0">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bg-[#F8FAFC] p-4 text-[#0F172A] whitespace-pre-wrap leading-relaxed">
                      {c.coachResponse}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {challengeError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded flex flex-wrap items-center justify-between gap-2">
                <span>{challengeError}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={executeChallengeSubmit}
                    disabled={isChallenging || !challengePrompt.trim()}
                    className="px-2.5 py-1 rounded bg-[#B91C1C] text-white font-bold hover:bg-[#991B1B] transition"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setChallengeError(null)}
                    className="font-semibold hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitChallenge} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={challengePrompt}
                onChange={(e) => setChallengePrompt(e.target.value)}
                disabled={isChallenging}
                placeholder="e.g., What if our top client refuses a 10% increase? Or how do we cut overtime without delaying jobs?"
                className="flex-1 bg-[#F8FAFC] border border-[#0F172A]/15 rounded px-4 py-2.5 text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F52BA] focus:border-[#0F52BA]"
              />
              <button
                type="submit"
                disabled={isChallenging || !challengePrompt.trim()}
                className="px-5 py-2.5 rounded bg-[#0A2E6E] hover:bg-[#0F52BA] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition shrink-0 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 text-[#6495ED]" />
                <span>{isChallenging ? 'Analyzing...' : 'Submit Challenge'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-[#0F172A]/12 rounded p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded bg-[#EDF3FD] text-[#0F52BA] border border-[#B7CEF7] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">
            Ready to Generate Business Coaching, 16-Area Profit Scan &amp; Sustainability Audit
          </h3>
          <p className="text-xs sm:text-sm text-[#475569] max-w-lg mx-auto leading-relaxed">
            BizPulse will analyze {profile.name || 'this business'} ({profile.industry}), all 12 capability ratings, CRM &amp; ROI records, and uploaded documents to deliver prioritized actions, a 10-area sustainability verdict, and 16-area profit opportunities.
          </p>
          <button
            type="button"
            onClick={handleGenerateRecommendation}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider shadow-sm transition"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>{isLoading ? 'Analyzing Business...' : 'Generate Coaching Plan Now'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
