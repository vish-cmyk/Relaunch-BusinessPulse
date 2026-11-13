import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  FolderSync, 
  Download, 
  Upload, 
  Trash2, 
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { CaseRecord } from '../types/bizpulse';

interface CaseManagerBarProps {
  cases: CaseRecord[];
  activeCase: CaseRecord;
  onSwitchCase: (caseId: string) => void;
  onNewCase: () => void;
  onLoadDemoCase: () => void;
  onDeleteCase: (caseId: string) => void;
  onExportJson: () => void;
  onImportJson: (jsonString: string) => void;
}

export const CaseManagerBar: React.FC<CaseManagerBarProps> = ({
  cases,
  activeCase,
  onSwitchCase,
  onNewCase,
  onLoadDemoCase,
  onDeleteCase,
  onExportJson,
  onImportJson
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
      } catch (err: any) {
        setImportError('Invalid JSON case file. Please check file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-[#F8F9FA] border-b border-[#E5EBEF] text-xs text-[#14283F] py-2 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Active Case Selector Pill */}
        <div className="flex items-center space-x-2">
          <span className="text-[#64748B] font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#168C83]" />
            Active Case:
          </span>

          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-[#CBD5E1] hover:border-[#168C83] text-[#14283F] font-semibold transition shadow-2xs"
            >
              <span className="max-w-[200px] sm:max-w-[300px] truncate text-left">
                {activeCase.profile.name}
              </span>
              {activeCase.profile.isDemonstrationCase && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30">
                  Demo
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {/* Dropdown Menu of Cases */}
            {isOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 bg-white border border-[#E5EBEF] rounded-xl shadow-xl z-50 p-2 space-y-1">
                <div className="px-3 py-2 border-b border-[#E5EBEF] text-[11px] text-[#64748B] flex items-center justify-between">
                  <span className="font-semibold text-[#14283F]">Switch Assessment Case</span>
                  <span className="font-mono text-[#64748B]">{cases.length} saved</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                  {cases.map((c) => {
                    const isCurrent = c.id === activeCase.id;
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg transition ${
                          isCurrent
                            ? 'bg-[#E6F4F2] border border-[#168C83]/30 text-[#168C83] font-semibold'
                            : 'hover:bg-[#F5F6F3] text-[#14283F]'
                        }`}
                      >
                        <button
                          onClick={() => {
                            onSwitchCase(c.id);
                            setIsOpen(false);
                          }}
                          className="flex-1 text-left truncate mr-2"
                        >
                          <div className="truncate text-xs font-semibold text-[#14283F]">{c.profile.name}</div>
                          <div className="text-[10px] text-[#64748B] truncate">
                            {c.profile.industry} • {c.profile.country} ({c.profile.currency})
                          </div>
                        </button>

                        <div className="flex items-center gap-1">
                          {c.profile.isDemonstrationCase ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E6F4F2] text-[#168C83] font-semibold">
                              Demo
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete assessment for "${c.profile.name}"?`)) {
                                  onDeleteCase(c.id);
                                }
                              }}
                              className="text-[#94A3B8] hover:text-[#B91C1C] p-1 transition"
                              title="Delete case"
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
                <div className="pt-2 border-t border-[#E5EBEF] grid grid-cols-2 gap-1.5 text-center">
                  <button
                    onClick={() => {
                      onNewCase();
                      setIsOpen(false);
                    }}
                    className="p-1.5 rounded-lg bg-[#168C83] hover:bg-[#12726B] text-white font-bold text-xs flex items-center justify-center gap-1 transition shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Business</span>
                  </button>
                  <button
                    onClick={() => {
                      onLoadDemoCase();
                      setIsOpen(false);
                    }}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#F5F6F3] text-[#14283F] border border-[#CBD5E1] font-semibold text-xs flex items-center justify-center gap-1 transition"
                  >
                    <FolderSync className="w-3 h-3 text-[#168C83]" />
                    <span>Load Demo MSP</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Case Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onNewCase}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#E6F4F2] hover:bg-[#d4edea] text-[#168C83] border border-[#168C83]/30 transition text-[11px] font-semibold"
          >
            <Plus className="w-3 h-3" />
            <span>New Case</span>
          </button>

          <button
            onClick={onLoadDemoCase}
            className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#F5F6F3] text-[#14283F] border border-[#CBD5E1] transition text-[11px] font-medium"
            title="Load the pre-filled NZ Managed IT Services test scenario"
          >
            <FolderSync className="w-3 h-3 text-[#168C83]" />
            <span>Load Demo Case</span>
          </button>

          <button
            onClick={onExportJson}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#F5F6F3] text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1] transition text-[11px]"
            title="Backup active case as JSON"
          >
            <Download className="w-3 h-3" />
            <span className="hidden md:inline">Export JSON</span>
          </button>

          <label className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#F5F6F3] text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1] transition text-[11px] cursor-pointer">
            <Upload className="w-3 h-3" />
            <span className="hidden md:inline">Import</span>
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </div>

      {importError && (
        <div className="max-w-7xl mx-auto mt-2 p-2 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#B91C1C]" />
            <span>{importError}</span>
          </div>
          <button onClick={() => setImportError(null)} className="text-[#64748B] hover:text-[#14283F]">✕</button>
        </div>
      )}
    </div>
  );
};
