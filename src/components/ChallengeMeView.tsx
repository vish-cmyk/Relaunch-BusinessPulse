import React, { useMemo, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  EyeOff,
  HelpCircle,
  Send,
  CheckCircle2,
  ArrowRight,
  Loader2,
  RotateCcw,
  Plus,
  MessageSquare,
  Sparkles,
  Flag,
  RefreshCw,
} from 'lucide-react';
import {
  CaseRecord,
  ChallengeMeSession,
  ChallengeNextAction,
  ChallengeRound,
  HealthDimensionInput,
  TurnaroundAction,
  AccountUsageSummary,
} from '../types/bizpulse';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';

interface ChallengeMeViewProps {
  caseRecord: CaseRecord;
  onUpdateCase: (updated: CaseRecord) => void;
  onTrackUsage?: (field: 'coachMessagesCount') => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
  onOpenCoachWithPrompt: (prompt: string) => void;
}

const CHALLENGE_FOCUS_PRESETS = [
  'Full Business Reality Check',
  'Cash Flow & Debtor Contradictions',
  'Pricing, Margins & Client Concentration',
  'Growth / ROI vs Operational Capacity',
  'Owner Dependency & Delivery Bottlenecks',
];

export const ChallengeMeView: React.FC<ChallengeMeViewProps> = ({
  caseRecord,
  onUpdateCase,
  onTrackUsage,
  onAccountUsageUpdate,
  onOpenCoachWithPrompt,
}) => {
  const { profile, financials, overallHealth, crmContacts = [], roiScenarios = [], recommendations } = caseRecord;
  const session = caseRecord.challengeSession || null;

  const [selectedFocus, setSelectedFocus] = useState<string>(
    session?.focusTopic || CHALLENGE_FOCUS_PRESETS[0]
  );
  const [customFocus, setCustomFocus] = useState<string>('');
  const [ownerResponse, setOwnerResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<'start' | 'respond' | 'conclude' | null>(null);
  const [pendingConcludeSession, setPendingConcludeSession] = useState<ChallengeMeSession | undefined>(
    undefined
  );

  // Deterministic pre-scan of factual tensions already visible in the active case record
  const localSignals = useMemo(() => {
    const signals: string[] = [];
    const currency = profile.currency || 'NZD';

    if (financials) {
      const cash = financials.cashInBank ?? 0;
      const overdue = financials.overdueReceivables ?? 0;
      const overdraftUsed = financials.creditFacilityUsed ?? 0;
      if (overdue > 0 && overdraftUsed > 0) {
        signals.push(
          `${currency} ${overdue.toLocaleString()} is overdue >60 days while ${currency} ${overdraftUsed.toLocaleString()} is drawn on credit facilities.`
        );
      } else if (overdue > cash && overdue > 0) {
        signals.push(
          `Overdue receivables (${currency} ${overdue.toLocaleString()}) exceed cash in bank (${currency} ${cash.toLocaleString()}).`
        );
      }
      if ((financials.pricingReviewLastYears ?? 0) >= 2) {
        signals.push(
          `Pricing has not been reviewed for ${financials.pricingReviewLastYears} years despite operating cost pressures.`
        );
      }
      if ((financials.top5ConcentrationPercent ?? 0) >= 40) {
        signals.push(
          `Top 5 customers represent ${financials.top5ConcentrationPercent}% of revenue — creating severe client loss exposure.`
        );
      }
    }

    const atRiskDims = (Object.values(caseRecord.healthInputs || {}) as HealthDimensionInput[]).filter(
      (d) => d.status === 'at_risk'
    );
    if (atRiskDims.length > 0) {
      signals.push(
        `12-Capability Health flags At Risk in: ${atRiskDims.map((d) => d.title).join(', ')}.`
      );
    }

    const unsureDims = (Object.values(caseRecord.healthInputs || {}) as HealthDimensionInput[]).filter(
      (d) => d.status === 'not_sure' || d.status === 'unanswered'
    );
    if (unsureDims.length >= 3) {
      signals.push(
        `${unsureDims.length} health dimensions remain unanswered or "Not Sure" — indicating visibility gaps.`
      );
    }

    const atRiskOrDueCrm = crmContacts.filter(
      (c) => c.status === 'At Risk' || c.status === 'Follow-Up Due'
    );
    if (atRiskOrDueCrm.length > 0) {
      signals.push(
        `${atRiskOrDueCrm.length} CRM record(s) are currently marked At Risk or Follow-Up Due.`
      );
    }

    if (roiScenarios.length > 0) {
      const lowConfidence = roiScenarios.filter((s) => (s.confidencePct ?? 100) < 60);
      if (lowConfidence.length > 0) {
        signals.push(
          `${lowConfidence.length} ROI scenario(s) carry <60% confidence yet assume capital outlay.`
        );
      }
    }

    return signals;
  }, [caseRecord, crmContacts, financials, profile.currency, roiScenarios]);

  const buildPayloadContext = () => ({
    caseId: caseRecord.id,
    businessProfile: caseRecord.profile,
    healthInputs: caseRecord.healthInputs,
    financials: caseRecord.financials,
    overallHealth: caseRecord.overallHealth,
    uploadedDocuments: sanitizeDocumentsForAiPayload(caseRecord.uploadedDocuments || []),
    crossDocumentSynthesis: caseRecord.crossDocumentSynthesis || null,
    crmContacts: caseRecord.crmContacts || [],
    roiScenarios: caseRecord.roiScenarios || [],
    recommendations: caseRecord.recommendations,
    actionPlan: caseRecord.actionPlan || [],
    continuity: caseRecord.continuity || null,
  });

  const handleStartChallenge = async () => {
    if (isLoading) return;
    const activeFocus = customFocus.trim() || selectedFocus;
    setIsLoading(true);
    setError(null);
    setLastFailedAction(null);

    try {
      const { data } = await apiFetchWithAuth<any>('/api/coach/challenge-me', {
        method: 'POST',
        body: {
          ...buildPayloadContext(),
          action: 'start',
          focusTopic: activeFocus,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      const nowIso = new Date().toISOString();
      const firstRound: ChallengeRound = {
        id: `cr-${Date.now()}-1`,
        roundNumber: 1,
        contradictionOrBlindSpot: data.firstRound?.contradictionOrBlindSpot || 'Primary Strategic Tension',
        scenarioContext: data.firstRound?.scenarioContext || '',
        question: data.firstRound?.question || 'What evidence supports your current assumption?',
      };

      const newSession: ChallengeMeSession = {
        id: `chal-session-${Date.now()}`,
        focusTopic: activeFocus,
        status: 'active',
        contradictionsDetected: Array.isArray(data.contradictionsDetected) ? data.contradictionsDetected : [],
        questionableAssumptions: Array.isArray(data.questionableAssumptions) ? data.questionableAssumptions : [],
        blindSpots: Array.isArray(data.blindSpots) ? data.blindSpots : [],
        rounds: [firstRound],
        conclusion: null,
        startedAt: nowIso,
        updatedAt: nowIso,
      };

      setOwnerResponse('');
      onUpdateCase({
        ...caseRecord,
        challengeSession: newSession,
        updatedAt: nowIso,
      });
      onTrackUsage?.('coachMessagesCount');
    } catch (err: any) {
      console.error('Challenge Me start failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setLastFailedAction('start');
      setError(err?.message || 'Failed to launch Challenge Me session.');
    } finally {
      setIsLoading(false);
    }
  };

  const executeRoundResponse = async () => {
    if (!session || session.status !== 'active' || !ownerResponse.trim() || isLoading) return;

    const currentRounds = [...session.rounds];
    const lastIdx = currentRounds.length - 1;
    if (lastIdx < 0) return;

    const trimmedAnswer = ownerResponse.trim();
    const updatedRoundsPreCall = currentRounds.map((r, idx) =>
      idx === lastIdx
        ? {
            ...r,
            ownerResponse: trimmedAnswer,
            respondedAt: new Date().toISOString(),
          }
        : r
    );

    setIsLoading(true);
    setError(null);
    setLastFailedAction(null);

    try {
      const { data } = await apiFetchWithAuth<any>('/api/coach/challenge-me', {
        method: 'POST',
        body: {
          ...buildPayloadContext(),
          action: 'respond',
          focusTopic: session.focusTopic,
          currentSession: {
            ...session,
            rounds: updatedRoundsPreCall,
          },
          ownerResponse: trimmedAnswer,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      const nowIso = new Date().toISOString();

      const updatedRounds = updatedRoundsPreCall.map((r, idx) =>
        idx === lastIdx
          ? {
              ...r,
              businessImplication: data.businessImplication || '',
            }
          : r
      );

      if (!data.shouldConclude && data.nextRound?.question) {
        updatedRounds.push({
          id: `cr-${Date.now()}-${updatedRounds.length + 1}`,
          roundNumber: updatedRounds.length + 1,
          contradictionOrBlindSpot: data.nextRound.contradictionOrBlindSpot || 'Follow-Up Risk',
          scenarioContext: data.nextRound.scenarioContext || '',
          question: data.nextRound.question,
        });
      }

      const updatedSession: ChallengeMeSession = {
        ...session,
        rounds: updatedRounds,
        updatedAt: nowIso,
      };

      setOwnerResponse('');
      onUpdateCase({
        ...caseRecord,
        challengeSession: updatedSession,
        updatedAt: nowIso,
      });
      onTrackUsage?.('coachMessagesCount');

      // If the AI signalled the challenge has reached conclusion depth, automatically synthesize conclusion
      if (data.shouldConclude) {
        setIsLoading(false);
        await concludeSession(updatedSession);
      }
    } catch (err: any) {
      console.error('Challenge Me response failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setLastFailedAction('respond');
      setError(err?.message || 'Unable to analyze response.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRoundResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeRoundResponse();
  };

  const concludeSession = async (targetSession?: ChallengeMeSession) => {
    const activeSess = targetSession || session;
    if (!activeSess) return;

    setIsLoading(true);
    setError(null);
    setLastFailedAction(null);
    setPendingConcludeSession(activeSess);

    try {
      const { data } = await apiFetchWithAuth<any>('/api/coach/challenge-me', {
        method: 'POST',
        body: {
          ...buildPayloadContext(),
          action: 'conclude',
          focusTopic: activeSess.focusTopic,
          currentSession: activeSess,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      const nowIso = new Date().toISOString();

      const concludedSession: ChallengeMeSession = {
        ...activeSess,
        status: 'concluded',
        conclusion: data.conclusion || {
          keyInsights: [],
          recommendedDecisions: [],
          nextActions: [],
          concludedAt: nowIso,
        },
        updatedAt: nowIso,
      };

      setPendingConcludeSession(undefined);
      onUpdateCase({
        ...caseRecord,
        challengeSession: concludedSession,
        updatedAt: nowIso,
      });
    } catch (err: any) {
      console.error('Challenge Me conclusion failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setLastFailedAction('conclude');
      setError(err?.message || 'Unable to conclude challenge session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryFailedAction = () => {
    if (lastFailedAction === 'start') {
      void handleStartChallenge();
    } else if (lastFailedAction === 'respond') {
      void executeRoundResponse();
    } else if (lastFailedAction === 'conclude') {
      void concludeSession(pendingConcludeSession);
    }
  };

  const handleAddNextActionToPlan = (nextAct: ChallengeNextAction) => {
    if (!session || !session.conclusion || nextAct.addedToPlan) return;

    const newAction: TurnaroundAction = {
      id: `act-chal-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      horizon: nextAct.priority.includes('Urgent')
        ? 'Horizon 1 (First 7 Days)'
        : nextAct.priority.includes('High')
        ? 'Horizon 2 (Days 8–30)'
        : 'Horizon 3 (Days 31–90)',
      priority: nextAct.priority,
      businessIssue: `Challenge Me Insight (${session.focusTopic})`,
      action: nextAct.action,
      accountableRole: nextAct.ownerRole || 'Owner',
      timeframe: nextAct.timeframe || 'Within 7 days',
      requiredInformationOrResources: ['Agreed in Challenge Me review'],
      measurableSuccessIndicator: nextAct.rationale || 'Verified completion & commercial review',
      dependencyOrRisk: 'Requires owner discipline to execute without reverting to old habits.',
      status: 'pending',
      completed: false,
    };

    const updatedNextActions = session.conclusion.nextActions.map((a) =>
      a.id === nextAct.id ? { ...a, addedToPlan: true } : a
    );

    const updatedSession: ChallengeMeSession = {
      ...session,
      conclusion: {
        ...session.conclusion,
        nextActions: updatedNextActions,
      },
      updatedAt: new Date().toISOString(),
    };

    onUpdateCase({
      ...caseRecord,
      actionPlan: [newAction, ...(caseRecord.actionPlan || [])],
      challengeSession: updatedSession,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleResetSession = () => {
    onUpdateCase({
      ...caseRecord,
      challengeSession: null,
      updatedAt: new Date().toISOString(),
    });
    setOwnerResponse('');
    setError(null);
  };

  const answeredRoundsCount = session?.rounds.filter((r) => Boolean(r.ownerResponse?.trim())).length ?? 0;
  const activePendingRound =
    session?.status === 'active'
      ? session.rounds.find((r) => !r.ownerResponse?.trim()) || null
      : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Executive Navy Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 border border-[#0F172A]/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#F5761A] text-[#0F172A] flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Challenge Me
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">
                Commercial Reality Check &amp; Assumption Stress-Test
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Stress-Test Your Decisions ({profile.name})
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              Interactive challenge grounded in {profile.name}’s actual Health Score ({overallHealth?.overallScore ?? 'Pending'}/100), stated concern, {crmContacts.length} CRM record{crmContacts.length === 1 ? '' : 's'}, {roiScenarios.length} ROI scenario{roiScenarios.length === 1 ? '' : 's'}, and {recommendations ? 'saved diagnostic recommendations' : 'assessment notes'}. Expect direct, commercially tough questions — one at a time.
            </p>
          </div>

          {session && (
            <button
              type="button"
              onClick={handleResetSession}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition whitespace-nowrap shrink-0 self-start lg:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#6495ED]" />
              <span>Start New Challenge</span>
            </button>
          )}
        </div>

        {/* Grounded Context Strip */}
        <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 rounded px-3 py-2 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">Industry &amp; Base</span>
            <strong className="text-white truncate block">{profile.industry} ({profile.currency})</strong>
          </div>
          <div className="bg-white/5 rounded px-3 py-2 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">Health Score</span>
            <strong className="text-[#6495ED] font-mono tabular-nums">
              {overallHealth?.overallScore !== null && overallHealth?.overallScore !== undefined
                ? `${overallHealth.overallScore}/100 · ${overallHealth.overallRating}`
                : overallHealth?.overallRating || 'Pending'}
            </strong>
          </div>
          <div className="bg-white/5 rounded px-3 py-2 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">CRM &amp; ROI Data</span>
            <strong className="text-white font-mono tabular-nums">
              {crmContacts.length} CRM · {roiScenarios.length} ROI
            </strong>
          </div>
          <div className="bg-white/5 rounded px-3 py-2 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">Primary Concern</span>
            <strong className="text-white truncate block">
              {profile.primaryConcern || 'Not entered yet'}
            </strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs sm:text-sm rounded flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastFailedAction && (
              <button
                type="button"
                onClick={handleRetryFailedAction}
                disabled={isLoading}
                className="px-3 py-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLastFailedAction(null);
              }}
              className="text-xs font-bold hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* State 1: Setup / Launch Challenge */}
      {!session && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#0F172A]/12 rounded p-6 sm:p-7 space-y-5 shadow-xs">
            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
                Configure Interrogation Focus
              </span>
              <h3 className="text-lg font-bold text-[#0F172A]">
                Where Should BizPulse Push Back Hardest?
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Choose a commercial angle below or define your own decision to test. BizPulse will surface contradictions in your numbers/answers and run a multi-round scenario test—one sharp question at a time.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CHALLENGE_FOCUS_PRESETS.map((preset) => {
                const isSelected = selectedFocus === preset && !customFocus.trim();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedFocus(preset);
                      setCustomFocus('');
                    }}
                    className={`p-3.5 rounded border text-left text-xs font-semibold transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#0F172A]/12 hover:border-[#0F52BA]'
                    }`}
                  >
                    <span>{preset}</span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#6495ED] shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0F172A] block">
                Or test a specific decision / assumption (optional):
              </label>
              <input
                type="text"
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                placeholder="e.g., Should we hire another senior technician before clearing overdue accounts?"
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-4 py-2.5 text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F52BA] focus:border-[#0F52BA]"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#0F172A]/10">
              <span className="text-[11px] text-[#475569]">
                Constructive, direct, evidence-first challenge. Session saves automatically to this business case.
              </span>
              <button
                type="button"
                onClick={handleStartChallenge}
                disabled={isLoading}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded bg-[#F5761A] hover:bg-[#E0650E] disabled:opacity-50 text-[#0F172A] text-xs font-bold uppercase tracking-wider transition whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scanning Business Data...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Start Challenge Me Session</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Local Pre-Scan Signals Card */}
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B45309]">
              <EyeOff className="w-4 h-4 text-[#D97706]" />
              <span>Signals Detected from Case Data</span>
            </div>
            {localSignals.length > 0 ? (
              <ul className="space-y-2.5 text-xs text-[#0F172A]">
                {localSignals.map((sig, i) => (
                  <li key={i} className="p-3 rounded bg-[#FFFBEB] border border-[#FDE68A] leading-relaxed">
                    • {sig}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-xs text-[#475569] leading-relaxed">
                Complete more of Essentials, 12-Capability Health, Cash Flow, CRM, or ROI to surface automatic numerical tensions—or start Challenge Me now to test your current business assumptions directly.
              </div>
            )}
          </div>
        </div>
      )}

      {/* State 2 & 3: Active or Concluded Session */}
      {session && (
        <div className="space-y-6">
          {/* Contradictions, Questionable Assumptions & Blind Spots Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-white border border-[#FECACA] rounded p-5 space-y-2.5">
              <span className="font-bold text-[#B91C1C] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Contradictions Detected
              </span>
              <ul className="space-y-2 text-[#0F172A]">
                {session.contradictionsDetected.map((c, idx) => (
                  <li key={idx} className="p-2.5 rounded bg-[#FEF2F2] border border-[#FECACA]/70 leading-relaxed">
                    • {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-[#FDE68A] rounded p-5 space-y-2.5">
              <span className="font-bold text-[#B45309] uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#D97706]" />
                Questionable Assumptions
              </span>
              <ul className="space-y-2 text-[#0F172A]">
                {session.questionableAssumptions.map((a, idx) => (
                  <li key={idx} className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A]/80 leading-relaxed">
                    ? {a}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-[#CBD5E1] rounded p-5 space-y-2.5">
              <span className="font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-[#475569]" />
                Potential Blind Spots &amp; Risks
              </span>
              <ul className="space-y-2 text-[#0F172A]">
                {session.blindSpots.map((b, idx) => (
                  <li key={idx} className="p-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] leading-relaxed">
                    ! {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Round-by-Round Progression */}
          <div className="space-y-4">
            {session.rounds.map((round) => {
              const isAnswered = Boolean(round.ownerResponse?.trim());
              const isCurrentOpen = session.status === 'active' && activePendingRound?.id === round.id;

              return (
                <div
                  key={round.id}
                  className={`bg-white rounded border transition ${
                    isCurrentOpen
                      ? 'border-[#0F52BA] shadow-sm'
                      : 'border-[#0F172A]/12'
                  }`}
                >
                  {/* Round Header */}
                  <div className="px-6 py-3.5 bg-[#F8FAFC] border-b border-[#0F172A]/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-[#0A2E6E] text-[#6495ED] font-mono font-bold text-[11px]">
                        Round {round.roundNumber}
                      </span>
                      <span className="text-xs font-bold text-[#0F172A]">
                        {round.contradictionOrBlindSpot}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isAnswered
                          ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                          : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                      }`}
                    >
                      {isAnswered ? 'Tested' : 'Awaiting Your Decision'}
                    </span>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Realistic Scenario */}
                    {round.scenarioContext && (
                      <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/15 space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
                          Realistic Commercial Scenario
                        </span>
                        <p className="text-xs sm:text-sm text-[#0F172A] leading-relaxed">
                          {round.scenarioContext}
                        </p>
                      </div>
                    )}

                    {/* Single Pointed Question */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA] block">
                        Challenge Question:
                      </span>
                      <p className="text-base sm:text-lg font-bold text-[#0F172A] leading-snug">
                        {round.question}
                      </p>
                    </div>

                    {/* Owner Response + Business Implication (when answered) */}
                    {isAnswered && (
                      <div className="space-y-3 pt-2 border-t border-[#0F172A]/10">
                        <div className="p-4 rounded bg-[#EDF3FD] border border-[#B7CEF7] space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F52BA] block">
                            Your Response
                          </span>
                          <p className="text-xs sm:text-sm text-[#0F172A] whitespace-pre-wrap leading-relaxed">
                            {round.ownerResponse}
                          </p>
                        </div>

                        {round.businessImplication && (
                          <div className="p-4 rounded bizpulse-hero-gradient text-white space-y-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6495ED] block">
                              Business &amp; Financial Implication
                            </span>
                            <p className="text-xs sm:text-sm text-[#F1F5F9] whitespace-pre-wrap leading-relaxed">
                              {round.businessImplication}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Active Response Form (shown only on the current unanswered round) */}
                    {isCurrentOpen && (
                      <form onSubmit={handleSubmitRoundResponse} className="space-y-3 pt-2 border-t border-[#0F172A]/10">
                        <label className="text-xs font-bold text-[#0F172A] block">
                          Defend your decision or test an alternative approach:
                        </label>
                        <textarea
                          rows={3}
                          value={ownerResponse}
                          onChange={(e) => setOwnerResponse(e.target.value)}
                          disabled={isLoading}
                          placeholder="State your reasoning, numbers, trade-offs, or how you would actually execute this under pressure..."
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-4 py-3 text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F52BA] focus:border-[#0F52BA]"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {answeredRoundsCount >= 1 ? (
                            <button
                              type="button"
                              onClick={() => concludeSession()}
                              disabled={isLoading}
                              className="px-4 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition flex items-center gap-1.5"
                            >
                              <Flag className="w-3.5 h-3.5 text-[#0F52BA]" />
                              <span>Conclude &amp; Extract Decisions</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#475569]">
                              Answer Round 1 to see the commercial implication and continue.
                            </span>
                          )}

                          <button
                            type="submit"
                            disabled={isLoading || !ownerResponse.trim()}
                            className="px-5 py-2.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition whitespace-nowrap"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                <span>Evaluating Implication...</span>
                              </>
                            ) : (
                              <>
                                <span>Submit Response &amp; Continue</span>
                                <Send className="w-3.5 h-3.5 text-white" />
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}

            {/* If active session has all rounds answered (rare edge case before conclude) */}
            {session.status === 'active' && !activePendingRound && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => concludeSession()}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                  <span>Generate Challenge Conclusions &amp; Next Actions</span>
                </button>
              </div>
            )}
          </div>

          {/* Concluded Insights, Decisions & Practical Next Actions */}
          {session.status === 'concluded' && session.conclusion && (
            <div className="bg-white border-2 border-[#0A2E6E] rounded p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#0F172A]/10">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Challenge Me Conclusion ({session.focusTopic})
                  </span>
                  <h3 className="text-xl font-bold text-[#0F172A]">
                    Key Insights, Recommended Decisions &amp; Next Actions
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onOpenCoachWithPrompt(
                      `Let's follow up on my Challenge Me session ("${session.focusTopic}"). Key decisions flagged: ${session.conclusion?.recommendedDecisions.slice(0, 2).join('; ')}. Help me pressure-test implementation.`
                    )
                  }
                  className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#0A2E6E] hover:bg-[#0F52BA] text-white text-xs font-semibold transition whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#6495ED]" />
                  <span>Continue in Chat with Coach</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm">
                <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] block">
                    Key Insights Surfaced
                  </span>
                  <ul className="space-y-2 text-xs text-[#0F172A]">
                    {session.conclusion.keyInsights.map((ins, i) => (
                      <li key={i} className="leading-relaxed flex items-start gap-2">
                        <span className="text-[#0F52BA] font-bold">•</span>
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#B45309] block">
                    Recommended Executive Decisions
                  </span>
                  <ul className="space-y-2 text-xs text-[#0F172A]">
                    {session.conclusion.recommendedDecisions.map((dec, i) => (
                      <li key={i} className="leading-relaxed flex items-start gap-2 font-medium">
                        <span className="text-[#B45309] font-bold">→</span>
                        <span>{dec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Practical Next Actions convertible directly into the 90-Day Action Plan */}
              <div className="space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
                  Practical Next Actions (Convert Directly to 90-Day Action Plan)
                </span>
                <div className="space-y-2.5">
                  {session.conclusion.nextActions.map((act) => (
                    <div
                      key={act.id}
                      className="p-4 rounded border border-[#0F172A]/12 bg-[#FCFCFC] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                              act.priority.includes('Urgent')
                                ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                : act.priority.includes('High')
                                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                : 'bg-white text-[#0F172A] border-[#0F172A]/15'
                            }`}
                          >
                            {act.priority}
                          </span>
                          <span className="text-[11px] font-semibold text-[#475569]">
                            {act.ownerRole} · {act.timeframe}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-[#0F172A]">{act.action}</p>
                        <p className="text-xs text-[#475569]">{act.rationale}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddNextActionToPlan(act)}
                        disabled={Boolean(act.addedToPlan)}
                        className={`px-3.5 py-2 rounded text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                          act.addedToPlan
                            ? 'bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0] cursor-default'
                            : 'bg-[#0A2E6E] hover:bg-[#0F52BA] text-white'
                        }`}
                      >
                        {act.addedToPlan ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Added to Action Plan</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-[#6495ED]" />
                            <span>Add to Action Plan</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
