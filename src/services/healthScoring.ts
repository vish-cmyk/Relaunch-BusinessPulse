import {
  HealthDimensionKey,
  HealthDimensionInput,
  HealthStatus,
  OverallHealthAssessment,
  DimensionScoreDetail,
  FinancialData,
} from '../types/bizpulse';

export const HEALTH_DIMENSION_ORDER: HealthDimensionKey[] = [
  'direction',
  'customers',
  'sales',
  'money',
  'operations',
  'people',
  'ownerDependency',
  'technology',
];

const STATUS_SCORE_MAP: Record<HealthStatus, number | null> = {
  healthy: 100,
  needs_attention: 55,
  at_risk: 15,
  not_sure: 40,
  unanswered: null,
};

const STATUS_COLOR_MAP: Record<HealthStatus, 'green' | 'amber' | 'red' | 'slate'> = {
  healthy: 'green',
  needs_attention: 'amber',
  at_risk: 'red',
  not_sure: 'slate',
  unanswered: 'slate',
};

function buildDimensionExplanation(item: HealthDimensionInput): string {
  const hasNotes = Boolean(item.notes && item.notes.trim().length > 0);
  const noteExcerpt = hasNotes ? ` Owner evidence noted: "${item.notes.trim().slice(0, 140)}${item.notes.trim().length > 140 ? '…' : ''}"` : '';

  switch (item.status) {
    case 'healthy':
      return `Operating reliably (100/100): ${item.title} is reported as sound with healthy commercial foundations.${noteExcerpt}`;
    case 'needs_attention':
      return `Moderately strained (55/100): ${item.title} shows structural friction or inconsistency that needs targeted attention within 30–60 days.${noteExcerpt}`;
    case 'at_risk':
      return `Critical vulnerability (15/100): ${item.title} poses active financial, delivery, or retention risk and requires immediate priority intervention.${noteExcerpt}`;
    case 'not_sure':
      return `Unverified / Missing data (40/100 provisional): Owner lacks reliable visibility into ${item.title.toLowerCase()}. Gather factual numbers before committing capital.${noteExcerpt}`;
    case 'unanswered':
    default:
      return `Not yet assessed: Select Healthy, Needs Attention, At Risk, or Not Sure / No Data to score ${item.title.toLowerCase()}.`;
  }
}

/**
 * Deterministic 8-Dimension Business Health Scoring Engine
 *
 * Guarantees:
 * 1. Different answers produce strictly distinct numerical scores, semantic colors, and ratings.
 * 2. Never defaults all results to a single color or "Unclear".
 * 3. Separates "Not Sure / No Data" (neutral slate, missing evidence) from "At Risk" (red, confirmed danger).
 * 4. Applies non-averaging commercial risk overrides when critical pillars (Money or Operations) are At Risk.
 * 5. Handles edge cases cleanly: all unanswered, partial answers, all "not sure", financial ledger overrides.
 */
