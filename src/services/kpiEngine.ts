import {
  CaseRecord,
  KpiBusinessTypePreset,
  KpiDirection,
  KpiRecommendedSuggestion,
  KpiTrackerState,
  KpiTrendStatus,
  KpiUnitType,
  TrackedKpiRecord,
} from '../types/bizpulse';
import {
  getCatalogKpiByKey,
  inferPresetFromIndustry,
  KPI_BUSINESS_TYPE_PRESETS,
  KPI_CATEGORIES,
  KpiCatalogDefinition,
} from '../data/kpiCatalog';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isValidNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

// ======================================================
// DETERMINISTIC KPI FORMULAS (NULL-SAFE / ZERO FABRICATION)
// ======================================================

export function calcRevenueGrowthPct(currentRevenue: number | null | undefined, previousRevenue: number | null | undefined): number | null {
  if (!isValidNumber(currentRevenue) || !isValidNumber(previousRevenue) || previousRevenue <= 0) return null;
  return round2(((currentRevenue - previousRevenue) / previousRevenue) * 100);
}

export function calcGrossProfitMarginPct(revenue: number | null | undefined, directCosts: number | null | undefined): number | null {
  if (!isValidNumber(revenue) || !isValidNumber(directCosts) || revenue <= 0) return null;
  return round2(((revenue - directCosts) / revenue) * 100);
}

export function calcNetProfitMarginPct(netProfit: number | null | undefined, revenue: number | null | undefined): number | null {
  if (!isValidNumber(netProfit) || !isValidNumber(revenue) || revenue <= 0) return null;
  return round2((netProfit / revenue) * 100);
}

export function calcStaffUtilisationPct(productiveHours: number | null | undefined, availableHours: number | null | undefined): number | null {
  if (!isValidNumber(productiveHours) || !isValidNumber(availableHours) || availableHours <= 0) return null;
  return round2((productiveHours / availableHours) * 100);
}

export function calcCustomerRetentionPct(
  customersAtEnd: number | null | undefined,
  newCustomersAcquired: number | null | undefined,
  customersAtStart: number | null | undefined
): number | null {
  if (
    !isValidNumber(customersAtEnd) ||
    !isValidNumber(newCustomersAcquired) ||
    !isValidNumber(customersAtStart) ||
    customersAtStart <= 0
  ) {
    return null;
  }
  return round2(((customersAtEnd - newCustomersAcquired) / customersAtStart) * 100);
}

export function calcOperatingExpensesPct(operatingExpenses: number | null | undefined, revenue: number | null | undefined): number | null {
  if (!isValidNumber(operatingExpenses) || !isValidNumber(revenue) || revenue <= 0) return null;
  return round2((operatingExpenses / revenue) * 100);
}

export function calcDebtorDays(accountsReceivable: number | null | undefined, annualRevenue: number | null | undefined): number | null {
  if (!isValidNumber(accountsReceivable) || !isValidNumber(annualRevenue) || annualRevenue <= 0) return null;
  return Math.round((accountsReceivable / annualRevenue) * 365);
}

export function calcRevenuePerEmployee(annualRevenue: number | null | undefined, teamCount: number | null | undefined): number | null {
  if (!isValidNumber(annualRevenue) || !isValidNumber(teamCount) || teamCount <= 0) return null;
  return Math.round(annualRevenue / teamCount);
}

