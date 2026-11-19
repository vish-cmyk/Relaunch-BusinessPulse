import React, { useState } from 'react';
import {
  FileUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Trash2,
  TrendingUp,
  ShieldAlert,
  Lightbulb,
  MessageSquare,
  FileSpreadsheet,
} from 'lucide-react';
import { CaseRecord, UploadedDocument } from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface DocumentAnalysisViewProps {
  caseRecord: CaseRecord;
  onAddDocument: (doc: UploadedDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onDiscussInCoach: (prompt: string) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = ['.csv', '.txt', '.md', '.json', '.pdf', '.docx', '.xlsx', '.xls', '.png', '.jpg', '.jpeg'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DocumentAnalysisView: React.FC<DocumentAnalysisViewProps> = ({
  caseRecord,
  onAddDocument,
  onDeleteDocument,
  onDiscussInCoach,
}) => {
  const { profile } = caseRecord;
  const documents = caseRecord.uploadedDocuments || [];

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(documents[0]?.id || null);

  const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    const lowerName = file.name.toLowerCase();
    const hasAllowedExt = ALLOWED_EXT.some((ext) => lowerName.endsWith(ext));
    if (!hasAllowedExt) {
      setError(`Unsupported file type for "${file.name}". Please upload CSV, TXT, PDF, DOCX, XLSX/XLS, JSON, MD, or PNG/JPG.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is ${formatBytes(file.size)}, which exceeds the 8 MB upload limit.`);
      return;
    }

    setIsAnalyzing(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
      });

      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/analyze-document', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          caseId: caseRecord.id,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          base64Data,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || 'Document analysis failed.');
      }

      if (json.documentAnalysis) {
        onAddDocument(json.documentAnalysis);
        setSelectedDocId(json.documentAnalysis.id);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to analyze uploaded document.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner — Black-to-Blue Executive Card */}
      <div className="bizpulse-hero-gradient rounded-2xl p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-blue-200 font-medium">
              <span>Phase 3: Document &amp; Financial Evidence Audit</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{profile.name}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Business Document Analysis
            </h2>
            <p className="text-sm text-slate-200 max-w-2xl leading-relaxed">
              Upload financial statements, aged debtor spreadsheets, P&amp;L reports, or operational notes (CSV, XLSX, PDF, DOCX, TXT). Documents remain strictly isolated to <strong className="text-white">{profile.name}</strong>—missing figures are never invented or guessed.
            </p>
          </div>

          <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-sm transition cursor-pointer shrink-0 whitespace-nowrap ${
            isAnalyzing
              ? 'bg-blue-900/60 text-blue-200 cursor-wait border border-blue-400/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/40'
          }`}>
            <FileUp className="w-4 h-4" />
            <span>{isAnalyzing ? 'Auditing Document...' : 'Upload & Analyze Document'}</span>
            <input
              type="file"
              accept=".csv,.txt,.md,.json,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={isAnalyzing}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-950/80 border border-red-400/40 text-red-100 text-xs flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-200 hover:text-white font-semibold">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Document List & Main Evidence Viewer */}
      {documents.length === 0 ? (
        <div className="bg-white border border-[#D9E2F0] rounded-2xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-[#0B1324]">
              No Business Documents Uploaded for {profile.name}
            </h3>
            <p className="text-xs text-[#52627A] leading-relaxed">
              Upload your Profit &amp; Loss extract, Balance Sheet, Aged Debtors CSV/Excel ledger, or supplier contract summary. BizPulse separates directly verified evidence from owner assumptions and highlights future earning potential, risks, and opportunities.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs cursor-pointer transition">
            <FileUp className="w-4 h-4" />
            <span>Select File (CSV, XLSX, PDF, DOCX, TXT)</span>
            <input
              type="file"
              accept=".csv,.txt,.md,.json,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={isAnalyzing}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Document Selector */}
          <div className="lg:col-span-4 bg-white border border-[#D9E2F0] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8EEF7]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1324]">
                Case Documents ({documents.length})
              </h3>
              <span className="text-[11px] font-mono text-[#52627A]">{profile.caseId}</span>
            </div>

            <div className="space-y-2">
              {documents.map((docItem) => {
                const isSelected = activeDoc?.id === docItem.id;
                return (
                  <div
                    key={docItem.id}
                    onClick={() => setSelectedDocId(docItem.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#0B1324]'
                        : 'bg-[#F8FAFC] border-[#E8EEF7] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#1D4ED8]' : 'text-[#52627A]'}`} />
                        <span className="text-xs font-bold truncate text-[#0B1324]">{docItem.fileName}</span>
                      </div>
                      <div className="text-[11px] text-[#52627A] font-mono">
                        {formatBytes(docItem.fileSizeBytes)} · {new Date(docItem.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDeleteDocument(docItem.id);
                      }}
                      className="p-1 text-[#64748B] hover:text-[#B91C1C] transition"
                      title="Remove document from this case"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Audit Breakdown */}
          {activeDoc && (
            <div className="lg:col-span-8 space-y-5">
              {/* Summary & Action Bar */}
              <div className="bg-white border border-[#D9E2F0] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E8EEF7]">
                  <div>
                    <div className="text-xs text-[#52627A]">
                      Audited Document · {new Date(activeDoc.uploadedAt).toLocaleString()}
                    </div>
                    <h3 className="text-xl font-bold text-[#0B1324] mt-0.5">{activeDoc.fileName}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onDiscussInCoach(
                        `Regarding the uploaded document "${activeDoc.fileName}", what is the single highest-value cash flow or margin improvement action I should take next?`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1D4ED8] text-white text-xs font-bold transition whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discuss With Coach</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
                    Document Summary
                  </h4>
                  <p className="text-sm text-[#0B1324] leading-relaxed">{activeDoc.summary}</p>
                </div>

                {/* Extracted Metrics Grid (Only directly observed values) */}
                {activeDoc.metricsFound?.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#52627A] mb-2">
                      Figures Observed Directly in Document
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeDoc.metricsFound.map((m, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#D9E2F0]">
                          <div className="text-[11px] text-[#52627A] font-medium">{m.label}</div>
                          <div className="text-sm font-bold text-[#0B1324] font-mono tabular-nums mt-0.5">{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence vs Assumptions vs Missing Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white border border-[#A7F3D0] rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#15803D] uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified Evidence</span>
                  </div>
                  <ul className="space-y-1.5 text-[#0B1324] leading-relaxed">
                    {(activeDoc.verifiedFacts.length ? activeDoc.verifiedFacts : ['No quantitative figures verified inside file.']).map((fact, idx) => (
                      <li key={idx}>• {fact}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-[#FDE68A] rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#B45309] uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Assumptions Flagged</span>
                  </div>
                  <ul className="space-y-1.5 text-[#0B1324] leading-relaxed">
                    {(activeDoc.assumptionsFlagged.length ? activeDoc.assumptionsFlagged : ['No unverified assumptions detected.']).map((asmp, idx) => (
                      <li key={idx}>• {asmp}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-[#FECACA] rounded-2xl p-5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#B91C1C] uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4" />
                    <span>Missing Figures (Not Invented)</span>
                  </div>
                  <ul className="space-y-1.5 text-[#0B1324] leading-relaxed">
                    {(activeDoc.missingFinancialFigures.length ? activeDoc.missingFinancialFigures : ['All core figures present.']).map((miss, idx) => (
                      <li key={idx}>• {miss}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Earning Potential, Risks & Opportunities */}
              <div className="bg-white border border-[#D9E2F0] rounded-2xl p-6 space-y-5 text-xs">
                <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#1D4ED8] uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    <span>Reasoned Assessment of Future Earning Potential</span>
                  </div>
                  <p className="text-sm text-[#0B1324] leading-relaxed">
                    {activeDoc.earningPotentialAssessment}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#B91C1C] uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Risks Identified</span>
                    </div>
                    <ul className="space-y-1.5 text-[#0B1324]">
                      {(activeDoc.risksIdentified.length ? activeDoc.risksIdentified : ['None highlighted.']).map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#15803D] uppercase tracking-wider">
                      <Lightbulb className="w-4 h-4" />
                      <span>Commercial Opportunities</span>
                    </div>
                    <ul className="space-y-1.5 text-[#0B1324]">
                      {(activeDoc.opportunitiesIdentified.length ? activeDoc.opportunitiesIdentified : ['None highlighted.']).map((o, i) => (
                        <li key={i}>• {o}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
