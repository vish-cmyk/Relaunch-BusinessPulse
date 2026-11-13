import React, { useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  AlertOctagon, 
  ShieldAlert, 
  CheckCircle, 
  Layers, 
  Percent, 
  Clock, 
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { REPORTED_FINANCIALS } from '../data/coachingBriefing';
import { CaseRecord } from '../types/bizpulse';

interface ClientMatrixCalculatorProps {
  caseRecord?: CaseRecord;
}

export const ClientMatrixCalculator: React.FC<ClientMatrixCalculatorProps> = ({ caseRecord }) => {
  const profile = caseRecord?.profile;
  const isDemo = profile?.isDemonstrationCase ?? true;
  const currency = profile?.currency || 'NZD';

  // Base client and revenue parameters
  const clientCount = caseRecord?.financials?.customerCount ?? (isDemo ? 48 : 35);
  const recurringRevenueBase = caseRecord?.financials?.annualRevenue 
    ? Math.round(caseRecord.financials.annualRevenue * 0.65)
    : (isDemo ? 850000 : 500000);
  const currentOperatingProfit = caseRecord?.financials?.operatingProfit 
    ?? (isDemo ? REPORTED_FINANCIALS.reportedOperatingProfit : 80000);

  // Simulator state
  const [priceIncreasePct, setPriceIncreasePct] = useState<number>(10);
  const [churnedClientsCount, setChurnedClientsCount] = useState<number>(2);
  const [averageChurnedClientMRR, setAverageChurnedClientMRR] = useState<number>(1100);
  const [churnedClientMarginPct, setChurnedClientMarginPct] = useState<number>(18); // Low margin clients

  // Calculations
  const grossPriceGain = Math.round(recurringRevenueBase * (priceIncreasePct / 100));
  const lostAnnualRevenue = churnedClientsCount * averageChurnedClientMRR * 12;
  const lostAnnualGrossProfit = Math.round(lostAnnualRevenue * (churnedClientMarginPct / 100));
  
  // Net bottom-line impact
  const netProfitImpact = grossPriceGain - lostAnnualGrossProfit;
  const newProjectedOperatingProfit = currentOperatingProfit + netProfitImpact;
  const profitPercentageIncrease = currentOperatingProfit > 0 
    ? Math.round((netProfitImpact / currentOperatingProfit) * 100) 
    : 100;

  // Technical/operational hours saved from churned low-margin accounts
  const estimatedHoursPerChurnedClientMonth = 16;
  const totalHoursFreedPerMonth = churnedClientsCount * estimatedHoursPerChurnedClientMonth;

  return (
    <div className="space-y-6">
      {/* Top Banner Context */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30">
                Pillar 2: Client Portfolio & Pricing
              </span>
              <span className="text-[#64748B] text-xs font-medium">Customer Economics Audit</span>
              {isDemo ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30">
                  Demo Case (NZ MSP)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {profile?.name}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-[#14283F] tracking-tight">
              Customer Concentration & The 8–12% Price Review Math
            </h2>
            <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
              Managing <span className="font-semibold text-[#14283F]">{clientCount} active customers</span>. 
              {isDemo ? ' Twelve drive 60% of recurring revenue; your top 5 drive 38% of total revenue. Contracts frozen for 3 years while cost inflation rose 15%+.' : ` Customer portfolio analysis for ${profile?.name} in ${profile?.industry}. Model price adjustments and margin protection.`}
            </p>
          </div>
          <div className="bg-[#F8FAFC] border border-[#E5EBEF] rounded-xl p-4 min-w-[240px] text-center shadow-sm">
            <span className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Current Operating Profit</span>
            <div className="text-3xl font-extrabold text-[#14283F] mt-1 font-mono">
              {currency} {currentOperatingProfit.toLocaleString()}
            </div>
            <div className="text-xs text-[#D99A35] font-semibold mt-1">
              Pre-tax & pre-owner drawings
            </div>
          </div>
        </div>
      </div>

      {/* Customer Concentration Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Top 5 Anchor Clients</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-[#14283F] mt-2 font-mono">
            38% of Revenue
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            ~{currency} {Math.round(recurringRevenueBase * 0.45).toLocaleString()} / year
          </div>
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
            <strong>Key Vulnerability: </strong>
            Loss of any single anchor client directly imperils pre-tax operating profit. Requires dedicated executive relationship management.
          </div>
        </div>

        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm border-l-4 border-l-[#D99A35]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D99A35]">Next 7 Core Clients</span>
            <Users className="w-4 h-4 text-[#D99A35]" />
          </div>
          <div className="text-2xl font-bold text-[#14283F] mt-2 font-mono">
            22% of Revenue
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            ~{currency} {Math.round(recurringRevenueBase * 0.25).toLocaleString()} / year
          </div>
          <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>Combined Power: </strong>
            Top 12 clients represent 60% of recurring revenue. These core accounts must receive proactive executive reviews this month.
          </div>
        </div>

        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm border-l-4 border-l-[#168C83]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#168C83]">Remaining Long-Tail Clients</span>
            <Layers className="w-4 h-4 text-[#168C83]" />
          </div>
          <div className="text-2xl font-bold text-[#14283F] mt-2 font-mono">
            40% of Revenue
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            ~{currency} {Math.round(recurringRevenueBase * 0.30).toLocaleString()} / year
          </div>
          <div className="mt-3 p-2.5 rounded-lg bg-[#E6F4F2] border border-[#168C83]/30 text-xs text-[#12726B]">
            <strong>Scope Creep Source: </strong>
            Consumes ~70% of ad-hoc interruptions, billing disputes, and payment friction. Prime candidates for price and scope realignments.
          </div>
        </div>
      </div>

      {/* Interactive Price Realignment & Churn Sensitivity Simulator */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5EBEF]">
          <div>
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-[#168C83]" />
              <h3 className="text-lg font-bold text-[#14283F]">
                Sensitivity Engine: Price Increase vs Churn Impact
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Prove the commercial mathematics: What happens when you increase service prices by 8–12%, even if 2–3 low-margin clients leave?
            </p>
          </div>

          <div className="bg-[#E6F4F2] border border-[#168C83]/30 px-3.5 py-1.5 rounded-xl text-xs text-[#168C83] font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-[#168C83]" />
            <span>Pure Gross Profit Expansion</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
          {/* Controls */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#14283F]">
                  Recurring Contract Price Adjustment
                </label>
                <span className="text-base font-bold text-[#168C83] font-mono bg-[#E6F4F2] px-2.5 py-0.5 rounded-full border border-[#168C83]/30">
                  +{priceIncreasePct}% (+{currency} {grossPriceGain.toLocaleString()}/yr)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={priceIncreasePct}
                onChange={(e) => setPriceIncreasePct(Number(e.target.value))}
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#168C83]"
              />
              <div className="flex justify-between text-xs text-[#64748B] mt-1 font-mono">
                <span>0% (Frozen)</span>
                <span>8% (Inflation offset)</span>
                <span className="text-[#168C83] font-semibold">10% (Target)</span>
                <span>15% (Modernization)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#14283F]">
                  Potential Price-Sensitive Churn
                </label>
                <span className="text-base font-bold text-rose-700 font-mono bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {churnedClientsCount} low-margin clients leave
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="1"
                value={churnedClientsCount}
                onChange={(e) => setChurnedClientsCount(Number(e.target.value))}
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between text-xs text-[#64748B] mt-1 font-mono">
                <span>0 clients</span>
                <span className="text-rose-700 font-semibold">2 clients (Typical)</span>
                <span>4 clients</span>
                <span>6 clients</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl">
                <span className="text-xs text-[#64748B] block font-medium">Avg MRR of Churning Clients</span>
                <span className="text-sm font-bold text-[#14283F] font-mono">
                  {currency} {averageChurnedClientMRR.toLocaleString()}/mo
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl">
                <span className="text-xs text-[#64748B] block font-medium">Est. Gross Margin on Churned</span>
                <span className="text-sm font-bold text-[#14283F] font-mono">
                  {churnedClientMarginPct}% (High support cost)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#E6F4F2] border border-[#168C83]/30 text-xs text-[#12726B] leading-relaxed">
              <strong className="text-[#168C83] font-bold">Commercial Insight: </strong>
              Even if {churnedClientsCount} low-margin clients leave during a price realignment, your bottom line profit expands by <strong>+{currency} {netProfitImpact.toLocaleString()}</strong>, while reclaiming <strong>{totalHoursFreedPerMonth} operational hours/month</strong> to serve your best accounts!
            </div>
          </div>

          {/* Simulated Financial Outcome */}
          <div className="bg-[#F8FAFC] border border-[#E5EBEF] rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#14283F] flex items-center justify-between border-b border-[#E5EBEF] pb-2">
              <span>Financial Impact on Bottom Line</span>
              <span className="text-xs normal-case text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Operating Profit Trajectory
              </span>
            </h4>

            <div className="space-y-3 divide-y divide-[#E5EBEF] text-sm">
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#64748B]">Gross Gain from {priceIncreasePct}% Price Review:</span>
                <span className="font-bold text-emerald-700 font-mono">+{currency} {grossPriceGain.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#64748B]">Lost Gross Billings from {churnedClientsCount} Churned Clients:</span>
                <span className="font-medium text-[#64748B] font-mono">-{currency} {lostAnnualRevenue.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#64748B]">Actual Lost Gross Profit (at {churnedClientMarginPct}% margin):</span>
                <span className="font-medium text-rose-700 font-mono">-{currency} {lostAnnualGrossProfit.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center pt-2 bg-white p-2.5 rounded-lg border border-[#E5EBEF] shadow-sm">
                <span className="font-semibold text-[#14283F]">Net Annual Operating Profit Gain:</span>
                <span className="font-extrabold text-emerald-700 font-mono text-base">
                  +{currency} {netProfitImpact.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#64748B]">New Projected Operating Profit:</span>
                <div className="text-right">
                  <span className="font-bold text-[#14283F] font-mono text-lg">
                    {currency} {newProjectedOperatingProfit.toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-700 block font-semibold">
                    +{profitPercentageIncrease}% increase from baseline
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[#64748B]">Operational Capacity Recovered:</span>
                <span className="font-bold text-[#168C83] font-mono">
                  +{totalHoursFreedPerMonth} hours / month
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <span className="font-bold">Commercial Verdict: </span>
                Disciplined price and contract reviews strengthen margins from {currency} {currentOperatingProfit.toLocaleString()} to {currency} {newProjectedOperatingProfit.toLocaleString()} while releasing team capacity and reducing unplanned firefighting.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The 4-Tier Client Categorization & Playbook */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#14283F] mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-[#D99A35]" />
          The 4-Tier Customer Segmentation & Treatment Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tier 1 */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Tier 1: Champions</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Top 20%</span>
            </div>
            <h4 className="font-bold text-[#14283F] text-sm">Strategic Core (60% Revenue)</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Prompt payers, high trust, value executive relationship and reliability.
            </p>
            <div className="pt-2 text-xs text-emerald-900 font-medium border-t border-[#E5EBEF]">
              <strong className="text-emerald-800">Action: </strong> Quarterly executive reviews, proactive technology roadmaps, personalized contract renewals bundled with added value.
            </div>
          </div>

          {/* Tier 2 */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-blue-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Tier 2: Steady Core</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Standard</span>
            </div>
            <h4 className="font-bold text-[#14283F] text-sm">Low-Drama Maintenance</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Regular service consumers. Standard payment turnaround (20-35 days).
            </p>
            <div className="pt-2 text-xs text-blue-900 font-medium border-t border-[#E5EBEF]">
              <strong className="text-blue-800">Action: </strong> Standard 8–10% price update notice with 30-day window. Shift to automated payment direct debit.
            </div>
          </div>

          {/* Tier 3 */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Tier 3: Fee Pushback</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Discount Seekers</span>
            </div>
            <h4 className="font-bold text-[#14283F] text-sm">Demanding Price Cuts</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Resists standard rates, shops quotes, requests fee reductions.
            </p>
            <div className="pt-2 text-xs text-amber-900 font-medium border-t border-[#E5EBEF]">
              <strong className="text-amber-800">Action: </strong> Never discount without reducing scope! Strip non-essential hours or transition to strict billable hourly rate.
            </div>
          </div>

          {/* Tier 4 */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-rose-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Tier 4: Toxic Drain</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">High Risk</span>
            </div>
            <h4 className="font-bold text-[#14283F] text-sm">Chronic Late-Payers</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Consumes working capital in &gt;60-day debt, expects immediate unpaid support, creates team stress.
            </p>
            <div className="pt-2 text-xs text-rose-900 font-medium border-t border-[#E5EBEF]">
              <strong className="text-rose-800">Action: </strong> Immediate credit stop-work. If they refuse to clear arrears, discontinue service and protect staff sanity.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