export function evaluateKpiFormula(formulaType: string, inputs: Record<string, number | null>): number | null {
  const num = (k: string): number | null => (isValidNumber(inputs[k]) ? inputs[k]! : null);

  switch (formulaType) {
    case 'revenue_growth':
      return calcRevenueGrowthPct(num('currentRevenue'), num('previousRevenue'));
    case 'gross_margin':
      return calcGrossProfitMarginPct(num('revenue'), num('directCosts'));
    case 'net_margin':
      return calcNetProfitMarginPct(num('netProfit'), num('revenue'));
    case 'opex_pct':
      return calcOperatingExpensesPct(num('operatingExpenses'), num('revenue'));
    case 'staff_utilisation':
      return calcStaffUtilisationPct(num('productiveHours'), num('availableHours'));
    case 'customer_retention':
      return calcCustomerRetentionPct(num('customersAtEnd'), num('newCustomersAcquired'), num('customersAtStart'));
    case 'conversion_rate': {
      const won = num('wonCustomers');
      const total = num('totalEnquiries');
      if (won === null || total === null || total <= 0) return null;
      return round2((won / total) * 100);
    }
    case 'avg_transaction_value': {
      const rev = num('totalRevenue');
      const jobs = num('jobCount');
      if (rev === null || jobs === null || jobs <= 0) return null;
      return round2(rev / jobs);
    }
    case 'repeat_business_pct': {
      const rep = num('repeatRevenue');
      const tot = num('totalRevenue');
      if (rep === null || tot === null || tot <= 0) return null;
      return round2((rep / tot) * 100);
    }
    case 'contribution_per_job': {
      const rev = num('revenue');
      const dc = num('directCosts');
      const jobs = num('jobCount');
      if (rev === null || dc === null || jobs === null || jobs <= 0) return null;
      return round2((rev - dc) / jobs);
    }
    case 'pricing_effectiveness': {
      const realised = num('realisedValue');
      const quoted = num('quotedValue');
      if (realised === null || quoted === null || quoted <= 0) return null;
      return round2((realised / quoted) * 100);
    }
    case 'debtor_days':
      return calcDebtorDays(num('accountsReceivable'), num('annualRevenue'));
    case 'forecast_accuracy': {
      const actual = num('actualCash');
      const forecast = num('forecastCash');
      if (actual === null || forecast === null || forecast === 0) return null;
      return round2(Math.max(0, 100 - (Math.abs(actual - forecast) / Math.abs(forecast)) * 100));
    }
    case 'customer_concentration': {
      const top = num('topClientsRevenue');
      const tot = num('totalRevenue');
      if (top === null || tot === null || tot <= 0) return null;
      return round2((top / tot) * 100);
    }
    case 'cac': {
      const spend = num('salesMarketingSpend');
      const newCust = num('newCustomersAcquired');
      if (spend === null || newCust === null || newCust <= 0) return null;
      return round2(spend / newCust);
    }
    case 'revenue_per_employee':
      return calcRevenuePerEmployee(num('annualRevenue'), num('teamCount'));
    case 'rework_pct': {
      const rework = num('reworkAmount');
      const tot = num('totalAmount');
      if (rework === null || tot === null || tot <= 0) return null;
      return round2((rework / tot) * 100);
    }
    case 'on_time_pct': {
      const onTime = num('onTimeJobs');
      const total = num('totalJobs');
      if (onTime === null || total === null || total <= 0) return null;
      return round2((onTime / total) * 100);
    }
    case 'roi_pct': {
      const gain = num('netGain');
      const inv = num('upfrontInvestment');
      if (gain === null || inv === null || inv <= 0) return null;
      return round2((gain / inv) * 100);
    }
    case 'recurring_revenue_pct': {
      const arr = num('annualRecurringRevenue');
      const tot = num('totalAnnualRevenue');
      if (arr === null || tot === null || tot <= 0) return null;
      return round2((arr / tot) * 100);
    }
    case 'manual_or_case':
    case 'manual':
    default: {
      const firstKey = Object.keys(inputs)[0];
      return firstKey ? num(firstKey) : null;
    }
  }
}

export interface KpiVarianceResult {
  delta: number;
  isFavorable: boolean;
  statusLabel: 'On / Better Than Target' | 'Off Target';
  formattedDelta: string;
}

