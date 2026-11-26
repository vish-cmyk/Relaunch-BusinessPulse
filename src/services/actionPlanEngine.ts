import {
  CaseRecord,
  RecommendationOutput,
  TurnaroundAction,
  TurnaroundHorizon,
} from '../types/bizpulse';

export function inferHorizonFromTimeframe(timeframe?: string): TurnaroundHorizon {
  const tf = (timeframe || '').toLowerCase();
  if (
    tf.includes('48') ||
    tf.includes('72') ||
    tf.includes('7 day') ||
    tf.includes('week') ||
    tf.includes('14') ||
    tf.includes('0-30') ||
    tf.includes('0–30') ||
    tf.includes('30 day') ||
    tf.includes('days 1')
  ) {
    return '30 Days (Quick Wins & Control)';
  }
  if (tf.includes('30-90') || tf.includes('30–90') || tf.includes('60')) {
    return '60 Days (Systems & Margin Fixes)';
  }
  return '90 Days (Sustainable Growth)';
}

/**
 * Derives structured 8-field Action Plan items from a CaseRecord's AI recommendations
 * and deterministic Top 3 Health Priorities, merging non-destructively so existing
 * owner edits, completion states, or rejected decisions are never overwritten.
 */
export function mergeDiagnosticsIntoActionPlan(
  caseRecord: CaseRecord,
  overrideRecommendations?: RecommendationOutput | null
): TurnaroundAction[] {
  const existing = Array.isArray(caseRecord.actionPlan) ? caseRecord.actionPlan : [];
  const rec = overrideRecommendations !== undefined ? overrideRecommendations : caseRecord.recommendations;
  const existingKeys = new Set(
    existing.map((item) => item.action.trim().toLowerCase())
  );
  const existingIds = new Set(existing.map((item) => item.id));

  const additions: TurnaroundAction[] = [];

  if (rec?.immediateAction?.trim()) {
    const immediateTitle = rec.immediateAction.trim();
    if (!existingKeys.has(immediateTitle.toLowerCase())) {
      existingKeys.add(immediateTitle.toLowerCase());
      additions.push({
        id: `act-immediate-${caseRecord.id.slice(-6)}`,
        horizon: '30 Days (Quick Wins & Control)',
        priority: 'Priority 1 (Urgent)',
        businessIssue:
          rec.initialObservation ||
          caseRecord.profile.primaryConcern ||
          'Immediate commercial stability risk',
        rationale:
          rec.commercialWhy ||
          'Addresses the sharpest immediate cash flow, margin, or operational exposure within 48–72 hours.',
        action: immediateTitle,
        accountableRole: 'Business Owner',
        timeframe: 'Next 48–72 Hours',
        requiredInformationOrResources: ['Current bank balance, overdue debtors, or pricing sheet'],
        measurableSuccessIndicator: 'Immediate step completed and verified in weekly review',
        intendedImprovement: 'Rapid cash or operational risk containment',
        dependencyOrRisk: 'Requires dedicated owner focus before routine firefighting',
        status: 'pending',
        completed: false,
        decisionStatus: 'pending_review',
        sourceTag: 'Coaching Immediate Action',
      });
    }
  }

  if (Array.isArray(rec?.actionItems) && rec.actionItems.length > 0) {
    rec.actionItems.forEach((item, idx) => {
      const actionTitle = (item.action || '').trim();
      if (!actionTitle || existingKeys.has(actionTitle.toLowerCase())) return;
      existingKeys.add(actionTitle.toLowerCase());

      const id =
        item.id && !existingIds.has(item.id)
          ? item.id
          : `rec-act-${Date.now()}-${idx}`;
      existingIds.add(id);

      additions.push({
        id,
        horizon: inferHorizonFromTimeframe(item.timeframe),
        priority: item.priority || 'Priority 2 (High)',
        businessIssue:
          rec.initialObservation ||
          caseRecord.profile.primaryConcern ||
          'Diagnostic coaching finding',
        rationale:
          rec.commercialWhy ||
          `Linked to ${item.expectedImpact || 'profit, cash flow, or operational resilience'}.`,
        action: actionTitle,
        accountableRole: item.ownerRole || 'Business Owner',
        timeframe: item.timeframe || 'Within 30 days',
        requiredInformationOrResources: ['Business records and owner sign-off'],
        measurableSuccessIndicator: item.expectedImpact || 'Measurable improvement confirmed in KPIs',
        intendedImprovement: item.expectedImpact || 'Improved commercial margin or liquidity',
        dependencyOrRisk: 'Requires consistent weekly accountability check-in',
        status: item.completed ? 'completed' : 'pending',
        completed: Boolean(item.completed),
        decisionStatus: 'pending_review',
        sourceTag: 'Coaching Plan',
      });
    });
  }

  if (Array.isArray(caseRecord.overallHealth?.topThreePriorities)) {
    caseRecord.overallHealth.topThreePriorities.forEach((p) => {
      const actionTitle = `Address Priority #${p.rank}: ${p.title}`;
      if (existingKeys.has(actionTitle.toLowerCase())) return;
      existingKeys.add(actionTitle.toLowerCase());

      const id = `prio-${p.key}-${p.rank}`;
      if (existingIds.has(id)) return;
      existingIds.add(id);

      additions.push({
        id,
        horizon:
          p.rank === 1
            ? '30 Days (Quick Wins & Control)'
            : p.rank === 2
            ? '60 Days (Systems & Margin Fixes)'
            : '90 Days (Sustainable Growth)',
        priority: p.rank === 1 ? 'Priority 1 (Urgent)' : 'Priority 2 (High)',
        businessIssue: `${p.title} (${p.status.replace('_', ' ')})`,
        rationale: p.rationale,
        action: actionTitle,
        accountableRole: 'Business Owner',
        timeframe: p.rank === 1 ? 'Days 1–30' : p.rank === 2 ? 'Days 31–60' : 'Days 61–90',
        requiredInformationOrResources: ['12-Capability Business Health assessment notes'],
        measurableSuccessIndicator: p.recommendedFocus,
        intendedImprovement: p.recommendedFocus,
        dependencyOrRisk: p.rationale,
        status: 'pending',
        completed: false,
        decisionStatus: 'pending_review',
        sourceTag: 'Top 3 Health Priority',
      });
    });
  }

  return [...existing, ...additions];
}
