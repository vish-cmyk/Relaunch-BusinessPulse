import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Activity,
  FileSpreadsheet,
  Edit3,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Type,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  RotateCcw,
  Download,
  Check,
  Loader2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import {
  RISK_MAP_ITEMS,
  GROWTH_OPTIONS_EVALUATION,
} from '../data/coachingBriefing';
import {
  AccountUsageSummary,
  CaseRecord,
  HealthDimensionInput,
  RecommendationOutput,
  ReportCustomBlock,
  ReportEditorSettings,
  ReportFontFamily,
  ReportFontSize,
  ReportBlockAlign,
} from '../types/bizpulse';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';
import { calculateOverallHealth } from '../services/healthScoring';
import { mergeDiagnosticsIntoActionPlan } from '../services/actionPlanEngine';
import { computeKpiTrend, computeKpiVariance, formatKpiNumber } from '../services/kpiEngine';
import { computeRoiScenarioMetrics } from '../services/roiEngine';
import {
  generateDocxReportUint8Array,
  generatePdfReportBytes,
  renderHealthChartCanvasPng,
} from '../services/reportGenerator';
import { InfoTooltip } from './InfoTooltip';

interface ExecutiveMemoProps {
  activeCase: CaseRecord;
  onSwitchTab: (tab: string) => void;
  onUpdateCase?: (updated: CaseRecord) => void;
  onOpenExportModal?: () => void;
  onOpenCoachWithPrompt?: (prompt: string) => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
  onOpenKpiTracker?: () => void;
}

const DEFAULT_CUSTOM_ORDER = [
  'dimensions',
  'strengths_weaknesses',
  'risks',
  'opportunities',
  'recommendations',
  'action_plan',
  'kpis',
  'evidence',
  'custom',
];
const DEFAULT_DEMO_ORDER = ['sec-2', 'sec-3', 'sec-4', 'sec-5', 'sec-6', 'custom'];

function getFontFamilyClass(font: ReportFontFamily = 'sans'): string {
  if (font === 'serif') return 'font-serif';
  if (font === 'mono') return 'font-mono';
  return 'font-sans';
}

function getFontSizeClass(size: ReportFontSize = 'base'): string {
  if (size === 'sm') return 'text-xs leading-relaxed';
  if (size === 'lg') return 'text-base leading-relaxed';
  return 'text-sm leading-relaxed';
}

function getAlignClass(align: ReportBlockAlign = 'left'): string {
  if (align === 'center') return 'text-center';
  if (align === 'justify') return 'text-justify';
  return 'text-left';
}

function getAccentClasses(accent: ReportCustomBlock['accent'] = 'slate'): {
  card: string;
  heading: string;
  badge: string;
} {
  switch (accent) {
    case 'blue':
      return {
        card: 'bg-[#EDF3FD] border-[#B7CEF7]',
        heading: 'text-[#0F52BA]',
        badge: 'bg-[#0F52BA] text-white',
      };
    case 'green':
      return {
        card: 'bg-[#ECFDF5] border-[#A7F3D0]',
        heading: 'text-[#15803D]',
        badge: 'bg-[#15803D] text-white',
      };
    case 'amber':
      return {
        card: 'bg-[#FFFBEB] border-[#FDE68A]',
        heading: 'text-[#B45309]',
        badge: 'bg-[#B45309] text-white',
      };
    case 'slate':
    default:
      return {
        card: 'bg-[#F8FAFC] border-[#0F172A]/12',
        heading: 'text-[#0F172A]',
        badge: 'bg-[#0A2E6E] text-white',
      };
  }
}