export function computeKpiVariance(
  actual: number | null,
  target: number | null,
  direction: KpiDirection,
  unit: KpiUnitType,
  currency = 'NZD'
): KpiVarianceResult | null {
  if (!isValidNumber(actual) || !isValidNumber(target)) return null;
  const delta = round2(actual - target);
  const isFavorable = direction === 'higher_is_better' ? actual >= target : actual <= target;
  const statusLabel = isFavorable ? 'On / Better Than Target' : 'Off Target';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const absFormatted = formatKpiNumber(Math.abs(delta), unit, currency);

  return {
    delta,
    isFavorable,
    statusLabel,
    formattedDelta: delta === 0 ? 'On target (0)' : `${sign}${absFormatted}`,
  };
}

export function computeKpiTrend(
  latestActual: number | null,
  previousValue: number | null,
  direction: KpiDirection,
  unit: KpiUnitType
): KpiTrendStatus {
  if (!isValidNumber(latestActual) || !isValidNumber(previousValue)) {
    return 'Insufficient Data';
  }
  const diff = latestActual - previousValue;
  const stableThreshold =
    unit === 'percent' || unit === 'days' || unit === 'score' || unit === 'hours'
      ? Math.max(0.5, Math.abs(previousValue) * 0.015)
      : Math.max(1, Math.abs(previousValue) * 0.015);

  if (Math.abs(diff) <= stableThreshold) {
    return 'Stable';
  }

  const movedHigher = diff > 0;
  if (direction === 'higher_is_better') {
    return movedHigher ? 'Improving' : 'Declining';
  }
  return movedHigher ? 'Declining' : 'Improving';
}

export function formatKpiNumber(value: number | null | undefined, unit: KpiUnitType, currency = 'NZD'): string {
  if (!isValidNumber(value)) return 'Insufficient Data';
  switch (unit) {
    case 'currency':
      return `${currency} ${Math.round(value).toLocaleString()}`;
    case 'percent':
      return `${round2(value)}%`;
    case 'days':
      return `${Math.round(value)} days`;
    case 'hours':
      return `${round2(value)} hrs`;
    case 'score':
      return `${Math.round(value)}/100`;
    case 'number':
    default:
      return `${round2(value).toLocaleString()}`;
  }
}

function defaultNextReviewDate(daysAhead: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  return dt.toISOString().slice(0, 10);
}

