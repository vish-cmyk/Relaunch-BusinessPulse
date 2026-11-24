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
} from 'lucide-react';
import {
  RISK_MAP_ITEMS,
  GROWTH_OPTIONS_EVALUATION,
} from '../data/coachingBriefing';
import {
  CaseRecord,
  ReportCustomBlock,
  ReportEditorSettings,
  ReportFontFamily,
  ReportFontSize,
  ReportBlockAlign,
} from '../types/bizpulse';

interface ExecutiveMemoProps {
  activeCase: CaseRecord;
  onSwitchTab: (tab: string) => void;
  onUpdateCase?: (updated: CaseRecord) => void;
  onOpenExportModal?: () => void;
  onOpenCoachWithPrompt?: (prompt: string) => void;
}

const DEFAULT_CUSTOM_ORDER = ['dimensions', 'evidence', 'recommendations', 'custom'];
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
        card: 'bg-[#EFF6FF] border-[#BFDBFE]',
        heading: 'text-[#1D4ED8]',
        badge: 'bg-[#1D4ED8] text-white',
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
        badge: 'bg-[#0F172A] text-white',
      };
  }
}

export const ExecutiveMemo: React.FC<ExecutiveMemoProps> = ({
  activeCase,
  onSwitchTab,
  onUpdateCase,
  onOpenExportModal,
}) => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>('sec-2');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

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
    setTimeout(() => setSaveNotice(null), 2500);
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
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className={`px-3.5 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition border ${
              isEditing
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] hover:bg-[#DBEAFE]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Done Editing Report' : 'Edit Tools (Move, Font, Paragraphs)'}</span>
          </button>

          <button
            type="button"
            onClick={handleAddParagraph}
            className="px-3.5 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Paragraph</span>
          </button>

          {onOpenExportModal && (
            <button
              type="button"
              onClick={onOpenExportModal}
              className="px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Export Edited PDF / Word</span>
            </button>
          )}
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
                    ? 'bg-[#0F172A] text-white'
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

      {isEditing && (
        <p className="text-[11px] text-[#475569] bg-[#F8FAFC] border border-[#0F172A]/10 rounded px-3 py-2">
          <strong>Edit Mode Active:</strong> Use the Up/Down arrows on any section or custom paragraph to reorder it, change fonts/sizes/alignment/bold/italic, edit report text inline, or add custom paragraphs. All changes save automatically to your case and carry into PDF, Word (.docx), and Markdown exports.
        </p>
      )}
    </div>
  );

  const renderCustomParagraphsSection = (displayNum: string) => {
    if (reportBlocks.length === 0 && !isEditing) return null;

    return (
      <div
        key="custom"
        className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10 gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="w-7 h-7 rounded bg-[#0F172A] text-white font-mono font-bold text-xs flex items-center justify-center">
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
              className="px-3 py-1.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-bold border border-[#BFDBFE] flex items-center gap-1 transition"
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
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
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
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
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
                                      ? 'bg-[#2563EB] text-white'
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
                            <option value="blue">Cobalt Highlight</option>
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
                            className="p-1.5 rounded bg-white border border-[#0F172A]/15 text-[#2563EB] hover:bg-[#EFF6FF]"
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
                        className={`w-full bg-white border border-[#0F172A]/15 rounded px-3 py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${blockFont} ${accent.heading}`}
                      />
                      <textarea
                        rows={4}
                        value={block.body}
                        onChange={(e) => handleUpdateBlock(block.id, { body: e.target.value })}
                        placeholder="Enter paragraph commentary..."
                        className={`w-full bg-white border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB] ${blockFont} ${blockSize} ${blockAlign} ${
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

  // Custom Business Executive Diagnostic Report
  if (!isDemo) {
    const renderCustomSection = (secId: string, indexNum: number) => {
      const displayNum = String(indexNum + 1);

      if (secId === 'dimensions') {
        return (
          <div key="dimensions" className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#0F172A] text-white font-mono font-bold text-xs flex items-center justify-center">
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Twelve Business Health Capabilities
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchTab('health')}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold print:hidden"
                >
                  Edit Dimensions &rarr;
                </button>
                {renderSectionMoveControls('dimensions')}
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
                  {Object.values(activeCase.healthInputs).map((dim) => {
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
                                ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]'
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

      if (secId === 'evidence') {
        return (
          <div key="evidence" className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#0F172A] text-white font-mono font-bold text-xs flex items-center justify-center">
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Supplied Financial &amp; Document Evidence
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('documents')}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold"
                >
                  Manage Documents ({docs.length}) &rarr;
                </button>
                {renderSectionMoveControls('evidence')}
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
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563EB]" />
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
          <div key="recommendations" className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/10">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded bg-[#0F172A] text-white font-mono font-bold text-xs flex items-center justify-center">
                  {displayNum}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  Coaching Recommendations &amp; Priority Actions
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onSwitchTab('recommendations')}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold"
                >
                  Open Coaching Tab &rarr;
                </button>
                {renderSectionMoveControls('recommendations')}
              </div>
            </div>

            {rec ? (
              <div className={`space-y-4 ${globalSizeClass}`}>
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-2">
                  <span className="font-bold font-mono text-[#2563EB] uppercase tracking-wider block text-[11px]">
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
                  <div className="p-4 rounded bg-[#EFF6FF] border border-[#BFDBFE] space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold font-mono text-[#1D4ED8] uppercase tracking-wider text-[11px]">
                        Business Sustainability &amp; Strategic Choice
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#0F172A] text-white font-bold text-[10px] uppercase">
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
                    <p className="text-[#1E3A8A] leading-relaxed">
                      <strong>Choice Rationale: </strong>
                      {rec.sustainabilityAssessment.choiceRationale}
                    </p>
                    <p className="text-[11px] italic text-[#475569]">
                      {rec.sustainabilityAssessment.disclaimer}
                    </p>
                  </div>
                )}

                {rec.profitOpportunities && rec.profitOpportunities.length > 0 && (
                  <div className="p-4 rounded bg-[#F8FAFC] border border-[#CBD5E1] space-y-2 text-xs">
                    <span className="font-bold font-mono text-[#0F172A] uppercase tracking-wider block text-[11px]">
                      Top Profit &amp; Revenue Leakage Levers ({rec.profitOpportunities.length})
                    </span>
                    <ul className="space-y-1.5 text-[#1E293B]">
                      {rec.profitOpportunities.slice(0, 5).map((opp) => (
                        <li key={opp.id}>
                          • <strong>[{opp.horizon}] {opp.title}:</strong> {opp.estimatedFinancialImpact} ({opp.whatToDoFirst || opp.evidenceBasis})
                        </li>
                      ))}
                    </ul>
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
                  onClick={() => onSwitchTab('recommendations')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold uppercase tracking-wider text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>Generate Coaching Plan</span>
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

        {/* Top Architectural Navy Executive Header */}
        <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 pb-5 print:border-black">
            <div>
              <span className="bizpulse-label text-[#60A5FA]">
                Executive Diagnostic Briefing · Case: {p.caseId}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 tracking-tight print:text-black">
                {p.name || 'Business Assessment'}
              </h1>
              <p className="text-[#CBD5E1] text-sm mt-1 print:text-gray-700">
                Commercial Diagnostic &amp; Action Report · {p.industry} ({p.country})
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
              <span className="text-[#60A5FA] font-mono font-bold uppercase tracking-wider text-[10px] block">
                Overall Health Score
              </span>
              <div className="text-xl font-bold text-white font-mono tabular-nums">
                {h && h.overallScore !== null ? `${h.overallScore} / 100` : 'Pending Rating'}
              </div>
              <span className="text-[#CBD5E1] block">{h?.overallRating || 'Awaiting inputs'}</span>
            </div>

            <div className="p-4 rounded bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#60A5FA] font-mono font-bold uppercase tracking-wider text-[10px] block">
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
              <span className="text-[#FCD34D] font-mono font-bold uppercase tracking-wider text-[10px] block">
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
                  <span className="text-[10px] font-mono font-bold uppercase text-[#60A5FA] block">
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
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
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
              className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold uppercase tracking-wider transition shadow-xs"
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
              <span className="w-8 h-8 rounded bg-[#0F172A] text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
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
                    <span className="font-bold uppercase tracking-wider text-[#2563EB] font-mono">
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
                    <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0F172A] text-[#60A5FA] font-mono inline-block">
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
              <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
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
                <span className="bizpulse-label text-[#60A5FA]">
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
              <Activity className="w-5 h-5 text-[#60A5FA]" />
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
