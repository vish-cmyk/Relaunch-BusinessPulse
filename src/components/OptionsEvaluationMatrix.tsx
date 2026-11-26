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
  Loader2,
  Sparkles,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { GROWTH_OPTIONS_EVALUATION } from '../data/coachingBriefing';
import { CaseRecord, RoiScenario, RoiCategory, AccountUsageSummary } from '../types/bizpulse';
import { computeRoiMetrics, computeRoiScenarioMetrics } from '../services/roiEngine';
import { InfoTooltip } from './InfoTooltip';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';

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
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
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

type NumericRoiField =
  | 'upfrontInvestment'
  | 'monthlyOperatingCost'
  | 'expectedMonthlyRevenue'
  | 'grossMarginPct'
  | 'monthsHorizon'
  | 'confidencePct';

function formatRoiPctLabel(roiPct: number | null, hasSufficientData: boolean): string {
  if (!hasSufficientData) return 'Insufficient Data';
  if (roiPct === null) return 'Zero-Cost Gain';
  return `${roiPct.toFixed(1)}%`;
}

function formatPaybackLabel(paybackMonths: number | null, hasSufficientData: boolean): string {
  if (!hasSufficientData) return 'Insufficient Data';
  if (paybackMonths === null) return 'Never';
  return `${paybackMonths.toFixed(1)} mo`;
}

