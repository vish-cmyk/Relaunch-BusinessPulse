import {
  HealthDimensionKey,
  HealthDimensionInput,
  HealthStatus,
  OverallHealthAssessment,
  DimensionScoreDetail,
  FinancialData,
  TopPriorityItem,
  CaseRecord,
} from '../types/bizpulse';

export const HEALTH_DIMENSION_ORDER: HealthDimensionKey[] = [
  'direction',
  'customers',
  'sales',
  'pricingMargins',
  'money',
  'operations',
  'people',
  'ownerDependency',
  'competition',
  'scalability',
  'technology',
  'sustainability',
];

// Confirmed status points; 'not_sure' and 'unanswered' are excluded from confirmed numeric average
// so lack of visibility never mascarades as healthy or inflates/distorts confirmed health.
const CONFIRMED_SCORE_MAP: Record<HealthStatus, number | null> = {
  healthy: 100,
  needs_attention: 55,
  at_risk: 15,
  not_sure: null,
  unanswered: null,
};

const STATUS_COLOR_MAP: Record<HealthStatus, 'green' | 'amber' | 'red' | 'blue'> = {
  healthy: 'green',
  needs_attention: 'amber',
  at_risk: 'red',
  not_sure: 'blue',
  unanswered: 'blue',
};

const COMMERCIAL_URGENCY_WEIGHT: Record<HealthDimensionKey, number> = {
  money: 12,
  pricingMargins: 11,
  operations: 10,
  customers: 9,
  ownerDependency: 8,
  sales: 7,
  people: 6,
  scalability: 5,
  direction: 4,
  competition: 3,
  technology: 2,
  sustainability: 1,
};

const DIMENSION_WHY_MATTERS: Record<HealthDimensionKey, string> = {
  direction: 'Without shared leadership alignment and target customer focus, time and cash scatter across low-yield work.',
  customers: 'High concentration or silent customer churn can erase months of sales effort overnight.',
  sales: 'Relying purely on word-of-mouth leaves revenue exposed when referrals slow down.',
  pricingMargins: 'Small unrecovered cost increases or unbilled scope creep quietly wipe out net profit even when turnover grows.',
  money: 'Profit on paper cannot pay payroll or suppliers if cash is trapped in overdue invoices or credit facilities.',
  operations: 'Rework, scheduling chaos, and delivery bottlenecks destroy both customer trust and billable capacity.',
  people: 'Overloaded or misaligned staff lead to costly mistakes, lower productivity, and expensive turnover.',
  ownerDependency: 'When quoting, escalations, and approvals all bottleneck at the owner, the business cannot scale or be exited.',
  competition: 'Weak differentiation forces the business into margin-destroying price discounts.',
  scalability: 'Growing turnover on fragile delivery systems compounds errors, overtime, and cash stress.',
  technology: 'Manual admin, unused reporting, and missed automation waste valuable team and owner hours every week.',
  sustainability: 'Key-person exposure, thin reserves, and owner burnout threaten long-term business survival.',
};

const DIMENSION_FOCUS_GUIDANCE: Record<HealthDimensionKey, string> = {
  direction: 'Clarify top 90-day commercial goals, target client segment, and partner alignment.',
  customers: 'Audit top-client revenue concentration, churn signals, and retention outreach.',
  sales: 'Establish a repeatable lead pipeline and weekly outbound/referral conversion cadence.',
  pricingMargins: 'Review gross margin per service/job, enforce CPI price updates, and stop unbilled scope creep.',
  money: 'Tighten aged debtor collection, map 4-week rolling cash commitments, and protect liquidity headroom.',
  operations: 'Remove delivery bottlenecks, triage urgent interruptions, and document core workflows.',
  people: 'Rebalance team workloads, clarify role accountability, and address key-staff flight risk.',
  ownerDependency: 'Delegate quoting, routine escalations, and admin tasks using standard operating checklists.',
  competition: 'Sharpen your point of difference and bundle value rather than competing on price alone.',
  scalability: 'Standardize client onboarding and delivery capacity before taking on additional fixed overhead.',
  technology: 'Use reporting analytics, automated invoicing/ticketing, and practical AI workflows to save hours.',
  sustainability: 'Eliminate single-person operational risks, strengthen compliance, and protect owner stamina.',
};

