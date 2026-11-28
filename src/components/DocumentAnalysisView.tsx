import React, { useState, useRef } from 'react';
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
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  CaseRecord,
  UploadedDocument,
  CrossDocumentSynthesis,
  AccountUsageSummary,
} from '../types/bizpulse';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';

interface DocumentAnalysisViewProps {
  caseRecord: CaseRecord;
  onAddDocument: (doc: UploadedDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onSynthesizeDocuments?: (synthesis: CrossDocumentSynthesis) => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
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
  onSynthesizeDocuments,
  onAccountUsageUpdate,
  onDiscussInCoach,
}) => {
  const { profile } = caseRecord;
  const documents = caseRecord.uploadedDocuments || [];
  const synthesis = caseRecord.crossDocumentSynthesis || null;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(documents[0]?.id || null);

  const synthesisRef = useRef<HTMLDivElement | null>(null);
  const docResultRef = useRef<HTMLDivElement | null>(null);

  const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  const showTempSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setSuccessNotice(null);
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

      const { data: json } = await apiFetchWithAuth<any>('/api/coach/analyze-document', {
        method: 'POST',
        body: {
          caseId: caseRecord.id,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          base64Data,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: sanitizeDocumentsForAiPayload(documents),
          crmContacts: caseRecord.crmContacts || [],
          roiScenarios: caseRecord.roiScenarios || [],
          recommendations: caseRecord.recommendations,
          actionPlan: caseRecord.actionPlan || [],
        },
      });

      if (json.accountUsage) onAccountUsageUpdate?.(json.accountUsage);

      if (json.documentAnalysis) {
        onAddDocument(json.documentAnalysis);
        setSelectedDocId(json.documentAnalysis.id);
        showTempSuccess(`Analyzed "${file.name}" and added verified findings below.`);
        setTimeout(() => {
          docResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      } else {
        throw new Error('The AI engine returned an empty document audit. Please retry.');
      }
    } catch (err: any) {
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setError(err.message || 'Unable to analyze uploaded document.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSynthesizeAll = async () => {
    if (documents.length === 0 || isSynthesizing) return;
    setError(null);
    setSuccessNotice(null);
    setIsSynthesizing(true);
    try {
      const { data: json } = await apiFetchWithAuth<any>('/api/coach/synthesize-documents', {
        method: 'POST',
        body: {
          caseId: caseRecord.id,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: sanitizeDocumentsForAiPayload(documents),
          crmContacts: caseRecord.crmContacts || [],
          roiScenarios: caseRecord.roiScenarios || [],
          recommendations: caseRecord.recommendations,
          actionPlan: caseRecord.actionPlan || [],
        },
      });
      if (json.accountUsage) onAccountUsageUpdate?.(json.accountUsage);
      if (json.crossDocumentSynthesis) {
        onSynthesizeDocuments?.(json.crossDocumentSynthesis);
        showTempSuccess('Cross-document earnings synthesis updated below.');
        setTimeout(() => {
          synthesisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      } else {
        throw new Error('Synthesis returned empty output. Please retry.');
      }
    } catch (err: any) {
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setError(err.message || 'Document synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner — Architectural Executive Navy Card */}
      <div className="bizpulse-hero-gradient rounded p-6 sm:p-8 text-white shadow-sm border border-[#0F172A]/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <span className="bizpulse-label text-[#6495ED]">[03] Evidence &amp; Trend Intelligence</span>
              <span aria-hidden="true" className="text-[#94A3B8]">·</span>
              <span className="font-mono text-[#CBD5E1]">{profile.name}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Document Intelligence &amp; Earnings Synthesis
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-2xl leading-relaxed">
              Upload financial statements, aged debtor spreadsheets, P&amp;L reports, or operational notes (CSV, XLSX, PDF, DOCX, TXT). Documents remain strictly isolated to <strong className="text-white">{profile.name}</strong>—missing figures are never invented or guessed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {documents.length >= 1 && (
              <button
                type="button"
                onClick={handleSynthesizeAll}
                disabled={isSynthesizing}
                className="inline-flex items-center gap-2 px-4 py-3 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold uppercase tracking-wider text-xs border border-white/20 transition whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 text-[#6495ED] ${isSynthesizing ? 'animate-spin' : ''}`} />
                <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize Trends & Earnings'}</span>
              </button>
            )}

            <label
              className={`inline-flex items-center gap-2 px-5 py-3 rounded font-semibold uppercase tracking-wider text-xs shadow-sm transition cursor-pointer shrink-0 whitespace-nowrap ${
                isAnalyzing
                  ? 'bg-[#0F52BA]/40 text-[#B7CEF7] cursor-wait border border-[#0F52BA]/30'
                  : 'bg-[#0F52BA] hover:bg-[#0A3D8F] text-white'
              }`}
            >
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
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded bg-red-950/80 border border-red-400/40 text-red-100 text-xs flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-200 hover:text-white font-semibold">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {successNotice && (
        <div className="p-3.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button type="button" onClick={() => setSuccessNotice(null)} className="hover:underline font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Cross-Document Earnings & Trend Synthesis Card */}
      {synthesis && (
        <div ref={synthesisRef} className="bg-white border border-[#0F52BA]/40 rounded p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#0F172A]/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0F52BA]" />
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Cross-Document Earnings &amp; Trend Synthesis ({documents.length} Document{documents.length === 1 ? '' : 's'})
                </h3>
                <p className="text-[11px] text-[#475569] font-mono">
                  Synthesized {new Date(synthesis.synthesizedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onDiscussInCoach(
                  `Based on our cross-document earnings synthesis ("${synthesis.summary.slice(0, 110)}..."), which earning scenario should we plan around for the next 90 days?`
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0A2E6E] hover:bg-[#0F52BA] text-white text-xs font-semibold uppercase tracking-wider transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#6495ED]" />
              <span>Discuss Scenarios</span>
            </button>
          </div>

          <p className="text-sm text-[#0F172A] leading-relaxed">{synthesis.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
              <span className="font-bold text-[#15803D] uppercase tracking-wider block">
                Verified Multi-Document Trends
              </span>
              <ul className="space-y-1 text-[#0F172A]">
                {(synthesis.trends.length ? synthesis.trends : ['No cross-period trend supplied.']).map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
              <span className="font-bold text-[#B91C1C] uppercase tracking-wider block">
                Unusual Movements &amp; Discrepancies
              </span>
              <ul className="space-y-1 text-[#0F172A]">
                {(synthesis.unusualMovements.length ? synthesis.unusualMovements : ['No unusual anomalies flagged.']).map((u, i) => (
                  <li key={i}>• {u}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded bg-[#F8FAFC] border border-[#CBD5E1] space-y-1.5">
              <span className="font-bold text-[#475569] uppercase tracking-wider block">
                Conservative Scenario
              </span>
              <p className="text-[#0F172A] leading-relaxed">{synthesis.conservativeScenario}</p>
            </div>
            <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
              <span className="font-bold text-[#B45309] uppercase tracking-wider block">
                Base Scenario
              </span>
              <p className="text-[#0F172A] leading-relaxed">{synthesis.baseScenario}</p>
            </div>
            <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
              <span className="font-bold text-[#15803D] uppercase tracking-wider block">
                Optimistic Scenario
              </span>
              <p className="text-[#0F172A] leading-relaxed">{synthesis.optimisticScenario}</p>
            </div>
          </div>

          {(synthesis.verifiedFiguresUsed.length > 0 || synthesis.dataGaps.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-[#0F172A]/10">
              <div>
                <span className="font-bold text-[#0F172A] uppercase tracking-wider block mb-1">
                  Verified Figures Grounding Synthesis
                </span>
                <p className="text-[#475569]">{synthesis.verifiedFiguresUsed.join(' · ') || 'None specified'}</p>
              </div>
              <div>
                <span className="font-bold text-[#B91C1C] uppercase tracking-wider block mb-1">
                  Remaining Data Gaps
                </span>
                <p className="text-[#475569]">{synthesis.dataGaps.join(' · ') || 'None flagged'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document List & Main Evidence Viewer */}
      {documents.length === 0 ? (
        <div className="bg-white border border-[#0F172A]/12 rounded p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded bg-[#EDF3FD] border border-[#B7CEF7] text-[#0F52BA] flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-[#0F172A]">
              No Business Documents Uploaded for {profile.name}
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Upload your Profit &amp; Loss extract, Balance Sheet, Aged Debtors CSV/Excel ledger, or supplier contract summary. BizPulse separates directly verified evidence from owner assumptions and lets you synthesize multiple periods into future earnings scenarios.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#0A2E6E] hover:bg-[#0F52BA] text-white font-semibold uppercase tracking-wider text-xs cursor-pointer transition">
            <FileUp className="w-4 h-4 text-[#6495ED]" />
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
          <div className="lg:col-span-4 bg-white border border-[#0F172A]/12 rounded p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#0F172A]/10">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A]">
                Case Documents ({documents.length})
              </h3>
              <span className="text-[11px] font-mono text-[#475569]">{profile.caseId}</span>
            </div>

            <div className="space-y-2">
              {documents.map((docItem) => {
                const isSelected = activeDoc?.id === docItem.id;
                return (
                  <div
                    key={docItem.id}
                    onClick={() => setSelectedDocId(docItem.id)}
                    className={`p-3 rounded border cursor-pointer transition flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#EDF3FD] border-[#0F52BA] text-[#0F172A]'
                        : 'bg-[#F8FAFC] border-[#0F172A]/10 hover:border-[#0F172A]/25'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#0F52BA]' : 'text-[#475569]'}`} />
                        <span className="text-xs font-bold truncate text-[#0F172A]">{docItem.fileName}</span>
                      </div>
                      <div className="text-[11px] text-[#475569] font-mono">
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
            <div ref={docResultRef} className="lg:col-span-8 space-y-5">
              {/* Summary & Action Bar */}
              <div className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#0F172A]/10">
                  <div>
                    <div className="text-xs font-mono text-[#475569]">
                      Audited Document · {new Date(activeDoc.uploadedAt).toLocaleString()}
                    </div>
                    <h3 className="text-xl font-bold text-[#0F172A] mt-0.5">{activeDoc.fileName}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onDiscussInCoach(
                        `Regarding the uploaded document "${activeDoc.fileName}", what is the single highest-value cash flow or margin improvement action I should take next?`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0A2E6E] hover:bg-[#0F52BA] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#6495ED]" />
                    <span>Discuss With Coach</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
                    Document Summary
                  </h4>
                  <p className="text-sm text-[#0F172A] leading-relaxed">{activeDoc.summary}</p>
                </div>

                {/* Extracted Metrics Grid */}
                {activeDoc.metricsFound?.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] mb-2">
                      Figures Observed Directly in Document
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeDoc.metricsFound.map((m, idx) => (
                        <div key={idx} className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/10">
                          <div className="text-[11px] text-[#475569] font-medium">{m.label}</div>
                          <div className="text-sm font-bold text-[#0F172A] font-mono tabular-nums mt-0.5">{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence vs Assumptions vs Missing Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white border border-[#A7F3D0] rounded p-5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#15803D] uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified Evidence</span>
                  </div>
                  <ul className="space-y-1.5 text-[#0F172A] leading-relaxed">
                    {(activeDoc.verifiedFacts.length ? activeDoc.verifiedFacts : ['No quantitative figures verified inside file.']).map((fact, idx) => (
                      <li key={idx}>• {fact}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-[#FDE68A] rounded p-5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#B45309] uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Assumptions Flagged</span>
                  </div>
                  <ul className="space-y-1.5 text-[#0F172A] leading-relaxed">
                    {(activeDoc.assumptionsFlagged.length ? activeDoc.assumptionsFlagged : ['No unverified assumptions detected.']).map((asmp, idx) => (
                      <li key={idx}>• {asmp}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-[#FECACA] rounded p-5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#B91C1C] uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4" />
                    <span>Missing Figures (Not Invented)</span>
                  </div>
                  <ul className="space-y-1.5 text-[#0F172A] leading-relaxed">
                    {(activeDoc.missingFinancialFigures.length ? activeDoc.missingFinancialFigures : ['All core figures present.']).map((miss, idx) => (
                      <li key={idx}>• {miss}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Earning Potential, Risks & Opportunities */}
              <div className="bg-white border border-[#0F172A]/12 rounded p-6 space-y-5 text-xs">
                <div className="p-4 rounded bg-[#EDF3FD] border border-[#B7CEF7] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#0F52BA] uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4 text-[#0F52BA]" />
                    <span>Reasoned Assessment of Future Earning Potential</span>
                  </div>
                  <p className="text-sm text-[#0F172A] leading-relaxed">
                    {activeDoc.earningPotentialAssessment}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#B91C1C] uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Risks Identified</span>
                    </div>
                    <ul className="space-y-1.5 text-[#0F172A]">
                      {(activeDoc.risksIdentified.length ? activeDoc.risksIdentified : ['None highlighted.']).map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#15803D] uppercase tracking-wider">
                      <Lightbulb className="w-4 h-4" />
                      <span>Commercial Opportunities</span>
                    </div>
                    <ul className="space-y-1.5 text-[#0F172A]">
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
