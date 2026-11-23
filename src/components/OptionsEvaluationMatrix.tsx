import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Calculator,
  Info,
  Plus,
  Copy,
  Trash2,
  Bot,
  TrendingUp,
  Layers,
  Link as LinkIcon,
} from 'lucide-react';
import { GROWTH_OPTIONS_EVALUATION } from '../data/coachingBriefing';
import { CaseRecord, RoiScenario, RoiCategory } from '../types/bizpulse';

export interface PendingRoiDraft {
  linkedCrmId: string;
  linkedCrmLabel: string;
  opportunityValue: number;
  monthlyValue: number;
  notes?: string;
}

interface OptionsEvaluationMatrixProps {
  caseRecord?: CaseRecord;
  onUpdateRoiScenarios?: (scenarios: RoiScenario[]) => void;
  pendingRoiDraft?: PendingRoiDraft | null;
  onClearPendingRoiDraft?: () => void;
  onOpenCoachWithPrompt?: (prompt: string) => void;
}

const ROI_CATEGORIES: RoiCategory[] = [
  'Sales & Marketing',
  'Hiring & Capacity',
  'Pricing & Margin',
  'Systems & Automation',
  'Client Retention',
  'Other',
];

function computeRoiMetrics(
  upfrontInvestment: number,
  monthlyOperatingCost: number,
  expectedMonthlyRevenue: number,
  grossMarginPct: number,
  monthsHorizon: number,
  confidencePct: number
) {
  const safeHorizon = Math.max(1, monthsHorizon || 12);
  const safeMarginRate = Math.max(0, Math.min(100, grossMarginPct || 0)) / 100;
  const safeConfidence = Math.max(0, Math.min(100, confidencePct || 0)) / 100;

  const monthlyGrossProfit = expectedMonthlyRevenue * safeMarginRate;
  const monthlyNetContribution = monthlyGrossProfit - monthlyOperatingCost;
  const totalHorizonCost = upfrontInvestment + monthlyOperatingCost * safeHorizon;
  const totalHorizonGrossProfit = monthlyGrossProfit * safeHorizon;
  const horizonNetBenefit = monthlyNetContribution * safeHorizon - upfrontInvestment;
  const roiPct = totalHorizonCost > 0 ? (horizonNetBenefit / totalHorizonCost) * 100 : 0;

  const paybackMonths =
    monthlyNetContribution > 0
      ? upfrontInvestment === 0
        ? 0
        : upfrontInvestment / monthlyNetContribution
      : null;

  const monthlyAmortizedUpfront = upfrontInvestment / safeHorizon;
  const breakEvenMonthlyRevenue =
    safeMarginRate > 0 ? (monthlyOperatingCost + monthlyAmortizedUpfront) / safeMarginRate : null;

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
  };
}

