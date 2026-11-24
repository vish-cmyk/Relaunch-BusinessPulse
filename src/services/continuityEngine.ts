import {
  CaseRecord,
  ContinuityBaseline,
  ContinuityMetricSnapshot,
  HealthDimensionKey,
  HealthStatus,
  MonthlyReviewEntry,
  QuarterlySustainabilityReview,
  WeeklyPulseEntry,
} from '../types/bizpulse';
import { calculateOverallHealth, HEALTH_DIMENSION_ORDER } from './healthScoring';

export function captureMetricSnapshot(caseRecord: CaseRecord): ContinuityMetricSnapshot {
  const computedHealth =
    caseRecord.overallHealth || calculateOverallHealth(caseRecord.healthInputs, caseRecord.financials);
  const fin = caseRecord.financials;
  const crm = caseRecord.crmContacts || [];
  const actions = (caseRecord.actionPlan || []).filter((a) => a.decisionStatus !== 'rejected');
  const todayIso = new Date().toISOString().slice(0, 10);

  const openPipelineValue = crm
    .filter((c) => c.salesStage !== 'Won' && c.salesStage !== 'Lost' && c.salesStage !== 'Dormant')
    .reduce((sum, c) => sum + (Number(c.opportunityValue) || 0), 0);

  const overdueFollowUpsCount = crm.filter(
    (c) =>
      c.status === 'Follow-Up Due' ||
      c.status === 'At Risk' ||
      (Boolean(c.nextFollowUpDate) &&
        c.nextFollowUpDate <= todayIso &&
        c.salesStage !== 'Lost' &&
        c.status !== 'Closed Lost')
  ).length;

  const actionsCompleted = actions.filter((a) => a.completed || a.status === 'completed').length;

  return {
    healthScore: computedHealth.overallScore ?? null,
    healthRating: computedHealth.overallRating,
    dataVisibilityScore: computedHealth.dataVisibilityScore ?? null,
    cashInBank: fin?.cashInBank ?? null,
    overdueReceivables: fin?.overdueReceivables ?? null,
    accountsReceivable: fin?.accountsReceivable ?? null,
    accountsPayable: fin?.accountsPayable ?? null,
    annualRevenue: fin?.annualRevenue ?? null,
    operatingProfit: fin?.operatingProfit ?? null,
    openPipelineValue,
    overdueFollowUpsCount,
    actionsTotal: actions.length,
    actionsCompleted,
  };
}

export function createJoiningBaseline(caseRecord: CaseRecord): ContinuityBaseline {
  const dimensionStatuses = {} as Record<HealthDimensionKey, HealthStatus>;
  for (const key of HEALTH_DIMENSION_ORDER) {
    dimensionStatuses[key] = caseRecord.healthInputs[key]?.status || 'unanswered';
  }

  return {
    capturedAt: new Date().toISOString(),
    primaryConcern: caseRecord.profile.primaryConcern?.trim() || 'Not yet recorded',
    primaryObjective: caseRecord.profile.primaryObjective?.trim() || 'Not yet recorded',
    initialRecommendationSummary:
      caseRecord.recommendations?.initialRecommendation?.trim() ||
      'Initial recommendations not yet generated.',
    snapshot: captureMetricSnapshot(caseRecord),
    dimensionStatuses,
  };
}

function diffNullable(current: number | null, previous: number | null): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  return current - previous;
}

const STATUS_RANK: Record<HealthStatus, number> = {
  at_risk: 1,
  needs_attention: 2,
  healthy: 3,
  not_sure: 0,
  unanswered: 0,
};