function deriveCaseInputsForCatalogKey(
  catalogKey: string,
  caseRecord: CaseRecord
): {
  actual: number | null;
  baseline: number | null;
  previous: number | null;
  inputs: Record<string, number | null>;
  target: number | null;
  synced: boolean;
} {
  const fin = caseRecord.financials;
  const crm = caseRecord.crmContacts || [];
  const roi = caseRecord.roiScenarios || [];
  const health = caseRecord.overallHealth;
  const baselineSnap = caseRecord.continuity?.joiningBaseline?.snapshot || null;
  const totalTeam = (caseRecord.profile.employeeCount || 0) + (caseRecord.profile.subcontractorCount || 0);

  switch (catalogKey) {
    case 'monthly_revenue': {
      const actual = isValidNumber(fin?.annualRevenue) ? Math.round(fin!.annualRevenue! / 12) : null;
      const baseline = isValidNumber(baselineSnap?.annualRevenue)
        ? Math.round(baselineSnap!.annualRevenue! / 12)
        : actual;
      return {
        actual,
        baseline,
        previous: baselineSnap?.annualRevenue ? Math.round(baselineSnap.annualRevenue / 12) : null,
        inputs: { monthlyRevenue: actual },
        target: actual !== null ? Math.round(actual * 1.1) : null,
        synced: actual !== null,
      };
    }
    case 'gross_profit_margin': {
      const actual = calcGrossProfitMarginPct(fin?.annualRevenue, fin?.directCosts);
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { revenue: fin?.annualRevenue ?? null, directCosts: fin?.directCosts ?? null },
        target: 45,
        synced: actual !== null,
      };
    }
    case 'net_profit_margin': {
      const actual = calcNetProfitMarginPct(fin?.operatingProfit, fin?.annualRevenue);
      const baseNet = calcNetProfitMarginPct(baselineSnap?.operatingProfit, baselineSnap?.annualRevenue);
      return {
        actual,
        baseline: baseNet ?? actual,
        previous: baseNet,
        inputs: { netProfit: fin?.operatingProfit ?? null, revenue: fin?.annualRevenue ?? null },
        target: 15,
        synced: actual !== null,
      };
    }
    case 'opex_pct_revenue': {
      const actual = calcOperatingExpensesPct(fin?.operatingExpenses, fin?.annualRevenue);
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { operatingExpenses: fin?.operatingExpenses ?? null, revenue: fin?.annualRevenue ?? null },
        target: 28,
        synced: actual !== null,
      };
    }
    case 'available_cash': {
      const actual = isValidNumber(fin?.cashInBank) ? fin!.cashInBank! : null;
      const baseCash = isValidNumber(baselineSnap?.cashInBank) ? baselineSnap!.cashInBank! : null;
      const suggestedTarget = isValidNumber(fin?.operatingExpenses)
        ? Math.round((fin!.operatingExpenses! / 12) * 1.5)
        : null;
      return {
        actual,
        baseline: baseCash ?? actual,
        previous: baseCash,
        inputs: { cashInBank: actual },
        target: suggestedTarget,
        synced: actual !== null,
      };
    }
    case 'accounts_receivable': {
      const actual = isValidNumber(fin?.accountsReceivable) ? fin!.accountsReceivable! : null;
      const baseAr = isValidNumber(baselineSnap?.accountsReceivable) ? baselineSnap!.accountsReceivable! : null;
      return {
        actual,
        baseline: baseAr ?? actual,
        previous: baseAr,
        inputs: { accountsReceivable: actual },
        target: isValidNumber(fin?.annualRevenue) ? Math.round((fin!.annualRevenue! / 365) * 30) : null,
        synced: actual !== null,
      };
    }
    case 'overdue_receivables': {
      const actual = isValidNumber(fin?.overdueReceivables) ? fin!.overdueReceivables! : null;
      const baseOverdue = isValidNumber(baselineSnap?.overdueReceivables) ? baselineSnap!.overdueReceivables! : null;
      return {
        actual,
        baseline: baseOverdue ?? actual,
        previous: baseOverdue,
        inputs: { overdueReceivables: actual },
        target: 0,
        synced: actual !== null,
      };
    }
    case 'average_debtor_days': {
      const formulaDays = calcDebtorDays(fin?.accountsReceivable, fin?.annualRevenue);
      const actual = isValidNumber(fin?.actualPaymentDelayDays) ? fin!.actualPaymentDelayDays! : formulaDays;
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { accountsReceivable: fin?.accountsReceivable ?? null, annualRevenue: fin?.annualRevenue ?? null },
        target: isValidNumber(fin?.standardPaymentTermsDays) ? fin!.standardPaymentTermsDays! : 21,
        synced: actual !== null,
      };
    }
    case 'accounts_payable': {
      const actual = isValidNumber(fin?.accountsPayable) ? fin!.accountsPayable! : null;
      const baseAp = isValidNumber(baselineSnap?.accountsPayable) ? baselineSnap!.accountsPayable! : null;
      return {
        actual,
        baseline: baseAp ?? actual,
        previous: baseAp,
        inputs: { accountsPayable: actual },
        target: null,
        synced: actual !== null,
      };
    }
    case 'customer_concentration':
    case 'major_customer_dependency': {
      const actual = isValidNumber(fin?.top5ConcentrationPercent) ? fin!.top5ConcentrationPercent! : null;
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { topClientsRevenue: null, totalRevenue: fin?.annualRevenue ?? null },
        target: 35,
        synced: actual !== null,
      };
    }
    case 'revenue_per_employee': {
      const actual = calcRevenuePerEmployee(fin?.annualRevenue, totalTeam > 0 ? totalTeam : null);
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { annualRevenue: fin?.annualRevenue ?? null, teamCount: totalTeam > 0 ? totalTeam : null },
        target: 185000,
        synced: actual !== null,
      };
    }
    case 'enquiry_conversion_rate': {
      const activeEnquiries = crm.filter((c) => c.salesStage !== 'Dormant');
      const won = activeEnquiries.filter((c) => c.salesStage === 'Won').length;
      const actual = activeEnquiries.length >= 2 ? round2((won / activeEnquiries.length) * 100) : null;
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: {
          wonCustomers: activeEnquiries.length >= 2 ? won : null,
          totalEnquiries: activeEnquiries.length >= 2 ? activeEnquiries.length : null,
        },
        target: 35,
        synced: actual !== null,
      };
    }
    case 'recurring_revenue': {
      const activeMonthly = crm
        .filter((c) => c.status !== 'Closed Lost' && c.salesStage !== 'Lost')
        .reduce((sum, c) => sum + (Number(c.monthlyValue) || 0), 0);
      const arr = activeMonthly > 0 ? activeMonthly * 12 : null;
      const actual =
        arr !== null && isValidNumber(fin?.annualRevenue) && fin!.annualRevenue! > 0
          ? round2((arr / fin!.annualRevenue!) * 100)
          : null;
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { annualRecurringRevenue: arr, totalAnnualRevenue: fin?.annualRevenue ?? null },
        target: 50,
        synced: actual !== null,
      };
    }
    case 'return_on_investment': {
      const topRoi = roi[0];
      if (!topRoi || !topRoi.upfrontInvestment || topRoi.upfrontInvestment <= 0) {
        return { actual: null, baseline: null, previous: null, inputs: { netGain: null, upfrontInvestment: null }, target: 35, synced: false };
      }
      const monthlyMargin = (topRoi.expectedMonthlyRevenue || 0) * ((topRoi.grossMarginPct || 0) / 100);
      const monthlyNet = monthlyMargin - (topRoi.monthlyOperatingCost || 0);
      const horizon = Math.max(1, topRoi.monthsHorizon || 12);
      const netGain = Math.round(monthlyNet * horizon - topRoi.upfrontInvestment);
      const actual = round2((netGain / topRoi.upfrontInvestment) * 100);
      return {
        actual,
        baseline: actual,
        previous: null,
        inputs: { netGain, upfrontInvestment: topRoi.upfrontInvestment },
        target: 35,
        synced: true,
      };
    }
    case 'business_continuity_risks': {
      const actual = isValidNumber(health?.overallScore) ? health!.overallScore! : null;
      const baseScore = isValidNumber(baselineSnap?.healthScore) ? baselineSnap!.healthScore! : null;
      return {
        actual,
        baseline: baseScore ?? actual,
        previous: baseScore,
        inputs: { continuityScore: actual },
        target: 72,
        synced: actual !== null,
      };
    }
    default:
      return {
        actual: null,
        baseline: null,
        previous: null,
        inputs: {},
        target: null,
        synced: false,
      };
  }
}