export const OptionsEvaluationMatrix: React.FC<OptionsEvaluationMatrixProps> = ({
  caseRecord,
  onUpdateRoiScenarios,
  pendingRoiDraft,
  onClearPendingRoiDraft,
  onAccountUsageUpdate,
  onOpenCoachWithPrompt,
}) => {
  const isDemo = caseRecord?.profile?.isDemonstrationCase ?? false;
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

  // Convert CRM draft passed from CRM tab into a pre-filled persisted ROI scenario without fabricating placeholder amounts
  useEffect(() => {
    if (!pendingRoiDraft || !onUpdateRoiScenarios) return;

    const existing = roiScenarios.find((s) => s.linkedCrmId === pendingRoiDraft.linkedCrmId);
    if (existing) {
      setSelectedScenarioId(existing.id);
      onClearPendingRoiDraft?.();
      return;
    }

    const now = new Date().toISOString();
    const isZeroValueDraft =
      pendingRoiDraft.monthlyValue === 0 && pendingRoiDraft.opportunityValue === 0;
    const estMonthlyRev =
      pendingRoiDraft.monthlyValue > 0
        ? pendingRoiDraft.monthlyValue
        : pendingRoiDraft.opportunityValue > 0
        ? Math.round(pendingRoiDraft.opportunityValue / 12)
        : 0;

    const draftPrefix = isZeroValueDraft
      ? '[Needs owner figures — enter actual upfront investment, expected monthly revenue, operating cost, and gross margin % to verify payback] '
      : '[Seeded from CRM revenue — enter actual upfront investment, monthly operating cost, and gross margin % to verify payback] ';

    const newScenario: RoiScenario = {
      id: `roi-${Date.now()}`,
      name: `Opportunity ROI: ${pendingRoiDraft.linkedCrmLabel}`,
      category: isZeroValueDraft ? 'Pricing & Margin' : 'Client Retention',
      linkedCrmId: pendingRoiDraft.linkedCrmId,
      linkedCrmLabel: pendingRoiDraft.linkedCrmLabel,
      upfrontInvestment: 0,
      monthlyOperatingCost: 0,
      expectedMonthlyRevenue: estMonthlyRev,
      grossMarginPct: 50,
      monthsHorizon: 12,
      confidencePct: isZeroValueDraft ? 50 : 65,
      dataOrigin: 'draft_estimate',
      assumptionsNote:
        draftPrefix +
        (pendingRoiDraft.notes ||
          `Linked to ${pendingRoiDraft.linkedCrmLabel}. Enter actual setup cost, monthly delivery cost, and gross margin % before relying on ROI.`),
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

  const [numDrafts, setNumDrafts] = useState<Record<NumericRoiField, string>>({
    upfrontInvestment: '0',
    monthlyOperatingCost: '0',
    expectedMonthlyRevenue: '0',
    grossMarginPct: '50',
    monthsHorizon: '12',
    confidencePct: '70',
  });

  const [aiAnalysis, setAiAnalysis] = useState<{
    reply: string;
    estimatesAndAssumptions: string[];
  } | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (activeScenario) {
      setNumDrafts({
        upfrontInvestment: String(activeScenario.upfrontInvestment ?? 0),
        monthlyOperatingCost: String(activeScenario.monthlyOperatingCost ?? 0),
        expectedMonthlyRevenue: String(activeScenario.expectedMonthlyRevenue ?? 0),
        grossMarginPct: String(activeScenario.grossMarginPct ?? 50),
        monthsHorizon: String(activeScenario.monthsHorizon ?? 12),
        confidencePct: String(activeScenario.confidencePct ?? 70),
      });
    }
    setAiAnalysis(null);
    setAiError(null);
  }, [activeScenario?.id]);

  const handleCreateScenario = () => {
    const now = new Date().toISOString();
    const created: RoiScenario = {
      id: `roi-${Date.now()}`,
      name: `New Opportunity Scenario #${roiScenarios.length + 1}`,
      category: 'Sales & Marketing',
      upfrontInvestment: 0,
      monthlyOperatingCost: 0,
      expectedMonthlyRevenue: 0,
      grossMarginPct: 50,
      monthsHorizon: 12,
      confidencePct: 70,
      dataOrigin: 'user_entered',
      assumptionsNote:
        'Enter explicit upfront setup cost, monthly operating cost, expected monthly revenue, and gross margin % here.',
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

  const handleNumericChange = (
    field: NumericRoiField,
    raw: string,
    min: number,
    max: number
  ) => {
    setNumDrafts((prev) => ({ ...prev, [field]: raw }));
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(min, Math.min(max, parsed));
    updateActiveField({
      [field]: clamped,
      dataOrigin: 'user_entered',
    } as Partial<RoiScenario>);
  };

  const handleNumericBlur = (
    field: NumericRoiField,
    min: number,
    max: number,
    fallback: number
  ) => {
    const raw = numDrafts[field].trim();
    const parsed = raw === '' ? NaN : Number(raw);
    const normalized = Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, parsed))
      : fallback;
    setNumDrafts((prev) => ({ ...prev, [field]: String(normalized) }));
    updateActiveField({
      [field]: normalized,
      dataOrigin: 'user_entered',
    } as Partial<RoiScenario>);
  };

  const baseMetrics = useMemo(() => {
    if (!activeScenario) return null;
    return computeRoiScenarioMetrics(activeScenario);
  }, [activeScenario]);

  const handleRunAiScenarioCheck = async () => {
    if (!activeScenario || !baseMetrics || !caseRecord || isAnalyzingAi) return;
    setIsAnalyzingAi(true);
    setAiError(null);

    try {
      const prompt = `Critique this ROI & Options scenario for ${profile?.name || 'this business'} (${currency}) and flag execution, cash-flow, margin, or capacity risks:\n- Scenario: "${activeScenario.name}" (${activeScenario.category}, Origin: ${activeScenario.dataOrigin === 'draft_estimate' ? 'Draft/CRM Seed' : 'Owner Entered'})\n- Upfront Investment: ${currency} ${activeScenario.upfrontInvestment.toLocaleString()}\n- Monthly Operating Cost: ${currency} ${activeScenario.monthlyOperatingCost.toLocaleString()}/mo\n- Expected Monthly Revenue: ${currency} ${activeScenario.expectedMonthlyRevenue.toLocaleString()}/mo @ ${activeScenario.grossMarginPct}% Gross Margin\n- Horizon: ${activeScenario.monthsHorizon} months | Confidence: ${activeScenario.confidencePct}%\n- Calculated Net Benefit: ${currency} ${Math.round(baseMetrics.horizonNetBenefit).toLocaleString()} | ROI: ${formatRoiPctLabel(baseMetrics.roiPct, baseMetrics.hasSufficientData)} | Payback: ${formatPaybackLabel(baseMetrics.paybackMonths, baseMetrics.hasSufficientData)} | Break-Even Revenue: ${baseMetrics.breakEvenMonthlyRevenue !== null ? `${currency} ${Math.round(baseMetrics.breakEvenMonthlyRevenue).toLocaleString()}/mo` : 'Insufficient Data'}\n- Assumptions: ${activeScenario.assumptionsNote}\n\nGive a sharp commercial verdict (Approve / Stage / Defer), stress-test the assumptions against our Business Health & Cash Flow headroom, and list 2–3 key verification checks.`;

      const { data } = await apiFetchWithAuth<{
        reply?: string;
        estimatesAndAssumptions?: string[];
        accountUsage?: AccountUsageSummary;
      }>('/api/coach/query', {
        method: 'POST',
        body: {
          caseId: caseRecord.id,
          prompt,
          conversationHistory: [],
          topic: 'ROI & Investments',
          userRole: 'Owner / Managing Director',
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
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      setAiAnalysis({
        reply: data.reply || 'No AI interpretation was returned.',
        estimatesAndAssumptions: Array.isArray(data.estimatesAndAssumptions)
          ? data.estimatesAndAssumptions
          : [],
      });
    } catch (err: any) {
      console.error('ROI AI risk check failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setAiError(err?.message || 'Unable to run AI scenario interpretation right now.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

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
      {/* Architectural Navy Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#60A5FA]">
                ROI Calculator, Break-Even &amp; Trade-Off Analysis
              </span>
              <span className="text-xs text-[#94A3B8] font-medium">
                {profile?.name || 'Active Business'} ({currency})
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              ROI, Margin Scenarios &amp; Growth Decision Matrix
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              Model investment payback, break-even monthly revenue, and Conservative/Base/Optimistic sensitivity with transparent, editable assumptions linked directly to your CRM opportunities and cash headroom.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateScenario}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New ROI Scenario</span>
          </button>
        </div>
      </div>

      {/* =================================================== */}
      {/* SECTION 1: INTERACTIVE EDITABLE ROI & BREAK-EVEN    */}
      {/* =================================================== */}
      <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#0F172A]/10">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-lg font-bold text-[#0F172A]">
                Editable ROI &amp; Break-Even Scenario Workbench
              </h3>
            </div>
            <p className="text-xs text-[#475569] mt-1">
              Every assumption is transparent and editable. Evaluate CRM pipeline deals, hiring, marketing retainers, or pricing changes.
            </p>
          </div>

          {roiScenarios.length > 0 && activeScenario && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDuplicateScenario(activeScenario)}
                className="px-3 py-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15 hover:border-[#2563EB] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1"
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
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-[#F8FAFC] text-[#0F172A] border-[#0F172A]/15 hover:border-[#2563EB]'
                  }`}
                >
                  <span>{sc.name}</span>
                  {sc.linkedCrmLabel && (
                    <span
                      className={`ml-1.5 text-[10px] font-mono ${
                        isSelected ? 'text-[#60A5FA]' : 'text-[#2563EB]'
                      }`}
                    >
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
            {(activeScenario.dataOrigin === 'draft_estimate' ||
              activeScenario.assumptionsNote?.includes('[Illustrative draft inputs') ||
              activeScenario.assumptionsNote?.includes('[Needs owner figures') ||
              !baseMetrics.hasSufficientData) && (
              <div className="p-3.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1E3A8A] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                <span>
                  {!baseMetrics.hasSufficientData ? (
                    <>
                      <strong>Insufficient Data for ROI Calculation:</strong> Enter at least one cost or revenue figure alongside a Gross Margin % above 0% below to calculate ROI, Payback, and Break-Even Monthly Revenue.
                    </>
                  ) : (
                    <>
                      <strong>Draft / CRM Seeded Scenario:</strong> Confirm or update the upfront investment, monthly operating cost, expected monthly revenue, and gross margin % below with actual quotes before making capital decisions.
                    </>
                  )}
                </span>
              </div>
            )}
            {/* Editable Inputs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold uppercase tracking-wider text-[#0F172A] block">
                    Editable Opportunity Assumptions
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      activeScenario.dataOrigin === 'draft_estimate'
                        ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                        : 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                    }`}
                  >
                    {activeScenario.dataOrigin === 'draft_estimate' ? 'Draft / CRM Seed' : 'Owner Entered'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-[#0F172A] block mb-1">Scenario Name</label>
                    <input
                      type="text"
                      value={activeScenario.name}
                      onChange={(e) => updateActiveField({ name: e.target.value })}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-semibold text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] block mb-1">Category</label>
                    <select
                      value={activeScenario.category}
                      onChange={(e) =>
                        updateActiveField({ category: e.target.value as RoiCategory })
                      }
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A]"
                    >
                      {ROI_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] block mb-1 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-[#2563EB]" /> Link to CRM Opportunity
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
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A]"
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
                    <label className="font-semibold text-[#0F172A] flex items-center gap-1 mb-1">
                      <span>Upfront Investment ({currency})</span>
                      <InfoTooltip
                        title="Upfront Investment"
                        whatItMeans="Total one-time cash outlay required to launch this initiative (equipment, setup, onboarding, deposit, or initial campaign)."
                        whyItMatters="Directly drains cash headroom on Day 1 and sets the hurdle your monthly contribution must pay back."
                      />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={numDrafts.upfrontInvestment}
                      onChange={(e) => handleNumericChange('upfrontInvestment', e.target.value, 0, 100000000)}
                      onBlur={() => handleNumericBlur('upfrontInvestment', 0, 100000000, 0)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-mono font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] flex items-center gap-1 mb-1">
                      <span>Monthly Operating Cost ({currency}/mo)</span>
                      <InfoTooltip
                        title="Monthly Operating Cost"
                        whatItMeans="Ongoing fixed or incremental monthly cash cost required to run this option (wages, retainers, software, or extra overhead)."
                        whyItMatters="Subtracted every month from Gross Profit before any payback occurs."
                      />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={numDrafts.monthlyOperatingCost}
                      onChange={(e) => handleNumericChange('monthlyOperatingCost', e.target.value, 0, 100000000)}
                      onBlur={() => handleNumericBlur('monthlyOperatingCost', 0, 100000000, 0)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-mono font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] flex items-center gap-1 mb-1">
                      <span>Expected Monthly Revenue ({currency}/mo)</span>
                      <InfoTooltip
                        title="Expected Monthly Revenue"
                        whatItMeans="Realistic incremental monthly sales generated once the option is running (or saved cost translated to top-line equivalent)."
                        whyItMatters="Multiplied by Gross Margin %—not full revenue—to determine real cash contribution."
                      />
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={numDrafts.expectedMonthlyRevenue}
                      onChange={(e) => handleNumericChange('expectedMonthlyRevenue', e.target.value, 0, 100000000)}
                      onBlur={() => handleNumericBlur('expectedMonthlyRevenue', 0, 100000000, 0)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-mono font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] flex items-center gap-1 mb-1">
                      <span>Gross Margin (%)</span>
                      <InfoTooltip
                        title="Gross Margin %"
                        whatItMeans="Share of each new revenue dollar remaining after direct materials, freight, and direct labour/subcontractors."
                        whyItMatters="Using top-line revenue instead of gross margin overstates payback speed on low-margin trades or retail work."
                      />
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={numDrafts.grossMarginPct}
                      onChange={(e) => handleNumericChange('grossMarginPct', e.target.value, 0, 100)}
                      onBlur={() => handleNumericBlur('grossMarginPct', 0, 100, 50)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-mono font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] flex items-center gap-1 mb-1">
                      <span>Evaluation Horizon (Months)</span>
                      <InfoTooltip
                        title="Evaluation Horizon"
                        whatItMeans="Number of months over which you test total cash outlay, net benefit, and amortized upfront break-even."
                        whyItMatters="Shorter horizons (6–12 mo) enforce tighter cash discipline for constrained SMEs."
                      />
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={numDrafts.monthsHorizon}
                      onChange={(e) => handleNumericChange('monthsHorizon', e.target.value, 1, 60)}
                      onBlur={() => handleNumericBlur('monthsHorizon', 1, 60, 12)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-mono font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#0F172A] flex items-center gap-1 mb-1">
                      <span>Execution Confidence (%)</span>
                      <InfoTooltip
                        title="Execution Confidence %"
                        whatItMeans="Your realistic probability of hitting the revenue and cost targets on schedule without delay."
                        whyItMatters="Discounts the Net Horizon Benefit into a Risk-Adjusted figure so optimistic forecasts don't hide downside."
                      />
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      value={numDrafts.confidencePct}
                      onChange={(e) => handleNumericChange('confidencePct', e.target.value, 5, 100)}
                      onBlur={() => handleNumericBlur('confidencePct', 5, 100, 50)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 font-mono font-bold text-[#0F172A] tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">
                    Transparent Assumptions &amp; Evidence Note
                  </label>
                  <textarea
                    rows={2}
                    value={activeScenario.assumptionsNote}
                    onChange={(e) => updateActiveField({ assumptionsNote: e.target.value })}
                    className="w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A]"
                  />
                </div>
              </div>

              {/* Calculated ROI & Break-Even Output Card */}
              <div className="lg:col-span-6 space-y-4 tabular-nums">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`p-4 rounded border ${
                      !baseMetrics.hasSufficientData
                        ? 'bg-[#F8FAFC] border-[#0F172A]/15'
                        : baseMetrics.roiPct === null || baseMetrics.roiPct >= 25
                        ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                        : baseMetrics.roiPct >= 0
                        ? 'bg-[#FFFBEB] border-[#FDE68A]'
                        : 'bg-[#FEF2F2] border-[#FECACA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
                        Projected {activeScenario.monthsHorizon}-Month ROI
                      </span>
                      <InfoTooltip
                        title="Projected ROI %"
                        whatItMeans="Net Horizon Benefit divided by Total Cash Outlay over the evaluation period."
                        actionOrCalculation="(Monthly Net Contribution × Horizon − Upfront) ÷ (Upfront + Monthly Cost × Horizon)"
                        align="right"
                      />
                    </div>
                    <div
                      className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${
                        !baseMetrics.hasSufficientData
                          ? 'text-[#475569]'
                          : baseMetrics.roiPct === null || baseMetrics.roiPct >= 25
                          ? 'text-[#15803D]'
                          : baseMetrics.roiPct >= 0
                          ? 'text-[#B45309]'
                          : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatRoiPctLabel(baseMetrics.roiPct, baseMetrics.hasSufficientData)}
                    </div>
                  </div>

                  <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
                        Payback Period
                      </span>
                      <InfoTooltip
                        title="Payback Period"
                        whatItMeans="Estimated months of positive Monthly Net Contribution required to recover the Upfront Investment."
                        actionOrCalculation="Upfront Investment ÷ Monthly Net Contribution (shows 'Never' if monthly contribution ≤ 0)."
                        align="right"
                      />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-[#0F172A] mt-1">
                      {formatPaybackLabel(baseMetrics.paybackMonths, baseMetrics.hasSufficientData)}
                    </div>
                  </div>
                </div>

                {/* Transparent Breakdown Table */}
                <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2.5 text-xs">
                  <span className="font-mono font-bold uppercase tracking-wider text-[#0F172A] block border-b border-[#0F172A]/10 pb-2">
                    Transparent Calculation Breakdown
                  </span>
                  <div className="flex justify-between">
                    <span className="text-[#475569]">
                      Monthly Gross Profit ({currency} {activeScenario.expectedMonthlyRevenue.toLocaleString()} × {activeScenario.grossMarginPct}%):
                    </span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      {currency} {Math.round(baseMetrics.monthlyGrossProfit).toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#475569]">
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
                    <span className="text-[#475569]">
                      Total Cash Outlay ({activeScenario.monthsHorizon} mo):
                    </span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      {currency} {Math.round(baseMetrics.totalHorizonCost).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#0F172A]/10">
                    <span className="font-bold text-[#0F172A]">
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
                    <span className="text-[#475569]">
                      Risk-Adjusted Net Benefit (@ {activeScenario.confidencePct}% confidence):
                    </span>
                    <span className="font-mono font-bold text-[#2563EB]">
                      {currency} {Math.round(baseMetrics.riskAdjustedNetBenefit).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#0F172A]/10">
                    <span className="font-bold text-[#0F172A] flex items-center gap-1">
                      <span>Break-Even Monthly Revenue Required:</span>
                      <InfoTooltip
                        title="Break-Even Monthly Revenue"
                        whatItMeans="Minimum monthly sales required at your Gross Margin % so monthly contribution covers both Monthly Operating Cost and amortized Upfront Investment."
                        actionOrCalculation="(Monthly Operating Cost + Upfront ÷ Horizon) ÷ Gross Margin Rate"
                      />
                    </span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      {baseMetrics.breakEvenMonthlyRevenue !== null
                        ? `${currency} ${Math.round(baseMetrics.breakEvenMonthlyRevenue).toLocaleString()}/mo`
                        : 'Insufficient Data'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] pt-1 font-mono">
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
                      <strong className="block text-[#0F172A]">{liquidityGuardrail.title}</strong>
                      <span className="text-[#475569]">{liquidityGuardrail.message}</span>
                    </div>
                  </div>
                )}

                {/* Action buttons: Inline AI Risk Check + Full Coach Thread */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleRunAiScenarioCheck}
                    disabled={isAnalyzingAi || !baseMetrics.hasSufficientData}
                    className="py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition"
                  >
                    {isAnalyzingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Running AI Risk Check...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>AI Interpretation &amp; Risk Check</span>
                      </>
                    )}
                  </button>

                  {onOpenCoachWithPrompt && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenCoachWithPrompt(
                          `Stress-test this ROI scenario "${activeScenario.name}" (${activeScenario.category}${
                            activeScenario.linkedCrmLabel
                              ? `, Linked CRM: ${activeScenario.linkedCrmLabel}`
                              : ''
                          }) for ${profile?.name}:\n- Upfront Investment: ${currency} ${activeScenario.upfrontInvestment.toLocaleString()}\n- Monthly Operating Cost: ${currency} ${activeScenario.monthlyOperatingCost.toLocaleString()}\n- Expected Monthly Revenue: ${currency} ${activeScenario.expectedMonthlyRevenue.toLocaleString()} @ ${activeScenario.grossMarginPct}% Gross Margin\n- Projected ${activeScenario.monthsHorizon}-month Net Benefit: ${currency} ${Math.round(baseMetrics.horizonNetBenefit).toLocaleString()} (${formatRoiPctLabel(baseMetrics.roiPct, baseMetrics.hasSufficientData)} ROI, Payback: ${formatPaybackLabel(baseMetrics.paybackMonths, baseMetrics.hasSufficientData)}, Break-Even Monthly Revenue: ${
                            baseMetrics.breakEvenMonthlyRevenue !== null
                              ? `${currency} ${Math.round(baseMetrics.breakEvenMonthlyRevenue).toLocaleString()}`
                              : 'Insufficient Data'
                          })\n- Confidence: ${activeScenario.confidencePct}% | Assumptions: ${activeScenario.assumptionsNote}\n\nCheck this against our Business Health and Cash Flow liquidity.`
                        )
                      }
                      className="py-2.5 px-4 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition"
                    >
                      <Bot className="w-4 h-4 text-[#60A5FA]" />
                      <span>Open in Chat with Coach</span>
                    </button>
                  )}
                </div>

                {/* Inline AI Scenario Risk Check Result / Error */}
                {aiError && (
                  <div className="p-3.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{aiError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAiScenarioCheck}
                      disabled={isAnalyzingAi}
                      className="px-2.5 py-1 rounded bg-[#B91C1C] text-white font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                )}

                {aiAnalysis && (
                  <div className="p-4 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold uppercase tracking-wider text-[#1D4ED8] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Scenario Interpretation &amp; Risk Verdict
                      </span>
                      <button
                        type="button"
                        onClick={() => setAiAnalysis(null)}
                        className="text-[11px] font-semibold text-[#475569] hover:text-[#0F172A]"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-[#0F172A] whitespace-pre-wrap leading-relaxed">
                      {aiAnalysis.reply}
                    </p>
                    {aiAnalysis.estimatesAndAssumptions.length > 0 && (
                      <div className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
                        <span className="font-bold text-[#B45309] uppercase tracking-wider text-[10px] block">
                          Assumptions &amp; Verification Checks
                        </span>
                        <ul className="space-y-1 text-[#0F172A]">
                          {aiAnalysis.estimatesAndAssumptions.map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue & Margin Sensitivity Matrix */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                <Layers className="w-4 h-4 text-[#2563EB]" />
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
                        : 'bg-[#F8FAFC] border-[#0F172A]/15'
                    }`}
                  >
                    <span className="font-bold text-[#0F172A] block">{sc.label}</span>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Monthly Rev / GM:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {currency} {Math.round(sc.revenue).toLocaleString()} @ {sc.gm}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Monthly Net:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {currency} {Math.round(sc.metrics.monthlyNetContribution).toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">{activeScenario.monthsHorizon}-Mo Net Benefit:</span>
                      <span
                        className={`font-mono font-bold ${
                          sc.metrics.horizonNetBenefit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {currency} {Math.round(sc.metrics.horizonNetBenefit).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#0F172A]/10">
                      <span className="text-[#475569]">ROI / Payback:</span>
                      <span className="font-mono font-bold text-[#0F172A]">
                        {formatRoiPctLabel(sc.metrics.roiPct, sc.metrics.hasSufficientData)} ·{' '}
                        {formatPaybackLabel(sc.metrics.paybackMonths, sc.metrics.hasSufficientData)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Side-by-Side Comparison Matrix of All Saved ROI Scenarios */}
            {roiScenarios.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                    <span>Side-by-Side Scenario Comparison Matrix ({roiScenarios.length})</span>
                  </div>
                  <span className="text-[11px] text-[#475569]">Click any row to edit</span>
                </div>
                <div className="overflow-x-auto border border-[#0F172A]/12 rounded">
                  <table className="w-full text-xs text-left border-collapse tabular-nums">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#0F172A]/12 text-[10px] font-mono uppercase tracking-wider text-[#475569]">
                        <th className="py-2.5 px-3">Scenario &amp; Basis</th>
                        <th className="py-2.5 px-3">Upfront</th>
                        <th className="py-2.5 px-3">Monthly Rev</th>
                        <th className="py-2.5 px-3">Net Benefit</th>
                        <th className="py-2.5 px-3">ROI %</th>
                        <th className="py-2.5 px-3">Payback</th>
                        <th className="py-2.5 px-3">Break-Even Rev/mo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0F172A]/10">
                      {roiScenarios.map((sc) => {
                        const m = computeRoiScenarioMetrics(sc);
                        const isSelected = sc.id === activeScenario.id;
                        return (
                          <tr
                            key={sc.id}
                            onClick={() => setSelectedScenarioId(sc.id)}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#0F172A]">{sc.name}</div>
                              <div className="text-[10px] text-[#475569]">
                                {sc.category} ·{' '}
                                {sc.dataOrigin === 'draft_estimate' ? 'Draft / CRM Seed' : 'Owner Figures'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {currency} {sc.upfrontInvestment.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {currency} {sc.expectedMonthlyRevenue.toLocaleString()}
                            </td>
                            <td
                              className={`py-2.5 px-3 font-mono font-bold ${
                                !m.hasSufficientData
                                  ? 'text-[#475569]'
                                  : m.horizonNetBenefit >= 0
                                  ? 'text-[#15803D]'
                                  : 'text-[#B91C1C]'
                              }`}
                            >
                              {!m.hasSufficientData
                                ? 'Insufficient Data'
                                : `${m.horizonNetBenefit >= 0 ? '+' : '-'}${currency} ${Math.round(
                                    Math.abs(m.horizonNetBenefit)
                                  ).toLocaleString()}`}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {formatRoiPctLabel(m.roiPct, m.hasSufficientData)}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {formatPaybackLabel(m.paybackMonths, m.hasSufficientData)}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {m.breakEvenMonthlyRevenue !== null
                                ? `${currency} ${Math.round(m.breakEvenMonthlyRevenue).toLocaleString()}`
                                : 'Insufficient Data'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ROI Methodology & Limitations Card */}
            <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#0F172A] uppercase tracking-wider text-[11px]">
                <BookOpen className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>ROI Methodology &amp; Commercial Limitations</span>
              </div>
              <p className="text-[#475569] leading-relaxed">
                <strong>Formulas used:</strong> Monthly Gross Profit = Expected Monthly Revenue × Gross Margin %. Monthly Net Contribution = Monthly Gross Profit − Monthly Operating Cost. Payback = Upfront Investment ÷ Monthly Net Contribution. Break-Even Monthly Revenue = (Monthly Cost + Upfront ÷ Horizon) ÷ Gross Margin %.
              </p>
              <p className="text-[#475569] leading-relaxed">
                <strong>Limitations:</strong> Projections are pre-tax cash estimates assuming steady monthly ramp and immediate debtor collection. Always compare 90-day cash outlay against your Cash Flow headroom and tax/GST obligations before committing capital.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded bg-[#F8FAFC] border border-dashed border-[#0F172A]/20 text-center space-y-3">
            <TrendingUp className="w-8 h-8 text-[#2563EB] mx-auto" />
            <h4 className="font-bold text-[#0F172A] text-sm">
              No Custom ROI Scenarios Modeled Yet
            </h4>
            <p className="text-xs text-[#475569] max-w-md mx-auto">
              Create a scenario above — or click &ldquo;Evaluate ROI for Opportunity&rdquo; directly inside CRM &amp; Clients — to model payback, break-even revenue, and sensitivity.
            </p>
            <button
              type="button"
              onClick={handleCreateScenario}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#0F172A] text-white text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Create First ROI Scenario</span>
            </button>
          </div>
        )}
      </div>

      {/* =================================================== */}
      {/* SECTION 2: BENCHMARK MATRIX (DEMO) OR CAPITAL GATES */}
      {/* =================================================== */}
      {isDemo ? (
        <>
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="bizpulse-label block">Capital Allocation Trade-Off Benchmarks</span>
              <h3 className="text-lg font-bold text-[#0F172A]">
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
                      ? 'bg-[#2563EB] text-white border border-[#2563EB]'
                      : 'bg-white text-[#0F172A] border border-[#0F172A]/15 hover:border-[#2563EB]'
                  }`}
                >
                  {optId}
                </button>
              ))}
            </div>
          </div>

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
                      ? 'bg-white border-[#2563EB] shadow-md ring-1 ring-[#2563EB]/30'
                      : 'bg-white border-[#0F172A]/12 hover:border-[#0F172A]/30'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-[#0F172A] text-[#60A5FA] font-mono">
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
                      <h3 className="font-bold text-[#0F172A] text-sm line-clamp-2">{opt.title}</h3>
                      <p className="text-xs text-[#475569] mt-1 line-clamp-2">{opt.proposedAction}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#0F172A]/10 space-y-1.5 text-xs tabular-nums">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#475569]">Upfront Cash:</span>
                      <span className="text-[#0F172A] font-mono font-bold">
                        {opt.id === 'Option A'
                          ? `${currency} 20,000`
                          : opt.id === 'Option B'
                          ? `${currency} 15k–20k setup`
                          : `${currency} 0`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#475569]">Ongoing Outlay:</span>
                      <span className="text-[#0F172A] font-mono font-semibold">
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
          <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#0F172A]/10">
              <div>
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 rounded bg-[#0F172A] text-[#60A5FA] font-mono font-bold text-sm">
                    {selectedOption.id}
                  </span>
                  <h3 className="text-xl font-bold text-[#0F172A]">{selectedOption.title}</h3>
                </div>
                <p className="text-xs text-[#475569] mt-1.5 max-w-3xl leading-relaxed">
                  {selectedOption.proposedAction}
                </p>
              </div>

              <div className="text-xs font-mono bg-[#F8FAFC] px-4 py-2.5 rounded border border-[#0F172A]/15 shrink-0">
                <span className="text-[#475569] block text-[10px] uppercase font-bold">
                  Cash Commitment
                </span>
                <span className="text-[#0F172A] font-bold">{selectedOption.upfrontCashRequirement}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <h4 className="font-bold text-[#15803D] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  What Must Be True
                </h4>
                <ul className="space-y-1.5 text-[#0F172A]">
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
                <ul className="space-y-1.5 text-[#0F172A]">
                  {selectedOption.commercialAssumptionsToTest.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
                <h4 className="font-bold text-[#2563EB] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  Timeframe to Positive Cash Return
                </h4>
                <p className="text-[#0F172A] leading-relaxed">{selectedOption.routeToRevenueAndCash}</p>
              </div>

              <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-2">
                <h4 className="font-bold text-[#B91C1C] text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  Principal Commercial Risks
                </h4>
                <ul className="space-y-1.5 text-[#0F172A]">
                  {selectedOption.principalRisks.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2.5 text-xs">
              <div className="flex items-center space-x-2 text-[#0F172A] font-bold text-sm">
                <Calculator className="w-4 h-4 text-[#2563EB]" />
                <span>Break-Even Formula</span>
              </div>
              <div className="p-3 bg-white rounded font-mono text-[#0F172A] border border-[#0F172A]/15">
                {selectedOption.calculationFramework.formula}
              </div>
              <p className="text-[#475569] leading-relaxed">
                {selectedOption.calculationFramework.explanation}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded space-y-1">
                <span className="font-bold text-[#15803D] uppercase tracking-wider block">
                  Approval Conditions
                </span>
                <ul className="space-y-1 text-[#0F172A]">
                  {selectedOption.approvalConditions.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded space-y-1">
                <span className="font-bold text-[#B45309] uppercase tracking-wider block">
                  Deferral Conditions
                </span>
                <ul className="space-y-1 text-[#0F172A]">
                  {selectedOption.deferralConditions.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded space-y-1">
                <span className="font-bold text-[#B91C1C] uppercase tracking-wider block">
                  Rejection Conditions
                </span>
                <ul className="space-y-1 text-[#0F172A]">
                  {selectedOption.rejectionConditions.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#0F172A]/10">
            <div>
              <span className="bizpulse-label block">Capital Allocation Discipline</span>
              <h3 className="text-lg font-bold text-[#0F172A]">
                Decision Gates Before Committing Cash ({profile?.name || 'Your Business'})
              </h3>
            </div>
            {onOpenCoachWithPrompt && (
              <button
                type="button"
                onClick={() =>
                  onOpenCoachWithPrompt(
                    `Stress-test my ROI scenarios for ${profile?.name || 'this business'} against our current cash headroom, 12-capability health flags, and delivery capacity.`
                  )
                }
                className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition shrink-0"
              >
                <Bot className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Stress-Test ROI with Coach</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
              <h4 className="font-bold text-[#15803D] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                1. Cash Headroom Gate
              </h4>
              <p className="text-[#0F172A] leading-relaxed">
                Confirm upfront cash + 3 months of operating burn will not breach overdraft limits or delay GST, PAYE, and supplier commitments.
              </p>
            </div>
            <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
              <h4 className="font-bold text-[#B45309] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                2. Confidence-Adjusted Payback
              </h4>
              <p className="text-[#0F172A] leading-relaxed">
                Require realistic gross margin (not top-line revenue) to pay back upfront outlay inside your planning horizon even at 60–75% confidence.
              </p>
            </div>
            <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1.5">
              <h4 className="font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#2563EB]" />
                3. Operational Capacity Check
              </h4>
              <p className="text-[#475569] leading-relaxed">
                Prioritize zero-cash margin, pricing, and debtor recovery wins before taking on fixed headcount or long-lag marketing retainers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
