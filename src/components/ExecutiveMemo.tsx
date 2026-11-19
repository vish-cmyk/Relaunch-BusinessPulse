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
} from 'lucide-react';
import {
  RISK_MAP_ITEMS,
  GROWTH_OPTIONS_EVALUATION,
} from '../data/coachingBriefing';
import { CaseRecord } from '../types/bizpulse';

interface ExecutiveMemoProps {
  activeCase: CaseRecord;
  onSwitchTab: (tab: string) => void;
  onOpenCoachWithPrompt?: (prompt: string) => void;
}

export const ExecutiveMemo: React.FC<ExecutiveMemoProps> = ({
  activeCase,
  onSwitchTab,
}) => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>('sec-2');
  const isDemo = activeCase.profile.isDemonstrationCase;
  const p = activeCase.profile;
  const h = activeCase.overallHealth;
  const rec = activeCase.recommendations;
  const docs = activeCase.uploadedDocuments || [];
  const fin = activeCase.financials;

  const toggleAccordion = (id: string) => {
    setActiveAccordion((prev) => (prev === id ? null : id));
  };

  // Custom Business Executive Diagnostic Report
  if (!isDemo) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:text-black">
        {/* Top Black-to-Blue Executive Header */}
        <div className="bizpulse-hero-gradient text-white rounded-2xl p-6 sm:p-8 shadow-md border border-white/10 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 pb-5 print:border-black">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-white bg-[#1D4ED8] px-3 py-1 rounded">
                Executive Diagnostic Briefing · Case: {p.caseId}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight print:text-black">
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
              </div>
              <div>
                <strong className="text-white print:text-black">Status:</strong>{' '}
                {h?.overallRating || 'Pending Rating'}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#93C5FD] font-bold uppercase tracking-wider text-[10px] block">
                Overall Health Score
              </span>
              <div className="text-xl font-extrabold text-white font-mono tabular-nums">
                {h && h.overallScore !== null ? `${h.overallScore} / 100` : 'Pending Rating'}
              </div>
              <span className="text-[#CBD5E1] block">{h?.overallRating || 'Awaiting inputs'}</span>
            </div>

            <div className="p-4 rounded-xl bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#93C5FD] font-bold uppercase tracking-wider text-[10px] block">
                Primary Objective
              </span>
              <p className="text-white font-medium leading-relaxed">
                {p.primaryObjective || 'Not entered yet'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/10 border border-white/15 space-y-1">
              <span className="text-[#FCD34D] font-bold uppercase tracking-wider text-[10px] block">
                Primary Concern
              </span>
              <p className="text-white font-medium leading-relaxed">
                {p.primaryConcern || 'Not entered yet'}
              </p>
            </div>
          </div>

          {h?.overallExplanation && (
            <p className="mt-4 text-xs sm:text-sm text-[#E2E8F0] leading-relaxed print:text-gray-800">
              <strong className="text-white print:text-black">Diagnostic Summary: </strong>
              {h.overallExplanation}
            </p>
          )}
        </div>

        {/* Section 1: Eight Health Dimensions */}
        <div className="bg-white border border-[#D9E2F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8EEF7]">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-lg font-bold text-[#0B1324]">
                Eight Commercial Health Dimensions
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('health')}
              className="text-xs text-[#1D4ED8] hover:text-[#1E40AF] font-bold print:hidden"
            >
              Edit Dimensions &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D9E2F0] bg-[#F3F6FB] text-[#52627A] uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Dimension</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Evidence Basis</th>
                  <th className="py-2.5 px-3">Owner Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EEF7]">
                {Object.values(activeCase.healthInputs).map((dim) => {
                  const detail = h?.dimensionScores?.find((d) => d.key === dim.key);
                  return (
                    <tr key={dim.key} className="hover:bg-[#F3F6FB]/60 transition">
                      <td className="py-3 px-3 font-semibold text-[#0B1324]">{dim.title}</td>
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
                              ? 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                              : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                          }`}
                        >
                          {dim.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[#0B1324] tabular-nums">
                        {detail && detail.score !== null ? `${detail.score}/100` : '—'}
                      </td>
                      <td className="py-3 px-3 text-[#52627A] font-mono text-[11px]">
                        {dim.evidenceType.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 text-[#0B1324] max-w-md">
                        {dim.notes || (
                          <span className="text-[#94A3B8] italic">No notes supplied by owner</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Supplied Financial & Document Evidence */}
        <div className="bg-white border border-[#D9E2F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8EEF7]">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-lg font-bold text-[#0B1324]">
                Supplied Financial &amp; Document Evidence
              </h3>
            </div>
            <div className="flex items-center gap-3 print:hidden">
              <button
                type="button"
                onClick={() => onSwitchTab('documents')}
                className="text-xs text-[#1D4ED8] hover:text-[#1E40AF] font-bold"
              >
                Manage Documents ({docs.length}) &rarr;
              </button>
            </div>
          </div>

          {fin ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
              <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Cash in Bank</span>
                <strong className="text-[#0B1324] font-mono text-sm">
                  {fin.cashInBank !== null ? `${p.currency} ${fin.cashInBank.toLocaleString()}` : 'Not supplied'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Receivables</span>
                <strong className="text-[#0B1324] font-mono text-sm">
                  {fin.accountsReceivable !== null
                    ? `${p.currency} ${fin.accountsReceivable.toLocaleString()}`
                    : 'Not supplied'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Overdue (&gt;60d)</span>
                <strong className="text-[#B91C1C] font-mono text-sm">
                  {fin.overdueReceivables !== null
                    ? `${p.currency} ${fin.overdueReceivables.toLocaleString()}`
                    : 'Not supplied'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Credit Drawn</span>
                <strong className="text-[#B45309] font-mono text-sm">
                  {fin.creditFacilityUsed !== null
                    ? `${p.currency} ${fin.creditFacilityUsed.toLocaleString()}`
                    : 'Not supplied'}
                </strong>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#52627A] bg-[#F3F6FB] p-3.5 rounded-xl border border-[#E8EEF7]">
              No numerical financial ledger figures have been entered in the Cash Flow Workbench yet. BizPulse never assumes missing financial numbers.
            </p>
          )}

          {docs.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-[#0B1324] uppercase tracking-wider block">
                Analyzed Documents ({docs.length})
              </span>
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#D9E2F0] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-bold text-[#0B1324]">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#1D4ED8]" />
                      {d.fileName}
                    </span>
                    <span className="text-[11px] font-mono text-[#52627A]">{d.fileType.toUpperCase()}</span>
                  </div>
                  <p className="text-[#52627A] leading-relaxed">{d.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Recommendations Summary */}
        <div className="bg-white border border-[#D9E2F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8EEF7]">
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-lg font-bold text-[#0B1324]">
                Coaching Recommendations &amp; Priority Actions
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('recommendations')}
              className="text-xs text-[#1D4ED8] hover:text-[#1E40AF] font-bold print:hidden"
            >
              Open Coaching Tab &rarr;
            </button>
          </div>

          {rec ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0] space-y-1">
                <span className="font-bold text-[#1D4ED8] uppercase tracking-wider block text-[11px]">
                  Core Commercial Finding
                </span>
                <p className="text-sm font-bold text-[#0B1324]">{rec.initialObservation}</p>
                <p className="text-[#52627A] mt-1 leading-relaxed">{rec.commercialWhy}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-1">
                <span className="font-bold text-[#1D4ED8] uppercase tracking-wider block text-[11px]">
                  Primary Recommendation
                </span>
                <p className="text-[#0B1324] font-semibold">{rec.initialRecommendation}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
                <span className="font-bold text-[#15803D] uppercase tracking-wider block text-[11px]">
                  Immediate 48–72 Hour Priority
                </span>
                <p className="text-[#0B1324] font-medium">{rec.immediateAction}</p>
              </div>

              {rec.specialistAdviceNeeded && (
                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#0B1324]">
                  <strong className="text-[#B45309]">Specialist Advisory Check: </strong>
                  {rec.specialistAdviceNeeded}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-[#F3F6FB] border border-[#D9E2F0] space-y-3">
              <p className="text-xs text-[#52627A]">
                Coaching recommendations have not yet been generated for {p.name}.
              </p>
              <button
                type="button"
                onClick={() => onSwitchTab('recommendations')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#1D4ED8] text-white font-bold text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Coaching Plan</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 4: Next Actions Bar */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#D9E2F0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
              Interactive Execution Tools
            </span>
            <h4 className="text-base font-bold text-[#0B1324]">
              Explore Cash Flow, Client Economics &amp; Live Coaching
            </h4>
            <p className="text-xs text-[#52627A] max-w-xl">
              Simulate liquidity scenarios or ask your AI Coach follow-up questions tailored to {p.name}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSwitchTab('cashflow')}
              className="px-3.5 py-2 rounded-xl bg-[#F3F6FB] hover:bg-[#E2E8F0] text-[#0B1324] text-xs font-semibold border border-[#CBD5E1] transition"
            >
              Cash Flow
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('clientmatrix')}
              className="px-3.5 py-2 rounded-xl bg-[#F3F6FB] hover:bg-[#E2E8F0] text-[#0B1324] text-xs font-semibold border border-[#CBD5E1] transition"
            >
              Client Matrix
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('aicoach')}
              className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition shadow-xs"
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
  return (
    <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:text-black">
      {/* Top Black-to-Blue Demo Banner */}
      <div className="bizpulse-hero-gradient text-white rounded-2xl p-6 sm:p-8 shadow-md border border-white/10 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        <div className="border-b border-white/15 pb-6 print:border-black">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white bg-[#1D4ED8] px-3 py-1 rounded">
                  Executive Turnaround Briefing
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#93C5FD] bg-white/10 px-3 py-1 rounded border border-white/15">
                  Benchmark Demo Case: NZ MSP
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight print:text-black">
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

        <div className="mt-5 p-4 rounded-xl bg-white/10 border border-white/15 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[#FCD34D]" />
              <span className="font-bold text-white text-sm">
                Provisional Overall Health Assessment:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                NEEDS ATTENTION (Working-Capital &amp; Delivery Strain)
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#E2E8F0] leading-relaxed">
            The business has an 8-year operating history, 48 recurring clients, and NZ$100,000 paper operating profit on NZ$1.28M revenue. However, NZ$175,000 trapped in receivables (NZ$58,000 overdue &gt;60 days) has pushed bank overdraft borrowing to NZ$52,000 of a NZ$75,000 limit while unbilled scope creep strains senior technician capacity.
          </p>
        </div>
      </div>

      {/* SECTION 2: BUSINESS SNAPSHOT & EVIDENCE QUALITY */}
      <div className="bg-white border border-[#D9E2F0] rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => toggleAccordion('sec-2')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F3F6FB] hover:bg-[#E8EEF7] transition border-b border-[#D9E2F0]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#0F172A] text-white font-bold text-sm flex items-center justify-center">
              2
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#0B1324]">
                Evidence Quality: Verified Baseline vs. Unverified vs. Missing
              </h2>
              <p className="text-xs text-[#52627A]">
                Distinguishing established facts from unverified owner estimates
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-2' ? (
            <ChevronUp className="w-5 h-5 text-[#52627A] print:hidden" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#52627A] print:hidden" />
          )}
        </button>

        <div className={activeAccordion === 'sec-2' ? 'block' : 'hidden print:block'}>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <div className="flex items-center space-x-2 text-[#15803D] font-bold text-xs uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  <span>Verified Baseline</span>
                </div>
                <ul className="text-xs text-[#0B1324] space-y-1.5 list-disc list-inside">
                  <li>8 years operating; 48 active B2B customers.</li>
                  <li>12 employees + 2 subcontractors.</li>
                  <li>NZ$75,000 overdraft limit; NZ$38,000 operating cash.</li>
                  <li>20-day standard invoice payment terms.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <div className="flex items-center space-x-2 text-[#B45309] font-bold text-xs uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4" />
                  <span>Reported (Needs Verification)</span>
                </div>
                <ul className="text-xs text-[#0B1324] space-y-1.5 list-disc list-inside">
                  <li>Annual revenue NZ$1.28M; paper profit NZ$100k.</li>
                  <li>NZ$175,000 receivables; NZ$58,000 &gt;60 days overdue.</li>
                  <li>NZ$52,000 overdraft drawn; Top 5 clients = 38%.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-2">
                <div className="flex items-center space-x-2 text-[#475569] font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Missing Evidence</span>
                </div>
                <ul className="text-xs text-[#0B1324] space-y-1.5 list-disc list-inside">
                  <li>Itemized aged receivables ledger with dispute flags.</li>
                  <li>Gross margin per contract &amp; effective hourly rates.</li>
                  <li>4-week GST, PAYE &amp; supplier commitment schedule.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CORE COMMERCIAL CONTRADICTION */}
      <div className="bg-white border border-[#D9E2F0] rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => toggleAccordion('sec-3')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F3F6FB] hover:bg-[#E8EEF7] transition border-b border-[#D9E2F0]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#B91C1C] font-bold text-sm flex items-center justify-center border border-[#FECACA]">
              3
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#0B1324]">
                Paper Profit vs. Cash Squeeze
              </h2>
              <p className="text-xs text-[#52627A]">
                Why NZ$100k reported profit is still leaving the bank account short
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-3' ? (
            <ChevronUp className="w-5 h-5 text-[#52627A] print:hidden" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#52627A] print:hidden" />
          )}
        </button>

        <div className={activeAccordion === 'sec-3' ? 'block' : 'hidden print:block'}>
          <div className="p-6 space-y-4 text-xs text-[#0B1324] leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
              <div className="p-3.5 bg-[#F3F6FB] rounded-xl border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Trapped in Receivables</span>
                <span className="text-lg font-bold text-[#B91C1C] font-mono block">NZ$175,000</span>
              </div>
              <div className="p-3.5 bg-[#F3F6FB] rounded-xl border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Net Immediate Liquidity</span>
                <span className="text-lg font-bold text-[#B91C1C] font-mono block">-NZ$54,000</span>
              </div>
              <div className="p-3.5 bg-[#F3F6FB] rounded-xl border border-[#D9E2F0]">
                <span className="text-[#52627A] block text-[11px]">Overdraft Drawn</span>
                <span className="text-lg font-bold text-[#B45309] font-mono block">
                  NZ$52,000 / NZ$75k
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: RISK MAP */}
      <div className="bg-white border border-[#D9E2F0] rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => toggleAccordion('sec-4')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F3F6FB] hover:bg-[#E8EEF7] transition border-b border-[#D9E2F0]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#FFFBEB] text-[#B45309] font-bold text-sm flex items-center justify-center border border-[#FDE68A]">
              4
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#0B1324]">
                Integrated Commercial Risk Map
              </h2>
              <p className="text-xs text-[#52627A]">
                Cash lag, delivery bottlenecks, and margin erosion
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-4' ? (
            <ChevronUp className="w-5 h-5 text-[#52627A] print:hidden" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#52627A] print:hidden" />
          )}
        </button>

        <div className={activeAccordion === 'sec-4' ? 'block' : 'hidden print:block'}>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {RISK_MAP_ITEMS.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#F8FAFC] border border-[#D9E2F0] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#1D4ED8] font-mono">
                    {item.category}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                    {item.urgency}
                  </span>
                </div>
                <p className="text-[#0B1324] font-semibold">{item.reportedSymptom}</p>
                <p className="text-[#52627A]">{item.possibleUnderlyingCause}</p>
                <div className="p-2.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D]">
                  <strong>First Action: </strong>
                  {item.recommendedFirstAction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 5: CAPITAL DECISIONS */}
      <div className="bg-white border border-[#D9E2F0] rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => toggleAccordion('sec-5')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F3F6FB] hover:bg-[#E8EEF7] transition border-b border-[#D9E2F0]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] font-bold text-sm flex items-center justify-center border border-[#BFDBFE]">
              5
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#0B1324]">
                Capital Investment Comparison (Options A, B &amp; C)
              </h2>
              <p className="text-xs text-[#52627A]">
                Marketing spend vs. Salesperson hire vs. Core margin turnaround
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-5' ? (
            <ChevronUp className="w-5 h-5 text-[#52627A] print:hidden" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#52627A] print:hidden" />
          )}
        </button>

        <div className={activeAccordion === 'sec-5' ? 'block' : 'hidden print:block'}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {GROWTH_OPTIONS_EVALUATION.map((opt) => (
                <div
                  key={opt.id}
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-[#D9E2F0] space-y-2 text-xs"
                >
                  <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] font-mono inline-block">
                    {opt.id}
                  </span>
                  <h3 className="font-bold text-[#0B1324] text-sm">{opt.title}</h3>
                  <p className="text-[#52627A]">{opt.proposedAction}</p>
                  <div className="pt-2 border-t border-[#E8EEF7]">
                    <span className="font-semibold text-[#0B1324]">Upfront Outlay: </span>
                    <span className="font-mono">{opt.upfrontCashRequirement}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: 48-HOUR GATES */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#D9E2F0] shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-[#1D4ED8] font-bold text-base">
          <ShieldCheck className="w-5 h-5" />
          <span>48-Hour Management Decision Gates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-[#0B1324]">
          <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
            <strong className="text-[#15803D] font-bold block text-sm">1. What to Do First</strong>
            <p>Verify the NZ$58k overdue ledger within 48 hours and initiate direct owner collection calls.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1">
            <strong className="text-[#B91C1C] font-bold block text-sm">2. What to Pause</strong>
            <p>Defer NZ$20k marketing spend and NZ$85k salesperson recruitment until liquidity stabilizes.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
            <strong className="text-[#B45309] font-bold block text-sm">3. Evidence Needed</strong>
            <p>Aged receivables ledger, 4-week tax/payroll cash commitments, and top-5 contract renewal dates.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-1">
            <strong className="text-[#475569] font-bold block text-sm">4. Day-60 Gate</strong>
            <p>Re-evaluate growth hiring once overdraft stays below NZ$20k and pricing review is underway.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