export function buildDeterministicKpiInsight(
  kpi: TrackedKpiRecord,
  caseRecord: CaseRecord
): { aiInterpretation: string; recommendedAction: string } {
  const currency = caseRecord.profile.currency || 'NZD';
  const trend = computeKpiTrend(kpi.latestActualValue, kpi.previousValue, kpi.direction, kpi.unit);
  const variance = computeKpiVariance(kpi.latestActualValue, kpi.targetValue, kpi.direction, kpi.unit, currency);

  if (!isValidNumber(kpi.latestActualValue)) {
    return {
      aiInterpretation: `Insufficient data recorded yet for ${kpi.name}. Enter your period figures or sync your financial ledger to establish a verified baseline.`,
      recommendedAction: `Record the latest verified figure for ${kpi.name} and set an explicit target before your next review.`,
    };
  }

  const actualFmt = formatKpiNumber(kpi.latestActualValue, kpi.unit, currency);
  const targetFmt = isValidNumber(kpi.targetValue) ? formatKpiNumber(kpi.targetValue, kpi.unit, currency) : 'not yet set';

  if (variance && !variance.isFavorable) {
    return {
      aiInterpretation: `${kpi.name} is currently ${actualFmt} (${variance.formattedDelta} vs target of ${targetFmt}; trend: ${trend}). Leaving this gap unaddressed creates direct commercial drag on cash or margin.`,
      recommendedAction:
        kpi.category === 'cash_flow'
          ? `Assign an owner to tighten invoice collections and weekly cash checkpoints until ${kpi.name} reaches ${targetFmt}.`
          : kpi.category === 'profitability'
          ? `Audit job costing, direct labour recovery, and unbilled variations this week to close the gap toward ${targetFmt}.`
          : kpi.category === 'operational_efficiency'
          ? `Review team scheduling, rework causes, and non-billable time logs in Monday's operations check-in.`
          : `Set a specific 30-day corrective milestone in your Action Plan to move ${kpi.name} toward ${targetFmt}.`,
    };
  }

  if (variance && variance.isFavorable) {
    return {
      aiInterpretation: `${kpi.name} is ${actualFmt}, meeting or outperforming your target (${targetFmt}; trend: ${trend}). Keep monitoring regularly so gains do not slip under higher workload.`,
      recommendedAction:
        trend === 'Declining'
          ? `Although still within target, the period-on-period trend is softening—inspect underlying drivers before next review.`
          : `Maintain current operational controls and verify figures again on ${kpi.nextReviewDate}.`,
    };
  }

  return {
    aiInterpretation: `Latest actual for ${kpi.name} is ${actualFmt} (trend: ${trend}). Set a clear target value to measure commercial variance.`,
    recommendedAction: `Define a realistic 90-day target value for ${kpi.name} and schedule a follow-up check.`,
  };
}