export const ExecutiveMemo: React.FC<ExecutiveMemoProps> = ({
  activeCase,
  onSwitchTab,
  onUpdateCase,
  onOpenExportModal,
  onAccountUsageUpdate,
  onOpenKpiTracker,
}) => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>('sec-2');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isExportingDirect, setIsExportingDirect] = useState<boolean>(false);

  const isDemo = activeCase.profile.isDemonstrationCase;
  const p = activeCase.profile;
  const h = activeCase.overallHealth;
  const rec = activeCase.recommendations;
  const docs = activeCase.uploadedDocuments || [];
  const fin = activeCase.financials;

  const editorSettings: ReportEditorSettings = activeCase.reportEditorSettings || {
    fontFamily: 'sans',
    fontSize: 'base',
    sectionOrder: isDemo ? DEFAULT_DEMO_ORDER : DEFAULT_CUSTOM_ORDER,
  };

  const reportBlocks: ReportCustomBlock[] = activeCase.reportBlocks || [];

  const defaultOrder = isDemo ? DEFAULT_DEMO_ORDER : DEFAULT_CUSTOM_ORDER;
  const rawOrder =
    editorSettings.sectionOrder && editorSettings.sectionOrder.length > 0
      ? editorSettings.sectionOrder
      : defaultOrder;
  const sectionOrder = [
    ...rawOrder.filter((id) => defaultOrder.includes(id)),
    ...defaultOrder.filter((id) => !rawOrder.includes(id)),
  ];

  const notifySaved = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const triggerDownload = (bytes: Uint8Array, filename: string, mimeType: string) => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDirectDownloadPdf = () => {
    try {
      setIsExportingDirect(true);
      setReportError(null);
      const safeName = (p.name || 'business').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const pdfBytes = generatePdfReportBytes(activeCase);
      triggerDownload(pdfBytes, `${safeName}_business_health_report.pdf`, 'application/pdf');
      notifySaved('Business Health Report PDF downloaded.');
    } catch (err: any) {
      console.error('Direct PDF report export failed:', err);
      setReportError(`PDF export failed: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsExportingDirect(false);
    }
  };

  const handleDirectDownloadDocx = async () => {
    try {
      setIsExportingDirect(true);
      setReportError(null);
      const safeName = (p.name || 'business').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const chartPng = renderHealthChartCanvasPng(activeCase) || undefined;
      const docxBytes = await generateDocxReportUint8Array(activeCase, chartPng);
      triggerDownload(
        docxBytes,
        `${safeName}_business_health_report.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      notifySaved('Business Health Report Word (.docx) downloaded.');
    } catch (err: any) {
      console.error('Direct DOCX report export failed:', err);
      setReportError(`Word (.docx) export failed: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsExportingDirect(false);
    }
  };

  const handleGenerateFullHealthReport = async () => {
    if (isGeneratingReport || !onUpdateCase) return;
    setIsGeneratingReport(true);
    setReportError(null);

    try {
      const updatedHealth = calculateOverallHealth(activeCase.healthInputs, activeCase.financials);
      const { data } = await apiFetchWithAuth<{
        recommendation?: RecommendationOutput;
        accountUsage?: AccountUsageSummary;
      }>('/api/coach/generate-recommendation', {
        method: 'POST',
        body: {
          caseId: p.caseId,
          businessProfile: p,
          healthInputs: activeCase.healthInputs,
          financials: activeCase.financials,
          overallHealth: updatedHealth,
          uploadedDocuments: sanitizeDocumentsForAiPayload(docs),
          crossDocumentSynthesis: activeCase.crossDocumentSynthesis,
          crmContacts: activeCase.crmContacts || [],
          roiScenarios: activeCase.roiScenarios || [],
          actionPlan: activeCase.actionPlan || [],
          continuity: activeCase.continuity || null,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);

      if (!data.recommendation) {
        throw new Error('The AI engine returned an empty report payload. Please click Retry.');
      }

      const mergedRec: RecommendationOutput = {
        ...data.recommendation,
        challenges: rec?.challenges || [],
      };

      const candidateCase: CaseRecord = {
        ...activeCase,
        overallHealth: updatedHealth,
        recommendations: mergedRec,
      };
      const mergedActionPlan = isDemo
        ? activeCase.actionPlan
        : mergeDiagnosticsIntoActionPlan(candidateCase, mergedRec);

      onUpdateCase({
        ...candidateCase,
        actionPlan: mergedActionPlan,
        updatedAt: new Date().toISOString(),
      });
      notifySaved('Business Health Report & Action Plan refreshed from latest case data.');
    } catch (err: any) {
      console.error('Business Health Report generation failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setReportError(err?.message || 'Unable to generate Business Health Report right now.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const updateSettings = (patch: Partial<ReportEditorSettings>) => {
    if (!onUpdateCase) return;
    onUpdateCase({
      ...activeCase,
      reportEditorSettings: {
        ...editorSettings,
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    });
    notifySaved('Report typography & layout saved.');
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    const idx = sectionOrder.indexOf(sectionId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sectionOrder.length) return;
    const next = [...sectionOrder];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    updateSettings({ sectionOrder: next });
  };

  const handleAddParagraph = () => {
    if (!onUpdateCase) return;
    const newBlock: ReportCustomBlock = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      heading: `Executive Note ${reportBlocks.length + 1}`,
      body: 'Write your custom commercial observation, decision rationale, or owner follow-up note here.',
      fontFamily: editorSettings.fontFamily || 'sans',
      fontSize: editorSettings.fontSize || 'base',
      bold: false,
      italic: false,
      align: 'left',
      accent: 'slate',
      updatedAt: new Date().toISOString(),
    };
    onUpdateCase({
      ...activeCase,
      reportBlocks: [...reportBlocks, newBlock],
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(true);
    notifySaved('New custom paragraph added.');
  };

  const handleUpdateBlock = (blockId: string, patch: Partial<ReportCustomBlock>) => {
    if (!onUpdateCase) return;
    const next = reportBlocks.map((b) =>
      b.id === blockId ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b
    );
    onUpdateCase({
      ...activeCase,
      reportBlocks: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMoveBlock = (blockId: string, direction: -1 | 1) => {
    if (!onUpdateCase) return;
    const idx = reportBlocks.findIndex((b) => b.id === blockId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= reportBlocks.length) return;
    const next = [...reportBlocks];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    onUpdateCase({
      ...activeCase,
      reportBlocks: next,
      updatedAt: new Date().toISOString(),
    });
    notifySaved('Paragraph moved.');
  };

  const handleDuplicateBlock = (block: ReportCustomBlock) => {
    if (!onUpdateCase) return;
    const clone: ReportCustomBlock = {
      ...block,
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      heading: `${block.heading} (Copy)`,
      updatedAt: new Date().toISOString(),
    };
    const idx = reportBlocks.findIndex((b) => b.id === block.id);
    const next = [...reportBlocks];
    next.splice(idx + 1, 0, clone);
    onUpdateCase({
      ...activeCase,
      reportBlocks: next,
      updatedAt: new Date().toISOString(),
    });
    notifySaved('Paragraph duplicated.');
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!onUpdateCase) return;
    onUpdateCase({
      ...activeCase,
      reportBlocks: reportBlocks.filter((b) => b.id !== blockId),
      updatedAt: new Date().toISOString(),
    });
    notifySaved('Paragraph removed.');
  };

  const handleResetLayout = () => {
    if (!onUpdateCase) return;
    onUpdateCase({
      ...activeCase,
      reportEditorSettings: {
        fontFamily: 'sans',
        fontSize: 'base',
        sectionOrder: defaultOrder,
      },
      updatedAt: new Date().toISOString(),
    });
    notifySaved('Report layout & typography reset to default.');
  };

  const updateProfileField = (field: 'primaryObjective' | 'primaryConcern', value: string) => {
    if (!onUpdateCase) return;
    onUpdateCase({
      ...activeCase,
      profile: {
        ...activeCase.profile,
        [field]: value,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const updateRecField = (
    field: 'initialObservation' | 'commercialWhy' | 'initialRecommendation' | 'immediateAction',
    value: string
  ) => {
    if (!onUpdateCase || !rec) return;
    onUpdateCase({
      ...activeCase,
      recommendations: {
        ...rec,
        [field]: value,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleAccordion = (id: string) => {
    setActiveAccordion((prev) => (prev === id ? null : id));
  };

  const globalFontClass = getFontFamilyClass(editorSettings.fontFamily);
  const globalSizeClass = getFontSizeClass(editorSettings.fontSize);

  const renderSectionMoveControls = (sectionId: string) => {
    if (!isEditing) return null;
    const idx = sectionOrder.indexOf(sectionId);
    return (
      <div className="flex items-center gap-1 print:hidden">
        <button
          type="button"
          onClick={() => moveSection(sectionId, -1)}
          disabled={idx === 0}
          title="Move section up"
          className="p-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15 text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 transition"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => moveSection(sectionId, 1)}
          disabled={idx === sectionOrder.length - 1}
          title="Move section down"
          className="p-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15 text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-40 transition"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderEditorToolbar = () => (
    <div className="bg-white border border-[#0F172A]/12 rounded p-4 shadow-xs space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isDemo && (
            <button
              type="button"
              onClick={handleGenerateFullHealthReport}
              disabled={isGeneratingReport}
              className="px-3.5 py-2 rounded bg-[#0A2E6E] hover:bg-[#0F52BA] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-[#6495ED] animate-spin" />
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#6495ED]" />
                  <span>{rec ? 'Refresh Full Health Report' : 'Generate Business Health Report'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleDirectDownloadPdf}
            disabled={isExportingDirect}
            className="px-3.5 py-2 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handleDirectDownloadDocx}
            disabled={isExportingDirect}
            className="px-3.5 py-2 rounded bg-[#EDF3FD] hover:bg-[#DCE8FC] disabled:opacity-50 text-[#0F52BA] text-xs font-bold border border-[#B7CEF7] flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download Word (.docx)</span>
          </button>

          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-3 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#0F52BA]" />
              <span>Export Options</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className={`px-3 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition border ${
              isEditing
                ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                : 'bg-white text-[#0F172A] border-[#0F172A]/15 hover:border-[#0F52BA]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Done Editing' : 'Edit Tools'}</span>
          </button>

          <button
            type="button"
            onClick={handleAddParagraph}
            className="px-3 py-2 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#0F52BA]" />
            <span>Add Note</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {saveNotice && (
            <span className="text-[#15803D] font-semibold flex items-center gap-1 bg-[#ECFDF5] px-2.5 py-1 rounded border border-[#A7F3D0]">
              <Check className="w-3.5 h-3.5" />
              {saveNotice}
            </span>
          )}

          <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5">
            <Type className="w-3.5 h-3.5 text-[#475569]" />
            <label htmlFor="report-font-select" className="sr-only">
              Report Font Family
            </label>
            <select
              id="report-font-select"
              value={editorSettings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value as ReportFontFamily })}
              className="bg-transparent text-[#0F172A] font-semibold focus:outline-none text-xs"
            >
              <option value="sans">Sans-Serif (Inter)</option>
              <option value="serif">Editorial Serif</option>
              <option value="mono">Executive Mono</option>
            </select>
          </div>

          <div className="flex items-center bg-[#F8FAFC] border border-[#0F172A]/15 rounded p-0.5">
            {(['sm', 'base', 'lg'] as ReportFontSize[]).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => updateSettings({ fontSize: sz })}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                  editorSettings.fontSize === sz
                    ? 'bg-[#0A2E6E] text-white'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {sz === 'sm' ? 'Compact' : sz === 'base' ? 'Standard' : 'Large'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetLayout}
            title="Reset section order and typography"
            className="px-2.5 py-1.5 rounded bg-white border border-[#0F172A]/15 text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] font-semibold flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {reportError && (
        <div className="p-3.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{reportError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleGenerateFullHealthReport}
              disabled={isGeneratingReport}
              className="px-3 py-1 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => setReportError(null)}
              className="font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <p className="text-[11px] text-[#475569] bg-[#F8FAFC] border border-[#0F172A]/10 rounded px-3 py-2">
          <strong>Edit Mode Active:</strong> Use the Up/Down arrows on any section or custom paragraph to reorder it, change fonts/sizes/alignment/bold/italic, edit report text inline, or add custom paragraphs. All changes save automatically to your case and carry into PDF and Word (.docx) exports.
        </p>
      )}
    </div>
  );

  const renderCustomParagraphsSection = (displayNum: string) => {
    if (reportBlocks.length === 0 && !isEditing) return null;
    const isSection09 = displayNum === '9' || displayNum === '09';

    return (
      <div
        key="custom"
        className={
          isSection09
            ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
            : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
        }
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10 gap-2">
          <div className="flex items-center space-x-2.5">
            <span
              className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
              }`}
            >
              {displayNum}
            </span>
            <h3 className="text-lg font-bold text-[#0F172A]">
              Custom Commentary &amp; Owner Paragraphs ({reportBlocks.length})
            </h3>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleAddParagraph}
              className="px-3 py-1.5 rounded bg-[#EDF3FD] hover:bg-[#DCE8FC] text-[#0F52BA] text-xs font-bold border border-[#B7CEF7] flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Paragraph</span>
            </button>
            {renderSectionMoveControls('custom')}
          </div>
        </div>

        {reportBlocks.length === 0 ? (
          <div className="p-6 text-center rounded bg-[#F8FAFC] border border-dashed border-[#0F172A]/20 space-y-2">
            <p className="text-xs text-[#475569]">
              No custom paragraphs added yet. Click <strong>Add Paragraph</strong> to insert board notes, consultant commentary, or owner decisions into this report.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reportBlocks.map((block, bIdx) => {
              const accent = getAccentClasses(block.accent);
              const blockFont = getFontFamilyClass(block.fontFamily);
              const blockSize = getFontSizeClass(block.fontSize);
              const blockAlign = getAlignClass(block.align);

              return (
                <div
                  key={block.id}
                  className={`p-4 sm:p-5 rounded border space-y-3 ${accent.card}`}
                >
                  {isEditing ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/10 print:hidden">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={block.fontFamily}
                            onChange={(e) =>
                              handleUpdateBlock(block.id, {
                                fontFamily: e.target.value as ReportFontFamily,
                              })
                            }
                            aria-label="Paragraph font"
                            className="bg-white border border-[#0F172A]/15 rounded px-2 py-1 text-[11px] font-semibold text-[#0F172A]"
                          >
                            <option value="sans">Sans</option>
                            <option value="serif">Serif</option>
                            <option value="mono">Mono</option>
                          </select>

                          <select
                            value={block.fontSize}
                            onChange={(e) =>
                              handleUpdateBlock(block.id, {
                                fontSize: e.target.value as ReportFontSize,
                              })
                            }
                            aria-label="Paragraph size"
                            className="bg-white border border-[#0F172A]/15 rounded px-2 py-1 text-[11px] font-semibold text-[#0F172A]"
                          >
                            <option value="sm">Small</option>
                            <option value="base">Normal</option>
                            <option value="lg">Large</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleUpdateBlock(block.id, { bold: !block.bold })}
                            title="Bold"
                            className={`p-1.5 rounded border text-xs ${
                              block.bold
                                ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                                : 'bg-white text-[#0F172A] border-[#0F172A]/15'
                            }`}
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateBlock(block.id, { italic: !block.italic })}
                            title="Italic"
                            className={`p-1.5 rounded border text-xs ${
                              block.italic
                                ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                                : 'bg-white text-[#0F172A] border-[#0F172A]/15'
                            }`}
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center bg-white border border-[#0F172A]/15 rounded overflow-hidden">
                            {(
                              [
                                { id: 'left', icon: AlignLeft, label: 'Align left' },
                                { id: 'center', icon: AlignCenter, label: 'Align center' },
                                { id: 'justify', icon: AlignJustify, label: 'Justify' },
                              ] as const
                            ).map((al) => {
                              const AlIcon = al.icon;
                              return (
                                <button
                                  key={al.id}
                                  type="button"
                                  onClick={() => handleUpdateBlock(block.id, { align: al.id })}
                                  title={al.label}
                                  className={`p-1.5 ${
                                    (block.align || 'left') === al.id
                                      ? 'bg-[#0F52BA] text-white'
                                      : 'text-[#475569] hover:text-[#0F172A]'
                                  }`}
                                >
                                  <AlIcon className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                          </div>

                          <select
                            value={block.accent || 'slate'}
                            onChange={(e) =>
                              handleUpdateBlock(block.id, {
                                accent: e.target.value as ReportCustomBlock['accent'],
                              })
                            }
                            aria-label="Callout style"
                            className="bg-white border border-[#0F172A]/15 rounded px-2 py-1 text-[11px] font-semibold text-[#0F172A]"
                          >
                            <option value="slate">Neutral Card</option>
                            <option value="blue">Sapphire Highlight</option>
                            <option value="green">Positive / Action</option>
                            <option value="amber">Attention / Watch</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(block.id, -1)}
                            disabled={bIdx === 0}
                            title="Move paragraph up"
                            className="p-1.5 rounded bg-white border border-[#0F172A]/15 text-[#0F172A] disabled:opacity-40 hover:bg-[#F8FAFC]"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(block.id, 1)}
                            disabled={bIdx === reportBlocks.length - 1}
                            title="Move paragraph down"
                            className="p-1.5 rounded bg-white border border-[#0F172A]/15 text-[#0F172A] disabled:opacity-40 hover:bg-[#F8FAFC]"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateBlock(block)}
                            title="Duplicate paragraph"
                            className="p-1.5 rounded bg-white border border-[#0F172A]/15 text-[#0F52BA] hover:bg-[#EDF3FD]"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            title="Delete paragraph"
                            className="p-1.5 rounded bg-white border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={block.heading}
                        onChange={(e) => handleUpdateBlock(block.id, { heading: e.target.value })}
                        placeholder="Paragraph / Section Heading..."
                        className={`w-full bg-white border border-[#0F172A]/15 rounded px-3 py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-[#0F52BA] ${blockFont} ${accent.heading}`}
                      />
                      <textarea
                        rows={4}
                        value={block.body}
                        onChange={(e) => handleUpdateBlock(block.id, { body: e.target.value })}
                        placeholder="Enter paragraph commentary..."
                        className={`w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0F52BA] ${blockFont} ${blockSize} ${blockAlign} ${
                          block.bold ? 'font-bold' : 'font-normal'
                        } ${block.italic ? 'italic' : ''}`}
                      />
                    </>
                  ) : (
                    <>
                      <h4 className={`font-bold text-sm ${blockFont} ${accent.heading} ${blockAlign}`}>
                        {block.heading}
                      </h4>
                      <p
                        className={`text-[#0F172A] whitespace-pre-wrap ${blockFont} ${blockSize} ${blockAlign} ${
                          block.bold ? 'font-bold' : 'font-normal'
                        } ${block.italic ? 'italic' : ''}`}
                      >
                        {block.body}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Custom Business Executive Diagnostic Report (All 9 Required Sections + Custom Notes)
  if (!isDemo) {
    const dimList = Object.values(activeCase.healthInputs) as HealthDimensionInput[];
    const healthyDims = dimList.filter((d) => d.status === 'healthy');
    const attentionDims = dimList.filter((d) => d.status === 'at_risk' || d.status === 'needs_attention');
    const missingDims = dimList.filter((d) => d.status === 'not_sure' || d.status === 'unanswered');
    const crmContacts = activeCase.crmContacts || [];
    const roiScenarios = activeCase.roiScenarios || [];
    const effectiveActionPlan =
      activeCase.actionPlan && activeCase.actionPlan.length > 0
        ? activeCase.actionPlan
        : mergeDiagnosticsIntoActionPlan(activeCase);
    const kpis = activeCase.kpiTracker?.kpis || [];

    const chartData = dimList.map((dim) => {
      const detail = h?.dimensionScores?.find((d) => d.key === dim.key);
      const numericScore =
        detail && detail.score !== null
          ? detail.score
          : dim.status === 'healthy'
          ? 100
          : dim.status === 'needs_attention'
          ? 55
          : dim.status === 'at_risk'
          ? 15
          : 0;
      const fill =
        dim.status === 'healthy'
          ? '#15803D'
          : dim.status === 'needs_attention'
          ? '#D97706'
          : dim.status === 'at_risk'
          ? '#B91C1C'
          : '#6495ED';
      return {
        name: dim.title.length > 26 ? `${dim.title.slice(0, 24)}…` : dim.title,
        fullTitle: dim.title,
        score: numericScore,
        statusLabel:
          dim.status === 'not_sure' || dim.status === 'unanswered'
            ? 'Insufficient Info'
            : dim.status.replace('_', ' '),
        fill,
      };
    });

    const renderCustomSection = (secId: string, indexNum: number) => {
      const displayNum = String(indexNum + 2);
      const isSection09 = displayNum === '9';

      if (secId === 'dimensions') {
        return (
          <div
            key="dimensions"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-5'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-5'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-1.5">
                  <span>Twelve Business Health Capabilities</span>
                  <InfoTooltip
                    title="12-Capability Score Profile"
                    whatItMeans="Visualises each capability from 0–100 (Healthy 100, Needs Attention 55, At Risk 15, Blue = Insufficient Data)."
                    whyItMatters="Pinpoints operational bottlenecks dragging overall business resilience."
                  />
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchTab('health')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold print:hidden"
                >
                  Edit Dimensions &rarr;
                </button>
                {renderSectionMoveControls('dimensions')}
              </div>
            </div>

            {/* 12-Capability Visual Bar Chart */}
            <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-mono font-bold uppercase tracking-wider text-[#0F172A]">
                  12-Capability Health Chart
                </span>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold">
                  <span className="text-[#15803D]">■ Healthy (100)</span>
                  <span className="text-[#B45309]">■ Needs Attention (55)</span>
                  <span className="text-[#B91C1C]">■ At Risk (15)</span>
                  <span className="text-[#0F52BA]">■ Not Sure / Unanswered (0)</span>
                </div>
              </div>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 10, bottom: 4 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={175}
                      tick={{ fontSize: 10, fill: '#0F172A', fontWeight: 600 }}
                    />
                    <RechartsTooltip
                      formatter={(value: any, _name: any, props: any) => [
                        `${value}/100 (${props?.payload?.statusLabel || ''})`,
                        props?.payload?.fullTitle || 'Capability',
                      ]}
                      contentStyle={{ fontSize: '12px', borderRadius: '6px' }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#0F172A]/12 bg-[#F8FAFC] text-[#475569] font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Dimension</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3">Evidence Basis</th>
                    <th className="py-2.5 px-3">Owner Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F172A]/10">
                  {dimList.map((dim) => {
                    const detail = h?.dimensionScores?.find((d) => d.key === dim.key);
                    return (
                      <tr key={dim.key} className="hover:bg-[#F8FAFC]/60 transition">
                        <td className="py-3 px-3 font-semibold text-[#0F172A]">{dim.title}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${
                              dim.status === 'healthy'
                                ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                                : dim.status === 'needs_attention'
                                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                : dim.status === 'at_risk'
                                ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                : dim.status === 'not_sure'
                                ? 'bg-[#EDF3FD] text-[#0F52BA] border-[#B7CEF7]'
                                : 'bg-[#EDF3FD] text-[#0F52BA] border-[#B7CEF7]'
                            }`}
                          >
                            {dim.status === 'not_sure' ? 'INSUFFICIENT INFO' : dim.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#0F172A] tabular-nums">
                          {detail && detail.score !== null ? `${detail.score}/100` : '—'}
                        </td>
                        <td className="py-3 px-3 text-[#475569] font-mono text-[11px]">
                          {dim.evidenceType.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-3 text-[#0F172A] max-w-md">
                          {dim.notes || (
                            <span className="text-[#64748B] italic">No notes supplied by owner</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      if (secId === 'strengths_weaknesses') {
        return (
          <div
            key="strengths_weaknesses"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Key Strengths &amp; Weaknesses
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('health')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Update Capabilities &rarr;
                </button>
                {renderSectionMoveControls('strengths_weaknesses')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <div className="font-bold uppercase tracking-wider text-[#15803D] flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Business Strengths ({healthyDims.length})</span>
                </div>
                {healthyDims.length > 0 ? (
                  <ul className="space-y-1.5 text-[#0F172A]">
                    {healthyDims.map((d) => (
                      <li key={d.key}>
                        • <strong>{d.title}:</strong> {d.notes || 'Rated Healthy with owner confirmation.'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[#475569]">
                    No capabilities are rated Healthy yet. Complete or verify the 12-Capability Health check.
                  </p>
                )}
              </div>

              <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <div className="font-bold uppercase tracking-wider text-[#B45309] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Weaknesses &amp; Pressure Areas ({attentionDims.length})</span>
                </div>
                {attentionDims.length > 0 ? (
                  <ul className="space-y-1.5 text-[#0F172A]">
                    {attentionDims.map((d) => (
                      <li key={d.key}>
                        • <strong className={d.status === 'at_risk' ? 'text-[#B91C1C]' : 'text-[#B45309]'}>
                          [{d.status === 'at_risk' ? 'At Risk' : 'Needs Attention'}] {d.title}:
                        </strong>{' '}
                        {d.notes || 'Flagged for corrective attention.'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[#475569]">
                    No capabilities are currently flagged At Risk or Needs Attention.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      }

      if (secId === 'risks') {
        const cashVal = fin?.cashInBank ?? null;
        const limitVal = fin?.creditFacilityLimit ?? 0;
        const usedVal = fin?.creditFacilityUsed ?? 0;
        const headroom = cashVal !== null ? cashVal + Math.max(0, limitVal - usedVal) : null;
        const overdueVal = fin?.overdueReceivables ?? null;
        const arVal = fin?.accountsReceivable ?? null;
        const top5Pct = fin?.top5ConcentrationPercent ?? null;
        const stdTerms = fin?.standardPaymentTermsDays ?? null;
        const actualDelay = fin?.actualPaymentDelayDays ?? null;

        return (
          <div
            key="risks"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09
                      ? 'bg-[#F5761A] text-[#0F172A]'
                      : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Cash, Debtor &amp; Sustainability Risks
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('cashflow')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Open Cash Flow Workbench &rarr;
                </button>
                {renderSectionMoveControls('risks')}
              </div>
            </div>

            {fin ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Liquidity Headroom</span>
                  <strong className={`font-mono text-sm ${(headroom ?? 0) < 0 ? 'text-[#B91C1C]' : 'text-[#0F172A]'}`}>
                    {headroom !== null ? `${p.currency} ${headroom.toLocaleString()}` : 'Insufficient Data'}
                  </strong>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Overdue (&gt;60d) / Total AR</span>
                  <strong className="text-[#B91C1C] font-mono text-sm">
                    {overdueVal !== null ? `${p.currency} ${overdueVal.toLocaleString()}` : 'Not supplied'}
                    {arVal !== null ? ` / ${p.currency} ${arVal.toLocaleString()}` : ''}
                  </strong>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Actual vs Standard Terms</span>
                  <strong className="text-[#0F172A] font-mono text-sm">
                    {actualDelay !== null ? `${actualDelay}d` : '—'} vs {stdTerms !== null ? `${stdTerms}d` : '—'}
                  </strong>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Top-5 Client Concentration</span>
                  <strong className={`font-mono text-sm ${(top5Pct ?? 0) >= 40 ? 'text-[#B91C1C]' : 'text-[#0F172A]'}`}>
                    {top5Pct !== null ? `${top5Pct}%` : 'Not supplied'}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#475569] bg-[#F8FAFC] p-3.5 rounded border border-[#0F172A]/10">
                Cash Flow figures have not yet been entered. Enter Cash, Receivables, Payables, and Overdraft figures on the Cash Flow tab to activate solvency risk stress-testing.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                <strong className="text-[#0F172A] block mb-1">Owner Dependency Risk</strong>
                <span className="text-[#475569]">
                  Status: <strong>{activeCase.healthInputs.ownerDependency.status.replace('_', ' ').toUpperCase()}</strong>
                  {activeCase.healthInputs.ownerDependency.notes
                    ? ` — ${activeCase.healthInputs.ownerDependency.notes}`
                    : ' — Add operational handoff notes in 12-Capability Health.'}
                </span>
              </div>
              <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                <strong className="text-[#0F172A] block mb-1">Long-Term Sustainability &amp; Pricing Discipline</strong>
                <span className="text-[#475569]">
                  Sustainability: <strong>{activeCase.healthInputs.sustainability.status.replace('_', ' ').toUpperCase()}</strong>
                  {fin?.pricingReviewLastYears !== null && fin?.pricingReviewLastYears !== undefined
                    ? ` · Last pricing review: ${fin.pricingReviewLastYears} yr(s) ago`
                    : ''}
                </span>
              </div>
            </div>
          </div>
        );
      }

      if (secId === 'opportunities') {
        const opps = rec?.profitOpportunities || [];
        const totalPipeline = crmContacts.reduce((acc, c) => acc + (c.opportunityValue || 0), 0);
        const followUpDue = crmContacts.filter(
          (c) => c.status === 'Follow-Up Due' || c.status === 'At Risk'
        ).length;

        return (
          <div
            key="opportunities"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09
                      ? 'bg-[#F5761A] text-[#0F172A]'
                      : 'bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0]'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Profit, Revenue &amp; ROI Opportunities
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('options')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Open ROI &amp; Options &rarr;
                </button>
                {renderSectionMoveControls('opportunities')}
              </div>
            </div>

            {opps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {opps.map((opp) => (
                  <div key={opp.id} className="p-3.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#15803D]">{opp.title}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#A7F3D0] text-[#0F172A]">
                        {opp.horizon}
                      </span>
                    </div>
                    <p className="text-[#0F172A] font-medium">{opp.estimatedFinancialImpact}</p>
                    <p className="text-[#475569]">{opp.whatToDoFirst || opp.evidenceBasis}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#475569] bg-[#F8FAFC] p-3.5 rounded border border-[#0F172A]/10">
                Generate the Business Health Report above to surface quantified profit &amp; revenue leakage opportunities tailored to {p.name}.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-1">
                <strong className="text-[#0F172A] uppercase tracking-wider text-[11px] block">
                  CRM &amp; Client Pipeline ({crmContacts.length} Records)
                </strong>
                <p className="text-[#475569]">
                  Active pipeline value: <strong className="font-mono text-[#0F172A]">{p.currency} {totalPipeline.toLocaleString()}</strong> ·{' '}
                  Follow-up due / at risk: <strong className="font-mono text-[#B45309]">{followUpDue}</strong>
                </p>
              </div>
              <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-1">
                <strong className="text-[#0F172A] uppercase tracking-wider text-[11px] block">
                  ROI Scenarios Modeled ({roiScenarios.length})
                </strong>
                {roiScenarios.length > 0 ? (
                  <ul className="space-y-1 text-[#475569]">
                    {roiScenarios.slice(0, 3).map((sc) => {
                      const m = computeRoiScenarioMetrics(sc);
                      return (
                        <li key={sc.id}>
                          • <strong>{sc.name}:</strong>{' '}
                          {!m.hasSufficientData
                            ? 'Insufficient Data'
                            : m.roiPct === null
                            ? 'Zero-Cost Gain'
                            : `${m.roiPct.toFixed(1)}% ROI (${m.paybackMonths !== null ? `${m.paybackMonths.toFixed(1)} mo payback` : 'Never'})`}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[#475569]">No ROI scenarios modeled yet.</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      if (secId === 'action_plan') {
        return (
          <div
            key="action_plan"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  30 / 60 / 90-Day Action Plan ({effectiveActionPlan.length})
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('roadmap')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Open Action Plan &rarr;
                </button>
                {renderSectionMoveControls('action_plan')}
              </div>
            </div>

            {effectiveActionPlan.length > 0 ? (
              <div className="overflow-x-auto border border-[#0F172A]/10 rounded">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#0F172A]/12 text-[10px] font-mono uppercase tracking-wider text-[#475569]">
                      <th className="py-2 px-2.5">Priority &amp; Horizon</th>
                      <th className="py-2 px-2.5">Issue / Opportunity</th>
                      <th className="py-2 px-2.5">Recommended Action</th>
                      <th className="py-2 px-2.5">Reason for Action</th>
                      <th className="py-2 px-2.5">Timeframe</th>
                      <th className="py-2 px-2.5">Owner</th>
                      <th className="py-2 px-2.5">Success Measure / KPI</th>
                      <th className="py-2 px-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0F172A]/10">
                    {effectiveActionPlan.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8FAFC]/60">
                        <td className="py-2.5 px-2.5 font-semibold text-[#0F172A] whitespace-nowrap">
                          <div>{item.priority}</div>
                          <div className="text-[10px] text-[#475569]">{item.horizon}</div>
                        </td>
                        <td className="py-2.5 px-2.5 text-[#0F172A]">{item.businessIssue || 'Diagnostic priority'}</td>
                        <td className="py-2.5 px-2.5 font-semibold text-[#0F172A]">{item.action}</td>
                        <td className="py-2.5 px-2.5 text-[#475569]">
                          {item.rationale || item.dependencyOrRisk || 'Direct diagnostic priority'}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[#0F172A] whitespace-nowrap">
                          {item.timeframe || item.targetCompletionDate || 'Within 30 days'}
                        </td>
                        <td className="py-2.5 px-2.5 text-[#0F172A]">{item.accountableRole}</td>
                        <td className="py-2.5 px-2.5 text-[#475569]">{item.measurableSuccessIndicator}</td>
                        <td className="py-2.5 px-2.5 font-mono font-bold uppercase text-[10px] whitespace-nowrap">
                          {item.status || (item.completed ? 'completed' : 'pending')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#475569] bg-[#F8FAFC] p-4 rounded border border-[#0F172A]/10">
                No Action Plan tasks yet. Click <strong>Generate Business Health Report</strong> above or visit the Action Plan tab to auto-populate prioritised tasks from your diagnostics.
              </p>
            )}
          </div>
        );
      }

      if (secId === 'kpis') {
        return (
          <div
            key="kpis"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  KPI &amp; Performance Monitoring ({kpis.length})
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => (onOpenKpiTracker ? onOpenKpiTracker() : onSwitchTab('dashboard'))}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Open KPI Tracker &rarr;
                </button>
                {renderSectionMoveControls('kpis')}
              </div>
            </div>

            {kpis.length > 0 ? (
              <div className="overflow-x-auto border border-[#0F172A]/10 rounded">
                <table className="w-full text-xs text-left border-collapse tabular-nums">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#0F172A]/12 text-[10px] font-mono uppercase tracking-wider text-[#475569]">
                      <th className="py-2 px-2.5">KPI</th>
                      <th className="py-2 px-2.5">Category</th>
                      <th className="py-2 px-2.5">Baseline</th>
                      <th className="py-2 px-2.5">Target</th>
                      <th className="py-2 px-2.5">Latest Actual</th>
                      <th className="py-2 px-2.5">Variance</th>
                      <th className="py-2 px-2.5">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0F172A]/10">
                    {kpis.map((kpi) => {
                      const variance = computeKpiVariance(
                        kpi.latestActualValue,
                        kpi.targetValue,
                        kpi.direction,
                        kpi.unit,
                        p.currency
                      );
                      const trend = computeKpiTrend(
                        kpi.latestActualValue,
                        kpi.previousValue,
                        kpi.direction,
                        kpi.unit
                      );
                      return (
                        <tr key={kpi.id} className="hover:bg-[#F8FAFC]/60">
                          <td className="py-2.5 px-2.5 font-semibold text-[#0F172A]">{kpi.name}</td>
                          <td className="py-2.5 px-2.5 text-[#475569]">{kpi.categoryLabel}</td>
                          <td className="py-2.5 px-2.5 font-mono">
                            {formatKpiNumber(kpi.baselineValue, kpi.unit, p.currency)}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono">
                            {formatKpiNumber(kpi.targetValue, kpi.unit, p.currency)}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono font-bold text-[#0F172A]">
                            {formatKpiNumber(kpi.latestActualValue, kpi.unit, p.currency)}
                          </td>
                          <td
                            className={`py-2.5 px-2.5 font-mono font-bold ${
                              !variance
                                ? 'text-[#475569]'
                                : variance.isFavorable
                                ? 'text-[#15803D]'
                                : 'text-[#B91C1C]'
                            }`}
                          >
                            {variance ? variance.formattedDelta : 'Insufficient Data'}
                          </td>
                          <td className="py-2.5 px-2.5 font-semibold">{trend}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-xs text-[#475569] flex flex-wrap items-center justify-between gap-3">
                <span>
                  Insufficient KPI baseline data yet. Initialize your industry KPI preset inside Measure Improvement &rarr; KPI &amp; Performance Tracker.
                </span>
                <button
                  type="button"
                  onClick={() => (onOpenKpiTracker ? onOpenKpiTracker() : onSwitchTab('dashboard'))}
                  className="px-3 py-1.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] text-white font-bold text-xs transition print:hidden"
                >
                  Setup KPI Tracker
                </button>
              </div>
            )}
          </div>
        );
      }

      if (secId === 'evidence') {
        const unverifiedDims = dimList.filter(
          (d) => d.evidenceType !== 'verified' && d.status !== 'unanswered' && d.status !== 'not_sure'
        );
        const verifiedDims = dimList.filter((d) => d.evidenceType === 'verified' && d.status !== 'unanswered');

        return (
          <div
            key="evidence"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Evidence Quality, Information Gaps &amp; Documents
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('documents')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Manage Documents ({docs.length}) &rarr;
                </button>
                {renderSectionMoveControls('evidence')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
                <strong className="text-[#15803D] uppercase text-[11px] block">
                  Known / Verified ({verifiedDims.length})
                </strong>
                <p className="text-[#0F172A]">
                  {verifiedDims.length > 0
                    ? verifiedDims.map((d) => d.title).join(', ')
                    : 'No verified capabilities marked yet.'}
                </p>
              </div>
              <div className="p-3.5 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
                <strong className="text-[#B45309] uppercase text-[11px] block">
                  Assumptions / Needs Verification ({unverifiedDims.length})
                </strong>
                <p className="text-[#0F172A]">
                  {unverifiedDims.length > 0
                    ? unverifiedDims.map((d) => d.title).join(', ')
                    : 'No estimated capability ratings pending verification.'}
                </p>
              </div>
              <div className="p-3.5 rounded bg-[#EDF3FD] border border-[#B7CEF7] space-y-1">
                <strong className="text-[#0F52BA] uppercase text-[11px] block">
                  Missing Information ({missingDims.length})
                </strong>
                <p className="text-[#0F172A]">
                  {missingDims.length > 0
                    ? missingDims.map((d) => d.title).join(', ')
                    : 'All 12 capabilities answered.'}
                </p>
              </div>
            </div>

            {fin ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Cash in Bank</span>
                  <strong className="text-[#0F172A] font-mono text-sm">
                    {fin.cashInBank !== null ? `${p.currency} ${fin.cashInBank.toLocaleString()}` : 'Not supplied'}
                  </strong>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Receivables</span>
                  <strong className="text-[#0F172A] font-mono text-sm">
                    {fin.accountsReceivable !== null
                      ? `${p.currency} ${fin.accountsReceivable.toLocaleString()}`
                      : 'Not supplied'}
                  </strong>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Overdue (&gt;60d)</span>
                  <strong className="text-[#B91C1C] font-mono text-sm">
                    {fin.overdueReceivables !== null
                      ? `${p.currency} ${fin.overdueReceivables.toLocaleString()}`
                      : 'Not supplied'}
                  </strong>
                </div>
                <div className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Credit Drawn</span>
                  <strong className="text-[#B45309] font-mono text-sm">
                    {fin.creditFacilityUsed !== null
                      ? `${p.currency} ${fin.creditFacilityUsed.toLocaleString()}`
                      : 'Not supplied'}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#475569] bg-[#F8FAFC] p-3.5 rounded border border-[#0F172A]/10">
                No numerical financial ledger figures have been entered in the Cash Flow Workbench yet. BizPulse never assumes missing financial numbers.
              </p>
            )}

            {docs.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
                  Analyzed Documents ({docs.length})
                </span>
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-[#0F172A]">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F52BA]" />
                        {d.fileName}
                      </span>
                      <span className="text-[11px] font-mono text-[#475569]">{d.fileType.toUpperCase()}</span>
                    </div>
                    <p className="text-[#475569] leading-relaxed">{d.summary}</p>
                  </div>
                ))}
              </div>
            )}

            {activeCase.crossDocumentSynthesis && (
              <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs space-y-2">
                <span className="font-bold text-[#B45309] uppercase tracking-wider block text-[11px]">
                  Cross-Document Financial &amp; Future Earnings Synthesis
                </span>
                <p className="text-[#0F172A] leading-relaxed">{activeCase.crossDocumentSynthesis.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded bg-white border border-[#0F172A]/10">
                    <span className="font-bold text-[#475569] block text-[10px] uppercase">Conservative</span>
                    <p className="text-[#0F172A] mt-0.5">{activeCase.crossDocumentSynthesis.conservativeScenario}</p>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[#0F172A]/10">
                    <span className="font-bold text-[#B45309] block text-[10px] uppercase">Base Case</span>
                    <p className="text-[#0F172A] mt-0.5">{activeCase.crossDocumentSynthesis.baseScenario}</p>
                  </div>
                  <div className="p-2.5 rounded bg-white border border-[#0F172A]/10">
                    <span className="font-bold text-[#15803D] block text-[10px] uppercase">Optimistic Drivers</span>
                    <p className="text-[#0F172A] mt-0.5">{activeCase.crossDocumentSynthesis.optimisticScenario}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

      if (secId === 'recommendations') {
        return (
          <div
            key="recommendations"
            className={
              isSection09
                ? 'bg-white border border-[#F5761A]/35 border-t-4 border-t-[#F5761A] rounded p-6 sm:p-8 shadow-xs space-y-4'
                : 'bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4'
            }
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center ${
                    isSection09 ? 'bg-[#F5761A] text-[#0F172A]' : 'bg-[#0A2E6E] text-white'
                  }`}
                >
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Coaching Recommendations &amp; Strategic Choice
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('recommendations')}
                  className="text-xs text-[#0F52BA] hover:text-[#0A3D8F] font-bold"
                >
                  Open Coaching Tab &rarr;
                </button>
                {renderSectionMoveControls('recommendations')}
              </div>
            </div>

            {rec ? (
              <div className={`space-y-4 ${globalSizeClass}`}>
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-2">
                  <span className="font-bold font-mono text-[#0F52BA] uppercase tracking-wider block text-[11px]">
                    Core Commercial Finding
                  </span>
                  {isEditing ? (
                    <>
                      <textarea
                        rows={2}
                        value={rec.initialObservation}
                        onChange={(e) => updateRecField('initialObservation', e.target.value)}
                        className="w-full bg-white border border-[#0F172A]/15 rounded p-2 font-bold text-[#0F172A] text-sm"
                      />
                      <textarea
                        rows={3}
                        value={rec.commercialWhy}
                        onChange={(e) => updateRecField('commercialWhy', e.target.value)}
                        className="w-full bg-white border border-[#0F172A]/15 rounded p-2 text-[#475569] text-xs"
                      />
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-[#0F172A]">{rec.initialObservation}</p>
                      <p className="text-[#475569] leading-relaxed">{rec.commercialWhy}</p>
                    </>
                  )}
                </div>

                <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                  <span className="font-bold font-mono text-[#B45309] uppercase tracking-wider block text-[11px]">
                    Primary Recommendation
                  </span>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={rec.initialRecommendation}
                      onChange={(e) => updateRecField('initialRecommendation', e.target.value)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded p-2 font-semibold text-[#0F172A] text-xs"
                    />
                  ) : (
                    <p className="text-[#0F172A] font-semibold">{rec.initialRecommendation}</p>
                  )}
                </div>

                <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                  <span className="font-bold text-[#15803D] uppercase tracking-wider block text-[11px]">
                    Immediate 48–72 Hour Priority
                  </span>
                  {isEditing ? (
                    <textarea
                      rows={2}
                      value={rec.immediateAction}
                      onChange={(e) => updateRecField('immediateAction', e.target.value)}
                      className="w-full bg-white border border-[#0F172A]/15 rounded p-2 font-medium text-[#0F172A] text-xs"
                    />
                  ) : (
                    <p className="text-[#0F172A] font-medium">{rec.immediateAction}</p>
                  )}
                </div>

                {rec.sustainabilityAssessment && (
                  <div className="p-4 rounded bg-[#EDF3FD] border border-[#B7CEF7] space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold font-mono text-[#0F52BA] uppercase tracking-wider text-[11px]">
                        Business Sustainability &amp; Strategic Choice
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#0A2E6E] text-white font-bold text-[10px] uppercase">
                        {rec.sustainabilityAssessment.recommendedChoice}
                      </span>
                    </div>
                    <p className="text-[#0F172A] font-medium leading-relaxed">
                      <strong>Current Position: </strong>
                      {rec.sustainabilityAssessment.currentPositionSummary}
                    </p>
                    <p className="text-[#334155] leading-relaxed">
                      <strong>6–12 Month Outlook: </strong>
                      {rec.sustainabilityAssessment.futureOutlook6to12Months}
                    </p>
                    <p className="text-[#0A2E6E] leading-relaxed">
                      <strong>Choice Rationale: </strong>
                      {rec.sustainabilityAssessment.choiceRationale}
                    </p>
                    <p className="text-[11px] italic text-[#475569]">
                      {rec.sustainabilityAssessment.disclaimer}
                    </p>
                  </div>
                )}

                {rec.specialistAdviceNeeded && (
                  <div className="p-3.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#0F172A] text-xs">
                    <strong className="text-[#B45309]">Specialist Advisory Check: </strong>
                    {rec.specialistAdviceNeeded}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-3">
                <p className="text-xs text-[#475569]">
                  Coaching recommendations have not yet been generated for {p.name}.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateFullHealthReport}
                  disabled={isGeneratingReport}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] disabled:opacity-50 text-white font-semibold uppercase tracking-wider text-xs transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>{isGeneratingReport ? 'Generating...' : 'Generate Coaching Plan & Report'}</span>
                </button>
              </div>
            )}
          </div>
        );
      }

      if (secId === 'custom') {
        return renderCustomParagraphsSection(displayNum);
      }

      return null;
    };

    return (
      <div className={`space-y-6 max-w-5xl mx-auto print:max-w-none print:text-black ${globalFontClass}`}>
        {renderEditorToolbar()}

        {/* Section 1: Business Profile & Executive Summary */}
        <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 pb-5 print:border-black">
            <div>
              <span className="bizpulse-label text-[#6495ED]">
                1. Business Profile &amp; Executive Summary · Case: {p.caseId}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 tracking-tight print:text-black">
                {p.name || 'Business Assessment'}
              </h1>
              <p className="text-[#CBD5E1] text-sm mt-1 print:text-gray-700">
                Commercial Diagnostic &amp; Business Health Report · {p.industry} ({p.country})
              </p>
            </div>
            <div className="text-right text-xs text-[#CBD5E1] space-y-1 print:text-gray-700 tabular-nums">
              <div>
                <strong className="text-white print:text-black">Assessment Date:</strong>{' '}
                {h?.assessmentDate || new Date().toISOString().split('T')[0]}
              </div>
              <div>
                <strong className="text-white print:text-black">Currency:</strong> {p.currency} ·{' '}
                <strong className="text-white print:text-black">Team:</strong> {p.employeeCount} Staff,{' '}
                {p.subcontractorCount} Subcontractors
                {p.turnoverRange ? ` · ${p.turnoverRange}` : ''}
              </div>
              <div>
                <strong className="text-white print:text-black">Status:</strong>{' '}
                {h?.overallRating || 'Pending Rating'}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#6495ED] font-mono font-bold uppercase tracking-wider text-[10px] block">
                Overall Health Score
              </span>
              <div className="text-xl font-bold text-white font-mono tabular-nums">
                {h && h.overallScore !== null ? `${h.overallScore} / 100` : 'Pending Rating'}
              </div>
              <span className="text-[#CBD5E1] block">{h?.overallRating || 'Awaiting inputs'}</span>
            </div>

            <div className="p-4 rounded bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#6495ED] font-mono font-bold uppercase tracking-wider text-[10px] block">
                Primary Objective
              </span>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={p.primaryObjective}
                  onChange={(e) => updateProfileField('primaryObjective', e.target.value)}
                  className="w-full bg-white text-[#0F172A] rounded p-2 text-xs font-medium focus:outline-none"
                />
              ) : (
                <p className="text-white font-medium leading-relaxed">
                  {p.primaryObjective || 'Not entered yet'}
                </p>
              )}
            </div>

            <div className="p-4 rounded bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#F5761A] font-mono font-bold uppercase tracking-wider text-[10px] block">
                Primary Concern
              </span>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={p.primaryConcern}
                  onChange={(e) => updateProfileField('primaryConcern', e.target.value)}
                  className="w-full bg-white text-[#0F172A] rounded p-2 text-xs font-medium focus:outline-none"
                />
              ) : (
                <p className="text-white font-medium leading-relaxed">
                  {p.primaryConcern || 'Not entered yet'}
                </p>
              )}
            </div>
          </div>

          {h?.overallExplanation && (
            <p className={`mt-4 text-[#CBD5E1] leading-relaxed print:text-gray-800 ${globalSizeClass}`}>
              <strong className="text-white print:text-black">Diagnostic Summary: </strong>
              {h.overallExplanation}
            </p>
          )}
          {h?.topThreePriorities && h.topThreePriorities.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {h.topThreePriorities.map((tp) => (
                <div key={tp.key} className="p-3 rounded bg-white/10 border border-white/15">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase block ${
                      tp.rank === 1 ? 'text-[#F5761A]' : 'text-[#6495ED]'
                    }`}
                  >
                    Priority #{tp.rank} · {tp.title}
                  </span>
                  <p className="text-[#E2E8F0] mt-1 leading-relaxed">{tp.recommendedFocus}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ordered Report Sections */}
        {sectionOrder.map((secId, idx) => renderCustomSection(secId, idx))}

        {/* Bottom Next Actions Bar */}
        <div className="p-6 sm:p-8 rounded bg-white border border-[#0F172A]/12 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
              Interactive Execution Tools
            </span>
            <h4 className="text-base font-bold text-[#0F172A]">
              Explore Cash Flow, Client Economics &amp; Live Coaching
            </h4>
            <p className="text-xs text-[#475569] max-w-xl">
              Simulate liquidity scenarios or ask your AI Coach follow-up questions tailored to {p.name}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSwitchTab('cashflow')}
              className="px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition"
            >
              Cash Flow
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('clientmatrix')}
              className="px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition"
            >
              Client Matrix
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('aicoach')}
              className="px-4 py-2 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] text-white text-xs font-semibold uppercase tracking-wider transition shadow-xs"
            >
              Consult AI Coach
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DEMONSTRATION CASE: NZ IT MANAGED SERVICES PROVIDER
  // =========================================================================
  const renderDemoSection = (secId: string, idx: number) => {
    const displayNum = String(idx + 2);

    if (secId === 'sec-2') {
      return (
        <div key="sec-2" className="bg-white border border-[#0F172A]/12 rounded overflow-hidden shadow-xs">
          <div className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] border-b border-[#0F172A]/10">
            <button
              type="button"
              onClick={() => toggleAccordion('sec-2')}
              className="flex-1 text-left flex items-center space-x-3"
            >
              <span className="w-8 h-8 rounded bg-[#0A2E6E] text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
                {displayNum}
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Evidence Quality: Verified Baseline vs. Unverified vs. Missing
                </h2>
                <p className="text-xs text-[#475569]">
                  Distinguishing established facts from unverified owner estimates
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {renderSectionMoveControls('sec-2')}
              <button type="button" onClick={() => toggleAccordion('sec-2')} className="p-1 print:hidden">
                {activeAccordion === 'sec-2' ? (
                  <ChevronUp className="w-5 h-5 text-[#475569]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#475569]" />
                )}
              </button>
            </div>
          </div>

          <div className={activeAccordion === 'sec-2' ? 'block' : 'hidden print:block'}>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                  <div className="flex items-center space-x-2 text-[#15803D] font-bold text-xs uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    <span>Verified Baseline</span>
                  </div>
                  <ul className="text-xs text-[#0F172A] space-y-1.5 list-disc list-inside">
                    <li>8 years operating; 48 active B2B customers.</li>
                    <li>12 employees + 2 subcontractors.</li>
                    <li>NZ$75,000 overdraft limit; NZ$38,000 operating cash.</li>
                    <li>20-day standard invoice payment terms.</li>
                  </ul>
                </div>

                <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                  <div className="flex items-center space-x-2 text-[#B45309] font-bold text-xs uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4" />
                    <span>Reported (Needs Verification)</span>
                  </div>
                  <ul className="text-xs text-[#0F172A] space-y-1.5 list-disc list-inside">
                    <li>Annual revenue NZ$1.28M; paper profit NZ$100k.</li>
                    <li>NZ$175,000 receivables; NZ$58,000 &gt;60 days overdue.</li>
                    <li>NZ$52,000 overdraft drawn; Top 5 clients = 38%.</li>
                  </ul>
                </div>

                <div className="p-4 rounded bg-[#F1F5F9] border border-[#CBD5E1] space-y-2">
                  <div className="flex items-center space-x-2 text-[#475569] font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Missing Evidence</span>
                  </div>
                  <ul className="text-xs text-[#0F172A] space-y-1.5 list-disc list-inside">
                    <li>Itemized aged receivables ledger with dispute flags.</li>
                    <li>Gross margin per contract &amp; effective hourly rates.</li>
                    <li>4-week GST, PAYE &amp; supplier commitment schedule.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (secId === 'sec-3') {
      return (
        <div key="sec-3" className="bg-white border border-[#0F172A]/12 rounded overflow-hidden shadow-xs">
          <div className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] border-b border-[#0F172A]/10">
            <button
              type="button"
              onClick={() => toggleAccordion('sec-3')}
              className="flex-1 text-left flex items-center space-x-3"
            >
              <span className="w-8 h-8 rounded bg-[#FEF2F2] text-[#B91C1C] font-mono font-bold text-sm flex items-center justify-center border border-[#FECACA] shrink-0">
                {displayNum}
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Paper Profit vs. Cash Squeeze
                </h2>
                <p className="text-xs text-[#475569]">
                  Why NZ$100k reported profit is still leaving the bank account short
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {renderSectionMoveControls('sec-3')}
              <button type="button" onClick={() => toggleAccordion('sec-3')} className="p-1 print:hidden">
                {activeAccordion === 'sec-3' ? (
                  <ChevronUp className="w-5 h-5 text-[#475569]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#475569]" />
                )}
              </button>
            </div>
          </div>

          <div className={activeAccordion === 'sec-3' ? 'block' : 'hidden print:block'}>
            <div className="p-6 space-y-4 text-xs text-[#0F172A] leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                <div className="p-3.5 bg-[#F8FAFC] rounded border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Trapped in Receivables</span>
                  <span className="text-lg font-bold text-[#B91C1C] font-mono block">NZ$175,000</span>
                </div>
                <div className="p-3.5 bg-[#F8FAFC] rounded border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Net Immediate Liquidity</span>
                  <span className="text-lg font-bold text-[#B91C1C] font-mono block">-NZ$54,000</span>
                </div>
                <div className="p-3.5 bg-[#F8FAFC] rounded border border-[#0F172A]/10">
                  <span className="text-[#475569] block text-[11px]">Overdraft Drawn</span>
                  <span className="text-lg font-bold text-[#B45309] font-mono block">
                    NZ$52,000 / NZ$75k
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (secId === 'sec-4') {
      return (
        <div key="sec-4" className="bg-white border border-[#0F172A]/12 rounded overflow-hidden shadow-xs">
          <div className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] border-b border-[#0F172A]/10">
            <button
              type="button"
              onClick={() => toggleAccordion('sec-4')}
              className="flex-1 text-left flex items-center space-x-3"
            >
              <span className="w-8 h-8 rounded bg-[#FFFBEB] text-[#B45309] font-mono font-bold text-sm flex items-center justify-center border border-[#FDE68A] shrink-0">
                {displayNum}
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Integrated Commercial Risk Map
                </h2>
                <p className="text-xs text-[#475569]">
                  Cash lag, delivery bottlenecks, and margin erosion
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {renderSectionMoveControls('sec-4')}
              <button type="button" onClick={() => toggleAccordion('sec-4')} className="p-1 print:hidden">
                {activeAccordion === 'sec-4' ? (
                  <ChevronUp className="w-5 h-5 text-[#475569]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#475569]" />
                )}
              </button>
            </div>
          </div>

          <div className={activeAccordion === 'sec-4' ? 'block' : 'hidden print:block'}>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {RISK_MAP_ITEMS.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[#0F52BA] font-mono">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                      {item.urgency}
                    </span>
                  </div>
                  <p className="text-[#0F172A] font-semibold">{item.reportedSymptom}</p>
                  <p className="text-[#475569]">{item.possibleUnderlyingCause}</p>
                  <div className="p-2.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D]">
                    <strong>First Action: </strong>
                    {item.recommendedFirstAction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (secId === 'sec-5') {
      return (
        <div key="sec-5" className="bg-white border border-[#0F172A]/12 rounded overflow-hidden shadow-xs">
          <div className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] border-b border-[#0F172A]/10">
            <button
              type="button"
              onClick={() => toggleAccordion('sec-5')}
              className="flex-1 text-left flex items-center space-x-3"
            >
              <span className="w-8 h-8 rounded bg-[#FFFBEB] text-[#B45309] font-mono font-bold text-sm flex items-center justify-center border border-[#FDE68A] shrink-0">
                {displayNum}
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Capital Investment Comparison (Options A, B &amp; C)
                </h2>
                <p className="text-xs text-[#475569]">
                  Marketing spend vs. Salesperson hire vs. Core margin turnaround
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {renderSectionMoveControls('sec-5')}
              <button type="button" onClick={() => toggleAccordion('sec-5')} className="p-1 print:hidden">
                {activeAccordion === 'sec-5' ? (
                  <ChevronUp className="w-5 h-5 text-[#475569]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#475569]" />
                )}
              </button>
            </div>
          </div>

          <div className={activeAccordion === 'sec-5' ? 'block' : 'hidden print:block'}>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {GROWTH_OPTIONS_EVALUATION.map((opt) => (
                  <div
                    key={opt.id}
                    className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-2 text-xs"
                  >
                    <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0A2E6E] text-[#6495ED] font-mono inline-block">
                      {opt.id}
                    </span>
                    <h3 className="font-bold text-[#0F172A] text-sm">{opt.title}</h3>
                    <p className="text-[#475569]">{opt.proposedAction}</p>
                    <div className="pt-2 border-t border-[#0F172A]/10">
                      <span className="font-semibold text-[#0F172A]">Upfront Outlay: </span>
                      <span className="font-mono">{opt.upfrontCashRequirement}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (secId === 'sec-6') {
      return (
        <div key="sec-6" className="p-6 sm:p-8 rounded bg-white border border-[#0F172A]/12 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[#0F172A] font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-[#0F52BA]" />
              <span>48-Hour Management Decision Gates</span>
            </div>
            {renderSectionMoveControls('sec-6')}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-[#0F172A]">
            <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
              <strong className="text-[#15803D] font-bold block text-sm">1. What to Do First</strong>
              <p>Verify the NZ$58k overdue ledger within 48 hours and initiate direct owner collection calls.</p>
            </div>
            <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-1">
              <strong className="text-[#B91C1C] font-bold block text-sm">2. What to Pause</strong>
              <p>Defer NZ$20k marketing spend and NZ$85k salesperson recruitment until liquidity stabilizes.</p>
            </div>
            <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
              <strong className="text-[#B45309] font-bold block text-sm">3. Evidence Needed</strong>
              <p>Aged receivables ledger, 4-week tax/payroll cash commitments, and top-5 contract renewal dates.</p>
            </div>
            <div className="p-4 rounded bg-[#F1F5F9] border border-[#CBD5E1] space-y-1">
              <strong className="text-[#475569] font-bold block text-sm">4. Day-60 Gate</strong>
              <p>Re-evaluate growth hiring once overdraft stays below NZ$20k and pricing review is underway.</p>
            </div>
          </div>
        </div>
      );
    }

    if (secId === 'custom') {
      return renderCustomParagraphsSection(displayNum);
    }

    return null;
  };

  return (
    <div className={`space-y-6 max-w-5xl mx-auto print:max-w-none print:text-black ${globalFontClass}`}>
      {renderEditorToolbar()}

      {/* Top Architectural Navy Demo Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        <div className="border-b border-white/15 pb-6 print:border-black">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="bizpulse-label text-[#6495ED]">
                  Executive Turnaround Briefing
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#CBD5E1] bg-white/10 px-2.5 py-0.5 rounded border border-white/15">
                  Benchmark Demo Case: NZ MSP
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 tracking-tight print:text-black">
                {p.name}: Commercial Turnaround Diagnostic
              </h1>
              <p className="text-[#CBD5E1] text-sm mt-1 print:text-gray-700">
                B2B IT Managed Services Provider ({p.country})
              </p>
            </div>
            <div className="text-right text-xs text-[#CBD5E1] space-y-1 print:text-gray-700 tabular-nums">
              <div>
                <strong className="text-white print:text-black">Date:</strong>{' '}
                {h?.assessmentDate || '2026-10-14'}
              </div>
              <div>
                <strong className="text-white print:text-black">Currency:</strong> {p.currency} ·{' '}
                <strong className="text-white print:text-black">Team:</strong> {p.employeeCount}{' '}
                Staff + {p.subcontractorCount} Subcontractors
              </div>
              <div>
                <strong className="text-white print:text-black">Overall Health:</strong>{' '}
                {h?.overallScore ?? 55}/100 ({h?.overallRating || 'Needs Attention'})
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 p-4 rounded bg-white/10 border border-white/15 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[#6495ED]" />
              <span className="font-bold text-white text-sm">
                Overall Health Assessment:
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  h?.overallRating === 'Healthy'
                    ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                    : h?.overallRating === 'Needs Attention'
                    ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                }`}
              >
                {(h?.overallRating || 'AT RISK').toUpperCase()} ({h?.overallScore ?? 35}/100)
              </span>
            </div>
          </div>

          <p className={`text-[#CBD5E1] leading-relaxed ${globalSizeClass}`}>
            The business has an 8-year operating history, 48 recurring clients, and NZ$100,000 paper operating profit on NZ$1.28M revenue. However, NZ$175,000 trapped in receivables (NZ$58,000 overdue &gt;60 days) has pushed bank overdraft borrowing to NZ$52,000 of a NZ$75,000 limit while unbilled scope creep strains senior technician capacity.
          </p>
        </div>
      </div>

      {sectionOrder.map((secId, idx) => renderDemoSection(secId, idx))}
    </div>
  );
};
