import { RoiScenario } from '../types/bizpulse';

export interface RoiCalculationMetrics {
  monthlyGrossProfit: number;
  monthlyNetContribution: number;
  totalHorizonCost: number;
  totalHorizonGrossProfit: number;
  horizonNetBenefit: number;
  roiPct: number | null;
  paybackMonths: number | null;
  breakEvenMonthlyRevenue: number | null;
  riskAdjustedNetBenefit: number;
  hasSufficientData: boolean;
}

export function computeRoiMetrics(
  upfrontInvestment: number,
  monthlyOperatingCost: number,
  expectedMonthlyRevenue: number,
  grossMarginPct: number,
  monthsHorizon: number,
  confidencePct: number
): RoiCalculationMetrics {
  const safeUpfront = Math.max(0, Number.isFinite(upfrontInvestment) ? upfrontInvestment : 0);
  const safeMonthlyCost = Math.max(0, Number.isFinite(monthlyOperatingCost) ? monthlyOperatingCost : 0);
  const safeExpectedRev = Math.max(0, Number.isFinite(expectedMonthlyRevenue) ? expectedMonthlyRevenue : 0);
  const safeHorizon = Math.max(1, Number.isFinite(monthsHorizon) && monthsHorizon > 0 ? monthsHorizon : 12);
  const safeMarginRate =
    Math.max(0, Math.min(100, Number.isFinite(grossMarginPct) ? grossMarginPct : 0)) / 100;
  const safeConfidence =
    Math.max(0, Math.min(100, Number.isFinite(confidencePct) ? confidencePct : 0)) / 100;

  const hasCostOrRevenueInputs = safeUpfront > 0 || safeMonthlyCost > 0 || safeExpectedRev > 0;
  const hasSufficientData = hasCostOrRevenueInputs && safeMarginRate > 0;

  const monthlyGrossProfit = safeExpectedRev * safeMarginRate;
  const monthlyNetContribution = monthlyGrossProfit - safeMonthlyCost;
  const totalHorizonCost = safeUpfront + safeMonthlyCost * safeHorizon;
  const totalHorizonGrossProfit = monthlyGrossProfit * safeHorizon;
  const horizonNetBenefit = monthlyNetContribution * safeHorizon - safeUpfront;

  const roiPct =
    !hasSufficientData || totalHorizonCost <= 0
      ? null
      : (horizonNetBenefit / totalHorizonCost) * 100;

  const paybackMonths = !hasSufficientData
    ? null
    : monthlyNetContribution > 0
    ? safeUpfront === 0
      ? 0
      : safeUpfront / monthlyNetContribution
    : null;

  const monthlyAmortizedUpfront = safeUpfront / safeHorizon;
  const breakEvenMonthlyRevenue =
    hasSufficientData && safeMarginRate > 0
      ? (safeMonthlyCost + monthlyAmortizedUpfront) / safeMarginRate
      : null;

  const riskAdjustedNetBenefit = horizonNetBenefit * safeConfidence;

  return {
    monthlyGrossProfit,
    monthlyNetContribution,
    totalHorizonCost,
    totalHorizonGrossProfit,
    horizonNetBenefit,
    roiPct,
    paybackMonths,
    breakEvenMonthlyRevenue,
    riskAdjustedNetBenefit,
    hasSufficientData,
  };
}

export function computeRoiScenarioMetrics(scenario: RoiScenario): RoiCalculationMetrics {
  return computeRoiMetrics(
    scenario.upfrontInvestment,
    scenario.monthlyOperatingCost,
    scenario.expectedMonthlyRevenue,
    scenario.grossMarginPct,
    scenario.monthsHorizon,
    scenario.confidencePct
  );
}
