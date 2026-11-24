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
    <div className="bg-[#F1F5F9] border-b border-[#0F172A]/10 text-xs text-[#0F172A] py-2 px-4 sm:px-6 lg:px-8 print:hidden">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Active Business Selector & Resume Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#0F172A]/60 font-mono uppercase tracking-[0.12em] text-[10px] flex items-center gap-1.5 whitespace-nowrap">
            <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Business Session</span>
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen);
                setConfirmDeleteId(null);
              }}
              className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded border border-[#0F172A]/15 hover:border-[#2563EB] text-[#0F172A] font-semibold transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              <span className="max-w-[180px] sm:max-w-[260px] truncate text-left">
                {activeCase.profile.name || 'New Business Assessment'}
              </span>
              {activeCase.profile.isDemonstrationCase && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                  · Sample Demo (Not Real Data)
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />
            </button>

            {isOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-[420px] bg-white border border-[#0F172A]/15 rounded shadow-xl z-50 p-2.5 space-y-2">
                <div className="px-2.5 py-1.5 border-b border-[#0F172A]/10 text-[11px] text-[#475569] flex items-center justify-between">
                  <span className="font-bold text-[#0F172A]">Resume Saved Business</span>
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
                        className={`flex items-center justify-between p-2.5 rounded border transition ${
                          isCurrent
                            ? 'bg-[#EFF6FF] border-[#2563EB]'
                            : 'bg-white border-transparent hover:bg-[#F8FAFC] hover:border-[#0F172A]/10'
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
                            <span className="truncate text-xs font-bold text-[#0F172A]">
                              {c.profile.name || 'Untitled Business'}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-[#2563EB]">(Active)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#475569] truncate mt-0.5 tabular-nums">
                            {c.profile.industry} · {c.profile.currency} · {answered}/12 Health · Score: {scoreText}
                            {docsCount > 0 ? ` · ${docsCount} doc${docsCount > 1 ? 's' : ''}` : ''}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {c.profile.isDemonstrationCase ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
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
                                className="px-1.5 py-1 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-semibold"
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
                              className="text-[#64748B] hover:text-[#B91C1C] p-1 transition"
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
                <div className="pt-2 border-t border-[#0F172A]/10 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNewCase();
                      setIsOpen(false);
                    }}
                    className="p-2 rounded bg-[#0B1324] hover:bg-[#172554] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#60A5FA]" />
                    <span>New Business</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoCase();
                      setIsOpen(false);
                    }}
                    className="p-2 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#0F172A]/15 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <FolderSync className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Sample Demo Business</span>
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
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-[#0B1324] hover:bg-[#172554] text-white transition text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
            title="Start a completely separate, clean business session"
          >
            <Plus className="w-3 h-3 text-[#60A5FA]" />
            <span>New Business</span>
          </button>

          <button
            type="button"
            onClick={onSaveCase}
            disabled={isSyncing}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white transition text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
            title="Save current business state to your private workspace"
          >
            <Save className="w-3 h-3" />
            <span>{isSyncing ? 'Saving...' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={onReenterEssentials}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#0F172A]/15 transition text-[11px] font-semibold whitespace-nowrap"
            title="Re-enter or edit business essentials for this session"
          >
            <Edit3 className="w-3 h-3 text-[#2563EB]" />
            <span className="hidden sm:inline">Re-enter Essentials</span>
          </button>

          <button
            type="button"
            onClick={onLoadDemoCase}
            className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#0F172A]/15 transition text-[11px] font-medium whitespace-nowrap"
            title="Load benchmark NZ Managed IT Services example"
          >
            <FolderSync className="w-3 h-3 text-[#2563EB]" />
            <span>Sample Demo</span>
          </button>

          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center space-x-1 px-2 py-1.5 rounded bg-white hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/15 transition text-[11px] whitespace-nowrap"
            title="Download backup JSON for this business"
          >
            <Download className="w-3 h-3" />
            <span className="hidden xl:inline">Backup</span>
          </button>

          <label
            className="flex items-center space-x-1 px-2 py-1.5 rounded bg-white hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/15 transition text-[11px] cursor-pointer whitespace-nowrap"
            title="Import a saved business JSON file as a separate session"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden xl:inline">Import</span>
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </div>

      {importError && (
        <div className="max-w-7xl mx-auto mt-2 p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#B91C1C]" />
            <span>{importError}</span>
          </div>
          <button type="button" onClick={() => setImportError(null)} className="text-[#475569] hover:text-[#0F172A] font-semibold">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