export const OptionsEvaluationMatrix: React.FC<OptionsEvaluationMatrixProps> = ({
  caseRecord,
  onUpdateRoiScenarios,
  pendingRoiDraft,
  onClearPendingRoiDraft,
  onOpenCoachWithPrompt,
}) => {
  const isDemo = caseRecord?.profile?.isDemonstrationCase ?? true;
  const profile = caseRecord?.profile;
  const currency = profile?.currency || 'NZD';
  const fin = caseRecord?.financials;
  const crmContacts = caseRecord?.crmContacts || [];
  const roiScenarios = caseRecord?.roiScenarios || [];

  const [selectedOptionId, setSelectedOptionId] = useState<'Option A' | 'Option B' | 'Option C'>(
    'Option C'
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    roiScenarios[0]?.id || null
  );

  // Convert CRM draft passed from CRM tab into a pre-filled persisted ROI scenario
  useEffect(() => {
    if (!pendingRoiDraft || !onUpdateRoiScenarios) return;

    const existing = roiScenarios.find((s) => s.linkedCrmId === pendingRoiDraft.linkedCrmId);
    if (existing) {
      setSelectedScenarioId(existing.id);
      onClearPendingRoiDraft?.();
      return;
    }

    const now = new Date().toISOString();
    const estMonthlyRev =
      pendingRoiDraft.monthlyValue > 0
        ? pendingRoiDraft.monthlyValue
        : pendingRoiDraft.opportunityValue > 0
        ? Math.round(pendingRoiDraft.opportunityValue / 12)
        : 2500;
    const estUpfront =
      pendingRoiDraft.opportunityValue > 0
        ? Math.round(pendingRoiDraft.opportunityValue * 0.15)
        : 1500;

    const newScenario: RoiScenario = {
      id: `roi-${Date.now()}`,
      name: `Opportunity ROI: ${pendingRoiDraft.linkedCrmLabel}`,
      category: 'Client Retention',
      linkedCrmId: pendingRoiDraft.linkedCrmId,
      linkedCrmLabel: pendingRoiDraft.linkedCrmLabel,
      upfrontInvestment: estUpfront,
      monthlyOperatingCost: Math.round(estMonthlyRev * 0.25),
      expectedMonthlyRevenue: estMonthlyRev,
      grossMarginPct: 55,
      monthsHorizon: 12,
      confidencePct: 65,
      assumptionsNote:
        pendingRoiDraft.notes ||
        `Pre-populated from CRM opportunity for ${pendingRoiDraft.linkedCrmLabel}. Edit upfront setup cost, ongoing delivery cost, and gross margin % to verify payback.`,
      createdAt: now,
      updatedAt: now,
    };

    onUpdateRoiScenarios([newScenario, ...roiScenarios]);
    setSelectedScenarioId(newScenario.id);
    onClearPendingRoiDraft?.();
  }, [pendingRoiDraft]);

  const activeScenario = useMemo(() => {
    if (roiScenarios.length === 0) return null;
    return roiScenarios.find((s) => s.id === selectedScenarioId) || roiScenarios[0];
  }, [roiScenarios, selectedScenarioId]);

  const handleCreateScenario = () => {
    const now = new Date().toISOString();
    const created: RoiScenario = {
      id: `roi-${Date.now()}`,
      name: `New Opportunity Scenario #${roiScenarios.length + 1}`,
      category: 'Sales & Marketing',
      upfrontInvestment: 5000,
      monthlyOperatingCost: 1200,
      expectedMonthlyRevenue: 4000,
      grossMarginPct: 60,
      monthsHorizon: 12,
      confidencePct: 70,
      assumptionsNote: 'Enter explicit delivery, setup, and conversion assumptions here.',
      createdAt: now,
      updatedAt: now,
    };
    onUpdateRoiScenarios?.([created, ...roiScenarios]);
    setSelectedScenarioId(created.id);
  };

  const handleDuplicateScenario = (scenario: RoiScenario) => {
    const now = new Date().toISOString();
    const dup: RoiScenario = {
      ...scenario,
      id: `roi-${Date.now()}`,
      name: `${scenario.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    onUpdateRoiScenarios?.([dup, ...roiScenarios]);
    setSelectedScenarioId(dup.id);
  };

  const handleDeleteScenario = (id: string) => {
    const remaining = roiScenarios.filter((s) => s.id !== id);
    onUpdateRoiScenarios?.(remaining);
    if (selectedScenarioId === id) {
      setSelectedScenarioId(remaining[0]?.id || null);
    }
  };

  const updateActiveField = (patch: Partial<RoiScenario>) => {
    if (!activeScenario || !onUpdateRoiScenarios) return;
    const updated = roiScenarios.map((s) =>
      s.id === activeScenario.id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
    );
    onUpdateRoiScenarios(updated);
  };

  const baseMetrics = useMemo(() => {
    if (!activeScenario) return null;
    return computeRoiMetrics(
      activeScenario.upfrontInvestment,
      activeScenario.monthlyOperatingCost,
      activeScenario.expectedMonthlyRevenue,
      activeScenario.grossMarginPct,
      activeScenario.monthsHorizon,
      activeScenario.confidencePct
    );
  }, [activeScenario]);

  const sensitivityCases = useMemo(() => {
    if (!activeScenario) return [];
    const conservative = computeRoiMetrics(
      activeScenario.upfrontInvestment,
      activeScenario.monthlyOperatingCost,
      activeScenario.expectedMonthlyRevenue * 0.75,
      Math.max(5, activeScenario.grossMarginPct - 5),
      activeScenario.monthsHorizon,
      activeScenario.confidencePct
    );
    const base = computeRoiMetrics(
      activeScenario.upfrontInvestment,
      activeScenario.monthlyOperatingCost,
      activeScenario.expectedMonthlyRevenue,
      activeScenario.grossMarginPct,
      activeScenario.monthsHorizon,
      activeScenario.confidencePct
    );
    const optimistic = computeRoiMetrics(
      activeScenario.upfrontInvestment,
      activeScenario.monthlyOperatingCost,
      activeScenario.expectedMonthlyRevenue * 1.25,
      Math.min(100, activeScenario.grossMarginPct + 5),
      activeScenario.monthsHorizon,
      activeScenario.confidencePct
    );
    return [
      {
        label: 'Conservative (-25% Rev, -5% GM)',
        revenue: activeScenario.expectedMonthlyRevenue * 0.75,
        gm: Math.max(5, activeScenario.grossMarginPct - 5),
        metrics: conservative,
        tone: 'amber' as const,
      },
      {
        label: 'Base Case (Current Inputs)',
        revenue: activeScenario.expectedMonthlyRevenue,
        gm: activeScenario.grossMarginPct,
        metrics: base,
        tone: 'neutral' as const,
      },
      {
        label: 'Optimistic (+25% Rev, +5% GM)',
        revenue: activeScenario.expectedMonthlyRevenue * 1.25,
        gm: Math.min(100, activeScenario.grossMarginPct + 5),
        metrics: optimistic,
        tone: 'green' as const,
      },
    ];
  }, [activeScenario]);

  // Liquidity & Health Guardrail Check
  const liquidityGuardrail = useMemo(() => {
    if (!activeScenario) return null;
    const cash = fin?.cashInBank ?? null;
    const facilityLimit = fin?.creditFacilityLimit ?? 0;
    const facilityUsed = fin?.creditFacilityUsed ?? 0;
    const headroom = cash !== null ? cash + Math.max(0, facilityLimit - facilityUsed) : null;
    const moneyStatus = caseRecord?.healthInputs?.money?.status;
    const firstQuarterCashOutlay =
      activeScenario.upfrontInvestment + activeScenario.monthlyOperatingCost * 3;

    if (moneyStatus === 'at_risk' && activeScenario.upfrontInvestment > 5000) {
      return {
        tone: 'red' as const,
        title: 'Business Health Liquidity Guardrail Triggered',
        message: `Your Money & Cash Flow health is rated At Risk. This scenario commits ${currency} ${activeScenario.upfrontInvestment.toLocaleString()} upfront (${currency} ${firstQuarterCashOutlay.toLocaleString()} across first 3 months). Prioritize overdue receivables collection or stage rollout before committing cash.`,
      };
    }

    if (headroom !== null && firstQuarterCashOutlay > headroom * 0.5) {
      return {
        tone: 'amber' as const,
        title: 'Working Capital Concentration Warning',
        message: `First 90-day cash outlay (${currency} ${firstQuarterCashOutlay.toLocaleString()}) absorbs over 50% of available cash + credit facility headroom (${currency} ${headroom.toLocaleString()}). Ensure payback speed or upfront client deposit covers delivery costs.`,
      };
    }

    if (cash === null) {
      return {
        tone: 'amber' as const,
        title: 'Cash Baseline Missing',
        message: `Enter current Cash in Bank and Credit Facility figures on the Cash Flow tab so BizPulse can stress-test this ROI scenario against real solvency headroom.`,
      };
    }

    return {
      tone: 'green' as const,
      title: 'Liquidity Headroom Check Passed',
      message: `Upfront + 90-day operating outlay (${currency} ${firstQuarterCashOutlay.toLocaleString()}) sits within current cash + facility headroom (${currency} ${headroom?.toLocaleString()}).`,
    };
  }, [activeScenario, fin, caseRecord, currency]);

  const selectedOption =
    GROWTH_OPTIONS_EVALUATION.find((o) => o.id === selectedOptionId) ||
    GROWTH_OPTIONS_EVALUATION[2];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Charcoal Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#FBBF24]">
                ROI Calculator, Break-Even &amp; Trade-Off Analysis
              </span>
              <span className="text-xs text-[#A1A1AA] font-medium">
                {profile?.name || 'Active Business'} ({currency})
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              ROI, Margin Scenarios &amp; Growth Decision Matrix
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed">
              Model investment payback, break-even monthly revenue, and Conservative/Base/Optimistic sensitivity with transparent, editable assumptions linked directly to your CRM opportunities and cash headroom.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateScenario}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New ROI Scenario</span>
          </button>
        </div>
      </div>

      {/* =================================================== */}
      {/* SECTION 1: INTERACTIVE EDITABLE ROI & BREAK-EVEN    */}
      {/* =================================================== */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-lg font-bold text-[#111113]">
                Editable ROI &amp; Break-Even Scenario Workbench
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1">
              Every assumption is transparent and editable. Evaluate CRM pipeline deals, hiring, marketing retainers, or pricing changes.
            </p>
          </div>

          {roiScenarios.length > 0 && activeScenario && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDuplicateScenario(activeScenario)}
                className="px-3 py-1.5 rounded bg-[#F8F7F4] border border-[#111113]/15 hover:border-[#D97706] text-xs font-semibold text-[#111113] inline-flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button
                type="button"
                onClick={() => handleDeleteScenario(activeScenario.id)}
                className="px-3 py-1.5 rounded bg-white border border-[#FECACA] hover:bg-[#FEF2F2] text-xs font-semibold text-[#B91C1C] inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Scenario Switcher Pills */}
        {roiScenarios.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {roiScenarios.map((sc) => {
              const isSelected = activeScenario?.id === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(sc.id)}
                  className={`px-3.5 py-2 rounded text-xs font-semibold border transition text-left ${
                    isSelected
                      ? 'bg-[#111113] text-white border-[#111113]'
                      : 'bg-[#F8F7F4] text-[#111113] border-[#111113]/15 hover:border-[#D97706]'
                  }`}
                >
                  <span>{sc.name}</span>
                  {sc.linkedCrmLabel && (
                    <span className="ml-1.5 text-[10px] font-mono text-[#FBBF24]">
                      [{sc.linkedCrmLabel}]
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeScenario && baseMetrics ? (
          <div className="space-y-6">
            {/* Editable Inputs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-4 text-xs">
                <span className="font-mono font-bold uppercase tracking-wider text-[#111113] block">
                  Editable Opportunity Assumptions
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-[#111113] block mb-1">Scenario Name</label>
                    <input
                      type="text"
                      value={activeScenario.name}
                      onChange={(e) => updateActiveField({ name: e.target.value })}
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-semibold text-[#111113]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">Category</label>
                    <select
                      value={activeScenario.category}
                      onChange={(e) =>
                        updateActiveField({ category: e.target.value as RoiCategory })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                    >
                      {ROI_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-[#D97706]" /> Link to CRM Opportunity
                    </label>
                    <select
                      value={activeScenario.linkedCrmId || ''}
                      onChange={(e) => {
                        const found = crmContacts.find((c) => c.id === e.target.value);
                        updateActiveField({
                          linkedCrmId: found?.id || undefined,
                          linkedCrmLabel: found?.companyOrName || undefined,
                        });
                      }}
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                    >
                      <option value="">No CRM Link</option>
                      {crmContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyOrName} ({c.salesStage})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">
                      Upfront Investment ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={activeScenario.upfrontInvestment}
                      onChange={(e) =>
                        updateActiveField({ upfrontInvestment: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-mono font-bold text-[#111113] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">
                      Monthly Operating Cost ({currency}/mo)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={activeScenario.monthlyOperatingCost}
                      onChange={(e) =>
                        updateActiveField({
                          monthlyOperatingCost: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-mono font-bold text-[#111113] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">
                      Expected Monthly Revenue ({currency}/mo)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={activeScenario.expectedMonthlyRevenue}
                      onChange={(e) =>
                        updateActiveField({
                          expectedMonthlyRevenue: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-mono font-bold text-[#111113] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">
                      Gross Margin (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={activeScenario.grossMarginPct}
                      onChange={(e) =>
                        updateActiveField({
                          grossMarginPct: Math.max(1, Math.min(100, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-mono font-bold text-[#111113] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">
                      Evaluation Horizon (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={activeScenario.monthsHorizon}
                      onChange={(e) =>
                        updateActiveField({
                          monthsHorizon: Math.max(1, Math.min(60, Number(e.target.value) || 12)),
                        })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-mono font-bold text-[#111113] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#111113] block mb-1">
                      Execution Confidence (%)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      value={activeScenario.confidencePct}
                      onChange={(e) =>
                        updateActiveField({
                          confidencePct: Math.max(5, Math.min(100, Number(e.target.value) || 50)),
                        })
                      }
                      className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 font-mono font-bold text-[#111113] tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#111113] block mb-1">
                    Transparent Assumptions &amp; Evidence Note
                  </label>
                  <textarea
                    rows={2}
                    value={activeScenario.assumptionsNote}
                    onChange={(e) => updateActiveField({ assumptionsNote: e.target.value })}
                    className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                  />
                </div>
              </div>

              {/* Calculated ROI & Break-Even Output Card */}
              <div className="lg:col-span-6 space-y-4 tabular-nums">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`p-4 rounded border ${
                      baseMetrics.roiPct >= 25
                        ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                        : baseMetrics.roiPct >= 0
                        ? 'bg-[#FFFBEB] border-[#FDE68A]'
                        : 'bg-[#FEF2F2] border-[#FECACA]'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B] block">
                      Projected {activeScenario.monthsHorizon}-Month ROI
                    </span>
                    <div
                      className={`text-2xl sm:text-3xl font-bold font-mono mt-1 ${
                        baseMetrics.roiPct >= 25
                          ? 'text-[#15803D]'
                          : baseMetrics.roiPct >= 0
                          ? 'text-[#B45309]'
                          : 'text-[#B91C1C]'
                      }`}
                    >
                      {baseMetrics.roiPct.toFixed(1)}%
                    </div>
                  </div>

                  <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B] block">
                      Payback Period
                    </span>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-[#111113] mt-1">
                      {baseMetrics.paybackMonths === null
                        ? 'Never'
                        : `${baseMetrics.paybackMonths.toFixed(1)} mo`}
                    </div>
                  </div>
                </div>

                {/* Transparent Breakdown Table */}
                <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2.5 text-xs">
                  <span className="font-mono font-bold uppercase tracking-wider text-[#111113] block border-b border-[#111113]/10 pb-2">
                    Transparent Calculation Breakdown
                  </span>
                  <div className="flex justify-between">
                    <span className="text-[#52525B]">
                      Monthly Gross Profit ({currency} {activeScenario.expectedMonthlyRevenue.toLocaleString()} × {activeScenario.grossMarginPct}%):
                    </span>
                    <span className="font-mono font-bold text-[#111113]">
                      {currency} {Math.round(baseMetrics.monthlyGrossProfit).toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52525B]">
                      Monthly Net Contribution (Gross Profit − {currency} {activeScenario.monthlyOperatingCost.toLocaleString()} cost):
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        baseMetrics.monthlyNetContribution >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {baseMetrics.monthlyNetContribution >= 0 ? '+' : '-'}
                      {currency} {Math.round(Math.abs(baseMetrics.monthlyNetContribution)).toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52525B]">
                      Total Cash Outlay ({activeScenario.monthsHorizon} mo):
                    </span>
                    <span className="font-mono font-bold text-[#111113]">
                      {currency} {Math.round(baseMetrics.totalHorizonCost).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#111113]/10">
                    <span className="font-bold text-[#111113]">
                      Net Horizon Benefit ({activeScenario.monthsHorizon} mo):
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        baseMetrics.horizonNetBenefit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {baseMetrics.horizonNetBenefit >= 0 ? '+' : '-'}
                      {currency} {Math.round(Math.abs(baseMetrics.horizonNetBenefit)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52525B]">
                      Risk-Adjusted Net Benefit (@ {activeScenario.confidencePct}% confidence):
                    </span>
                    <span className="font-mono font-bold text-[#D97706]">
                      {currency} {Math.round(baseMetrics.riskAdjustedNetBenefit).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#111113]/10">
                    <span className="font-bold text-[#111113]">
                      Break-Even Monthly Revenue Required:
                    </span>
                    <span className="font-mono font-bold text-[#111113]">
                      {baseMetrics.breakEvenMonthlyRevenue !== null
                        ? `${currency} ${Math.round(baseMetrics.breakEvenMonthlyRevenue).toLocaleString()}/mo`
                        : 'N/A'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#52525B] pt-1 font-mono">
                    Formula: Break-Even Rev/mo = (Monthly Cost + Upfront ÷ Horizon) ÷ Gross Margin %
                  </p>
                </div>

                {/* Live Health & Liquidity Guardrail */}
                {liquidityGuardrail && (
                  <div
                    className={`p-3.5 rounded border text-xs flex items-start gap-2.5 ${
                      liquidityGuardrail.tone === 'red'
                        ? 'bg-[#FEF2F2] border-[#FECACA]'
                        : liquidityGuardrail.tone === 'amber'
                        ? 'bg-[#FFFBEB] border-[#FDE68A]'
                        : 'bg-[#ECFDF5] border-[#A7F3D0]'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        liquidityGuardrail.tone === 'red'
                          ? 'text-[#B91C1C]'
                          : liquidityGuardrail.tone === 'amber'
                          ? 'text-[#D97706]'
                          : 'text-[#15803D]'
                      }`}
                    />
                    <div>
                      <strong className="block text-[#111113]">{liquidityGuardrail.title}</strong>
                      <span className="text-[#52525B]">{liquidityGuardrail.message}</span>
                    </div>
                  </div>
                )}

                {onOpenCoachWithPrompt && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenCoachWithPrompt(
                        `Stress-test this ROI scenario "${activeScenario.name}" (${activeScenario.category}${
                          activeScenario.linkedCrmLabel
                            ? `, Linked CRM: ${activeScenario.linkedCrmLabel}`
                            : ''
                        }) for ${profile?.name}:\n- Upfront Investment: ${currency} ${activeScenario.upfrontInvestment.toLocaleString()}\n- Monthly Operating Cost: ${currency} ${activeScenario.monthlyOperatingCost.toLocaleString()}\n- Expected Monthly Revenue: ${currency} ${activeScenario.expectedMonthlyRevenue.toLocaleString()} @ ${activeScenario.grossMarginPct}% Gross Margin\n- Projected ${activeScenario.monthsHorizon}-month Net Benefit: ${currency} ${Math.round(baseMetrics.horizonNetBenefit).toLocaleString()} (${baseMetrics.roiPct.toFixed(1)}% ROI, Payback: ${
                          baseMetrics.paybackMonths !== null
                            ? `${baseMetrics.paybackMonths.toFixed(1)} months`
                            : 'Never'
                        }, Break-Even Monthly Revenue: ${
                          baseMetrics.breakEvenMonthlyRevenue !== null
                            ? `${currency} ${Math.round(baseMetrics.breakEvenMonthlyRevenue).toLocaleString()}`
                            : 'N/A'
                        })\n- Confidence: ${activeScenario.confidencePct}% | Assumptions: ${activeScenario.assumptionsNote}\n\nCheck this against our Business Health and Cash Flow liquidity.`
                      )
                    }
                    className="w-full py-2.5 px-4 rounded bg-[#111113] hover:bg-[#27272A] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                  >
                    <Bot className="w-4 h-4 text-[#FBBF24]" />
                    <span>Stress-Test ROI &amp; Cash Impact in AI Coach</span>
                  </button>
                )}
              </div>
            </div>

            {/* Revenue & Margin Sensitivity Matrix */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#111113]">
                <Layers className="w-4 h-4 text-[#D97706]" />
                <span>Revenue &amp; Margin Sensitivity Scenarios</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs tabular-nums">
                {sensitivityCases.map((sc) => (
                  <div
                    key={sc.label}
                    className={`p-4 rounded border space-y-2 ${
                      sc.tone === 'green'
                        ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                        : sc.tone === 'amber'
                        ? 'bg-[#FFFBEB] border-[#FDE68A]'
                        : 'bg-[#F8F7F4] border-[#111113]/15'
                    }`}
                  >
                    <span className="font-bold text-[#111113] block">{sc.label}</span>
                    <div className="flex justify-between">
                      <span className="text-[#52525B]">Monthly Rev / GM:</span>
                      <span className="font-mono font-bold text-[#111113]">
                        {currency} {Math.round(sc.revenue).toLocaleString()} @ {sc.gm}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#52525B]">Monthly Net:</span>
                      <span className="font-mono font-bold text-[#111113]">
                        {currency} {Math.round(sc.metrics.monthlyNetContribution).toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#52525B]">{activeScenario.monthsHorizon}-Mo Net Benefit:</span>
                      <span
                        className={`font-mono font-bold ${
                          sc.metrics.horizonNetBenefit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {currency} {Math.round(sc.metrics.horizonNetBenefit).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#111113]/10">
                      <span className="text-[#52525B]">ROI / Payback:</span>
                      <span className="font-mono font-bold text-[#111113]">
                        {sc.metrics.roiPct.toFixed(1)}% ·{' '}
                        {sc.metrics.paybackMonths !== null
                          ? `${sc.metrics.paybackMonths.toFixed(1)} mo`
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded bg-[#F8F7F4] border border-dashed border-[#111113]/20 text-center space-y-3">
            <TrendingUp className="w-8 h-8 text-[#D97706] mx-auto" />
            <h4 className="font-bold text-[#111113] text-sm">
              No Custom ROI Scenarios Modeled Yet
            </h4>
            <p className="text-xs text-[#52525B] max-w-md mx-auto">
              Create a scenario above — or click &ldquo;Evaluate ROI for Opportunity&rdquo; directly inside CRM &amp; Clients — to model payback, break-even revenue, and sensitivity.
            </p>
            <button
              type="button"
              onClick={handleCreateScenario}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#111113] text-white text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>Create First ROI Scenario</span>
            </button>
          </div>
        )}
      </div>

      {/* =================================================== */}
      {/* SECTION 2: PRESERVED GROWTH DECISION REFERENCE MATRIX */}
      {/* =================================================== */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="bizpulse-label block">Capital Allocation Trade-Off Benchmarks</span>
          <h3 className="text-lg font-bold text-[#111113]">
            Option A vs. Option B vs. Option C Decision Matrix
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(['Option A', 'Option B', 'Option C'] as const).map((optId) => (
            <button
              key={optId}
              type="button"
              onClick={() => setSelectedOptionId(optId)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                selectedOptionId === optId
                  ? 'bg-[#D97706] text-white border border-[#D97706]'
                  : 'bg-white text-[#111113] border border-[#111113]/15 hover:border-[#D97706]'
              }`}
            >
              {optId}
            </button>
          ))}
        </div>
      </div>

      {!isDemo && (
        <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <span>
            Reference cards below illustrate how commercial coaching compares capital outlays ({currency} outlays vs. payback thresholds) when cash headroom is tight. Use the editable ROI Workbench above to model exact scenarios for <strong>{profile?.name}</strong>.
          </span>
        </div>
      )}

      {/* 3 Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROWTH_OPTIONS_EVALUATION.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => setSelectedOptionId(opt.id)}
              className={`p-5 rounded cursor-pointer transition-all border flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-[#D97706] shadow-md ring-1 ring-[#D97706]/30'
                  : 'bg-white border-[#111113]/12 hover:border-[#111113]/30'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-[#111113] text-[#FBBF24] font-mono">
                    {opt.id}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      opt.id === 'Option C'
                        ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                        : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                    }`}
                  >
                    {opt.id === 'Option C' ? 'Lower Risk First' : 'Defer Until Cash Safe'}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-[#111113] text-sm line-clamp-2">{opt.title}</h3>
                  <p className="text-xs text-[#52525B] mt-1 line-clamp-2">{opt.proposedAction}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#111113]/10 space-y-1.5 text-xs tabular-nums">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#52525B]">Upfront Cash:</span>
                  <span className="text-[#111113] font-mono font-bold">
                    {opt.id === 'Option A'
                      ? `${currency} 20,000`
                      : opt.id === 'Option B'
                      ? `${currency} 15k–20k setup`
                      : `${currency} 0`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#52525B]">Ongoing Outlay:</span>
                  <span className="text-[#111113] font-mono font-semibold">
                    {opt.id === 'Option A'
                      ? `${currency} 3k–6k/mo`
                      : opt.id === 'Option B'
                      ? `~${currency} 7,460/mo`
                      : 'Management Focus'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Option Detail */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded bg-[#111113] text-[#FBBF24] font-mono font-bold text-sm">
                {selectedOption.id}
              </span>
              <h3 className="text-xl font-bold text-[#111113]">{selectedOption.title}</h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1.5 max-w-3xl leading-relaxed">
              {selectedOption.proposedAction}
            </p>
          </div>

          <div className="text-xs font-mono bg-[#F8F7F4] px-4 py-2.5 rounded border border-[#111113]/15 shrink-0">
            <span className="text-[#52525B] block text-[10px] uppercase font-bold">
              Cash Commitment
            </span>
            <span className="text-[#111113] font-bold">{selectedOption.upfrontCashRequirement}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
            <h4 className="font-bold text-[#15803D] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle className="w-4 h-4" />
              What Must Be True
            </h4>
            <ul className="space-y-1.5 text-[#111113]">
              {selectedOption.whatMustBeTrue.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
            <h4 className="font-bold text-[#B45309] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              Assumptions to Verify First
            </h4>
            <ul className="space-y-1.5 text-[#111113]">
              {selectedOption.commercialAssumptionsToTest.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2">
            <h4 className="font-bold text-[#D97706] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              Timeframe to Positive Cash Return
            </h4>
            <p className="text-[#111113] leading-relaxed">{selectedOption.routeToRevenueAndCash}</p>
          </div>

          <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-2">
            <h4 className="font-bold text-[#B91C1C] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              Principal Commercial Risks
            </h4>
            <ul className="space-y-1.5 text-[#111113]">
              {selectedOption.principalRisks.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2.5 text-xs">
          <div className="flex items-center space-x-2 text-[#111113] font-bold text-sm">
            <Calculator className="w-4 h-4 text-[#D97706]" />
            <span>Break-Even Formula</span>
          </div>
          <div className="p-3 bg-white rounded font-mono text-[#111113] border border-[#111113]/15">
            {selectedOption.calculationFramework.formula}
          </div>
          <p className="text-[#52525B] leading-relaxed">
            {selectedOption.calculationFramework.explanation}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded space-y-1">
            <span className="font-bold text-[#15803D] uppercase tracking-wider block">
              Approval Conditions
            </span>
            <ul className="space-y-1 text-[#111113]">
              {selectedOption.approvalConditions.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
          <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded space-y-1">
            <span className="font-bold text-[#B45309] uppercase tracking-wider block">
              Deferral Conditions
            </span>
            <ul className="space-y-1 text-[#111113]">
              {selectedOption.deferralConditions.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
          <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded space-y-1">
            <span className="font-bold text-[#B91C1C] uppercase tracking-wider block">
              Rejection Conditions
            </span>
            <ul className="space-y-1 text-[#111113]">
              {selectedOption.rejectionConditions.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