export function buildTrackedKpiFromCatalog(
  def: KpiCatalogDefinition,
  caseRecord: CaseRecord
): TrackedKpiRecord {
  const derived = deriveCaseInputsForCatalogKey(def.catalogKey, caseRecord);
  const initialInputs: Record<string, number | null> = {};
  for (const field of def.inputFields) {
    initialInputs[field.key] = derived.inputs[field.key] ?? null;
  }

  const now = new Date().toISOString();
  const baseRecord: TrackedKpiRecord = {
    id: `kpi-${def.catalogKey}`,
    catalogKey: def.catalogKey,
    name: def.name,
    category: def.category,
    categoryLabel: def.categoryLabel,
    explanation: def.explanation,
    unit: def.unit,
    direction: def.direction,
    formulaType: def.formulaType,
    formulaDescription: def.formulaDescription,
    inputValues: initialInputs,
    baselineValue: derived.baseline,
    targetValue: derived.target,
    previousValue: derived.previous,
    latestActualValue: derived.actual,
    aiInterpretation: '',
    recommendedAction: '',
    nextReviewDate: defaultNextReviewDate(def.reviewCadenceDays),
    ownerComment: '',
    isAutoSyncedFromCase: derived.synced,
    isCustom: false,
    history:
      derived.actual !== null
        ? [
            {
              periodLabel: now.slice(0, 10),
              recordedAt: now,
              actualValue: derived.actual,
              targetValue: derived.target,
              comment: 'Synced from business case record',
            },
          ]
        : [],
    updatedAt: now,
  };

  const insight = buildDeterministicKpiInsight(baseRecord, caseRecord);
  baseRecord.aiInterpretation = insight.aiInterpretation;
  baseRecord.recommendedAction = insight.recommendedAction;
  return baseRecord;
}