export function calculateOverallHealth(
  inputs: Record<HealthDimensionKey, HealthDimensionInput>,
  financials?: FinancialData | null
): OverallHealthAssessment {
  const keys = HEALTH_DIMENSION_ORDER.filter((k) => Boolean(inputs?.[k]));
  const totalDimensions = keys.length || 8;

  let totalScore = 0;
  let answeredCount = 0;
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
    const score = STATUS_SCORE_MAP[item.status] ?? null;
    const color = STATUS_COLOR_MAP[item.status] ?? 'slate';
    const explanation = buildDimensionExplanation(item);

    dimensionScores.push({
      key,
      title: item.title,
      status: item.status,
      score,
      color,
      explanation,
    });

    switch (item.status) {
      case 'healthy':
        totalScore += 100;
        answeredCount++;
        healthyCount++;
        strongestAreas.push(
          `${item.title}: Healthy (100/100)${item.notes?.trim() ? ` — ${item.notes.trim().slice(0, 90)}` : ''}.`
        );
        break;
      case 'needs_attention':
        totalScore += 55;
        answeredCount++;
        needsAttentionCount++;
        mainDrivers.push(
          `${item.title}: Needs Attention (55/100) — Requires structured improvement and monitoring.`
        );
        break;
      case 'at_risk':
        totalScore += 15;
        answeredCount++;
        atRiskCount++;
        criticalRisks.push(
          `${item.title}: At Risk (15/100) — Urgent operational or financial bottleneck flagged.`
        );
        mainDrivers.push(
          `${item.title}: At Risk (15/100) — Immediate executive intervention required.`
        );
        break;
      case 'not_sure':
        totalScore += 40;
        answeredCount++;
        unsureCount++;
        missingEvidence.push(
          `${item.title}: Marked "Not Sure / No Data" — Operational numbers need verification.`
        );
        break;
      case 'unanswered':
      default:
        unansweredCount++;
        missingEvidence.push(`${item.title}: Unanswered — Assessment not yet entered.`);
        break;
    }
  }

  // Raw average across answered dimensions (0 when nothing answered yet)
  const rawScore = answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;
  let finalScore: number | null = rawScore;

  // Optional financial ledger verification ONLY when financials are actually supplied
  let financialWarningApplied = false;
  if (financials) {
    const totalAR = Number(financials.accountsReceivable) || 0;
    const overdueAR = Number(financials.overdueReceivables) || 0;
    const overdueRatio = totalAR > 0 ? overdueAR / totalAR : 0;
    const isOverdueHigh = (totalAR > 0 && overdueRatio >= 0.30) || (totalAR === 0 && overdueAR > 0);

    const creditLimit = Number(financials.creditFacilityLimit) || 0;
    const creditUsed = Number(financials.creditFacilityUsed) || 0;
    const creditUtilization = creditLimit > 0 ? creditUsed / creditLimit : 0;
    const isCreditStrained = creditLimit > 0 && creditUtilization >= 0.80;

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

  // Determine overall rating & plain-English explanation
  const moneyStatus = inputs.money?.status;
  const opsStatus = inputs.operations?.status;
  const ownerDepStatus = inputs.ownerDependency?.status;
  const hasCriticalMoneyRisk = moneyStatus === 'at_risk';
  const hasCriticalOpsRisk = opsStatus === 'at_risk';

  let rating: OverallHealthAssessment['overallRating'] = 'Healthy';
  let label = 'Healthy: Resilient Commercial Foundations';
  let overallExplanation = '';

  if (answeredCount === 0) {
    rating = 'Incomplete / Missing Information';
    label = 'Awaiting Assessment — 0 of 8 Dimensions Completed';
    finalScore = null;
    overallExplanation =
      'No dimensions have been scored yet. Complete all 8 dimensions using realistic evidence (Healthy, Needs Attention, At Risk, or Not Sure) to generate an accurate business health rating.';
  } else if (unansweredCount >= 3) {
    rating = 'Incomplete / Missing Information';
    label = `Assessment Incomplete (${unansweredCount} of ${totalDimensions} Dimensions Pending)`;
    // Scale proportionally so a single Healthy answer does not falsely show 100 overall health
    finalScore = Math.min(rawScore, Math.round((answeredCount / totalDimensions) * rawScore));
    overallExplanation = `Only ${answeredCount} of ${totalDimensions} dimensions have been answered (provisional average on answered areas is ${rawScore}/100, completeness-adjusted to ${finalScore}/100). Complete at least ${Math.max(0, 6 - answeredCount)} more dimensions to unlock a confirmed overall rating.`;
  } else if (unsureCount >= 5) {
    rating = 'Incomplete / Missing Information';
    label = `Insufficient Data Visibility (${unsureCount} of ${totalDimensions} Marked "Not Sure")`;
    finalScore = Math.min(rawScore, 48);
    overallExplanation = `${unsureCount} of ${totalDimensions} dimensions are marked "Not Sure / No Data". Because key operational and financial facts are unverified, the business cannot be rated Healthy or At Risk without gathering baseline records first.`;
  } else if (hasCriticalMoneyRisk || hasCriticalOpsRisk || atRiskCount >= 2 || rawScore < 45 || (financialWarningApplied && hasCriticalMoneyRisk)) {
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
    finalScore = Math.min(rawScore, 44);
    overallExplanation = `Scored ${finalScore}/100 (At Risk). Under BizPulse non-averaging commercial rules, critical "At Risk" conditions in ${[hasCriticalMoneyRisk ? 'Money' : '', hasCriticalOpsRisk ? 'Operations' : '', atRiskCount >= 2 ? `${atRiskCount} dimensions` : ''].filter(Boolean).join(' and ') || 'core areas'} cap the overall health rating until stabilized, even if other areas are strong.`;
  } else if (rawScore < 72 || ownerDepStatus === 'at_risk' || atRiskCount === 1 || needsAttentionCount >= 3 || unsureCount >= 3) {
    rating = 'Needs Attention';
    if (ownerDepStatus === 'at_risk') {
      label = 'Needs Attention: High Owner Dependency & Scaling Friction';
    } else if (atRiskCount === 1) {
      label = 'Needs Attention: Localized Bottleneck Constraining Growth';
    } else {
      label = 'Needs Attention: Stable Base With Margin & System Gaps';
    }
    finalScore = Math.min(rawScore, 71);
    if (ownerDepStatus === 'at_risk') {
      finalScore = Math.min(finalScore, 68);
    } else if (atRiskCount === 1) {
      finalScore = Math.min(finalScore, 69);
    }
    overallExplanation = `Scored ${finalScore}/100 (Needs Attention). You have ${healthyCount} healthy area(s), ${needsAttentionCount} area(s) needing attention, ${atRiskCount} at-risk area(s), and ${unsureCount} unverified area(s). Addressing the highlighted friction points will lift resilience into the Healthy range (72+).`;
  } else {
    rating = 'Healthy';
    label = 'Healthy: Strong Commercial & Operational Control';
    overallExplanation = `Scored ${finalScore}/100 (Healthy). With ${healthyCount} of ${totalDimensions} dimensions rated Healthy and zero critical risks in cash flow or operations, your business shows strong commercial discipline. Continue weekly KPI monitoring to protect margins.`;
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
    criticalRisksIdentified:
      criticalRisks.length > 0
        ? criticalRisks
        : ['No critical ("At Risk") dimensions flagged based on supplied answers.'],
    strongestAreas:
      strongestAreas.length > 0
        ? strongestAreas
        : ['No dimensions confirmed as Healthy yet.'],
    missingEvidenceAreas:
      missingEvidence.length > 0
        ? missingEvidence
        : ['All 8 commercial health dimensions have been assessed.'],
    mainDrivers:
      mainDrivers.length > 0
        ? mainDrivers
        : ['Balanced commercial profile with no major risk drivers flagged.'],
    assessmentDate: new Date().toISOString().split('T')[0],
    scoringWeightRules:
      'Scoring model: Healthy = 100, Needs Attention = 55, Not Sure / No Data = 40 (flags visibility gap), At Risk = 15, Unanswered = excluded. Non-averaging safeguard: If Money or Operations is At Risk (or 2+ dimensions are At Risk), overall status is capped at At Risk (max 44/100). If 3+ dimensions are unanswered or 5+ are Not Sure, status is Incomplete / Missing Information.',
    isProvisional: unansweredCount > 0 || unsureCount > 0,
  };
}
