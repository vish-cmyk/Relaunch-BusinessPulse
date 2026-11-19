import React, { useState } from 'react';
import {
  Building2,
  Plus,
  FolderSync,
  Download,
  Upload,
  Trash2,
  AlertCircle,
  ChevronDown,
  Save,
  Check,
  Edit3,
  FolderOpen,
} from 'lucide-react';
import { CaseRecord } from '../types/bizpulse';

interface CaseManagerBarProps {
  cases: CaseRecord[];
  activeCase: CaseRecord;
  isSyncing?: boolean;
  lastSavedAt?: string | null;
  onSwitchCase: (caseId: string) => void;
  onNewCase: () => void;
  onSaveCase: () => void;
  onReenterEssentials: () => void;
  onLoadDemoCase: () => void;
  onDeleteCase: (caseId: string) => void;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
}

export const CaseManagerBar: React.FC<CaseManagerBarProps> = ({
  cases,
  activeCase,
  isSyncing = false,
  lastSavedAt,
  onSwitchCase,
  onNewCase,
  onSaveCase,
  onReenterEssentials,
  onLoadDemoCase,
  onDeleteCase,
  onExportJson,
  onImportJson,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        onImportJson(text);
        setImportError(null);
        setIsOpen(false);
      } catch {
        setImportError('Invalid JSON case file. Please verify the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const countAnswered = (c: CaseRecord) =>
    Object.values(c.healthInputs || {}).filter((h) => h.status !== 'unanswered').length;

  return (
    <div className="bg-[#EEF3FA] border-b border-[#D9E2F0] text-xs text-[#0B1324] py-2 px-4 sm:px-6 lg:px-8 print:hidden">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Active Business Selector & Resume Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#52627A] font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 whitespace-nowrap">
            <Building2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>Business Session:</span>
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen);
                setConfirmDeleteId(null);
              }}
              className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-[#CBD5E1] hover:border-[#1D4ED8] text-[#0B1324] font-semibold transition shadow-2xs"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
              <span className="max-w-[180px] sm:max-w-[260px] truncate text-left">
                {activeCase.profile.name || 'New Business Assessment'}
              </span>
              {activeCase.profile.isDemonstrationCase && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                  Demo
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#52627A]" />
            </button>

            {isOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-[420px] bg-white border border-[#D9E2F0] rounded-xl shadow-xl z-50 p-2.5 space-y-2">
                <div className="px-2.5 py-1.5 border-b border-[#E8EEF7] text-[11px] text-[#52627A] flex items-center justify-between">
                  <span className="font-bold text-[#0B1324]">Resume Saved Business</span>
                  <span className="font-mono tabular-nums">{cases.length} saved</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 py-1">
                  {cases.map((c) => {
                    const isCurrent = c.id === activeCase.id;
                    const answered = countAnswered(c);
                    const docsCount = c.uploadedDocuments?.length || 0;
                    const scoreText =
                      c.overallHealth?.overallScore !== null && c.overallHealth?.overallScore !== undefined
                        ? `${c.overallHealth.overallScore}/100`
                        : 'Pending';

                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                          isCurrent
                            ? 'bg-[#EFF6FF] border-[#93C5FD]'
                            : 'bg-white border-transparent hover:bg-[#F3F6FB] hover:border-[#E8EEF7]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchCase(c.id);
                            setIsOpen(false);
                            setConfirmDeleteId(null);
                          }}
                          className="flex-1 text-left min-w-0 mr-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-[#0B1324]">
                              {c.profile.name || 'Untitled Business'}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-[#1D4ED8]">(Active)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#52627A] truncate mt-0.5 tabular-nums">
                            {c.profile.industry} · {c.profile.currency} · {answered}/8 Health · Score: {scoreText}
                            {docsCount > 0 ? ` · ${docsCount} doc${docsCount > 1 ? 's' : ''}` : ''}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {c.profile.isDemonstrationCase ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#BFDBFE]">
                              Demo
                            </span>
                          ) : confirmDeleteId === c.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteCase(c.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-[#B91C1C] text-white text-[10px] font-bold hover:bg-[#991B1B]"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-1 rounded bg-[#F1F5F9] text-[#52627A] text-[10px] font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(c.id);
                              }}
                              className="text-[#94A3B8] hover:text-[#B91C1C] p-1 transition"
                              title="Delete business session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dropdown Footer Actions */}
                <div className="pt-2 border-t border-[#E8EEF7] grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNewCase();
                      setIsOpen(false);
                    }}
                    className="p-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Business</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoCase();
                      setIsOpen(false);
                    }}
                    className="p-2 rounded-lg bg-white hover:bg-[#F3F6FB] text-[#0B1324] border border-[#CBD5E1] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <FolderSync className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>Resume Demo MSP</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {lastSavedAt && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-[#15803D] font-medium whitespace-nowrap">
              <Check className="w-3 h-3" />
              <span>Saved {lastSavedAt}</span>
            </span>
          )}
        </div>

        {/* Clear New Business, Save, Re-enter, Resume & Backup Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onNewCase}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white transition text-[11px] font-bold whitespace-nowrap"
            title="Start a completely separate, clean business session"
          >
            <Plus className="w-3 h-3 text-[#93C5FD]" />
            <span>New Business</span>
          </button>

          <button
            type="button"
            onClick={onSaveCase}
            disabled={isSyncing}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white transition text-[11px] font-bold whitespace-nowrap"
            title="Save current business state to your private workspace"
          >
            <Save className="w-3 h-3" />
            <span>{isSyncing ? 'Saving...' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={onReenterEssentials}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F3F6FB] text-[#0B1324] border border-[#CBD5E1] transition text-[11px] font-semibold whitespace-nowrap"
            title="Re-enter or edit business essentials for this session"
          >
            <Edit3 className="w-3 h-3 text-[#1D4ED8]" />
            <span className="hidden sm:inline">Re-enter Essentials</span>
          </button>

          <button
            type="button"
            onClick={onLoadDemoCase}
            className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F3F6FB] text-[#0B1324] border border-[#CBD5E1] transition text-[11px] font-medium whitespace-nowrap"
            title="Load benchmark NZ Managed IT Services example"
          >
            <FolderSync className="w-3 h-3 text-[#1D4ED8]" />
            <span>Demo Case</span>
          </button>

          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center space-x-1 px-2 py-1.5 rounded-lg bg-white hover:bg-[#F3F6FB] text-[#52627A] hover:text-[#0B1324] border border-[#CBD5E1] transition text-[11px] whitespace-nowrap"
            title="Download backup JSON for this business"
          >
            <Download className="w-3 h-3" />
            <span className="hidden xl:inline">Backup</span>
          </button>

          <label
            className="flex items-center space-x-1 px-2 py-1.5 rounded-lg bg-white hover:bg-[#F3F6FB] text-[#52627A] hover:text-[#0B1324] border border-[#CBD5E1] transition text-[11px] cursor-pointer whitespace-nowrap"
            title="Import a saved business JSON file as a separate session"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden xl:inline">Import</span>
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </div>

      {importError && (
        <div className="max-w-7xl mx-auto mt-2 p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#B91C1C]" />
            <span>{importError}</span>
          </div>
          <button type="button" onClick={() => setImportError(null)} className="text-[#52627A] hover:text-[#0B1324] font-semibold">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
