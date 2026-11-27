import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Info,
  Activity,
  BookmarkCheck,
  TrendingUp,
  Scale,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
} from 'lucide-react';
import { WEEKLY_DASHBOARD_KPIS } from '../data/coachingBriefing';
import {
  AccountUsageSummary,
  CaseRecord,
  KpiTrackerState,
  MembershipContinuity,
  WeeklyDashboardKPI,
} from '../types/bizpulse';
import {
  buildMonthlyReviewEntry,
  buildQuarterlyReviewEntry,
  buildWeeklyPulseEntry,
  captureMetricSnapshot,
  createJoiningBaseline,
} from '../services/continuityEngine';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';
import { KpiTrackerView } from './KpiTrackerView';

export type ContinuitySubTab = 'scoreboard' | 'kpis' | 'baseline' | 'weekly' | 'monthly' | 'quarterly';

interface WeeklyDashboardViewProps {
  caseRecord?: CaseRecord;
  initialSubTab?: ContinuitySubTab;
  onUpdateContinuity?: (continuity: MembershipContinuity) => void;
  onUpdateKpiTracker?: (tracker: KpiTrackerState) => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
}

export const WeeklyDashboardView: React.FC<WeeklyDashboardViewProps> = ({
  caseRecord,
  initialSubTab,
  onUpdateContinuity,
  onUpdateKpiTracker,
  onAccountUsageUpdate,
}) => {
  const [subTab, setSubTab] = useState<ContinuitySubTab>(initialSubTab || 'scoreboard');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [weeklyNote, setWeeklyNote] = useState('');
  const [monthlyReflection, setMonthlyReflection] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<null | 'weekly' | 'monthly' | 'quarterly'>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isDemo = caseRecord?.profile?.isDemonstrationCase ?? false;
  const businessName = caseRecord?.profile?.name || 'Business Case';
  const currency = caseRecord?.profile?.currency || 'NZD';
  const fin = caseRecord?.financials;
  const health = caseRecord?.overallHealth;

  const continuity: MembershipContinuity = caseRecord?.continuity || {
    joiningBaseline: null,
    weeklyPulses: [],
    monthlyReviews: [],
    quarterlyReviews: [],
  };

  const actionPlanList = (caseRecord?.actionPlan || []).filter(
    (a) => a.decisionStatus !== 'rejected'
  );
  const doneActionsCount = actionPlanList.filter(
    (a) => a.completed || a.status === 'completed'
  ).length;
  const recItems = caseRecord?.recommendations?.actionItems || [];
  const recDoneCount = recItems.filter((a) => a.completed).length;

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  const ensureBaseline = (currentContinuity: MembershipContinuity): MembershipContinuity => {
    if (currentContinuity.joiningBaseline || !caseRecord) return currentContinuity;
    return {
      ...currentContinuity,
      joiningBaseline: createJoiningBaseline(caseRecord),
    };
  };

  const handleLockOrRefreshBaseline = () => {
    if (!caseRecord || !onUpdateContinuity) return;
    const updated: MembershipContinuity = {
      ...continuity,
      joiningBaseline: createJoiningBaseline(caseRecord),
    };
    onUpdateContinuity(updated);
    showTempNotice(
      continuity.joiningBaseline
        ? 'Updated Joining Baseline snapshot from current business figures.'
        : 'Locked Joining Baseline snapshot. Future weekly and monthly reviews will compare against this baseline.'
    );
  };

  const handleLogDeterministicWeeklyPulse = () => {
    if (!caseRecord || !onUpdateContinuity) return;
    const baseContinuity = ensureBaseline(continuity);
    const entry = buildWeeklyPulseEntry(
      { ...caseRecord, continuity: baseContinuity },
      { ownerNote: weeklyNote }
    );
    onUpdateContinuity({
      ...baseContinuity,
      weeklyPulses: [entry, ...(baseContinuity.weeklyPulses || [])],
    });
    setWeeklyNote('');
    showTempNotice(`Saved Weekly Business Pulse for week of ${entry.weekOf}.`);
  };

  const handleLogDeterministicMonthlyReview = () => {
    if (!caseRecord || !onUpdateContinuity) return;
    const baseContinuity = ensureBaseline(continuity);
    const entry = buildMonthlyReviewEntry(
      { ...caseRecord, continuity: baseContinuity },
      { ownerReflection: monthlyReflection }
    );
    onUpdateContinuity({
      ...baseContinuity,
      monthlyReviews: [entry, ...(baseContinuity.monthlyReviews || [])],
    });
    setMonthlyReflection('');
    showTempNotice(`Saved Monthly Business Review for ${entry.reviewMonth}.`);
  };

  const handleLogDeterministicQuarterlyReview = () => {
    if (!caseRecord || !onUpdateContinuity) return;
    const baseContinuity = ensureBaseline(continuity);
    const entry = buildQuarterlyReviewEntry({ ...caseRecord, continuity: baseContinuity });
    onUpdateContinuity({
      ...baseContinuity,
      quarterlyReviews: [entry, ...(baseContinuity.quarterlyReviews || [])],
    });
    showTempNotice(`Saved Quarterly Sustainability Review for ${entry.quarterLabel}.`);
  };

  const handleGenerateAiContinuity = async (reviewType: 'weekly' | 'monthly' | 'quarterly') => {
    if (!caseRecord || !onUpdateContinuity || isGeneratingAi) return;
    setIsGeneratingAi(reviewType);
    setAiError(null);

    try {
      const baseContinuity = ensureBaseline(continuity);
      const { data } = await apiFetchWithAuth<{
        review?: any;
        accountUsage?: AccountUsageSummary;
      }>('/api/continuity/generate-review', {
        method: 'POST',
        body: {
          caseId: caseRecord.id,
          reviewType,
          ownerReflection: reviewType === 'weekly' ? weeklyNote : monthlyReflection,
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
          continuity: baseContinuity,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);

      const aiReview = data.review || {};
      if (reviewType === 'weekly') {
        const entry = buildWeeklyPulseEntry(
          { ...caseRecord, continuity: baseContinuity },
          {
            ownerNote: weeklyNote,
            emergingConcerns: Array.isArray(aiReview.emergingConcerns) ? aiReview.emergingConcerns : undefined,
            emergingOpportunities: Array.isArray(aiReview.emergingOpportunities)
              ? aiReview.emergingOpportunities
              : undefined,
            nextWeekPriorities: Array.isArray(aiReview.nextWeekPriorities)
              ? aiReview.nextWeekPriorities
              : undefined,
            aiPulseSummary: typeof aiReview.executiveSummary === 'string' ? aiReview.executiveSummary : undefined,
          }
        );
        if (Array.isArray(aiReview.missingInfoNeeded) && aiReview.missingInfoNeeded.length > 0) {
          entry.missingDataPrompt = aiReview.missingInfoNeeded;
        }
        onUpdateContinuity({
          ...baseContinuity,
          weeklyPulses: [entry, ...(baseContinuity.weeklyPulses || [])],
        });
        setWeeklyNote('');
        showTempNotice(`Generated AI Weekly Business Pulse for ${entry.weekOf}.`);
      } else if (reviewType === 'monthly') {
        const entry = buildMonthlyReviewEntry(
          { ...caseRecord, continuity: baseContinuity },
          {
            ownerReflection: monthlyReflection,
            aiResult: {
              executiveSummary: aiReview.executiveSummary,
              comparisonToBaseline: {
                healthScoreChange: null,
                cashChange: null,
                overdueArChange: null,
                pipelineChange: 0,
                improvedAreas: Array.isArray(aiReview.improvedAreas) ? aiReview.improvedAreas : [],
                deterioratedAreas: Array.isArray(aiReview.deterioratedAreas) ? aiReview.deterioratedAreas : [],
                unresolvedIssues: Array.isArray(aiReview.unresolvedIssues) ? aiReview.unresolvedIssues : [],
              },
              revenueOpportunities: Array.isArray(aiReview.revenueOpportunities)
                ? aiReview.revenueOpportunities
                : undefined,
              profitLeakageAlerts: Array.isArray(aiReview.profitLeakageAlerts)
                ? aiReview.profitLeakageAlerts
                : undefined,
              cashFlowConcerns: Array.isArray(aiReview.cashFlowConcerns) ? aiReview.cashFlowConcerns : undefined,
              actionOutcomesReviewed: Array.isArray(aiReview.actionOutcomesReviewed)
                ? aiReview.actionOutcomesReviewed
                : undefined,
              nextThreePriorities: Array.isArray(aiReview.nextThreePriorities)
                ? aiReview.nextThreePriorities
                : undefined,
              missingInfoNeeded: Array.isArray(aiReview.missingInfoNeeded) ? aiReview.missingInfoNeeded : undefined,
            },
          }
        );
        onUpdateContinuity({
          ...baseContinuity,
          monthlyReviews: [entry, ...(baseContinuity.monthlyReviews || [])],
        });
        setMonthlyReflection('');
        showTempNotice(`Generated AI Monthly Business Review for ${entry.reviewMonth}.`);
      } else {
        const entry = buildQuarterlyReviewEntry(
          { ...caseRecord, continuity: baseContinuity },
          {
            aiResult: {
              executiveSummary: aiReview.executiveSummary,
              resilienceTrend:
                aiReview.resilienceTrend === 'Strengthening' ||
                aiReview.resilienceTrend === 'Mixed / Holding' ||
                aiReview.resilienceTrend === 'Under Strain' ||
                aiReview.resilienceTrend === 'Insufficient Data'
                  ? aiReview.resilienceTrend
                  : undefined,
              strategicChoice: aiReview.strategicChoice,
              longTermRisks: Array.isArray(aiReview.longTermRisks) ? aiReview.longTermRisks : undefined,
              longTermOpportunities: Array.isArray(aiReview.longTermOpportunities)
                ? aiReview.longTermOpportunities
                : undefined,
              recommendedAdjustments: Array.isArray(aiReview.recommendedAdjustments)
                ? aiReview.recommendedAdjustments
                : undefined,
              missingInfoNeeded: Array.isArray(aiReview.missingInfoNeeded) ? aiReview.missingInfoNeeded : undefined,
            },
          }
        );
        onUpdateContinuity({
          ...baseContinuity,
          quarterlyReviews: [entry, ...(baseContinuity.quarterlyReviews || [])],
        });
        showTempNotice(`Generated AI Quarterly Sustainability Review for ${entry.quarterLabel}.`);
      }
    } catch (err: any) {
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setAiError(err.message || 'Unable to generate AI continuity review.');
    } finally {
      setIsGeneratingAi(null);
    }
  };

  const currentSnapshot = caseRecord ? captureMetricSnapshot(caseRecord) : null;

  const formatDelta = (delta: number | null, prefix = '', suffix = '') => {
    if (delta === null || delta === undefined) return 'Not yet comparable';
    if (delta === 0) return 'Unchanged (0)';
    return `${delta > 0 ? '+' : ''}${prefix}${delta.toLocaleString()}${suffix}`;
  };

  const customKPIs: WeeklyDashboardKPI[] = [
    {
      id: 'c-kpi-1',
      name: isDemo ? WEEKLY_DASHBOARD_KPIS[0].name : 'Cash on Hand vs. Overdraft Drawn',
      area: 'Cash Liquidity',
      currentReportedValue: fin
        ? `Cash ${currency} ${(fin.cashInBank ?? 0).toLocaleString()} | Drawn ${currency} ${(
            fin.creditFacilityUsed ?? 0
          ).toLocaleString()}`
        : 'Not supplied yet',
      targetBenchmark: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].targetBenchmark
        : 'Cash buffer >= 4–8 weeks operating expenses',
      warningThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].warningThreshold
        : 'Credit facility drawn > 50% of limit',
      criticalThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].criticalThreshold
        : 'Negative net cash after near-term payables',
      explanation: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].explanation
        : 'Tracks genuine cash solvency weekly instead of paper revenue.',
      criteriaExplanation: 'Updates live from your Cash Flow & Financial Ledger tab.',
      accountableRole: 'Owner / Finance Lead',
      measurementFrequency: 'Weekly (Monday Cash Check)',
    },
    {
      id: 'c-kpi-2',
      name: isDemo ? WEEKLY_DASHBOARD_KPIS[1].name : 'Overdue Customer Invoices (>60 Days)',
      area: 'Collections',
      currentReportedValue:
        fin && fin.overdueReceivables != null
          ? `${currency} ${fin.overdueReceivables.toLocaleString()}${
              fin.accountsReceivable
                ? ` (${Math.round((fin.overdueReceivables / fin.accountsReceivable) * 100)}% of AR)`
                : ''
            }`
          : 'Not supplied yet',
      targetBenchmark: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].targetBenchmark
        : '< 10% of receivables past 30 days',
      warningThreshold: isDemo ? WEEKLY_DASHBOARD_KPIS[1].warningThreshold : '15–25% receivables overdue',
      criticalThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].criticalThreshold
        : '> 25% receivables > 60 days overdue',
      explanation: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].explanation
        : 'Prevents funded work from turning into unpaid interest-free customer credit.',
      criteriaExplanation: 'Reviewed every Monday against aged debtors ledger.',
      accountableRole: 'Accounts / Owner',
      measurementFrequency: 'Weekly',
    },
    {
      id: 'c-kpi-3',
      name: '12-Capability Business Health Index',
      area: 'Overall Health',
      currentReportedValue:
        health && health.overallScore !== null
          ? `${health.overallScore}/100 (${health.overallRating})`
          : 'Assessment Pending',
      targetBenchmark: '72+ / 100 (Healthy across Money & Delivery)',
      warningThreshold: '45–71 / 100 (Needs Attention)',
      criticalThreshold: '< 45 / 100 or Money / Ops At Risk',
      explanation: 'Summarizes strategic, financial, margin, staffing, and owner-dependency stability.',
      criteriaExplanation: 'Updates dynamically from the 12 Business Health Capabilities tab.',
      accountableRole: 'Business Owner',
      measurementFrequency: 'Monthly / On Assessment',
    },
    {
      id: 'c-kpi-4',
      name: '30/60/90-Day Accountability Progress',
      area: 'Execution',
      currentReportedValue:
        actionPlanList.length > 0
          ? `${doneActionsCount} / ${actionPlanList.length} Plan Actions Done`
          : recItems.length > 0
          ? `${recDoneCount} / ${recItems.length} Actions Done`
          : isDemo
          ? WEEKLY_DASHBOARD_KPIS[3].currentReportedValue
          : '0 / 0 Plan Actions Done',
      targetBenchmark: 'Weekly completion of priority steps',
      warningThreshold: 'Actions stalled > 14 days',
      criticalThreshold: 'Repeated unplanned firefighting',
      explanation: 'Ensures coaching insights convert into tangible weekly execution.',
      criteriaExplanation: 'Tracked dynamically on 30/60/90-Day Action Plan & Coaching tabs.',
      accountableRole: 'Operations Lead',
      measurementFrequency: 'Weekly',
    },
    {
      id: 'c-kpi-5',
      name: 'Core Team & Owner Workload',
      area: 'People & Capacity',
      currentReportedValue: caseRecord?.healthInputs?.ownerDependency?.status
        ? caseRecord.healthInputs.ownerDependency.status.replace('_', ' ').toUpperCase()
        : 'UNRATED',
      targetBenchmark: 'Healthy (< 45 hrs/wk owner focus on high-value work)',
      warningThreshold: 'Needs Attention (frequent escalations)',
      criticalThreshold: 'At Risk (single-point failure / burnout)',
      explanation: 'Protects staff retention and reduces owner dependency on routine decisions.',
      criteriaExplanation: 'Rated in Dimension 6 (People) and Dimension 7 (Owner Dependency).',
      accountableRole: 'Owner / Team Lead',
      measurementFrequency: 'Fortnightly',
    },
    {
      id: 'c-kpi-6',
      name: 'Pricing & Margin Integrity',
      area: 'Profitability',
      currentReportedValue:
        fin && fin.operatingProfit != null && fin.annualRevenue
          ? `${Math.round((fin.operatingProfit / fin.annualRevenue) * 100)}% operating margin (${
              fin.pricingReviewLastYears != null
                ? `${fin.pricingReviewLastYears}y since price review`
                : 'review cadence unrecorded'
            })`
          : 'Not supplied yet',
      targetBenchmark: 'Annual price review + documented variation quotes',
      warningThreshold: 'Margins slipping on rising wage/supplier costs',
      criticalThreshold: 'Unbilled scope creep or loss-making jobs',
      explanation: 'Protects gross profit against inflation without sacrificing service quality.',
      criteriaExplanation: 'Updates from Cash Flow ledger and Client Matrix calculator.',
      accountableRole: 'Managing Director',
      measurementFrequency: 'Monthly',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Executive Navy Hero Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#2563EB] text-white">
                Scoreboard &amp; Member Continuity
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">{businessName}</span>
              {isDemo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/40">
                  Sample Demo Business (Not Your Real Data)
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Weekly Pulse, Monthly Reviews &amp; Quarterly Sustainability
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              Track your real business from your Joining Baseline through Weekly Pulses, Monthly Progress Reviews, and Quarterly Sustainability checks—saved privately to this business session.
            </p>
          </div>

          <div className="bg-white/5 border border-white/15 rounded p-4 min-w-[235px] text-center shrink-0 tabular-nums">
            <span className="text-[11px] text-[#60A5FA] uppercase tracking-wider font-bold block">
              Continuity Memory
            </span>
            <div className="text-sm font-bold text-white mt-1">
              {continuity.joiningBaseline
                ? `Baseline: ${continuity.joiningBaseline.capturedAt.slice(0, 10)}`
                : 'No Baseline Locked Yet'}
            </div>
            <div className="text-xs text-[#CBD5E1] font-mono mt-1">
              {continuity.weeklyPulses.length} Weekly · {continuity.monthlyReviews.length} Monthly ·{' '}
              {continuity.quarterlyReviews.length} Quarterly
            </div>
          </div>
        </div>

        {/* Sub-view navigation */}
        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap gap-2">
          {(
            [
              { id: 'scoreboard', label: 'Monday Scoreboard', icon: Calendar },
              {
                id: 'kpis',
                label: caseRecord?.kpiTracker?.kpis?.length
                  ? `KPI & Performance Tracker (${caseRecord.kpiTracker.kpis.length})`
                  : 'KPI & Performance Tracker',
                icon: Gauge,
              },
              { id: 'baseline', label: 'Joining Baseline', icon: BookmarkCheck },
              {
                id: 'weekly',
                label: `Weekly Pulse (${continuity.weeklyPulses.length})`,
                icon: Activity,
              },
              {
                id: 'monthly',
                label: `Monthly Review (${continuity.monthlyReviews.length})`,
                icon: TrendingUp,
              },
              {
                id: 'quarterly',
                label: `Quarterly Sustainability (${continuity.quarterlyReviews.length})`,
                icon: Scale,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold transition ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white/10 hover:bg-white/20 text-[#CBD5E1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {aiError && (
        <div className="p-3.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{aiError}</span>
          </div>
          <button type="button" onClick={() => setAiError(null)} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* SUB-TAB 1: MONDAY SCOREBOARD (PRESERVED CORE) */}
      {subTab === 'scoreboard' && (
        <div className="space-y-6">
          {!isDemo && !fin && (
            <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#0F172A] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <span>
                Metrics below reflect your actual ratings and any numbers entered for{' '}
                <strong>{businessName}</strong>. Missing accounting figures are shown as &ldquo;Not
                supplied yet&rdquo; rather than fabricated defaults.
              </span>
            </div>
          )}

          {/* Live Connected CRM & ROI Pipeline Summary Strip */}
          {(() => {
            const crm = caseRecord?.crmContacts || [];
            const roi = caseRecord?.roiScenarios || [];
            const todayIso = new Date().toISOString().slice(0, 10);
            const openPipeline = crm
              .filter(
                (c) => c.salesStage !== 'Won' && c.salesStage !== 'Lost' && c.salesStage !== 'Dormant'
              )
              .reduce((s, c) => s + (Number(c.opportunityValue) || 0), 0);
            const dueCount = crm.filter(
              (c) =>
                c.status === 'Follow-Up Due' ||
                c.status === 'At Risk' ||
                (Boolean(c.nextFollowUpDate) &&
                  c.nextFollowUpDate <= todayIso &&
                  c.salesStage !== 'Lost' &&
                  c.status !== 'Closed Lost')
            ).length;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
                <div className="bg-white border border-[#0F172A]/12 rounded p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                    CRM Active Pipeline
                  </span>
                  <div className="text-xl font-bold text-[#0F172A] font-mono mt-1">
                    {currency} {openPipeline.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-[#475569]">
                    Across {crm.length} CRM contact{crm.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div
                  className={`border rounded p-4 ${
                    dueCount > 0 ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-white border-[#0F172A]/12'
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B45309] block">
                    CRM Follow-Ups Due / At Risk
                  </span>
                  <div className="text-xl font-bold text-[#B45309] font-mono mt-1">{dueCount}</div>
                  <span className="text-[11px] text-[#475569]">
                    Accounts needing Monday follow-up action
                  </span>
                </div>
                <div className="bg-white border border-[#0F172A]/12 rounded p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                    Modeled ROI Scenarios
                  </span>
                  <div className="text-xl font-bold text-[#0F172A] font-mono mt-1">{roi.length}</div>
                  <span className="text-[11px] text-[#475569]">
                    Evaluated on ROI &amp; Options workbench
                  </span>
                </div>
              </div>
            );
          })()}

          {/* 6 Vital Sign Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {customKPIs.map((kpi, index) => {
              const isAlert =
                kpi.currentReportedValue.includes('AT RISK') ||
                kpi.currentReportedValue.includes('At Risk');
              return (
                <div
                  key={kpi.id}
                  className="bg-white border border-[#0F172A]/12 rounded p-6 flex flex-col justify-between transition-all hover:border-[#2563EB]"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F172A] px-2.5 py-0.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15 font-mono">
                        {kpi.area}
                      </span>
                      <span className="text-[11px] font-semibold text-[#1D4ED8] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                        {kpi.accountableRole}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-[#0F172A] text-base leading-snug">
                        {index + 1}. {kpi.name}
                      </h3>
                      <p className="text-xs text-[#475569] mt-1 leading-relaxed">{kpi.explanation}</p>
                    </div>

                    <div
                      className={`p-3.5 rounded border space-y-1 ${
                        isAlert
                          ? 'bg-[#FEF2F2] border-[#FECACA]'
                          : 'bg-[#F8FAFC] border-[#0F172A]/12'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wider">
                        Current Reported Position
                      </span>
                      <div
                        className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                          isAlert ? 'text-[#B91C1C]' : 'text-[#0F172A]'
                        }`}
                      >
                        {kpi.currentReportedValue}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
                        <span className="text-[#15803D] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                          Healthy Target
                        </span>
                        <span className="text-[#0F172A] font-medium text-[11px] block">
                          {kpi.targetBenchmark}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
                        <span className="text-[#B91C1C] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                          Redline Alert
                        </span>
                        <span className="text-[#0F172A] font-medium text-[11px] block">
                          {kpi.criticalThreshold}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#0F172A]/10 text-xs text-[#475569] leading-relaxed">
                    <strong className="text-[#0F172A] font-semibold">Review Basis: </strong>
                    {kpi.criteriaExplanation}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 45-Minute Monday Meeting Protocol */}
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8">
            <h3 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#2563EB]" />
              <span>45-Minute Monday Meeting Protocol</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
                <span className="font-bold text-[#2563EB] text-sm block">
                  1. Minutes 0–15: Cash &amp; Debtors
                </span>
                <p className="text-[#475569] leading-relaxed">
                  Check bank balance, facility headroom, and overdue invoices past terms. Confirm
                  collection calls and follow-up dates.
                </p>
              </div>
              <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
                <span className="font-bold text-[#0F172A] text-sm block">
                  2. Minutes 15–30: Delivery &amp; Clients
                </span>
                <p className="text-[#475569] leading-relaxed">
                  Review key customer status, overdue jobs or tickets, and senior staff capacity
                  protection.
                </p>
              </div>
              <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
                <span className="font-bold text-[#15803D] text-sm block">
                  3. Minutes 30–45: 3 Weekly Commitments
                </span>
                <p className="text-[#475569] leading-relaxed">
                  Assign 3 clear non-negotiable actions with accountable owners and Friday completion
                  check-ins.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1B: KPI & PERFORMANCE TRACKER */}
      {subTab === 'kpis' && caseRecord && (
        <KpiTrackerView
          caseRecord={caseRecord}
          onUpdateKpiTracker={onUpdateKpiTracker}
          onAccountUsageUpdate={onAccountUsageUpdate}
        />
      )}

      {/* SUB-TAB 2: AT JOINING BASELINE */}
      {subTab === 'baseline' && (
        <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#0F172A]/10 pb-4">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                At Joining Baseline
              </span>
              <h3 className="text-xl font-bold text-[#0F172A] mt-0.5">
                Where {businessName} Started vs. Today
              </h3>
            </div>
            {onUpdateContinuity && (
              <button
                type="button"
                onClick={handleLockOrRefreshBaseline}
                className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider transition"
              >
                {continuity.joiningBaseline
                  ? 'Refresh Baseline Snapshot'
                  : 'Lock Joining Baseline Now'}
              </button>
            )}
          </div>

          {continuity.joiningBaseline ? (
            <div className="space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">
                    Baseline Captured: {continuity.joiningBaseline.capturedAt.slice(0, 10)}
                  </span>
                  <p className="text-[#0F172A]">
                    <strong>Starting Concern:</strong> {continuity.joiningBaseline.primaryConcern}
                  </p>
                  <p className="text-[#0F172A]">
                    <strong>Starting Objective:</strong> {continuity.joiningBaseline.primaryObjective}
                  </p>
                  <p className="text-[#475569]">
                    <strong>Initial Recommendation:</strong>{' '}
                    {continuity.joiningBaseline.initialRecommendationSummary}
                  </p>
                </div>

                {currentSnapshot && (
                  <div className="p-4 rounded bg-[#EFF6FF] border border-[#BFDBFE] space-y-2 tabular-nums">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1D4ED8] block">
                      Live Delta Since Joining
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[#475569] block">Health Score</span>
                        <strong className="text-[#0F172A] font-mono">
                          {continuity.joiningBaseline.snapshot.healthScore ?? 'Pending'} →{' '}
                          {currentSnapshot.healthScore ?? 'Pending'} (
                          {formatDelta(
                            currentSnapshot.healthScore !== null &&
                              continuity.joiningBaseline.snapshot.healthScore !== null
                              ? currentSnapshot.healthScore -
                                  continuity.joiningBaseline.snapshot.healthScore
                              : null,
                            '',
                            ' pts'
                          )}
                          )
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#475569] block">Cash in Bank</span>
                        <strong className="text-[#0F172A] font-mono">
                          {currentSnapshot.cashInBank !== null
                            ? `${currency} ${currentSnapshot.cashInBank.toLocaleString()}`
                            : 'Not supplied'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#475569] block">Overdue AR (&gt;60d)</span>
                        <strong className="text-[#0F172A] font-mono">
                          {currentSnapshot.overdueReceivables !== null
                            ? `${currency} ${currentSnapshot.overdueReceivables.toLocaleString()}`
                            : 'Not supplied'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#475569] block">Actions Completed</span>
                        <strong className="text-[#0F172A] font-mono">
                          {continuity.joiningBaseline.snapshot.actionsCompleted} →{' '}
                          {currentSnapshot.actionsCompleted} / {currentSnapshot.actionsTotal}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded bg-[#F8FAFC] border border-[#0F172A]/12 text-xs text-[#475569] space-y-2">
              <p className="font-semibold text-[#0F172A]">No Joining Baseline captured yet.</p>
              <p>
                Click &ldquo;Lock Joining Baseline Now&rdquo; once you enter your initial Essentials,
                Health scores, and any known cash figures. Every Weekly Pulse and Monthly Review will
                compare real changes against that starting point.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: WEEKLY BUSINESS PULSE */}
      {subTab === 'weekly' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                  Weekly Business Pulse
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Log This Week&rsquo;s Progress, Cash Check &amp; Next Priorities
                </h3>
              </div>
            </div>

            <textarea
              rows={3}
              value={weeklyNote}
              onChange={(e) => setWeeklyNote(e.target.value)}
              placeholder="What moved forward this week? Any debtor delays, team overload, quote wins, or stalled steps?"
              className="w-full bg-[#F8FAFC] border border-[#0F172A]/15 rounded px-4 py-2.5 text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleLogDeterministicWeeklyPulse}
                className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Save Weekly Pulse Snapshot (Free)
              </button>
              <button
                type="button"
                disabled={isGeneratingAi !== null}
                onClick={() => handleGenerateAiContinuity('weekly')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                {isGeneratingAi === 'weekly' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Generate AI Weekly Pulse</span>
              </button>
            </div>
          </div>

          {continuity.weeklyPulses.length === 0 ? (
            <div className="bg-white border border-[#0F172A]/12 rounded p-6 text-xs text-[#475569]">
              No weekly pulses logged yet. Save your first Weekly Pulse above after updating your
              action checklist or cash position.
            </div>
          ) : (
            <div className="space-y-4">
              {continuity.weeklyPulses.map((pulse) => (
                <div
                  key={pulse.id}
                  className="bg-white border border-[#0F172A]/12 rounded p-5 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0F172A]/10 pb-2.5">
                    <span className="font-bold text-sm text-[#0F172A]">
                      Week of {pulse.weekOf}
                    </span>
                    <span className="font-mono text-[#475569] tabular-nums">
                      Health: {pulse.snapshot.healthScore ?? 'Pending'}/100 · Actions:{' '}
                      {pulse.snapshot.actionsCompleted}/{pulse.snapshot.actionsTotal} · Pipeline:{' '}
                      {currency} {pulse.snapshot.openPipelineValue.toLocaleString()}
                    </span>
                  </div>

                  {pulse.aiPulseSummary && (
                    <p className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[#0F172A] leading-relaxed">
                      {pulse.aiPulseSummary}
                    </p>
                  )}

                  {pulse.ownerNote && (
                    <p className="text-[#334155]">
                      <strong>Owner Note:</strong> {pulse.ownerNote}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
                      <strong className="text-[#B91C1C] block mb-1 uppercase text-[10px]">
                        Emerging Concerns
                      </strong>
                      {pulse.emergingConcerns.length > 0 ? (
                        <ul className="space-y-1 text-[#0F172A]">
                          {pulse.emergingConcerns.map((c, i) => (
                            <li key={i}>• {c}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[#475569]">None flagged from current inputs.</span>
                      )}
                    </div>
                    <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
                      <strong className="text-[#15803D] block mb-1 uppercase text-[10px]">
                        Opportunities
                      </strong>
                      {pulse.emergingOpportunities.length > 0 ? (
                        <ul className="space-y-1 text-[#0F172A]">
                          {pulse.emergingOpportunities.map((o, i) => (
                            <li key={i}>• {o}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[#475569]">Add CRM or coaching items to track.</span>
                      )}
                    </div>
                    <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE]">
                      <strong className="text-[#1D4ED8] block mb-1 uppercase text-[10px]">
                        Next Week Priorities
                      </strong>
                      {pulse.nextWeekPriorities.length > 0 ? (
                        <ul className="space-y-1 text-[#0F172A]">
                          {pulse.nextWeekPriorities.map((p, i) => (
                            <li key={i}>• {p}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[#475569]">All current tasks marked complete.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: MONTHLY BUSINESS REVIEW */}
      {subTab === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-4">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                Monthly Business Review
              </span>
              <h3 className="text-lg font-bold text-[#0F172A]">
                Compare Today vs. Joining Baseline &amp; Last Month&rsquo;s Review
              </h3>
            </div>

            <textarea
              rows={3}
              value={monthlyReflection}
              onChange={(e) => setMonthlyReflection(e.target.value)}
              placeholder="Summarize this month's sales, margin pressures, staffing updates, or debtor changes..."
              className="w-full bg-[#F8FAFC] border border-[#0F172A]/15 rounded px-4 py-2.5 text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleLogDeterministicMonthlyReview}
                className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Run Monthly Comparison (Free)
              </button>
              <button
                type="button"
                disabled={isGeneratingAi !== null}
                onClick={() => handleGenerateAiContinuity('monthly')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                {isGeneratingAi === 'monthly' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Generate AI Monthly Review</span>
              </button>
            </div>
          </div>

          {continuity.monthlyReviews.length === 0 ? (
            <div className="bg-white border border-[#0F172A]/12 rounded p-6 text-xs text-[#475569]">
              No Monthly Business Reviews recorded yet. Run your first review above to compare
              progress honestly against your Joining Baseline.
            </div>
          ) : (
            <div className="space-y-4">
              {continuity.monthlyReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0F172A]/10 pb-3">
                    <span className="font-bold text-base text-[#0F172A]">
                      Monthly Review · {rev.reviewMonth}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                      <span className="px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15">
                        Health: {rev.snapshot.healthScore ?? 'Pending'}/100
                      </span>
                      {rev.comparisonToBaseline.healthScoreChange !== null && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold ${
                            rev.comparisonToBaseline.healthScoreChange >= 0
                              ? 'bg-[#ECFDF5] text-[#15803D]'
                              : 'bg-[#FEF2F2] text-[#B91C1C]'
                          }`}
                        >
                          {rev.comparisonToBaseline.healthScoreChange >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {formatDelta(rev.comparisonToBaseline.healthScoreChange, '', ' pts vs baseline')}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[#0F172A] leading-relaxed">
                    {rev.executiveSummary}
                  </p>

                  {rev.comparisonToPreviousReview && (
                    <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E3A8A] font-mono tabular-nums">
                      Compared vs previous review ({rev.comparisonToPreviousReview.previousMonth}):{' '}
                      Health {formatDelta(rev.comparisonToPreviousReview.healthScoreChange, '', ' pts')} ·{' '}
                      Cash {formatDelta(rev.comparisonToPreviousReview.cashChange, `${currency} `)}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
                      <strong className="text-[#15803D] block mb-1 uppercase text-[10px]">
                        Improved Areas
                      </strong>
                      {rev.comparisonToBaseline.improvedAreas.length > 0 ? (
                        <ul className="space-y-1">
                          {rev.comparisonToBaseline.improvedAreas.map((a, i) => (
                            <li key={i}>• {a}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[#475569]">No verified score gains yet.</span>
                      )}
                    </div>
                    <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
                      <strong className="text-[#B91C1C] block mb-1 uppercase text-[10px]">
                        Deteriorated / Unresolved
                      </strong>
                      {[...rev.comparisonToBaseline.deterioratedAreas, ...rev.comparisonToBaseline.unresolvedIssues]
                        .length > 0 ? (
                        <ul className="space-y-1">
                          {[
                            ...rev.comparisonToBaseline.deterioratedAreas,
                            ...rev.comparisonToBaseline.unresolvedIssues,
                          ]
                            .slice(0, 5)
                            .map((u, i) => (
                              <li key={i}>• {u}</li>
                            ))}
                        </ul>
                      ) : (
                        <span className="text-[#475569]">No unresolved issues flagged.</span>
                      )}
                    </div>
                    <div className="p-3 rounded bg-[#FFFBEB] border border-[#FDE68A]">
                      <strong className="text-[#B45309] block mb-1 uppercase text-[10px]">
                        Next 3 Priorities
                      </strong>
                      {rev.nextThreePriorities.length > 0 ? (
                        <ul className="space-y-1">
                          {rev.nextThreePriorities.map((p, i) => (
                            <li key={i}>• {p}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[#475569]">Add action plan priorities to track.</span>
                      )}
                    </div>
                  </div>

                  {rev.missingInfoNeeded.length > 0 && (
                    <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8]">
                      <strong>Missing Data Needed to Verify Progress:</strong>{' '}
                      {rev.missingInfoNeeded.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 5: QUARTERLY SUSTAINABILITY REVIEW */}
      {subTab === 'quarterly' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                Quarterly Sustainability &amp; Future Earning Check
              </span>
              <h3 className="text-lg font-bold text-[#0F172A]">
                Evaluate Resilience, Owner Workload, Concentration &amp; Strategic Direction
              </h3>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleLogDeterministicQuarterlyReview}
                className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Run Quarterly Check (Free)
              </button>
              <button
                type="button"
                disabled={isGeneratingAi !== null}
                onClick={() => handleGenerateAiContinuity('quarterly')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                {isGeneratingAi === 'quarterly' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Generate AI Quarterly Review</span>
              </button>
            </div>
          </div>

          {continuity.quarterlyReviews.length === 0 ? (
            <div className="bg-white border border-[#0F172A]/12 rounded p-6 text-xs text-[#475569]">
              No Quarterly Sustainability Reviews saved yet.
            </div>
          ) : (
            <div className="space-y-4">
              {continuity.quarterlyReviews.map((q) => (
                <div
                  key={q.id}
                  className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0F172A]/10 pb-3">
                    <span className="font-bold text-base text-[#0F172A]">
                      {q.quarterLabel} Sustainability Review
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] font-bold border border-[#BFDBFE]">
                        Trend: {q.resilienceTrend}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-[#0F172A] text-white font-bold">
                        Path: {q.strategicChoice}
                      </span>
                    </div>
                  </div>

                  <p className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[#0F172A] leading-relaxed">
                    {q.executiveSummary}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
                      <strong className="text-[#B91C1C] block mb-1 uppercase text-[10px]">
                        Long-Term Risks
                      </strong>
                      <ul className="space-y-1">
                        {q.longTermRisks.length > 0 ? (
                          q.longTermRisks.map((r, i) => <li key={i}>• {r}</li>)
                        ) : (
                          <li className="text-[#475569]">No critical risks logged yet.</li>
                        )}
                      </ul>
                    </div>
                    <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
                      <strong className="text-[#15803D] block mb-1 uppercase text-[10px]">
                        Long-Term Opportunities
                      </strong>
                      <ul className="space-y-1">
                        {q.longTermOpportunities.length > 0 ? (
                          q.longTermOpportunities.map((o, i) => <li key={i}>• {o}</li>)
                        ) : (
                          <li className="text-[#475569]">Run Coaching Plan to populate upside.</li>
                        )}
                      </ul>
                    </div>
                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#CBD5E1]">
                      <strong className="text-[#0F172A] block mb-1 uppercase text-[10px]">
                        Recommended Adjustments
                      </strong>
                      <ul className="space-y-1">
                        {q.recommendedAdjustments.length > 0 ? (
                          q.recommendedAdjustments.map((a, i) => <li key={i}>• {a}</li>)
                        ) : (
                          <li className="text-[#475569]">Owner dependency: {q.ownerDependencyStatus}</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {q.missingInfoNeeded.length > 0 && (
                    <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8]">
                      <strong>Missing Data Needed:</strong> {q.missingInfoNeeded.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