export function compareDimensionsToBaseline(
  caseRecord: CaseRecord,
  baseline: ContinuityBaseline | null
): { improvedAreas: string[]; deterioratedAreas: string[]; unresolvedIssues: string[] } {
  const improvedAreas: string[] = [];
  const deterioratedAreas: string[] = [];
  const unresolvedIssues: string[] = [];

  for (const key of HEALTH_DIMENSION_ORDER) {
    const dim = caseRecord.healthInputs[key];
    if (!dim) continue;
    const currStatus = dim.status;
    const baseStatus = baseline?.dimensionStatuses?.[key];

    if (baseStatus && STATUS_RANK[currStatus] > 0 && STATUS_RANK[baseStatus] > 0) {
      if (STATUS_RANK[currStatus] > STATUS_RANK[baseStatus]) {
        improvedAreas.push(`${dim.title}: ${baseStatus.replace('_', ' ')} -> ${currStatus.replace('_', ' ')}`);
      } else if (STATUS_RANK[currStatus] < STATUS_RANK[baseStatus]) {
        deterioratedAreas.push(`${dim.title}: ${baseStatus.replace('_', ' ')} -> ${currStatus.replace('_', ' ')}`);
      }
    }

    if (currStatus === 'at_risk' || currStatus === 'needs_attention') {
      unresolvedIssues.push(
        `${dim.title} remains ${currStatus === 'at_risk' ? 'At Risk' : 'Needs Attention'}`
      );
    }
  }

  return { improvedAreas, deterioratedAreas, unresolvedIssues };
}

export function buildMissingInfoChecklist(caseRecord: CaseRecord): string[] {
  const missing: string[] = [];
  const fin = caseRecord.financials;
  if (!fin) {
    missing.push('Core cash & working capital figures (Cash in Bank, Overdue Receivables, Payables) are not entered yet.');
  } else {
    if (fin.cashInBank === null || fin.cashInBank === undefined) missing.push('Current bank cash balance is missing.');
    if (fin.overdueReceivables === null || fin.overdueReceivables === undefined) missing.push('Overdue customer invoices (>60 days) figure is missing.');
    if (fin.annualRevenue === null || fin.annualRevenue === undefined) missing.push('Annual turnover figure is missing.');
  }
  const unverifiedDims = HEALTH_DIMENSION_ORDER.filter(
    (k) => caseRecord.healthInputs[k]?.status === 'not_sure' || caseRecord.healthInputs[k]?.status === 'unanswered'
  );
  if (unverifiedDims.length > 0) {
    missing.push(
      `${unverifiedDims.length} health capability area(s) are marked Not Sure or Unanswered (${unverifiedDims
        .slice(0, 3)
        .map((k) => caseRecord.healthInputs[k]?.title)
        .join(', ')}${unverifiedDims.length > 3 ? '…' : ''}).`
    );
  }
  return missing;
}