export function generateSelectiveKpiRecommendations(
  caseRecord: CaseRecord,
  selectedKpiIds: string[]
): KpiRecommendedSuggestion[] {
  const selected = new Set(selectedKpiIds);
  const suggestions: KpiRecommendedSuggestion[] = [];
  const fin = caseRecord.financials;

  const pushIfMissing = (catalogKey: string, clearBusinessReason: string) => {
    if (selected.has(catalogKey) || suggestions.some((s) => s.catalogKey === catalogKey)) return;
    const def = getCatalogKpiByKey(catalogKey);
    if (!def) return;
    suggestions.push({
      catalogKey,
      name: def.name,
      category: def.category,
      categoryLabel: def.categoryLabel,
      clearBusinessReason,
    });
  };

  if (fin && isValidNumber(fin.top5ConcentrationPercent) && fin.top5ConcentrationPercent >= 35) {
    pushIfMissing(
      'customer_concentration',
      `Your top 5 clients represent ${fin.top5ConcentrationPercent}% of revenue. Tracking Customer Concentration prevents unexpected churn shock.`
    );
  }

  if (
    fin &&
    isValidNumber(fin.overdueReceivables) &&
    isValidNumber(fin.accountsReceivable) &&
    fin.accountsReceivable > 0 &&
    fin.overdueReceivables / fin.accountsReceivable >= 0.2
  ) {
    pushIfMissing(
      'average_debtor_days',
      `${Math.round((fin.overdueReceivables / fin.accountsReceivable) * 100)}% of receivables are overdue—Average Debtor Days exposes collection velocity.`
    );
  }

  if (caseRecord.healthInputs?.pricingMargins?.status === 'at_risk') {
    pushIfMissing(
      'unbilled_work_hours',
      'Pricing & Margins is rated At Risk—tracking Unbilled Work or Service Hours catches absorbed variations and scope creep.'
    );
  }

  if (caseRecord.healthInputs?.ownerDependency?.status === 'at_risk') {
    pushIfMissing(
      'business_continuity_risks',
      'Owner Dependency is rated At Risk—monitoring Business Continuity Risks keeps delegation and resilience visible.'
    );
  }

  if ((caseRecord.roiScenarios?.length || 0) > 0) {
    pushIfMissing(
      'return_on_investment',
      `You have ${caseRecord.roiScenarios!.length} active ROI scenario(s) modeled—track actual Return on Investment against forecast.`
    );
  }

  return suggestions.slice(0, 3);
}

export function initializeKpiTrackerForCase(
  caseRecord: CaseRecord,
  presetOverride?: KpiBusinessTypePreset
): KpiTrackerState {
  const preset = presetOverride || caseRecord.kpiTracker?.selectedPreset || inferPresetFromIndustry(caseRecord.profile.industry);
  const presetMeta =
    KPI_BUSINESS_TYPE_PRESETS.find((p) => p.id === preset) || KPI_BUSINESS_TYPE_PRESETS[4];

  const existingById = new Map<string, TrackedKpiRecord>();
  for (const k of caseRecord.kpiTracker?.kpis || []) {
    existingById.set(k.catalogKey || k.id, k);
  }

  const selectedKeys = presetOverride
    ? [...presetMeta.defaultKpiKeys]
    : caseRecord.kpiTracker?.selectedKpiIds?.length
    ? [...caseRecord.kpiTracker.selectedKpiIds]
    : [...presetMeta.defaultKpiKeys];

  // Preserve custom KPIs across preset switching
  const customKpis = (caseRecord.kpiTracker?.kpis || []).filter((k) => k.isCustom);
  for (const c of customKpis) {
    if (!selectedKeys.includes(c.id)) selectedKeys.push(c.id);
  }

  const builtKpis: TrackedKpiRecord[] = [];
  for (const key of selectedKeys) {
    const existing = existingById.get(key);
    if (existing) {
      builtKpis.push(existing);
      continue;
    }
    const def = getCatalogKpiByKey(key);
    if (def) {
      builtKpis.push(buildTrackedKpiFromCatalog(def, caseRecord));
    }
  }

  return {
    selectedPreset: preset,
    selectedKpiIds: builtKpis.map((k) => k.catalogKey || k.id),
    kpis: builtKpis,
    recommendedAdditionalKpis: generateSelectiveKpiRecommendations(
      caseRecord,
      builtKpis.map((k) => k.catalogKey || k.id)
    ),
    lastAiReviewedAt: caseRecord.kpiTracker?.lastAiReviewedAt ?? null,
  };
}

