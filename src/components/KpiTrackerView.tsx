import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Gauge,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  AccountUsageSummary,
  CaseRecord,
  KpiBusinessTypePreset,
  KpiCategoryId,
  KpiDirection,
  KpiTrackerState,
  KpiTrendStatus,
  KpiUnitType,
  TrackedKpiRecord,
} from '../types/bizpulse';
import {
  getCatalogKpiByKey,
  KPI_BUSINESS_TYPE_PRESETS,
  KPI_CATALOG,
  KPI_CATEGORIES,
} from '../data/kpiCatalog';
import {
  buildDeterministicKpiInsight,
  buildTrackedKpiFromCatalog,
  computeKpiTrend,
  computeKpiVariance,
  createCustomTrackedKpi,
  evaluateKpiFormula,
  formatKpiNumber,
  initializeKpiTrackerForCase,
  syncKpiTrackerWithCaseData,
} from '../services/kpiEngine';
import { getAuthHeaders } from '../services/firebase';

interface KpiTrackerViewProps {
  caseRecord: CaseRecord;
  onUpdateKpiTracker?: (tracker: KpiTrackerState) => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
}

function getTrendBadgeClasses(trend: KpiTrendStatus): string {
  switch (trend) {
    case 'Improving':
      return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    case 'Declining':
      return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
    case 'Stable':
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    case 'Insufficient Data':
    default:
      return 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]';
  }
}