function formatEvidenceLabel(evidenceType: HealthDimensionInput['evidenceType']): string {
  switch (evidenceType) {
    case 'verified':
      return 'Verified records / financial evidence';
    case 'owner_reported':
      return 'Owner-reported observation';
    case 'assumption':
      return 'Working assumption (needs checking)';
    case 'hypothesis':
      return 'Initial hypothesis';
    default:
      return 'Not yet verified';
  }
}

function buildDimensionSixPartDetail(key: HealthDimensionKey, item: HealthDimensionInput) {
  const hasNotes = Boolean(item.notes && item.notes.trim().length > 0);
  const trimmedNote = item.notes?.trim() || '';
  const noteExcerpt = hasNotes
    ? ` Owner evidence noted: "${trimmedNote.slice(0, 140)}${trimmedNote.length > 140 ? '…' : ''}"`
    : '';
  const evidenceUsed = hasNotes
    ? `${formatEvidenceLabel(item.evidenceType)}: "${trimmedNote.slice(0, 160)}${trimmedNote.length > 160 ? '…' : ''}"`
    : `${formatEvidenceLabel(item.evidenceType)} — no supporting notes entered yet.`;

  let explanation = '';
  let gapDiagnosis = '';
  let recommendedStep = DIMENSION_FOCUS_GUIDANCE[key];

  switch (item.status) {
    case 'healthy':
      explanation = `Operating reliably (100/100): ${item.title} is reported as sound with healthy commercial foundations.${noteExcerpt}`;
      gapDiagnosis = hasNotes
        ? 'No confirmed operational or financial gap flagged; maintain monthly KPI check-ins.'
        : 'Rated Healthy, though attaching a concrete figure or metric note strengthens audit confidence.';
      recommendedStep = `Maintain quarterly checks on ${item.title.toLowerCase()} and protect standards as volume grows.`;
      break;
    case 'needs_attention':
      explanation = `Moderately strained (55/100): ${item.title} shows structural friction or inconsistency that needs targeted attention within 30–60 days.${noteExcerpt}`;
      gapDiagnosis = 'Confirmed performance friction: workable today, but causing avoidable margin, time, or reliability drag.';
      break;
    case 'at_risk':
      explanation = `Critical vulnerability (15/100): ${item.title} poses active financial, delivery, or retention risk and requires immediate priority intervention.${noteExcerpt}`;
      gapDiagnosis = 'Confirmed high-severity risk: left unaddressed, this capability actively threatens cash flow or client retention.';
      break;
    case 'not_sure':
      explanation = `Insufficient information (Blue — excluded from confirmed score): Reliable data is missing for ${item.title.toLowerCase()}. Gather factual numbers before committing capital.${noteExcerpt}`;
      gapDiagnosis = 'Information visibility gap (not confirmed failure): facts have not yet been verified to confirm performance.';
      recommendedStep = `Verify baseline data for ${item.title.toLowerCase()} first, then update status from Not Sure to a confirmed rating.`;
      break;
    case 'unanswered':
    default:
      explanation = `Not yet assessed (Blue): Select Healthy, Needs Attention, At Risk, or Not Sure to score ${item.title.toLowerCase()}.`;
      gapDiagnosis = 'Unanswered capability: assessment input still required.';
      recommendedStep = `Rate ${item.title.toLowerCase()} with any known context or choose "Not Sure / No Data" if figures are missing.`;
      break;
  }

  return {
    explanation,
    whatMeasured: item.description,
    whyMatters: DIMENSION_WHY_MATTERS[key],
    evidenceUsed,
    gapDiagnosis,
    recommendedStep,
  };
}