export function syncKpiTrackerWithCaseData(
  tracker: KpiTrackerState,
  caseRecord: CaseRecord
): KpiTrackerState {
  const updatedKpis = tracker.kpis.map((kpi) => {
    if (kpi.isCustom || !kpi.catalogKey) return kpi;
    const derived = deriveCaseInputsForCatalogKey(kpi.catalogKey, caseRecord);
    if (!derived.synced || derived.actual === null) {
      return kpi;
    }
    const previousChanged =
      kpi.latestActualValue !== null && kpi.latestActualValue !== derived.actual
        ? kpi.latestActualValue
        : kpi.previousValue;

    const merged: TrackedKpiRecord = {
      ...kpi,
      inputValues: { ...kpi.inputValues, ...derived.inputs },
      baselineValue: kpi.baselineValue ?? derived.baseline,
      targetValue: kpi.targetValue ?? derived.target,
      previousValue: previousChanged,
      latestActualValue: derived.actual,
      isAutoSyncedFromCase: true,
      updatedAt: new Date().toISOString(),
    };
    const insight = buildDeterministicKpiInsight(merged, caseRecord);
    if (!merged.aiInterpretation || merged.aiInterpretation.startsWith('Insufficient data')) {
      merged.aiInterpretation = insight.aiInterpretation;
      merged.recommendedAction = insight.recommendedAction;
    }
    return merged;
  });

  return {
    ...tracker,
    kpis: updatedKpis,
    recommendedAdditionalKpis: generateSelectiveKpiRecommendations(caseRecord, tracker.selectedKpiIds),
  };
}

export function createCustomTrackedKpi(params: {
  name: string;
  categoryId: TrackedKpiRecord['category'];
  explanation: string;
  unit: KpiUnitType;
  direction: KpiDirection;
  baselineValue: number | null;
  targetValue: number | null;
  latestActualValue: number | null;
  nextReviewDate: string;
  ownerComment?: string;
}): TrackedKpiRecord {
  const catMeta = KPI_CATEGORIES.find((c) => c.id === params.categoryId) || KPI_CATEGORIES[0];
  const now = new Date().toISOString();
  const id = `custom-kpi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    name: params.name.trim(),
    category: catMeta.id,
    categoryLabel: catMeta.label,
    explanation: params.explanation.trim() || 'Custom owner-defined KPI.',
    unit: params.unit,
    direction: params.direction,
    formulaType: 'manual',
    formulaDescription: 'Owner-entered figure',
    inputValues: { manualValue: params.latestActualValue },
    baselineValue: params.baselineValue,
    targetValue: params.targetValue,
    previousValue: params.baselineValue,
    latestActualValue: params.latestActualValue,
    aiInterpretation:
      params.latestActualValue === null
        ? 'Insufficient data recorded yet. Enter your latest actual figure to activate variance and AI interpretation.'
        : 'Custom KPI recorded. Run AI Interpret KPIs to generate tailored commercial commentary.',
    recommendedAction: 'Review figure at scheduled review date and adjust operational owner actions as needed.',
    nextReviewDate: params.nextReviewDate || defaultNextReviewDate(30),
    ownerComment: params.ownerComment?.trim() || '',
    isAutoSyncedFromCase: false,
    isCustom: true,
    history:
      params.latestActualValue !== null
        ? [
            {
              periodLabel: now.slice(0, 10),
              recordedAt: now,
              actualValue: params.latestActualValue,
              targetValue: params.targetValue,
              comment: params.ownerComment?.trim() || 'Initial custom KPI entry',
            },
          ]
        : [],
    updatedAt: now,
  };
}
