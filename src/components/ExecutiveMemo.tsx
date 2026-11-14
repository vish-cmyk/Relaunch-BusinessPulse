import React, { useState } from 'react';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  Layers, 
  TrendingUp, 
  ShieldAlert, 
  ArrowRight, 
  Printer, 
  Coins, 
  Scale, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Calculator, 
  UserCheck, 
  Clock, 
  Activity, 
  ArrowDownRight, 
  GitBranch, 
  ShieldCheck, 
  CheckCircle2, 
  AlertOctagon, 
  FileSpreadsheet,
  Building2,
  RefreshCw
} from 'lucide-react';
import { 
  REPORTED_FINANCIALS, 
  RISK_MAP_ITEMS, 
  GROWTH_OPTIONS_EVALUATION, 
  PRIORITISED_TURNAROUND_PLAN, 
  MISSING_INFORMATION_CHECKLIST, 
  WEEKLY_DASHBOARD_KPIS 
} from '../data/coachingBriefing';

import { CaseRecord } from '../types/bizpulse';

interface ExecutiveMemoProps {
  activeCase: CaseRecord;
  onSwitchTab: (tab: string) => void;
  onOpenCoachWithPrompt?: (prompt: string) => void;
}

export const ExecutiveMemo: React.FC<ExecutiveMemoProps> = ({ activeCase, onSwitchTab, onOpenCoachWithPrompt }) => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>('sec-1');
  const isDemo = activeCase.profile.isDemonstrationCase;
  const p = activeCase.profile;
  const h = activeCase.overallHealth;
  const rec = activeCase.recommendations;

  const toggleAccordion = (id: string) => {
    setActiveAccordion(prev => prev === id ? null : id);
  };

  // If this is a custom business (not the MSP demonstration scenario), render the dynamic case-specific executive report
  if (!isDemo) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:text-black">
        {/* Top Header Card */}
        <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs print:border-none print:shadow-none print:p-0">
          <div className="border-b border-[#E5EBEF] pb-6 print:border-black">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] bg-[#EAF1FF] px-3 py-1 rounded-full border border-[#2563EB]/30">
                  Custom Turnaround Diagnostic · Case: {p.caseId}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14283F] mt-3 tracking-tight print:text-black">
                  {p.name}
                </h1>
                <p className="text-[#64748B] text-sm mt-1 print:text-gray-700">
                  Commercial Turnaround Diagnostic & Strategic Action Report · {p.industry} ({p.country})
                </p>
              </div>
              <div className="text-right text-xs text-[#64748B] space-y-1 print:text-gray-700">
                <div><strong className="text-[#14283F]">Date:</strong> {h?.assessmentDate || new Date().toISOString().split('T')[0]}</div>
                <div><strong className="text-[#14283F]">Currency:</strong> {p.currency} | <strong>Workforce:</strong> {p.employeeCount} Staff, {p.subcontractorCount} Subcontractors</div>
                <div><strong className="text-[#14283F]">Assessment:</strong> {h?.overallRating || 'Provisional (Pending)'}</div>
              </div>
            </div>
          </div>

          {/* Business Health Summary Strip */}
          <div className="mt-6 p-5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-[#2563EB]" />
                <span className="font-bold text-[#14283F] text-sm">Overall Business Health Assessment:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  h?.overallRating === 'Healthy' ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]' :
                  h?.overallRating === 'Needs Attention' ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' :
                  h?.overallRating === 'At Risk' ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' :
                  'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                }`}>
                  {h?.overallRating || 'Assessment In Progress'} {h ? `(${h.overallScore}/100)` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSwitchTab('health')}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold underline"
                >
                  Edit 8 Dimensions
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div className="p-3.5 rounded-lg bg-white border border-[#E5EBEF] space-y-1">
                <span className="text-[#64748B] font-semibold block uppercase tracking-wider text-[11px]">Primary Commercial Objective</span>
                <p className="text-[#14283F] font-medium">{p.primaryObjective}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#E5EBEF] space-y-1">
                <span className="text-[#E87518] font-semibold block uppercase tracking-wider text-[11px]">Stated Primary Concern</span>
                <p className="text-[#14283F] font-medium">{p.primaryConcern || 'Unspecified commercial pressure'}</p>
              </div>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed pt-1">
              <strong className="text-[#14283F]">Diagnostic Synthesis: </strong>
              {h?.scoreLabel || 'Assessment pending completion of the 8 health dimensions.'}
              {' '}This diagnostic report is calibrated specifically for an enterprise in the <strong>{p.industry}</strong> sector operating in {p.country}.
            </p>
          </div>
        </div>

        {/* Section 2: The Eight Health Dimensions */}
        <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EBEF]">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-[#EAF1FF] text-[#2563EB] font-bold text-xs flex items-center justify-center border border-[#2563EB]/30">
                1
              </span>
              <h3 className="text-lg font-bold text-[#14283F]">The Eight Commercial Health Dimensions</h3>
            </div>
            <button
              onClick={() => onSwitchTab('health')}
              className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold"
            >
              Update Dimensions &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5EBEF] bg-[#F8FAFC] text-[#64748B] uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Dimension</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Evidence Basis</th>
                  <th className="py-2.5 px-3">Owner-Reported Operational Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBEF]">
                {Object.values(activeCase.healthInputs).map((dim) => (
                  <tr key={dim.key} className="hover:bg-[#F8FAFC] transition">
                    <td className="py-3 px-3 font-semibold text-[#14283F]">
                      {dim.title}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        dim.status === 'healthy' ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]' :
                        dim.status === 'needs_attention' ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' :
                        dim.status === 'at_risk' ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' :
                        dim.status === 'not_sure' ? 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]' :
                        'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                      }`}>
                        {dim.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#64748B] font-mono text-[11px]">
                      {dim.evidenceType.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 text-[#14283F] max-w-md">
                      {dim.notes || <span className="text-[#94A3B8] italic">No notes supplied by owner</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Recommendations Summary */}
        <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EBEF]">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-[#EAF1FF] text-[#2563EB] font-bold text-xs flex items-center justify-center border border-[#2563EB]/30">
                2
              </span>
              <h3 className="text-lg font-bold text-[#14283F]">Diagnostic Synthesis & Executive Recommendations</h3>
            </div>
            <button
              onClick={() => onSwitchTab('recommendations')}
              className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold"
            >
              Consult Engine &rarr;
            </button>
          </div>

          {rec ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-1">
                <span className="font-bold text-[#E87518] uppercase tracking-wider block text-[11px]">
                  Core Diagnostic Finding:
                </span>
                <p className="text-sm font-bold text-[#14283F]">{rec.initialObservation}</p>
                <p className="text-[#64748B] mt-1 leading-relaxed">{rec.commercialWhy}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#EAF1FF] border border-[#2563EB]/30 space-y-1">
                <span className="font-bold text-[#2563EB] uppercase tracking-wider block text-[11px]">
                  Primary Strategic Recommendation:
                </span>
                <p className="text-[#14283F] font-semibold">{rec.initialRecommendation}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-1">
                <span className="font-bold text-[#15803D] uppercase tracking-wider block text-[11px]">
                  Immediate 48–72 Hour Step:
                </span>
                <p className="text-[#14283F] font-medium">{rec.immediateAction}</p>
              </div>

              {rec.specialistAdviceNeeded && (
                <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#14283F]">
                  <strong className="text-[#B45309]">Specialist Advice Trigger: </strong>
                  {rec.specialistAdviceNeeded}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-2">
              <p className="text-xs text-[#64748B]">Recommendations have not yet been generated for this case.</p>
              <button
                onClick={() => onSwitchTab('recommendations')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Recommendations Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 4: Evidence Standards & Information Gaps */}
        <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-[#E5EBEF]">
            <span className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#14283F] font-bold text-xs flex items-center justify-center border border-[#E2E8F0]">
              3
            </span>
            <h3 className="text-lg font-bold text-[#14283F]">Evidence Standards & Information Quality</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
              <span className="font-bold text-[#15803D] uppercase tracking-wider block">Owner-Reported Knowns</span>
              <p className="text-[#14283F]">
                Operating history: {p.yearsOperating} years. Team size: {p.employeeCount} staff. Primary stated issue: {p.primaryConcern || 'Operational strain'}.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
              <span className="font-bold text-[#B45309] uppercase tracking-wider block">Working Assumptions</span>
              <p className="text-[#14283F]">
                Current financial indicators are preliminary and subject to reconciliation with your external accountant and banking facilities.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-1.5">
              <span className="font-bold text-[#475569] uppercase tracking-wider block">Critical Missing Evidence</span>
              <p className="text-[#14283F]">
                Accurate aged debtors ledger, customer-level gross contribution margins, and verified near-term cash liabilities.
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Commercial Navigation Tools Callout */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#E5EBEF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">Next Action</span>
            <h4 className="text-base font-bold text-[#14283F]">Explore Interactive Financial Workbenches</h4>
            <p className="text-xs text-[#64748B] max-w-xl">
              Model your cash flow deficit, test price realignment scenarios, or review the weekly management scoreboard for {p.name}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSwitchTab('cashflow')}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#14283F] text-xs font-semibold border border-[#CBD5E1] transition shadow-2xs"
            >
              Cash Workbench
            </button>
            <button
              onClick={() => onSwitchTab('options')}
              className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#14283F] text-xs font-semibold border border-[#CBD5E1] transition shadow-2xs"
            >
              Options Matrix
            </button>
            <button
              onClick={() => onSwitchTab('aicoach')}
              className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition shadow-xs"
            >
              Consult AI Coach
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DEMONSTRATION CASE: NZ IT MANAGED SERVICES PROVIDER (10-SECTION MASTER MEMO)
  // =========================================================================
  return (
    <div className="space-y-6 max-w-5xl mx-auto print:max-w-none print:text-black">
      
      {/* Top Banner for Demo Case */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs print:border-none print:shadow-none print:p-0">
        <div className="border-b border-[#E5EBEF] pb-6 print:border-black">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] bg-[#EAF1FF] px-3 py-1 rounded-full border border-[#2563EB]/30">
                  Executive Turnaround Advisory Document
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-[#475569] bg-[#F1F5F9] px-3 py-1 rounded-full border border-[#CBD5E1]">
                  Demonstration Case: NZ MSP
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14283F] mt-3 tracking-tight print:text-black">
                Relaunch BizPulse: Comprehensive Commercial Turnaround Diagnostic
              </h1>
              <p className="text-[#64748B] text-sm mt-1 print:text-gray-700">
                Prepared for Vish & Managing Partner · B2B IT Managed Services Provider (New Zealand)
              </p>
            </div>
            <div className="text-right text-xs text-[#64748B] space-y-1 print:text-gray-700">
              <div><strong className="text-[#14283F]">Date:</strong> 14 October 2026</div>
              <div><strong className="text-[#14283F]">Currency:</strong> NZD (NZ$) | <strong>Team:</strong> 12 Staff + 2 Subcontractors</div>
              <div><strong className="text-[#14283F]">Status:</strong> Provisional Diagnostic (Subject to Debtor Verification)</div>
            </div>
          </div>
        </div>

        {/* Provisional Business Health Gauge */}
        <div className="mt-6 p-5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[#E87518]" />
              <span className="font-bold text-[#14283F] text-sm">Provisional Overall Business-Health Assessment:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                AMBER-CAUTION (Working-Capital & Operational Strain)
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">Classification Criteria Below</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-[#14283F]">
              <strong className="text-[#15803D] block mb-1">GREEN Criteria (Healthy):</strong>
              Cash buffer &gt; 8 weeks opex, zero overdraft drawn, debtors &lt; 30 days DSO, unconstrained tech capacity.
            </div>
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[#14283F]">
              <strong className="text-[#B45309] block mb-1">AMBER Criteria (Current State):</strong>
              Reported profit positive on paper, but overdraft &gt; 65% drawn, debtors &gt; 45 days, single point of failure in tech delivery.
            </div>
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#14283F]">
              <strong className="text-[#B91C1C] block mb-1">RED Criteria (Crisis):</strong>
              Overdraft facility maxed, active supplier delivery holds, uncollectable bad debts &gt; NZ$30k, debt defaults.
            </div>
          </div>

          <p className="text-xs text-[#64748B] leading-relaxed pt-1">
            <strong className="text-[#14283F]">Diagnostic Synthesis: </strong>
            The business is <em>not</em> fundamentally unviable. It possesses an 8-year operating track record, an established recurring customer base, and reported positive pre-tax earnings of NZ$100,000. However, it is experiencing a <strong>pronounced cash-conversion and working-capital lag</strong>: NZ$175,000 in receivables (with NZ$58,000 reported overdue past 60 days) has forced reliance on an expensive NZ$52,000 bank overdraft against a NZ$75,000 limit. Simultaneously, contract pricing frozen for 3 years alongside unbilled scope creep has compressed technician capacity, causing staff friction and partner exhaustion.
          </p>
        </div>
      </div>

      {/* SECTION 2: BUSINESS SNAPSHOT & EVIDENCE QUALITY */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl overflow-hidden shadow-xs">
        <button
          onClick={() => toggleAccordion('sec-2')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] hover:bg-[#F1F5F9] transition border-b border-[#E5EBEF]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#EAF1FF] text-[#2563EB] font-bold text-sm flex items-center justify-center border border-[#2563EB]/30">
              2
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#14283F]">
                Business Snapshot & Evidence Quality
              </h2>
              <p className="text-xs text-[#64748B]">
                Separating Independently Established Facts from Reported Unverified Information and Missing Evidence
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-2' ? <ChevronUp className="w-5 h-5 text-[#64748B] print:hidden" /> : <ChevronDown className="w-5 h-5 text-[#64748B] print:hidden" />}
        </button>

        <div className={activeAccordion === 'sec-2' ? 'block' : 'hidden print:block'}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <div className="flex items-center space-x-2 text-[#15803D] font-bold text-xs uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  <span>Category A: Verified Baseline</span>
                </div>
                <ul className="text-xs text-[#14283F] space-y-1.5 list-disc list-inside">
                  <li>8 years in business; 48 active customers.</li>
                  <li>12 employees (including 2 owners) + 2 subcontractors.</li>
                  <li>NZ$75,000 bank overdraft facility exists.</li>
                  <li>NZ$38,000 cash in operating accounts.</li>
                  <li>Standard customer payment terms: 20 days.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <div className="flex items-center space-x-2 text-[#B45309] font-bold text-xs uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4" />
                  <span>Category B: Reported (Unverified)</span>
                </div>
                <ul className="text-xs text-[#14283F] space-y-1.5 list-disc list-inside">
                  <li>Annual revenue: NZ$1.28M; Operating profit: NZ$100k.</li>
                  <li>NZ$175,000 receivables; NZ$58,000 &gt;60 days overdue.</li>
                  <li>NZ$52,000 overdraft drawn balance.</li>
                  <li>Top 5 customers = 38% revenue; Top 12 = 60% MRR.</li>
                  <li>Labour and vendor costs up ~15%+ over 36 months.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-2">
                <div className="flex items-center space-x-2 text-[#475569] font-bold text-xs uppercase tracking-wider">
                  <SearchIcon className="w-4 h-4" />
                  <span>Category C: Missing Evidence</span>
                </div>
                <ul className="text-xs text-[#14283F] space-y-1.5 list-disc list-inside">
                  <li>Aged receivables ledger with dispute tags.</li>
                  <li>Gross margin per contract and customer effective hourly rate.</li>
                  <li>Billable technical utilization rates by technician.</li>
                  <li>Renewal dates for top 5 anchor accounts.</li>
                  <li>Detailed 4-week cash commitments schedule.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CORE COMMERCIAL CONTRADICTION & ROOT-CAUSE ANALYSIS */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl overflow-hidden shadow-xs">
        <button
          onClick={() => toggleAccordion('sec-3')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] hover:bg-[#F1F5F9] transition border-b border-[#E5EBEF]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#B91C1C] font-bold text-sm flex items-center justify-center border border-[#FECACA]">
              3
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#14283F]">
                Core Commercial Contradiction: Paper Profit vs. Cash Pressure
              </h2>
              <p className="text-xs text-[#64748B]">
                Why Reported Accounting Profit is Failing to Reach the Bank Account
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-3' ? <ChevronUp className="w-5 h-5 text-[#64748B] print:hidden" /> : <ChevronDown className="w-5 h-5 text-[#64748B] print:hidden" />}
        </button>

        <div className={activeAccordion === 'sec-3' ? 'block' : 'hidden print:block'}>
          <div className="p-6 space-y-5 text-xs text-[#14283F] leading-relaxed">
            <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-3">
              <h4 className="font-bold text-[#14283F] text-sm">The Mechanism of Cash Trapping</h4>
              <p className="text-[#64748B]">
                The owner reports an operating profit of NZ$100,000 on revenue of NZ$1.28 million (a 7.8% margin). In accrual accounting, revenue is recognized when invoiced, regardless of payment. Because customer payment cycles average 45–75 days, working capital is consumed in financing customer operations:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-white rounded-lg border border-[#E5EBEF]">
                  <span className="text-[#64748B] block text-[11px]">Uncollected Paper Profit</span>
                  <span className="text-lg font-bold text-[#B91C1C] font-mono mt-0.5 block">NZ$175,000</span>
                  <span className="text-[10px] text-[#64748B]">Trapped in client receivables</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#E5EBEF]">
                  <span className="text-[#64748B] block text-[11px]">Immediate Cash Shortfall</span>
                  <span className="text-lg font-bold text-[#B91C1C] font-mono mt-0.5 block">-NZ$54,000</span>
                  <span className="text-[10px] text-[#64748B]">Cash ($38k) minus Payables ($92k)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#E5EBEF]">
                  <span className="text-[#64748B] block text-[11px]">Bank Overdraft Utilized</span>
                  <span className="text-lg font-bold text-[#E87518] font-mono mt-0.5 block">NZ$52,000</span>
                  <span className="text-[10px] text-[#64748B]">69.3% of NZ$75k credit ceiling</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-2">
              <h4 className="font-bold text-[#14283F] text-sm">Four Interlocking Root Drivers</h4>
              <ol className="list-decimal list-inside space-y-1.5 text-[#14283F]">
                <li><strong>Unenforced Credit Policy: </strong> Continued delivery of active IT support to customers 60+ days delinquent out of fear of churn.</li>
                <li><strong>Unbilled Hardware Procurement: </strong> Purchasing customer laptops and cloud licenses on 30-day supplier terms while billing customers in arrears.</li>
                <li><strong>Contract Margin Compression: </strong> 3-year pricing freeze combined with ~15% inflation in wages and Microsoft licensing costs.</li>
                <li><strong>Unmeasured Scope Creep: </strong> Out-of-scope work absorbed under fixed monthly fees without change orders or supplemental billing.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: THE INTEGRATED COMMERCIAL RISK MAP */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl overflow-hidden shadow-xs">
        <button
          onClick={() => toggleAccordion('sec-4')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] hover:bg-[#F1F5F9] transition border-b border-[#E5EBEF]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#FFFBEB] text-[#B45309] font-bold text-sm flex items-center justify-center border border-[#FDE68A]">
              4
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#14283F]">
                Integrated Commercial Risk Map (Cause-and-Effect Chain)
              </h2>
              <p className="text-xs text-[#64748B]">
                Interconnected Failure Modes: Cash Lag, Key-Person Bottlenecks, and Margin Erosion
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-4' ? <ChevronUp className="w-5 h-5 text-[#64748B] print:hidden" /> : <ChevronDown className="w-5 h-5 text-[#64748B] print:hidden" />}
        </button>

        <div className={activeAccordion === 'sec-4' ? 'block' : 'hidden print:block'}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RISK_MAP_ITEMS.map((item) => (
                <div key={item.id} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] font-mono">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                      {item.urgency}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#14283F] text-xs">Reported Symptom:</h4>
                    <p className="text-xs text-[#64748B]">{item.reportedSymptom}</p>
                  </div>

                  <div className="pt-2 border-t border-[#E5EBEF]">
                    <span className="text-[11px] font-bold text-[#14283F] block">Underlying Commercial Cause:</span>
                    <p className="text-xs text-[#64748B]">{item.possibleUnderlyingCause}</p>
                  </div>

                  <div className="p-2.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] text-[#15803D]">
                    <strong>Recommended First Action: </strong> {item.recommendedFirstAction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: GROWTH INVESTMENT COMPARISON (OPTION A, B, AND C) */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl overflow-hidden shadow-xs">
        <button
          onClick={() => toggleAccordion('sec-5')}
          className="w-full p-6 text-left flex items-center justify-between bg-[#F8FAFC] hover:bg-[#F1F5F9] transition border-b border-[#E5EBEF]"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-[#EAF1FF] text-[#2563EB] font-bold text-sm flex items-center justify-center border border-[#2563EB]/30">
              5
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#14283F]">
                Growth Investment Comparison: Option A vs. Option B vs. Option C
              </h2>
              <p className="text-xs text-[#64748B]">
                Objective Evaluation of Marketing Agency, Salesperson Hire, and Core Margin Turnaround
              </p>
            </div>
          </div>
          {activeAccordion === 'sec-5' ? <ChevronUp className="w-5 h-5 text-[#64748B] print:hidden" /> : <ChevronDown className="w-5 h-5 text-[#64748B] print:hidden" />}
        </button>

        <div className={activeAccordion === 'sec-5' ? 'block' : 'hidden print:block'}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {GROWTH_OPTIONS_EVALUATION.map((opt) => (
                <div key={opt.id} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EAF1FF] text-[#2563EB] border border-[#2563EB]/30 font-mono">
                      {opt.id}
                    </span>
                    <h3 className="font-bold text-[#14283F] text-sm">{opt.title}</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">{opt.proposedAction}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#E5EBEF] text-xs">
                    <div>
                      <span className="text-[#64748B] font-medium block">Upfront Cash Outlay:</span>
                      <span className="text-[#14283F] font-mono font-bold text-[11px]">{opt.upfrontCashRequirement}</span>
                    </div>

                    <div>
                      <span className="text-[#64748B] font-medium block">Route to Cash Collection:</span>
                      <p className="text-[#64748B] text-[11px] leading-relaxed">{opt.routeToRevenueAndCash}</p>
                    </div>

                    <div className="p-2.5 rounded bg-white border border-[#E5EBEF] space-y-1">
                      <span className="font-bold text-[#E87518] block text-[11px]">Break-Even Calculation Framework:</span>
                      <p className="font-mono text-[#14283F] text-[10px]">{opt.calculationFramework.formula}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#15803D] space-y-1">
              <strong className="text-[#15803D] font-bold block text-sm">Advisory Verdict on Capital Commitments:</strong>
              <p className="leading-relaxed text-[#14283F]">
                Options A (Marketing) and B (Salesperson) must be <strong>DEFERRED</strong>. Injecting leads into a service desk experiencing technician flight risk and key-person delivery bottlenecks will accelerate customer churn and drain remaining bank headroom. Implement <strong>Option C (Core Margin Turnaround)</strong> immediately to restore positive liquidity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: MANAGEMENT RECOMMENDATIONS & 48-HOUR GATES */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#E5EBEF] shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-[#2563EB] font-bold text-base">
          <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
          <span>Direct Commercial Recommendation for Vish & Managing Partner</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 text-xs text-[#14283F]">
          <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
            <strong className="text-[#15803D] font-bold block text-sm">1. What to Do First</strong>
            <p className="leading-relaxed text-[#14283F]">
              Verify the aged debtors ledger over the next 48 hours. Isolate the collectable portion of the NZ$58k overdue debt and initiate direct telephone contact on the top 5 accounts to secure immediate cash commitments.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
            <strong className="text-[#B91C1C] font-bold block text-sm">2. What NOT to Commit</strong>
            <p className="leading-relaxed text-[#14283F]">
              Do not commit to the NZ$20k marketing agency spend or the NZ$85k salesperson recruitment. Committing capital before verifying cash flow and gross margins risks exhausting the remaining NZ$23k overdraft buffer.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
            <strong className="text-[#B45309] font-bold block text-sm">3. Immediate Evidence Needed</strong>
            <p className="leading-relaxed text-[#14283F]">
              Supply the aged receivables detail report, the 4-week cash commitments schedule (net payroll, GST/PAYE, supplier POs), and the contract renewal dates for the 5 largest customers.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-1.5">
            <strong className="text-[#475569] font-bold block text-sm">4. Next Decision Gate</strong>
            <p className="leading-relaxed text-[#14283F]">
              Re-evaluate discretionary growth investments at Day 60, upon verifying: (a) overdraft reduced below NZ$20k, (b) customer margin matrix completed, and (c) senior tech focus window operating.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

function SearchIcon(props: any) {
  return <HelpCircle {...props} />;
}