/**
 * Deterministic 12-Capability Business Health Scoring Engine
 *
 * Guarantees:
 * 1. Confirmed ratings ('healthy'=100, 'needs_attention'=55, 'at_risk'=15) drive the numeric score.
 * 2. 'not_sure' is tracked separately via dataVisibilityScore & missingEvidenceAreas rather than muddying confirmed averages.
 * 3. Non-averaging commercial risk overrides apply when Money, Pricing & Margins, or Operations are At Risk.
 * 4. Computes deterministic Top 3 Improvement Priorities ranked by severity + commercial impact.
 */
export function calculateOverallHealth(
  inputs: Record<HealthDimensionKey, HealthDimensionInput>,
  financials?: FinancialData | null
): OverallHealthAssessment {
  const keys = HEALTH_DIMENSION_ORDER.filter((k) => Boolean(inputs?.[k]));
  const totalDimensions = keys.length || 12;

  let confirmedScoreSum = 0;
  let answeredCount = 0;
  let confirmedCount = 0;
  let unsureCount = 0;
  let unansweredCount = 0;
  let atRiskCount = 0;
  let needsAttentionCount = 0;
  let healthyCount = 0;

  const criticalRisks: string[] = [];
  const strongestAreas: string[] = [];
  const missingEvidence: string[] = [];
  const mainDrivers: string[] = [];
  const dimensionScores: DimensionScoreDetail[] = [];

  for (const key of keys) {
    const item = inputs[key];
    const score = CONFIRMED_SCORE_MAP[item.status] ?? null;
    const color = STATUS_COLOR_MAP[item.status] ?? 'blue';
    const sixPart = buildDimensionSixPartDetail(key, item);

    dimensionScores.push({
      key,
      title: item.title,
      status: item.status,
      score,
      color,
      ...sixPart,
    });

    switch (item.status) {
      case 'healthy':
        confirmedScoreSum += 100;
        confirmedCount++;
        answeredCount++;
        healthyCount++;
        strongestAreas.push(
          `${item.title}: Healthy (100/100)${item.notes?.trim() ? ` — ${item.notes.trim().slice(0, 90)}` : ''}.`
        );
        break;
      case 'needs_attention':
        confirmedScoreSum += 55;
        confirmedCount++;
        answeredCount++;
        needsAttentionCount++;
        mainDrivers.push(
          `${item.title}: Needs Attention (55/100) — Requires structured improvement and monitoring.`
        );
        break;
      case 'at_risk':
        confirmedScoreSum += 15;
        confirmedCount++;
        answeredCount++;
        atRiskCount++;
        criticalRisks.push(
          `${item.title}: At Risk (15/100) — Urgent operational, margin, or cash bottleneck flagged.`
        );
        mainDrivers.push(
          `${item.title}: At Risk (15/100) — Immediate executive intervention required.`
        );
        break;
      case 'not_sure':
        answeredCount++;
        unsureCount++;
        missingEvidence.push(
          `${item.title}: Marked "Not Sure / No Data" — Operational or financial numbers need verification.`
        );
        break;
      case 'unanswered':
      default:
        unansweredCount++;
        missingEvidence.push(`${item.title}: Unanswered — Assessment not yet entered.`);
        break;
    }
  }

  const dataVisibilityScore = Math.round((confirmedCount / totalDimensions) * 100);
  const confirmedAvg = confirmedCount > 0 ? Math.round(confirmedScoreSum / confirmedCount) : 0;
  let finalScore: number | null = confirmedCount > 0 ? confirmedAvg : null;

  // Optional financial ledger verification ONLY when financials are actually supplied
  let financialWarningApplied = false;
  if (financials) {
    const totalAR = Number(financials.accountsReceivable) || 0;
    const overdueAR = Number(financials.overdueReceivables) || 0;
    const overdueRatio = totalAR > 0 ? overdueAR / totalAR : 0;
    const isOverdueHigh = (totalAR > 0 && overdueRatio >= 0.3) || (totalAR === 0 && overdueAR > 0);

    const creditLimit = Number(financials.creditFacilityLimit) || 0;
    const creditUsed = Number(financials.creditFacilityUsed) || 0;
    const creditUtilization = creditLimit > 0 ? creditUsed / creditLimit : 0;
    const isCreditStrained = creditLimit > 0 && creditUtilization >= 0.8;

    if (isOverdueHigh && overdueAR > 0) {
      financialWarningApplied = true;
      const ratioPercent = totalAR > 0 ? ` (${Math.round(overdueRatio * 100)}% of receivables)` : '';
      criticalRisks.push(
        `Working capital ledger alert: Delinquent receivables${ratioPercent} are tying up business cash.`
      );
    }

    if (isCreditStrained) {
      financialWarningApplied = true;
      criticalRisks.push(
        `Liquidity headroom alert: Credit facility is ${Math.round(creditUtilization * 100)}% drawn.`
      );
    }
  }

  // Compute Top 3 Improvement Priorities deterministically across confirmed strains & visibility gaps
  const candidateRankValue = (status: HealthStatus, key: HealthDimensionKey): number => {
    const urgency = COMMERCIAL_URGENCY_WEIGHT[key] || 0;
    if (status === 'at_risk') return 300 + urgency;
    if (status === 'needs_attention') return 200 + urgency;
    if (status === 'not_sure') return 100 + urgency;
    return 0;
  };

  const priorityCandidates = keys
    .map((key) => ({ key, item: inputs[key], weight: candidateRankValue(inputs[key].status, key) }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const topThreePriorities: TopPriorityItem[] = priorityCandidates.map((entry, idx) => {
    const rank = (idx + 1) as 1 | 2 | 3;
    const hasNotes = entry.item.notes?.trim();
    const statusLabel =
      entry.item.status === 'at_risk'
        ? 'At Risk'
        : entry.item.status === 'needs_attention'
        ? 'Needs Attention'
        : 'Data Blind Spot (Not Sure)';
    return {
      rank,
      key: entry.key,
      title: entry.item.title,
      status: entry.item.status,
      rationale: hasNotes
        ? `${statusLabel}: ${entry.item.notes.trim().slice(0, 160)}`
        : `${statusLabel} flagged in ${entry.item.title} (${entry.item.description}).`,
      recommendedFocus: DIMENSION_FOCUS_GUIDANCE[entry.key],
    };
  });

  // Determine overall rating & plain-English explanation
  const moneyStatus = inputs.money?.status;
  const pricingStatus = inputs.pricingMargins?.status;
  const opsStatus = inputs.operations?.status;
  const ownerDepStatus = inputs.ownerDependency?.status;
  const hasCriticalMoneyRisk = moneyStatus === 'at_risk';
  const hasCriticalOpsRisk = opsStatus === 'at_risk';
  const hasCriticalPricingRisk = pricingStatus === 'at_risk';

  let rating: OverallHealthAssessment['overallRating'] = 'Healthy';
  let label = 'Healthy: Resilient 12-Capability Foundations';
  let overallExplanation = '';

  if (answeredCount === 0) {
    rating = 'Incomplete / Missing Information';
    label = `Awaiting Assessment — 0 of ${totalDimensions} Capabilities Completed`;
    finalScore = null;
    overallExplanation =
      `No capabilities have been scored yet. Complete all ${totalDimensions} business capabilities using realistic evidence (Healthy, Needs Attention, At Risk, or Not Sure) to generate an accurate business health rating.`;
  } else if (unansweredCount >= 4) {
    rating = 'Incomplete / Missing Information';
    label = `Assessment Incomplete (${unansweredCount} of ${totalDimensions} Capabilities Pending)`;
    finalScore = confirmedCount > 0
      ? Math.min(confirmedAvg, Math.round((confirmedCount / totalDimensions) * confirmedAvg))
      : null;
    overallExplanation = `Only ${answeredCount} of ${totalDimensions} capabilities have been answered (${confirmedCount} confirmed, visibility ${dataVisibilityScore}%). Complete at least ${Math.max(0, totalDimensions - 3 - answeredCount)} more capabilities to unlock a confirmed overall rating.`;
  } else if (unsureCount >= 6 || confirmedCount === 0) {
    rating = 'Incomplete / Missing Information';
    label = `Insufficient Data Visibility (${unsureCount} of ${totalDimensions} Marked "Not Sure")`;
    finalScore = confirmedCount > 0 ? Math.min(confirmedAvg, 44) : 0;
    overallExplanation = `${unsureCount} of ${totalDimensions} capabilities are marked "Not Sure / No Data" (Data Visibility: ${dataVisibilityScore}%). Because key operational and financial facts are unverified, establish baseline figures first before committing growth capital.`;
  } else if (
    hasCriticalMoneyRisk ||
    hasCriticalOpsRisk ||
    atRiskCount >= 3 ||
    confirmedAvg < 45 ||
    (financialWarningApplied && (hasCriticalMoneyRisk || hasCriticalPricingRisk))
  ) {
    rating = 'At Risk';
    if (hasCriticalMoneyRisk && hasCriticalOpsRisk) {
      label = 'At Risk: Dual Cash Flow & Service Delivery Pressure';
    } else if (hasCriticalMoneyRisk) {
      label = 'At Risk: Cash Conversion & Working Capital Vulnerability';
    } else if (hasCriticalOpsRisk) {
      label = 'At Risk: Service Delivery & Capacity Bottleneck';
    } else {
      label = 'At Risk: Multiple Critical Commercial Vulnerabilities';
    }
    finalScore = Math.min(confirmedAvg, 44);
    overallExplanation = `Confirmed health score is ${finalScore}/100 (At Risk · Data Visibility ${dataVisibilityScore}%). Under BizPulse non-averaging commercial rules, critical "At Risk" conditions in ${[hasCriticalMoneyRisk ? 'Money & Cash Flow' : '', hasCriticalOpsRisk ? 'Operations' : '', atRiskCount >= 3 ? `${atRiskCount} capabilities` : ''].filter(Boolean).join(' and ') || 'core areas'} cap the overall health rating until stabilized.`;
  } else if (
    confirmedAvg < 72 ||
    ownerDepStatus === 'at_risk' ||
    hasCriticalPricingRisk ||
    atRiskCount >= 1 ||
    needsAttentionCount >= 4 ||
    unsureCount >= 4
  ) {
    rating = 'Needs Attention';
    if (ownerDepStatus === 'at_risk') {
      label = 'Needs Attention: High Owner Dependency & Scaling Friction';
    } else if (hasCriticalPricingRisk) {
      label = 'Needs Attention: Margin Compression & Pricing Leakage';
    } else if (atRiskCount >= 1) {
      label = 'Needs Attention: Localized Bottleneck Constraining Growth';
    } else {
      label = 'Needs Attention: Stable Base With Margin & System Gaps';
    }
    finalScore = Math.min(confirmedAvg, 71);
    if (ownerDepStatus === 'at_risk' || hasCriticalPricingRisk) {
      finalScore = Math.min(finalScore, 68);
    } else if (atRiskCount >= 1) {
      finalScore = Math.min(finalScore, 69);
    }
    overallExplanation = `Confirmed health score is ${finalScore}/100 (Needs Attention · Data Visibility ${dataVisibilityScore}%). You have ${healthyCount} healthy capability(ies), ${needsAttentionCount} needing attention, ${atRiskCount} at-risk, and ${unsureCount} unverified ("Not Sure"). Addressing your Top 3 Improvement Priorities will lift resilience into the Healthy range (72+).`;
  } else {
    rating = 'Healthy';
    label = 'Healthy: Strong Commercial & Operational Control';
    overallExplanation = `Confirmed health score is ${finalScore}/100 (Healthy · Data Visibility ${dataVisibilityScore}%). With ${healthyCount} of ${totalDimensions} capabilities rated Healthy and zero critical cash or delivery vulnerabilities, the business shows strong commercial discipline.`;
  }

  return {
    overallScore: finalScore,
    overallRating: rating,
    scoreLabel: label,
    overallExplanation,
    dimensionScores,
    answeredCount,
    unsureCount,
    unansweredCount,
    dataVisibilityScore,
    topThreePriorities,
    criticalRisksIdentified:
      criticalRisks.length > 0
        ? criticalRisks
        : ['No critical ("At Risk") capabilities flagged based on supplied answers.'],
    strongestAreas:
      strongestAreas.length > 0
        ? strongestAreas
        : ['No capabilities confirmed as Healthy yet.'],
    missingEvidenceAreas:
      missingEvidence.length > 0
        ? missingEvidence
        : [`All ${totalDimensions} commercial health capabilities have confirmed evidence.`],
    mainDrivers:
      mainDrivers.length > 0
        ? mainDrivers
        : ['Balanced commercial profile with no major risk drivers flagged.'],
    assessmentDate: new Date().toISOString().split('T')[0],
    scoringWeightRules:
      'Scoring model (12 Capabilities): Confirmed ratings score Healthy = 100, Needs Attention = 55, At Risk = 15. "Not Sure / No Data" is excluded from confirmed scoring and tracked via Data Visibility % so missing evidence does not distort performance. Non-averaging safeguard: Critical Money/Operations risk (or 3+ At Risk) caps overall rating at At Risk (max 44/100).',
    isProvisional: unansweredCount > 0 || unsureCount > 0,
  };
}

export type SessionDimensionTrajectoryPoint = {
  sessionId: string;
  sessionLabel: string;
  fullSessionName: string;
  updatedAt: string;
  updatedAtLabel: string;
  isActive: boolean;
  isDemo: boolean;
  overallScore: number | null;
  statuses: Record<HealthDimensionKey, HealthStatus>;
} & Record<HealthDimensionKey, number | null>;

/**
 * Builds chronological trajectory data across the most recent N saved business sessions
 * (default 3) for the Recharts dimension line chart. Missing/not-sure dimensions stay `null`
 * so gaps are never misrepresented as 0.
 */
export function buildSessionDimensionTrajectory(
  savedSessions: CaseRecord[],
  activeCaseId?: string,
  maxSessions = 3
): SessionDimensionTrajectoryPoint[] {
  const valid = (savedSessions || []).filter((c) => Boolean(c && c.id && c.profile));
  const sortedNewestFirst = [...valid].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.profile.updatedAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.profile.updatedAt || 0).getTime();
    return timeB - timeA;
  });

  const latestChronological = sortedNewestFirst.slice(0, Math.max(1, maxSessions)).reverse();

  return latestChronological.map((session, idx) => {
    const rawName = (session.profile?.name || `Session ${idx + 1}`).trim();
    const shortName = rawName.length > 18 ? `${rawName.slice(0, 17)}…` : rawName;
    const rawDate = session.updatedAt || session.profile?.updatedAt || new Date().toISOString();
    const parsedDate = new Date(rawDate);
    const dateLabel = Number.isNaN(parsedDate.getTime())
      ? `S${idx + 1}`
      : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const statuses = {} as Record<HealthDimensionKey, HealthStatus>;
    const dimScores = {} as Record<HealthDimensionKey, number | null>;

    for (const key of HEALTH_DIMENSION_ORDER) {
      const status = session.healthInputs?.[key]?.status || 'unanswered';
      statuses[key] = status;
      dimScores[key] = CONFIRMED_SCORE_MAP[status] ?? null;
    }

    const overallScore =
      session.overallHealth?.overallScore !== undefined
        ? session.overallHealth.overallScore
        : calculateOverallHealth(session.healthInputs, session.financials).overallScore;

    return {
      sessionId: session.id,
      sessionLabel: `${shortName} (${dateLabel})`,
      fullSessionName: rawName,
      updatedAt: rawDate,
      updatedAtLabel: dateLabel,
      isActive: Boolean(activeCaseId && session.id === activeCaseId),
      isDemo: Boolean(session.profile?.isDemonstrationCase),
      overallScore,
      statuses,
      ...dimScores,
    };
  });
}