export const KpiTrackerView: React.FC<KpiTrackerViewProps> = ({
  caseRecord,
  onUpdateKpiTracker,
  onAccountUsageUpdate,
}) => {
  const trackerState: KpiTrackerState = useMemo(() => {
    if (caseRecord.kpiTracker && Array.isArray(caseRecord.kpiTracker.kpis) && caseRecord.kpiTracker.kpis.length > 0) {
      return caseRecord.kpiTracker;
    }
    return initializeKpiTrackerForCase(caseRecord);
  }, [caseRecord]);

  const currency = caseRecord.profile.currency || 'NZD';

  const [categoryFilter, setCategoryFilter] = useState<'all' | KpiCategoryId>('all');
  const [trendFilter, setTrendFilter] = useState<'all' | KpiTrendStatus>('all');
  const [showKpiSelector, setShowKpiSelector] = useState<boolean>(false);
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Edit form draft state
  const [draftMode, setDraftMode] = useState<'formula' | 'direct'>('formula');
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});
  const [draftActual, setDraftActual] = useState<string>('');
  const [draftBaseline, setDraftBaseline] = useState<string>('');
  const [draftTarget, setDraftTarget] = useState<string>('');
  const [draftNextReviewDate, setDraftNextReviewDate] = useState<string>('');
  const [draftComment, setDraftComment] = useState<string>('');

  // Custom KPI creation state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<KpiCategoryId>('revenue_sales');
  const [customExplanation, setCustomExplanation] = useState('');
  const [customUnit, setCustomUnit] = useState<KpiUnitType>('number');
  const [customDirection, setCustomDirection] = useState<KpiDirection>('higher_is_better');
  const [customBaseline, setCustomBaseline] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  const [customActual, setCustomActual] = useState('');
  const [customReviewDate, setCustomReviewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [customComment, setCustomComment] = useState('');

  // AI feedback state
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  const commitTracker = (next: KpiTrackerState, msg?: string) => {
    onUpdateKpiTracker?.(next);
    if (msg) flashNotice(msg);
  };

  const handleSelectBusinessPreset = (preset: KpiBusinessTypePreset) => {
    const initialized = initializeKpiTrackerForCase(
      { ...caseRecord, kpiTracker: trackerState },
      preset
    );
    commitTracker(
      initialized,
      `Loaded curated KPI bundle for ${
        KPI_BUSINESS_TYPE_PRESETS.find((p) => p.id === preset)?.label || preset
      }.`
    );
  };

  const handleSyncFromCase = () => {
    const synced = syncKpiTrackerWithCaseData(trackerState, caseRecord);
    commitTracker(synced, 'Synced KPI baselines & actuals deterministically from your Financial Ledger, CRM, Health & ROI records.');
  };

  const handleToggleCatalogKpi = (catalogKey: string) => {
    const def = getCatalogKpiByKey(catalogKey);
    if (!def) return;

    const exists = trackerState.kpis.some((k) => k.catalogKey === catalogKey);
    let nextKpis: TrackedKpiRecord[];
    if (exists) {
      nextKpis = trackerState.kpis.filter((k) => k.catalogKey !== catalogKey);
    } else {
      nextKpis = [...trackerState.kpis, buildTrackedKpiFromCatalog(def, caseRecord)];
    }

    const nextIds = nextKpis.map((k) => k.catalogKey || k.id);
    const nextRecs = trackerState.recommendedAdditionalKpis.filter((r) => r.catalogKey !== catalogKey);

    commitTracker({
      ...trackerState,
      selectedKpiIds: nextIds,
      kpis: nextKpis,
      recommendedAdditionalKpis: nextRecs,
    });
  };

  const handleRemoveKpi = (kpiId: string) => {
    const nextKpis = trackerState.kpis.filter((k) => k.id !== kpiId);
    commitTracker({
      ...trackerState,
      selectedKpiIds: nextKpis.map((k) => k.catalogKey || k.id),
      kpis: nextKpis,
    });
  };

  const parseNullableNumber = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const openEditorForKpi = (kpi: TrackedKpiRecord) => {
    const catalogDef = kpi.catalogKey ? getCatalogKpiByKey(kpi.catalogKey) : undefined;
    const hasFormulaInputs = Boolean(
      catalogDef &&
        catalogDef.inputFields.length > 0 &&
        kpi.formulaType !== 'manual' &&
        kpi.formulaType !== 'manual_or_case'
    );
    setDraftMode(hasFormulaInputs ? 'formula' : 'direct');
    const strInputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(kpi.inputValues || {})) {
      strInputs[k] = v !== null && v !== undefined ? String(v) : '';
    }
    if (catalogDef) {
      for (const f of catalogDef.inputFields) {
        if (!(f.key in strInputs)) strInputs[f.key] = '';
      }
    }
    setDraftInputs(strInputs);
    setDraftActual(kpi.latestActualValue !== null && kpi.latestActualValue !== undefined ? String(kpi.latestActualValue) : '');
    setDraftBaseline(kpi.baselineValue !== null && kpi.baselineValue !== undefined ? String(kpi.baselineValue) : '');
    setDraftTarget(kpi.targetValue !== null && kpi.targetValue !== undefined ? String(kpi.targetValue) : '');
    setDraftNextReviewDate(kpi.nextReviewDate || '');
    setDraftComment(kpi.ownerComment || '');
    setEditingKpiId(kpi.id);
  };

  const handleSaveKpiEdit = (kpi: TrackedKpiRecord) => {
    const numericInputs: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(draftInputs)) {
      numericInputs[k] = parseNullableNumber(v);
    }

    const computedActual =
      draftMode === 'formula'
        ? evaluateKpiFormula(kpi.formulaType, numericInputs)
        : parseNullableNumber(draftActual);

    const nextBaseline = parseNullableNumber(draftBaseline);
    const nextTarget = parseNullableNumber(draftTarget);

    // Shift previous actual ONLY when a new distinct numeric actual is logged
    const nextPrevious =
      computedActual !== null &&
      kpi.latestActualValue !== null &&
      computedActual !== kpi.latestActualValue
        ? kpi.latestActualValue
        : kpi.previousValue;

    const now = new Date().toISOString();
    const updatedHistory = [...(kpi.history || [])];
    if (computedActual !== null) {
      updatedHistory.push({
        periodLabel: now.slice(0, 10),
        recordedAt: now,
        actualValue: computedActual,
        targetValue: nextTarget,
        comment: draftComment.trim() || undefined,
        inputs: numericInputs,
      });
    }

    const updatedKpi: TrackedKpiRecord = {
      ...kpi,
      inputValues: numericInputs,
      baselineValue: nextBaseline ?? computedActual,
      targetValue: nextTarget,
      previousValue: nextPrevious,
      latestActualValue: computedActual,
      nextReviewDate: draftNextReviewDate || kpi.nextReviewDate,
      ownerComment: draftComment.trim(),
      isAutoSyncedFromCase: false,
      history: updatedHistory.slice(-12),
      updatedAt: now,
    };

    const insight = buildDeterministicKpiInsight(updatedKpi, caseRecord);
    updatedKpi.aiInterpretation = insight.aiInterpretation;
    updatedKpi.recommendedAction = insight.recommendedAction;

    const nextKpis = trackerState.kpis.map((item) => (item.id === kpi.id ? updatedKpi : item));
    commitTracker(
      {
        ...trackerState,
        kpis: nextKpis,
      },
      `Updated "${kpi.name}" (${formatKpiNumber(computedActual, kpi.unit, currency)}).`
    );
    setEditingKpiId(null);
  };

  const handleCreateCustomKpi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const newKpi = createCustomTrackedKpi({
      name: customName,
      categoryId: customCategory,
      explanation: customExplanation,
      unit: customUnit,
      direction: customDirection,
      baselineValue: parseNullableNumber(customBaseline),
      targetValue: parseNullableNumber(customTarget),
      latestActualValue: parseNullableNumber(customActual),
      nextReviewDate: customReviewDate,
      ownerComment: customComment,
    });

    const insight = buildDeterministicKpiInsight(newKpi, caseRecord);
    newKpi.aiInterpretation = insight.aiInterpretation;
    newKpi.recommendedAction = insight.recommendedAction;

    const nextKpis = [newKpi, ...trackerState.kpis];
    commitTracker(
      {
        ...trackerState,
        selectedKpiIds: nextKpis.map((k) => k.catalogKey || k.id),
        kpis: nextKpis,
      },
      `Added custom KPI "${newKpi.name}" to your tracker.`
    );
    setCustomName('');
    setCustomExplanation('');
    setCustomBaseline('');
    setCustomTarget('');
    setCustomActual('');
    setCustomComment('');
    setShowCustomForm(false);
  };

  const handleRunAiInterpretation = async () => {
    if (isAiRunning || trackerState.kpis.length === 0) return;
    setIsAiRunning(true);
    setErrorMsg(null);

    try {
      const authHeaders = await getAuthHeaders();
      const kpisWithTrend = trackerState.kpis.map((k) => ({
        ...k,
        trend: computeKpiTrend(k.latestActualValue, k.previousValue, k.direction, k.unit),
      }));

      const untrackedCatalog = KPI_CATALOG.filter(
        (c) => !trackerState.kpis.some((k) => k.catalogKey === c.catalogKey)
      ).map((c) => ({
        catalogKey: c.catalogKey,
        name: c.name,
        categoryLabel: c.categoryLabel,
        explanation: c.explanation,
      }));

      const res = await fetch('/api/kpi/interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: caseRecord.id,
          kpis: kpisWithTrend,
          selectedPreset: trackerState.selectedPreset,
          availableCatalogSummary: untrackedCatalog,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: caseRecord.uploadedDocuments || [],
          crossDocumentSynthesis: caseRecord.crossDocumentSynthesis || null,
          crmContacts: caseRecord.crmContacts || [],
          roiScenarios: caseRecord.roiScenarios || [],
          recommendations: caseRecord.recommendations,
          actionPlan: caseRecord.actionPlan || [],
          continuity: caseRecord.continuity || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      if (!res.ok) {
        throw new Error(data.error || 'Unable to run AI KPI interpretation.');
      }

      const updateMap = new Map<string, { aiInterpretation: string; recommendedAction: string }>();
      for (const u of data.kpiUpdates || []) {
        if (u?.id) {
          updateMap.set(String(u.id), {
            aiInterpretation: String(u.aiInterpretation || ''),
            recommendedAction: String(u.recommendedAction || ''),
          });
        }
      }

      const updatedKpis = trackerState.kpis.map((k) => {
        const ai = updateMap.get(k.id);
        if (!ai) return k;
        return {
          ...k,
          aiInterpretation: ai.aiInterpretation || k.aiInterpretation,
          recommendedAction: ai.recommendedAction || k.recommendedAction,
        };
      });

      const aiRecs = (Array.isArray(data.recommendedAdditionalKpis) ? data.recommendedAdditionalKpis : [])
        .map((r: any) => {
          const def = getCatalogKpiByKey(String(r.catalogKey || ''));
          if (!def || updatedKpis.some((k) => k.catalogKey === def.catalogKey)) return null;
          return {
            catalogKey: def.catalogKey,
            name: def.name,
            category: def.category,
            categoryLabel: def.categoryLabel,
            clearBusinessReason: String(r.clearBusinessReason || ''),
          };
        })
        .filter(Boolean);

      commitTracker(
        {
          ...trackerState,
          kpis: updatedKpis,
          recommendedAdditionalKpis: aiRecs as KpiTrackerState['recommendedAdditionalKpis'],
          lastAiReviewedAt: new Date().toISOString(),
        },
        `AI Coach interpreted ${updatedKpis.length} tracked KPI(s) using your latest business data.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to generate AI KPI interpretation.');
    } finally {
      setIsAiRunning(false);
    }
  };

  // Portfolio metrics
  const enrichedKpis = useMemo(() => {
    return trackerState.kpis.map((kpi) => {
      const trend = computeKpiTrend(kpi.latestActualValue, kpi.previousValue, kpi.direction, kpi.unit);
      const variance = computeKpiVariance(
        kpi.latestActualValue,
        kpi.targetValue,
        kpi.direction,
        kpi.unit,
        currency
      );
      return { kpi, trend, variance };
    });
  }, [trackerState.kpis, currency]);

  const counts = useMemo(() => {
    let improving = 0;
    let declining = 0;
    let stable = 0;
    let insufficient = 0;
    let onTarget = 0;
    for (const item of enrichedKpis) {
      if (item.trend === 'Improving') improving += 1;
      else if (item.trend === 'Declining') declining += 1;
      else if (item.trend === 'Stable') stable += 1;
      else insufficient += 1;

      if (item.variance?.isFavorable) onTarget += 1;
    }
    return { total: enrichedKpis.length, improving, declining, stable, insufficient, onTarget };
  }, [enrichedKpis]);

  const filteredKpis = useMemo(() => {
    return enrichedKpis.filter(({ kpi, trend }) => {
      if (categoryFilter !== 'all' && kpi.category !== categoryFilter) return false;
      if (trendFilter !== 'all' && trend !== trendFilter) return false;
      return true;
    });
  }, [enrichedKpis, categoryFilter, trendFilter]);

  return (
    <div className="space-y-6">
      {/* KPI & Performance Tracker Control Header */}
      <div className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[#0F172A]/10 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
              <Gauge className="w-3.5 h-3.5" />
              <span>Measure Improvement Module</span>
              <span className="text-[#94A3B8]">·</span>
              <span className="text-[#475569]">{caseRecord.profile.name}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight mt-1">
              KPI &amp; PERFORMANCE TRACKER
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-1 max-w-3xl leading-relaxed">
              Monitor business-critical indicators tailored to your industry against Baseline and Target values. Update raw inputs to compute formulas deterministically, record comments, and run AI interpretation grounded in your actual figures.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncFromCase}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Sync Case Figures</span>
            </button>
            <button
              type="button"
              onClick={() => setShowKpiSelector((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Select KPIs ({trackerState.kpis.length}/30+)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCustomForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#0F172A]/20 text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Add Custom KPI</span>
            </button>
            <button
              type="button"
              disabled={isAiRunning || trackerState.kpis.length === 0}
              onClick={handleRunAiInterpretation}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold transition"
            >
              {isAiRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isAiRunning ? 'Interpreting KPIs...' : 'AI Interpret KPIs'}</span>
            </button>
          </div>
        </div>

        {/* Business Type Preset Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <label
              htmlFor="kpi-business-preset"
              className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] block"
            >
              Business-Type KPI Bundle
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="kpi-business-preset"
                value={trackerState.selectedPreset}
                onChange={(e) => handleSelectBusinessPreset(e.target.value as KpiBusinessTypePreset)}
                className="px-3 py-2 rounded border border-[#0F172A]/20 bg-white text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              >
                {KPI_BUSINESS_TYPE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#475569]">
                {KPI_BUSINESS_TYPE_PRESETS.find((p) => p.id === trackerState.selectedPreset)?.description}
              </span>
            </div>
          </div>

          {trackerState.lastAiReviewedAt && (
            <div className="text-[11px] text-[#475569] font-mono shrink-0">
              Last AI Review: {trackerState.lastAiReviewedAt.slice(0, 10)}
            </div>
          )}
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 tabular-nums">
          <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
              Tracked KPIs
            </span>
            <div className="text-xl font-bold text-[#0F172A] mt-0.5">{counts.total}</div>
          </div>
          <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#15803D] block">
              Improving
            </span>
            <div className="text-xl font-bold text-[#15803D] mt-0.5">{counts.improving}</div>
          </div>
          <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#B91C1C] block">
              Declining
            </span>
            <div className="text-xl font-bold text-[#B91C1C] mt-0.5">{counts.declining}</div>
          </div>
          <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#1D4ED8] block">
              On / Above Target
            </span>
            <div className="text-xl font-bold text-[#1D4ED8] mt-0.5">{counts.onTarget}</div>
          </div>
          <div className="p-3 rounded bg-[#F8FAFC] border border-[#CBD5E1]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
              Insufficient Data
            </span>
            <div className="text-xl font-bold text-[#475569] mt-0.5">{counts.insufficient}</div>
          </div>
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

      {errorMsg && (
        <div className="p-3.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Selective Additional KPI Recommendations (Shown only when warranted) */}
      {trackerState.recommendedAdditionalKpis.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B45309]">
            <Sparkles className="w-4 h-4" />
            <span>Recommended Additional KPIs Based on Your Business Case</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {trackerState.recommendedAdditionalKpis.map((rec) => (
              <div
                key={rec.catalogKey}
                className="p-3.5 rounded bg-white border border-[#FDE68A] flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#B45309]">
                    {rec.categoryLabel}
                  </div>
                  <div className="text-sm font-bold text-[#0F172A] mt-0.5">{rec.name}</div>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed">{rec.clearBusinessReason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleCatalogKpi(rec.catalogKey)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Tracker</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Catalog Selector Panel (30 Standard KPIs across Categories A-F) */}
      {showKpiSelector && (
        <div className="bg-white border border-[#0F172A]/15 rounded p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0F172A]/10 pb-3">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">
                Select KPIs by Business-Performance Category (A–F)
              </h3>
              <p className="text-xs text-[#475569]">
                Pick only the indicators relevant to {caseRecord.profile.name}. You do not need to track all 30 at once.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowKpiSelector(false)}
              className="px-3 py-1.5 rounded bg-[#0F172A] text-white text-xs font-semibold"
            >
              Done Selecting
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {KPI_CATEGORIES.map((cat) => {
              const items = KPI_CATALOG.filter((k) => k.category === cat.id);
              return (
                <div key={cat.id} className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-2.5">
                  <div>
                    <div className="text-xs font-bold text-[#0F172A]">{cat.label}</div>
                    <p className="text-[11px] text-[#475569]">{cat.description}</p>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item) => {
                      const checked = trackerState.kpis.some((k) => k.catalogKey === item.catalogKey);
                      return (
                        <label
                          key={item.catalogKey}
                          className="flex items-start gap-2 p-2 rounded bg-white border border-[#0F172A]/10 cursor-pointer hover:border-[#2563EB] text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleCatalogKpi(item.catalogKey)}
                            className="mt-0.5 rounded border-[#CBD5E1] text-[#2563EB]"
                          />
                          <div>
                            <span className="font-semibold text-[#0F172A] block">{item.name}</span>
                            <span className="text-[11px] text-[#64748B]">{item.explanation}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom KPI Form */}
      {showCustomForm && (
        <form
          onSubmit={handleCreateCustomKpi}
          className="bg-white border border-[#2563EB]/30 rounded p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#0F172A]/10 pb-3">
            <h3 className="text-base font-bold text-[#0F172A]">Add Custom KPI</h3>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="text-xs text-[#475569] hover:text-[#0F172A] font-semibold"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[#0F172A] block mb-1">KPI Name *</label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., SLA Ticket Response Within 30 Mins"
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-[#0F172A] block mb-1">Category</label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as KpiCategoryId)}
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs bg-white"
              >
                {KPI_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">Unit</label>
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as KpiUnitType)}
                  className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs bg-white"
                >
                  <option value="currency">Currency ({currency})</option>
                  <option value="percent">Percentage (%)</option>
                  <option value="number">Number</option>
                  <option value="days">Days</option>
                  <option value="hours">Hours</option>
                  <option value="score">Score (0–100)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">Direction</label>
                <select
                  value={customDirection}
                  onChange={(e) => setCustomDirection(e.target.value as KpiDirection)}
                  className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs bg-white"
                >
                  <option value="higher_is_better">Higher is better</option>
                  <option value="lower_is_better">Lower is better</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="font-semibold text-[#0F172A] block mb-1">What It Measures</label>
              <input
                type="text"
                value={customExplanation}
                onChange={(e) => setCustomExplanation(e.target.value)}
                placeholder="Explain why this metric matters to margin, cash, delivery, or retention."
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-[#0F172A] block mb-1">Baseline Value</label>
              <input
                type="number"
                step="any"
                value={customBaseline}
                onChange={(e) => setCustomBaseline(e.target.value)}
                placeholder="Starting baseline"
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-[#0F172A] block mb-1">Target Value</label>
              <input
                type="number"
                step="any"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                placeholder="Target value"
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-[#0F172A] block mb-1">Latest Actual Value</label>
              <input
                type="number"
                step="any"
                value={customActual}
                onChange={(e) => setCustomActual(e.target.value)}
                placeholder="Leave blank if unavailable"
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-[#0F172A] block mb-1">Next Review Date</label>
              <input
                type="date"
                value={customReviewDate}
                onChange={(e) => setCustomReviewDate(e.target.value)}
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-semibold text-[#0F172A] block mb-1">Owner Comment / Note</label>
              <input
                type="text"
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                placeholder="Initial observation or owner responsibility..."
                className="w-full px-3 py-2 rounded border border-[#0F172A]/20 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold"
            >
              Save Custom KPI
            </button>
          </div>
        </form>
      )}

      {/* Category & Trend Filters */}
      <div className="bg-white border border-[#0F172A]/12 rounded p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              categoryFilter === 'all'
                ? 'bg-[#0F172A] text-white'
                : 'bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            All Categories ({trackerState.kpis.length})
          </button>
          {KPI_CATEGORIES.map((cat) => {
            const count = trackerState.kpis.filter((k) => k.category === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  categoryFilter === cat.id
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-[#475569]">Trend:</span>
          <select
            value={trendFilter}
            onChange={(e) => setTrendFilter(e.target.value as 'all' | KpiTrendStatus)}
            className="px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs font-semibold text-[#0F172A]"
          >
            <option value="all">All Trends</option>
            <option value="Improving">Improving</option>
            <option value="Declining">Declining</option>
            <option value="Stable">Stable</option>
            <option value="Insufficient Data">Insufficient Data</option>
          </select>
        </div>
      </div>

      {/* Tracked KPI Cards (Displaying all 12 required fields + inline formula/manual update + history chart) */}
      {filteredKpis.length === 0 ? (
        <div className="bg-white border border-[#0F172A]/12 rounded p-8 text-center text-xs text-[#475569]">
          No tracked KPIs match the selected filter. Adjust filters above or click <strong>Select KPIs</strong> to add indicators.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredKpis.map(({ kpi, trend, variance }) => {
            const isEditing = editingKpiId === kpi.id;
            const isHistoryOpen = expandedHistoryId === kpi.id;
            const catalogDef = kpi.catalogKey ? getCatalogKpiByKey(kpi.catalogKey) : undefined;
            const hasFormula = Boolean(
              catalogDef &&
                catalogDef.inputFields.length > 0 &&
                kpi.formulaType !== 'manual' &&
                kpi.formulaType !== 'manual_or_case'
            );

            // Previous-period comparison text
            let previousComparisonText = 'Insufficient Data (no prior period recorded)';
            if (kpi.previousValue !== null && kpi.latestActualValue !== null) {
              const diff = kpi.latestActualValue - kpi.previousValue;
              const diffSign = diff > 0 ? '+' : diff < 0 ? '−' : '';
              const diffFmt =
                diff === 0 ? 'No change (0)' : `${diffSign}${formatKpiNumber(Math.abs(diff), kpi.unit, currency)}`;
              previousComparisonText = `${formatKpiNumber(kpi.previousValue, kpi.unit, currency)} (${diffFmt})`;
            } else if (kpi.previousValue !== null) {
              previousComparisonText = formatKpiNumber(kpi.previousValue, kpi.unit, currency);
            }

            return (
              <div
                key={kpi.id}
                className="bg-white border border-[#0F172A]/12 rounded p-5 sm:p-6 flex flex-col justify-between gap-4 hover:border-[#2563EB]/60 transition"
              >
                <div className="space-y-4">
                  {/* Top Bar: 2. Business-performance category & 9. Trend */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                      {kpi.categoryLabel}
                      {kpi.isCustom ? ' · Custom' : ''}
                    </span>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-bold ${getTrendBadgeClasses(
                          trend
                        )}`}
                      >
                        {trend === 'Improving' && <ArrowUpRight className="w-3.5 h-3.5" />}
                        {trend === 'Declining' && <ArrowDownRight className="w-3.5 h-3.5" />}
                        {trend === 'Stable' && <Minus className="w-3.5 h-3.5" />}
                        {trend === 'Insufficient Data' && <Activity className="w-3.5 h-3.5" />}
                        <span>{trend}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingKpiId(null) : openEditorForKpi(kpi))}
                        className="p-1.5 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/12 text-xs"
                        title="Update figures, targets, or comment"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#2563EB]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveKpi(kpi.id)}
                        className="p-1.5 rounded bg-[#F8FAFC] hover:bg-[#FEF2F2] text-[#64748B] hover:text-[#B91C1C] border border-[#0F172A]/12 text-xs"
                        title="Remove KPI from active tracker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 1. KPI name & 3. Explanation of what it measures */}
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A] leading-snug">{kpi.name}</h3>
                    <p className="text-xs text-[#475569] mt-1 leading-relaxed">{kpi.explanation}</p>
                    <p className="text-[11px] font-mono text-[#64748B] mt-1">
                      Formula: {kpi.formulaDescription}
                    </p>
                  </div>

                  {/* Numeric KPI Grid: 4. Baseline, 5. Target, 6. Latest Actual, 7. Variance, 8. Previous Comparison */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs tabular-nums">
                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                        4. Baseline Value
                      </span>
                      <div className="text-sm font-bold text-[#0F172A] font-mono mt-0.5">
                        {formatKpiNumber(kpi.baselineValue, kpi.unit, currency)}
                      </div>
                    </div>

                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                        5. Target Value
                      </span>
                      <div className="text-sm font-bold text-[#0F172A] font-mono mt-0.5">
                        {formatKpiNumber(kpi.targetValue, kpi.unit, currency)}
                      </div>
                    </div>

                    <div className="p-3 rounded bg-[#EFF6FF] border border-[#BFDBFE]">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#1D4ED8] block">
                        6. Latest Actual
                      </span>
                      <div className="text-sm font-bold text-[#0F172A] font-mono mt-0.5">
                        {formatKpiNumber(kpi.latestActualValue, kpi.unit, currency)}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded border ${
                        variance === null
                          ? 'bg-[#F8FAFC] border-[#0F172A]/10'
                          : variance.isFavorable
                          ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                          : 'bg-[#FEF2F2] border-[#FECACA]'
                      }`}
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                        7. Variance vs Target
                      </span>
                      <div
                        className={`text-xs font-bold font-mono mt-0.5 ${
                          variance === null
                            ? 'text-[#475569]'
                            : variance.isFavorable
                            ? 'text-[#15803D]'
                            : 'text-[#B91C1C]'
                        }`}
                      >
                        {variance ? `${variance.formattedDelta} · ${variance.statusLabel}` : 'Insufficient Data'}
                      </div>
                    </div>

                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10 sm:col-span-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                        8. Previous-Period Comparison
                      </span>
                      <div className="text-xs font-semibold text-[#0F172A] font-mono mt-0.5">
                        {previousComparisonText}
                      </div>
                    </div>
                  </div>

                  {/* Inline Update / Formula Input Editor */}
                  {isEditing && (
                    <div className="p-4 rounded bg-[#F8FAFC] border border-[#2563EB]/40 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#0F172A]">Update KPI Figures &amp; Schedule</span>
                        {hasFormula && (
                          <div className="inline-flex rounded border border-[#0F172A]/15 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setDraftMode('formula')}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                                draftMode === 'formula' ? 'bg-[#2563EB] text-white' : 'text-[#475569]'
                              }`}
                            >
                              Formula Inputs
                            </button>
                            <button
                              type="button"
                              onClick={() => setDraftMode('direct')}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                                draftMode === 'direct' ? 'bg-[#2563EB] text-white' : 'text-[#475569]'
                              }`}
                            >
                              Direct Actual
                            </button>
                          </div>
                        )}
                      </div>

                      {draftMode === 'formula' && hasFormula && catalogDef ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {catalogDef.inputFields.map((field) => (
                              <div key={field.key}>
                                <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                                  {field.label}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={draftInputs[field.key] ?? ''}
                                  onChange={(e) =>
                                    setDraftInputs((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  placeholder="Enter verified figure"
                                  className="w-full px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs font-mono"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="text-[11px] font-mono text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] rounded px-2.5 py-1.5">
                            Computed Preview:{' '}
                            {formatKpiNumber(
                              evaluateKpiFormula(
                                kpi.formulaType,
                                Object.fromEntries(
                                  Object.entries(draftInputs).map(([k, v]) => [k, parseNullableNumber(v)])
                                )
                              ),
                              kpi.unit,
                              currency
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                            Latest Actual Value ({kpi.unit === 'currency' ? currency : kpi.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={draftActual}
                            onChange={(e) => setDraftActual(e.target.value)}
                            placeholder="Enter actual value"
                            className="w-full px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs font-mono"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                            Baseline Value
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={draftBaseline}
                            onChange={(e) => setDraftBaseline(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                            Target Value
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={draftTarget}
                            onChange={(e) => setDraftTarget(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                            Next Review Date
                          </label>
                          <input
                            type="date"
                            value={draftNextReviewDate}
                            onChange={(e) => setDraftNextReviewDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-[#475569] block mb-1">
                          Owner Note / Period Comment
                        </label>
                        <input
                          type="text"
                          value={draftComment}
                          onChange={(e) => setDraftComment(e.target.value)}
                          placeholder="Context, exceptions, or action taken this period..."
                          className="w-full px-2.5 py-1.5 rounded border border-[#0F172A]/20 bg-white text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingKpiId(null)}
                          className="px-3 py-1.5 rounded bg-white border border-[#0F172A]/15 text-xs font-semibold text-[#475569]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveKpiEdit(kpi)}
                          className="px-3.5 py-1.5 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold"
                        >
                          Save KPI Period Entry
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 10. AI interpretation & 11. Recommended corrective action */}
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1D4ED8] block mb-1">
                        10. AI Interpretation
                      </span>
                      <p className="text-[#0F172A] leading-relaxed">{kpi.aiInterpretation}</p>
                    </div>
                    <div className="p-3 rounded bg-[#FFFBEB] border border-[#FDE68A]">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B45309] block mb-1">
                        11. Recommended Corrective Action
                      </span>
                      <p className="text-[#0F172A] leading-relaxed">{kpi.recommendedAction}</p>
                    </div>
                  </div>
                </div>

                {/* Footer: 12. Next review date + Owner Comment + History Chart Toggle */}
                <div className="pt-3 border-t border-[#0F172A]/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-[#475569] font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>
                        12. Next Review: <strong className="text-[#0F172A]">{kpi.nextReviewDate || 'Unscheduled'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditorForKpi(kpi)}
                        className="text-[#2563EB] hover:underline font-semibold"
                      >
                        Update Actual / Inputs
                      </button>
                      {kpi.history.length > 0 && (
                        <>
                          <span className="text-[#CBD5E1]">·</span>
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryId(isHistoryOpen ? null : kpi.id)}
                            className="inline-flex items-center gap-1 text-[#0F172A] hover:text-[#2563EB] font-semibold"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>History ({kpi.history.length})</span>
                            {isHistoryOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {kpi.ownerComment && (
                    <div className="text-[11px] text-[#475569] bg-[#F8FAFC] px-2.5 py-1.5 rounded border border-[#0F172A]/8">
                      <strong className="text-[#0F172A]">Owner Note:</strong> {kpi.ownerComment}
                    </div>
                  )}

                  {isHistoryOpen && kpi.history.length > 0 && (
                    <div className="pt-2 space-y-2">
                      {kpi.history.length >= 2 && (
                        <div className="h-36 w-full bg-[#F8FAFC] rounded border border-[#0F172A]/10 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={kpi.history}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                              <XAxis dataKey="periodLabel" tick={{ fontSize: 10, fill: '#475569' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#475569' }} width={42} />
                              <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 6, borderColor: '#CBD5E1' }}
                              />
                              <Line
                                type="monotone"
                                dataKey="actualValue"
                                name="Actual"
                                stroke="#2563EB"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="targetValue"
                                name="Target"
                                stroke="#15803D"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="space-y-1 max-h-28 overflow-y-auto text-[11px] font-mono">
                        {kpi.history
                          .slice()
                          .reverse()
                          .map((h, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#F8FAFC] text-[#475569]"
                            >
                              <span>{h.periodLabel}</span>
                              <span className="font-bold text-[#0F172A]">
                                {formatKpiNumber(h.actualValue, kpi.unit, currency)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