export function buildWeeklyPulseEntry(
  caseRecord: CaseRecord,
  input?: {
    weekOf?: string;
    ownerNote?: string;
    completedThisWeek?: string[];
    emergingConcerns?: string[];
    emergingOpportunities?: string[];
    nextWeekPriorities?: string[];
    aiPulseSummary?: string;
  }
): WeeklyPulseEntry {
  const snapshot = captureMetricSnapshot(caseRecord);
  const baselineSnap = caseRecord.continuity?.joiningBaseline?.snapshot || null;
  const actions = (caseRecord.actionPlan || []).filter((a) => a.decisionStatus !== 'rejected');
  const stalledActions = actions
    .filter((a) => !a.completed && a.status !== 'completed')
    .slice(0, 5)
    .map((a) => `${a.action} (${a.accountableRole || 'Owner'})`);

  const autoCompleted = actions
    .filter((a) => a.completed || a.status === 'completed')
    .slice(0, 5)
    .map((a) => a.action);

  const autoConcerns: string[] = [];
  if (snapshot.overdueFollowUpsCount > 0) {
    autoConcerns.push(`${snapshot.overdueFollowUpsCount} CRM follow-up / at-risk customer account(s) need attention this week.`);
  }
  if (snapshot.cashInBank !== null && snapshot.accountsPayable !== null && snapshot.cashInBank < snapshot.accountsPayable) {
    autoConcerns.push(
      `Bank cash (${caseRecord.profile.currency} ${snapshot.cashInBank.toLocaleString()}) sits below payables (${caseRecord.profile.currency} ${snapshot.accountsPayable.toLocaleString()}).`
    );
  }
  if (snapshot.healthScore !== null && snapshot.healthScore < 45) {
    autoConcerns.push(`Business health remains At Risk (${snapshot.healthScore}/100) — focus on cash/delivery stabilisation.`);
  }

  const autoOpportunities: string[] = [];
  if (snapshot.openPipelineValue > 0) {
    autoOpportunities.push(
      `Active CRM pipeline holds ${caseRecord.profile.currency} ${snapshot.openPipelineValue.toLocaleString()} in open opportunities.`
    );
  }
  const topOpp = caseRecord.recommendations?.profitOpportunities?.[0];
  if (topOpp) {
    autoOpportunities.push(`Priority profit lever: ${topOpp.title} (${topOpp.horizon}).`);
  }

  const defaultPriorities = stalledActions.slice(0, 3);
  if (defaultPriorities.length === 0 && snapshot.overdueFollowUpsCount > 0) {
    defaultPriorities.push('Complete overdue CRM follow-up calls and update next follow-up dates.');
  }

  return {
    id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    weekOf: input?.weekOf || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    snapshot,
    deltaVsBaseline: {
      healthScoreDelta: diffNullable(snapshot.healthScore, baselineSnap?.healthScore ?? null),
      cashDelta: diffNullable(snapshot.cashInBank, baselineSnap?.cashInBank ?? null),
      overdueArDelta: diffNullable(snapshot.overdueReceivables, baselineSnap?.overdueReceivables ?? null),
      actionsCompletedDelta: baselineSnap ? snapshot.actionsCompleted - baselineSnap.actionsCompleted : snapshot.actionsCompleted,
    },
    completedThisWeek: input?.completedThisWeek?.length ? input.completedThisWeek : autoCompleted,
    stalledActions,
    emergingConcerns: input?.emergingConcerns?.length ? input.emergingConcerns : autoConcerns,
    emergingOpportunities: input?.emergingOpportunities?.length ? input.emergingOpportunities : autoOpportunities,
    nextWeekPriorities: input?.nextWeekPriorities?.length ? input.nextWeekPriorities : defaultPriorities,
    ownerNote: input?.ownerNote?.trim() || '',
    aiPulseSummary: input?.aiPulseSummary,
    missingDataPrompt: buildMissingInfoChecklist(caseRecord),
  };
}

