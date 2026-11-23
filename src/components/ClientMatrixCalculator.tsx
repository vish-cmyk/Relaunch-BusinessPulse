import React, { useState } from 'react';
import {
  Users,
  AlertOctagon,
  CheckCircle,
  Layers,
  Percent,
  FileSpreadsheet,
  Info,
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
  const fin = caseRecord?.financials;

  const clientCount = fin?.customerCount ?? (isDemo ? 48 : null);
  const top5Pct = fin?.top5ConcentrationPercent ?? (isDemo ? 38 : null);
  const top12Pct = fin?.top12ConcentrationPercent ?? (isDemo ? 60 : null);
  const next7Pct = top12Pct !== null && top5Pct !== null ? Math.max(0, top12Pct - top5Pct) : null;
  const tailPct = top12Pct !== null ? Math.max(0, 100 - top12Pct) : null;

  const annualRevenue = fin?.annualRevenue ?? (isDemo ? REPORTED_FINANCIALS.revenue : null);
  const operatingProfit =
    fin?.operatingProfit ?? (isDemo ? REPORTED_FINANCIALS.reportedOperatingProfit : null);

  // Allow owner modeling via sliders; initialize conservatively without fabricating business baseline
  const [priceableRevenueBase, setPriceableRevenueBase] = useState<number>(
    annualRevenue ? Math.round(annualRevenue * 0.65) : isDemo ? 850000 : 250000
  );
  const [priceIncreasePct, setPriceIncreasePct] = useState<number>(10);
  const [churnedClientsCount, setChurnedClientsCount] = useState<number>(2);
  const [averageChurnedClientMRR, setAverageChurnedClientMRR] = useState<number>(1100);
  const [churnedClientMarginPct, setChurnedClientMarginPct] = useState<number>(18);

  const grossPriceGain = Math.round(priceableRevenueBase * (priceIncreasePct / 100));
  const lostAnnualRevenue = churnedClientsCount * averageChurnedClientMRR * 12;
  const lostAnnualGrossProfit = Math.round(lostAnnualRevenue * (churnedClientMarginPct / 100));
  const netProfitImpact = grossPriceGain - lostAnnualGrossProfit;
  const newProjectedOperatingProfit =
    operatingProfit !== null ? operatingProfit + netProfitImpact : netProfitImpact;
  const totalHoursFreedPerMonth = churnedClientsCount * 16;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Charcoal Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#FBBF24]">
                Client Portfolio &amp; Pricing Model
              </span>
              <span className="text-xs text-[#A1A1AA] font-medium">
                {profile?.name || 'Business Case'} ({profile?.industry || 'SME'})
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Customer Concentration &amp; Price Review Calculator
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed tabular-nums">
              {clientCount !== null
                ? `Active customers: ${clientCount}.`
                : 'Customer count not yet supplied for this business.'}{' '}
              {isDemo
                ? 'Top 5 clients represent 38% of revenue and Top 12 represent 60% of recurring revenue.'
                : 'Test how a disciplined price increase impacts operating profit even if a few low-margin clients leave.'}
            </p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded p-4 min-w-[230px] text-center shrink-0">
            <span className="text-[11px] font-mono text-[#FBBF24] uppercase tracking-wider font-bold block">
              {operatingProfit !== null ? 'Reported Operating Profit' : 'Operating Profit Baseline'}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1 font-mono tabular-nums">
              {operatingProfit !== null ? `${currency} ${operatingProfit.toLocaleString()}` : 'Not supplied'}
            </div>
            <div className="text-[11px] text-[#D4D4D8] mt-1">
              Pre-tax &amp; pre-owner drawings
            </div>
          </div>
        </div>
      </div>

      {!isDemo && annualRevenue === null && (
        <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <span>
            No historical revenue or customer concentration figures have been supplied for{' '}
            <strong>{profile?.name}</strong> yet. Use the modeling slider below to test scenarios cleanly without assuming unverified client data.
          </span>
        </div>
      )}

      {/* Concentration Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B91C1C]">
              Top 5 Anchor Clients
            </span>
            <AlertOctagon className="w-4 h-4 text-[#B91C1C]" />
          </div>
          <div className="text-2xl font-bold text-[#111113] font-mono">
            {top5Pct !== null ? `${top5Pct}% of Revenue` : 'Not supplied'}
          </div>
          <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#111113]">
            <strong>Risk Check: </strong>
            Losing any single anchor client requires formal relationship reviews and written renewal visibility.
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B45309]">
              Next Core Tier
            </span>
            <Users className="w-4 h-4 text-[#B45309]" />
          </div>
          <div className="text-2xl font-bold text-[#111113] font-mono">
            {next7Pct !== null ? `${next7Pct}% of Revenue` : 'Not supplied'}
          </div>
          <div className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113]">
            <strong>Retention Focus: </strong>
            Core recurring accounts respond well to predictable service roadmaps and transparent pricing updates.
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#111113]">
              Long-Tail Accounts
            </span>
            <Layers className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="text-2xl font-bold text-[#111113] font-mono">
            {tailPct !== null ? `${tailPct}% of Revenue` : 'Not supplied'}
          </div>
          <div className="p-2.5 rounded bg-[#F8F7F4] border border-[#111113]/10 text-xs text-[#111113]">
            <strong>Scope Hygiene: </strong>
            Small ad-hoc accounts often create disproportionate admin interruptions and unpaid support calls.
          </div>
        </div>
      </div>

      {/* Price Review & Churn Sensitivity Calculator */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-lg font-bold text-[#111113]">
                Scenario Simulator: Price Adjustment vs. Low-Margin Churn
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1">
              Test what happens to annual net profit when you review pricing by 8–12% across your recurring revenue base.
            </p>
          </div>
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-1.5 rounded text-xs text-[#15803D] font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            <span>Margin Recovery Simulator</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
          <div className="space-y-5">
            {!isDemo && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-[#111113]">
                    Scenario Annual Recurring Revenue Base ({currency})
                  </label>
                  <span className="text-xs font-bold font-mono tabular-nums text-[#D97706]">
                    {currency} {priceableRevenueBase.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="50000"
                  max="2500000"
                  step="25000"
                  value={priceableRevenueBase}
                  onChange={(e) => setPriceableRevenueBase(Number(e.target.value))}
                  className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#D97706]"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#111113]">
                  Contract Price Adjustment (%)
                </label>
                <span className="text-sm font-bold text-[#B45309] font-mono tabular-nums bg-[#FFFBEB] px-2.5 py-0.5 rounded border border-[#FDE68A]">
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
                className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#D97706]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#111113]">
                  Estimated Low-Margin Clients Exiting
                </label>
                <span className="text-sm font-bold text-[#B91C1C] font-mono tabular-nums bg-[#FEF2F2] px-2.5 py-0.5 rounded border border-[#FECACA]">
                  {churnedClientsCount} clients
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="1"
                value={churnedClientsCount}
                onChange={(e) => setChurnedClientsCount(Number(e.target.value))}
                className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#DC2626]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#F8F7F4] border border-[#111113]/12 rounded">
                <label className="text-[#52525B] block font-semibold mb-1">
                  Avg Monthly Retainer ({currency})
                </label>
                <input
                  type="number"
                  value={averageChurnedClientMRR}
                  onChange={(e) => setAverageChurnedClientMRR(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded px-2.5 py-1 font-mono font-bold text-[#111113] tabular-nums focus:outline-none focus:border-[#D97706]"
                />
              </div>
              <div className="p-3 bg-[#F8F7F4] border border-[#111113]/12 rounded">
                <label className="text-[#52525B] block font-semibold mb-1">
                  Gross Margin on Churned (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={churnedClientMarginPct}
                  onChange={(e) => setChurnedClientMarginPct(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded px-2.5 py-1 font-mono font-bold text-[#111113] tabular-nums focus:outline-none focus:border-[#D97706]"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#F8F7F4] border border-[#111113]/12 rounded p-5 space-y-4 tabular-nums">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#111113] border-b border-[#111113]/10 pb-2">
              Projected Operating Profit Outcome
            </h4>

            <div className="space-y-3 divide-y divide-[#111113]/10 text-sm">
              <div className="flex justify-between items-center pt-1">
                <span className="text-[#52525B]">Gross Price Review Gain:</span>
                <span className="font-bold text-[#15803D] font-mono">
                  +{currency} {grossPriceGain.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#52525B]">Lost Gross Profit from Churn:</span>
                <span className="font-semibold text-[#B91C1C] font-mono">
                  -{currency} {lostAnnualGrossProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 bg-white p-3 rounded border border-[#111113]/12">
                <span className="font-bold text-[#111113]">Net Annual Profit Impact:</span>
                <span
                  className={`font-bold font-mono text-base ${
                    netProfitImpact >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                  }`}
                >
                  {netProfitImpact >= 0 ? '+' : '-'}
                  {currency} {Math.abs(netProfitImpact).toLocaleString()}
                </span>
              </div>
              {operatingProfit !== null && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#52525B]">New Projected Operating Profit:</span>
                  <span className="font-bold text-[#111113] font-mono text-lg">
                    {currency} {newProjectedOperatingProfit.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#52525B]">Team Capacity Freed:</span>
                <span className="font-bold text-[#D97706] font-mono">
                  +{totalHoursFreedPerMonth} hrs / month
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Tier Segmentation Playbook */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs">
        <h3 className="text-base font-bold text-[#111113] mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-[#D97706]" />
          <span>4-Tier Client Portfolio Segmentation Guide</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#15803D] block">
              Tier 1: Champions
            </span>
            <p className="text-[#111113]">Prompt payers, high margin, strong mutual trust.</p>
            <p className="text-[#15803D] font-semibold">
              Action: Executive check-ins + value-led renewals.
            </p>
          </div>
          <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#111113] block">
              Tier 2: Steady Core
            </span>
            <p className="text-[#111113]">Predictable service needs, pays within 20–35 days.</p>
            <p className="text-[#D97706] font-semibold">
              Action: Scheduled CPI/cost price update + direct debit.
            </p>
          </div>
          <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#B45309] block">
              Tier 3: Margin Squeeze
            </span>
            <p className="text-[#111113]">Repeatedly demands discounts or extra free scope.</p>
            <p className="text-[#B45309] font-semibold">
              Action: Remove unbilled inclusions before matching price.
            </p>
          </div>
          <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#B91C1C] block">
              Tier 4: Chronic Drain
            </span>
            <p className="text-[#111113]">Consistently 60+ days overdue with high ticket friction.</p>
            <p className="text-[#B91C1C] font-semibold">
              Action: Enforce credit stop-work or exit account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