export function buildMonthlyReviewEntry(
  caseRecord: CaseRecord,
  input?: {
    reviewMonth?: string;
    ownerReflection?: string;
    aiResult?: Partial<MonthlyReviewEntry>;
  }
): MonthlyReviewEntry {
  const snapshot = captureMetricSnapshot(caseRecord);
  const baseline = caseRecord.continuity?.joiningBaseline || null;
  const prevReview = caseRecord.continuity?.monthlyReviews?.[0] || null;
  const dimDiff = compareDimensionsToBaseline(caseRecord, baseline);
  const missing = buildMissingInfoChecklist(caseRecord);
  const currency = caseRecord.profile.currency || 'NZD';

  const cashFlowConcerns: string[] = [];
  if (snapshot.cashInBank !== null && snapshot.accountsPayable !== null && snapshot.cashInBank < snapshot.accountsPayable) {
    cashFlowConcerns.push(`Cash in bank (${currency} ${snapshot.cashInBank.toLocaleString()}) covers less than supplier payables (${currency} ${snapshot.accountsPayable.toLocaleString()}).`);
  }
  if (snapshot.overdueReceivables && snapshot.overdueReceivables > 0) {
    cashFlowConcerns.push(`Overdue receivables stand at ${currency} ${snapshot.overdueReceivables.toLocaleString()}.`);
  }

  const revenueOpportunities = (caseRecord.recommendations?.profitOpportunities || [])
    .slice(0, 4)
    .map((o) => `${o.title} (${o.estimatedFinancialImpact})`);

  const profitLeakageAlerts = (caseRecord.recommendations?.profitOpportunities || [])
    .filter((o) => o.area.includes('Pricing') || o.area.includes('Unbilled') || o.area.includes('Collections'))
    .slice(0, 3)
    .map((o) => `${o.area}: ${o.title}`);

  const actionOutcomesReviewed = (caseRecord.actionPlan || [])
    .filter((a) => a.completed || a.status === 'completed' || Boolean(a.actualResult))
    .slice(0, 5)
    .map((a) => `${a.action}${a.actualResult ? ` — Outcome: ${a.actualResult}` : ' — Marked completed'}`);

  const fallbackNext3 = (caseRecord.actionPlan || [])
    .filter((a) => !a.completed && a.status !== 'completed' && a.decisionStatus !== 'rejected')
    .slice(0, 3)
    .map((a) => a.action);

  const healthChange = diffNullable(snapshot.healthScore, baseline?.snapshot.healthScore ?? null);
  const fallbackSummary = baseline
    ? `Compared against joining baseline (${baseline.capturedAt.slice(0, 10)}), health is ${
        healthChange === null ? 'not yet comparably scored' : healthChange > 0 ? `+${healthChange} pts` : healthChange < 0 ? `${healthChange} pts` : 'unchanged'
      } (${snapshot.healthScore ?? 'Pending'}/100) with ${snapshot.actionsCompleted}/${snapshot.actionsTotal} action items completed.`
    : `Current health is ${snapshot.healthScore ?? 'Pending'}/100 with ${snapshot.actionsCompleted}/${snapshot.actionsTotal} action items completed. Lock a joining baseline to measure future progress against today.`;

  return {
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reviewMonth: input?.reviewMonth || new Date().toISOString().slice(0, 7),
    createdAt: new Date().toISOString(),
    snapshot,
    comparisonToBaseline: {
      healthScoreChange: healthChange,
      cashChange: diffNullable(snapshot.cashInBank, baseline?.snapshot.cashInBank ?? null),
      overdueArChange: diffNullable(snapshot.overdueReceivables, baseline?.snapshot.overdueReceivables ?? null),
      pipelineChange: baseline ? snapshot.openPipelineValue - baseline.snapshot.openPipelineValue : 0,
      improvedAreas: input?.aiResult?.comparisonToBaseline?.improvedAreas?.length
        ? input.aiResult.comparisonToBaseline.improvedAreas
        : dimDiff.improvedAreas,
      deterioratedAreas: input?.aiResult?.comparisonToBaseline?.deterioratedAreas?.length
        ? input.aiResult.comparisonToBaseline.deterioratedAreas
        : dimDiff.deterioratedAreas,
      unresolvedIssues: input?.aiResult?.comparisonToBaseline?.unresolvedIssues?.length
        ? input.aiResult.comparisonToBaseline.unresolvedIssues
        : dimDiff.unresolvedIssues,
    },
    comparisonToPreviousReview: prevReview
      ? {
          previousMonth: prevReview.reviewMonth,
          healthScoreChange: diffNullable(snapshot.healthScore, prevReview.snapshot.healthScore),
          cashChange: diffNullable(snapshot.cashInBank, prevReview.snapshot.cashInBank),
          overdueArChange: diffNullable(snapshot.overdueReceivables, prevReview.snapshot.overdueReceivables),
        }
      : null,
    revenueOpportunities: input?.aiResult?.revenueOpportunities?.length ? input.aiResult.revenueOpportunities : revenueOpportunities,
    profitLeakageAlerts: input?.aiResult?.profitLeakageAlerts?.length ? input.aiResult.profitLeakageAlerts : profitLeakageAlerts,
    cashFlowConcerns: input?.aiResult?.cashFlowConcerns?.length ? input.aiResult.cashFlowConcerns : cashFlowConcerns,
    actionOutcomesReviewed: input?.aiResult?.actionOutcomesReviewed?.length ? input.aiResult.actionOutcomesReviewed : actionOutcomesReviewed,
    nextThreePriorities: input?.aiResult?.nextThreePriorities?.length ? input.aiResult.nextThreePriorities : fallbackNext3,
    missingInfoNeeded: input?.aiResult?.missingInfoNeeded?.length ? input.aiResult.missingInfoNeeded : missing,
    executiveSummary: input?.aiResult?.executiveSummary || fallbackSummary,
    ownerReflection: input?.ownerReflection?.trim() || '',
  };
}

export function buildQuarterlyReviewEntry(
  caseRecord: CaseRecord,
  input?: {
    quarterLabel?: string;
    aiResult?: Partial<QuarterlySustainabilityReview>;
  }
): QuarterlySustainabilityReview {
  const snapshot = captureMetricSnapshot(caseRecord);
  const baseline = caseRecord.continuity?.joiningBaseline || null;
  const ownerDepStatus = caseRecord.healthInputs.ownerDependency?.status || 'unanswered';
  const concentration = caseRecord.financials?.top5ConcentrationPercent ?? null;
  const missing = buildMissingInfoChecklist(caseRecord);

  let resilienceTrend: QuarterlySustainabilityReview['resilienceTrend'] = 'Insufficient Data';
  if (snapshot.healthScore !== null) {
    const baseScore = baseline?.snapshot.healthScore ?? null;
    if (snapshot.healthScore >= 72 && ownerDepStatus !== 'at_risk') {
      resilienceTrend = 'Strengthening';
    } else if (baseScore !== null && snapshot.healthScore - baseScore >= 5) {
      resilienceTrend = 'Strengthening';
    } else if (snapshot.healthScore < 45 || (baseScore !== null && snapshot.healthScore < baseScore)) {
      resilienceTrend = 'Under Strain';
    } else {
      resilienceTrend = 'Mixed / Holding';
    }
  }

  const now = new Date();
  const defaultQ = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const strategicChoice =
    caseRecord.recommendations?.sustainabilityAssessment?.recommendedChoice ||
    (snapshot.healthScore === null
      ? 'Pending Evidence'
      : snapshot.healthScore < 45
      ? 'Stabilise'
      : snapshot.healthScore < 72
      ? 'Improve'
      : 'Expand');

  return {
    id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    quarterLabel: input?.quarterLabel || defaultQ,
    createdAt: new Date().toISOString(),
    snapshot,
    resilienceTrend: input?.aiResult?.resilienceTrend || resilienceTrend,
    strategicChoice: input?.aiResult?.strategicChoice || strategicChoice,
    longTermRisks:
      input?.aiResult?.longTermRisks?.length
        ? input.aiResult.longTermRisks
        : (caseRecord.overallHealth?.criticalRisksIdentified || []).slice(0, 4),
    longTermOpportunities:
      input?.aiResult?.longTermOpportunities?.length
        ? input.aiResult.longTermOpportunities
        : (caseRecord.recommendations?.profitOpportunities || []).slice(0, 4).map((o) => o.title),
    recommendedAdjustments:
      input?.aiResult?.recommendedAdjustments?.length
        ? input.aiResult.recommendedAdjustments
        : (caseRecord.recommendations?.actionItems || []).slice(0, 3).map((a) => a.action),
    ownerDependencyStatus: ownerDepStatus,
    customerConcentrationPct: concentration,
    missingInfoNeeded: input?.aiResult?.missingInfoNeeded?.length ? input.aiResult.missingInfoNeeded : missing,
    executiveSummary:
      input?.aiResult?.executiveSummary ||
      `Quarterly sustainability check (${resilienceTrend}): Health ${
        snapshot.healthScore ?? 'Pending'
      }/100, Owner Dependency is ${ownerDepStatus.replace('_', ' ')}, and ${
        snapshot.actionsCompleted
      }/${snapshot.actionsTotal} turnaround actions completed.`,
  };
}
