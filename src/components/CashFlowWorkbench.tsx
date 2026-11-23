import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Clock,
  Coins,
  Edit3,
  Save,
  RotateCcw,
} from 'lucide-react';
import { REPORTED_FINANCIALS } from '../data/coachingBriefing';
import { CaseRecord, FinancialData } from '../types/bizpulse';

interface CashFlowWorkbenchProps {
  caseRecord?: CaseRecord;
  onUpdateFinancials?: (updated: FinancialData) => void;
}

export const CashFlowWorkbench: React.FC<CashFlowWorkbenchProps> = ({
  caseRecord,
  onUpdateFinancials,
}) => {
  const profile = caseRecord?.profile;
  const isDemo = profile?.isDemonstrationCase ?? true;
  const currency = profile?.currency || 'NZD';

  const [cash, setCash] = useState<number>(() => {
    if (caseRecord?.financials?.cashInBank != null) return caseRecord.financials.cashInBank;
    return isDemo ? REPORTED_FINANCIALS.cashInBank : 0;
  });

  const [overdraftUsed, setOverdraftUsed] = useState<number>(() => {
    if (caseRecord?.financials?.creditFacilityUsed != null)
      return caseRecord.financials.creditFacilityUsed;
    return isDemo ? REPORTED_FINANCIALS.overdraftUsed : 0;
  });

  const [overdraftLimit, setOverdraftLimit] = useState<number>(() => {
    if (caseRecord?.financials?.creditFacilityLimit != null)
      return caseRecord.financials.creditFacilityLimit;
    return isDemo ? REPORTED_FINANCIALS.overdraftLimit : 0;
  });

  const [payables, setPayables] = useState<number>(() => {
    if (caseRecord?.financials?.accountsPayable != null) return caseRecord.financials.accountsPayable;
    return isDemo ? REPORTED_FINANCIALS.supplierPayables : 0;
  });

  const [totalAR, setTotalAR] = useState<number>(() => {
    if (caseRecord?.financials?.accountsReceivable != null)
      return caseRecord.financials.accountsReceivable;
    return isDemo ? REPORTED_FINANCIALS.accountsReceivable : 0;
  });

  const [overdue60, setOverdue60] = useState<number>(() => {
    if (caseRecord?.financials?.overdueReceivables != null)
      return caseRecord.financials.overdueReceivables;
    return isDemo ? REPORTED_FINANCIALS.overdue60Days : 0;
  });

  const [isEditingBaseline, setIsEditingBaseline] = useState<boolean>(
    !isDemo && !caseRecord?.financials
  );
  const [baselineSavedAlert, setBaselineSavedAlert] = useState<boolean>(false);

  // Sync cleanly whenever active case changes (strict case isolation)
  useEffect(() => {
    if (caseRecord?.financials) {
      setCash(caseRecord.financials.cashInBank ?? 0);
      setOverdraftUsed(caseRecord.financials.creditFacilityUsed ?? 0);
      setOverdraftLimit(caseRecord.financials.creditFacilityLimit ?? 0);
      setPayables(caseRecord.financials.accountsPayable ?? 0);
      setTotalAR(caseRecord.financials.accountsReceivable ?? 0);
      setOverdue60(caseRecord.financials.overdueReceivables ?? 0);
      setIsEditingBaseline(false);
    } else if (isDemo) {
      setCash(REPORTED_FINANCIALS.cashInBank);
      setOverdraftUsed(REPORTED_FINANCIALS.overdraftUsed);
      setOverdraftLimit(REPORTED_FINANCIALS.overdraftLimit);
      setPayables(REPORTED_FINANCIALS.supplierPayables);
      setTotalAR(REPORTED_FINANCIALS.accountsReceivable);
      setOverdue60(REPORTED_FINANCIALS.overdue60Days);
      setIsEditingBaseline(false);
    } else {
      setCash(0);
      setOverdraftUsed(0);
      setOverdraftLimit(0);
      setPayables(0);
      setTotalAR(0);
      setOverdue60(0);
      setIsEditingBaseline(true);
    }
  }, [caseRecord?.id, isDemo, caseRecord?.financials]);

  // Interactive simulator controls
  const [recoveredPercent, setRecoveredPercent] = useState<number>(65);
  const [hardwarePolicyEnforced, setHardwarePolicyEnforced] = useState<boolean>(true);
  const [monthlyHardwareVolume, setMonthlyHardwareVolume] = useState<number>(isDemo ? 25000 : 10000);
  const [overdraftRatePercent] = useState<number>(12.8);

  const recoveredAmount = Math.round((overdue60 * recoveredPercent) / 100);
  const simulatedOverdraftUsed = Math.max(0, overdraftUsed - recoveredAmount);
  const excessCashFromRecovery = Math.max(0, recoveredAmount - overdraftUsed);
  const simulatedCash = cash + excessCashFromRecovery;
  const simulatedHeadroom = overdraftLimit - simulatedOverdraftUsed;

  const annualInterestCurrent = overdraftUsed * (overdraftRatePercent / 100);
  const annualInterestSimulated = simulatedOverdraftUsed * (overdraftRatePercent / 100);
  const annualInterestSaved = annualInterestCurrent - annualInterestSimulated;

  const hardwareFloatUnlocked = hardwarePolicyEnforced ? monthlyHardwareVolume : 0;
  const currentNetLiquidity = cash - payables;
  const simulatedNetLiquidity = simulatedCash - payables;

  const handleSaveCustomBaseline = () => {
    setIsEditingBaseline(false);
    setBaselineSavedAlert(true);
    setTimeout(() => setBaselineSavedAlert(false), 3500);

    if (onUpdateFinancials) {
      onUpdateFinancials({
        annualRevenue: caseRecord?.financials?.annualRevenue ?? null,
        directCosts: caseRecord?.financials?.directCosts ?? null,
        operatingExpenses: caseRecord?.financials?.operatingExpenses ?? null,
        operatingProfit: caseRecord?.financials?.operatingProfit ?? null,
        cashInBank: cash,
        accountsReceivable: totalAR,
        overdueReceivables: overdue60,
        accountsPayable: payables,
        creditFacilityLimit: overdraftLimit,
        creditFacilityUsed: overdraftUsed,
        customerCount: caseRecord?.financials?.customerCount ?? null,
        top5ConcentrationPercent: caseRecord?.financials?.top5ConcentrationPercent ?? null,
        top12ConcentrationPercent: caseRecord?.financials?.top12ConcentrationPercent ?? null,
        standardPaymentTermsDays: caseRecord?.financials?.standardPaymentTermsDays ?? null,
        actualPaymentDelayDays: caseRecord?.financials?.actualPaymentDelayDays ?? null,
        pricingReviewLastYears: caseRecord?.financials?.pricingReviewLastYears ?? null,
      });
    }
  };

  const handleClearCustomBaseline = () => {
    setCash(0);
    setOverdraftUsed(0);
    setOverdraftLimit(0);
    setPayables(0);
    setTotalAR(0);
    setOverdue60(0);
  };

  const handleResetToDemo = () => {
    setCash(REPORTED_FINANCIALS.cashInBank);
    setOverdraftUsed(REPORTED_FINANCIALS.overdraftUsed);
    setOverdraftLimit(REPORTED_FINANCIALS.overdraftLimit);
    setPayables(REPORTED_FINANCIALS.supplierPayables);
    setTotalAR(REPORTED_FINANCIALS.accountsReceivable);
    setOverdue60(REPORTED_FINANCIALS.overdue60Days);
    setIsEditingBaseline(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Charcoal Hero Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#FBBF24]">
                Cash Flow &amp; Working Capital Workbench
              </span>
              <span className="text-xs font-medium text-[#A1A1AA]">
                {isDemo ? 'Benchmark Demo Case' : profile?.name || 'Custom Business'} · {currency}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Cash Position, Debtors &amp; Facility Headroom
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed tabular-nums">
              Cash on hand: <strong className="text-white">{currency} {cash.toLocaleString()}</strong> ·{' '}
              Credit drawn: <strong className="text-[#FCD34D]">{currency} {overdraftUsed.toLocaleString()}</strong> ·{' '}
              Payables due: <strong className="text-[#FCA5A5]">{currency} {payables.toLocaleString()}</strong> ·{' '}
              Net liquidity:{' '}
              <strong className={currentNetLiquidity < 0 ? 'text-[#FCA5A5]' : 'text-[#86EFAC]'}>
                {currentNetLiquidity < 0 ? '-' : '+'}
                {currency} {Math.abs(currentNetLiquidity).toLocaleString()}
              </strong>
            </p>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <div className="bg-white/10 border border-white/15 rounded p-4 min-w-[230px] text-center">
              <span className="text-[11px] font-mono text-[#FBBF24] uppercase tracking-wider font-bold block">
                Remaining Facility Headroom
              </span>
              <div className="text-3xl font-bold text-white mt-1 font-mono tabular-nums">
                {currency} {(overdraftLimit - overdraftUsed).toLocaleString()}
              </div>
              <div className="text-xs text-[#D4D4D8] mt-1 tabular-nums">
                of {currency} {overdraftLimit.toLocaleString()} limit
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingBaseline(!isEditingBaseline)}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>{isEditingBaseline ? 'Hide Financial Inputs' : 'Enter / Edit Cash Figures'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editable Baseline Drawer */}
      {isEditingBaseline && (
        <div className="bg-white border border-[#D97706] rounded p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#111113]/10">
            <div>
              <h3 className="font-bold text-[#111113] text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#D97706]" />
                <span>
                  {profile?.name || 'Active Business'} — Working Capital Inputs ({currency})
                </span>
              </h3>
              <p className="text-xs text-[#52525B]">
                Enter verified figures from your accounting system or bank balance. Leave unknown balances at 0 rather than guessing.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isDemo ? (
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded bg-[#F8F7F4] text-xs font-semibold text-[#52525B] hover:text-[#111113] border border-[#111113]/15 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo Figures</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClearCustomBaseline}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded bg-[#F8F7F4] text-xs font-semibold text-[#52525B] hover:text-[#111113] border border-[#111113]/15 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Inputs</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveCustomBaseline}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[#111113] hover:bg-[#27272A] text-white font-semibold uppercase tracking-wider text-xs shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Save Cash Baseline</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[#52525B] font-semibold block mb-1">
                Available Cash in Bank ({currency})
              </label>
              <input
                type="number"
                value={cash}
                onChange={(e) => setCash(Number(e.target.value) || 0)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded p-2.5 text-[#111113] font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
            </div>

            <div>
              <label className="text-[#52525B] font-semibold block mb-1">
                Overdraft / Credit Drawn ({currency})
              </label>
              <input
                type="number"
                value={overdraftUsed}
                onChange={(e) => setOverdraftUsed(Number(e.target.value) || 0)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded p-2.5 text-[#111113] font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
            </div>

            <div>
              <label className="text-[#52525B] font-semibold block mb-1">
                Total Credit Facility Limit ({currency})
              </label>
              <input
                type="number"
                value={overdraftLimit}
                onChange={(e) => setOverdraftLimit(Number(e.target.value) || 0)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded p-2.5 text-[#111113] font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
            </div>

            <div>
              <label className="text-[#52525B] font-semibold block mb-1">
                Outstanding Payables ({currency})
              </label>
              <input
                type="number"
                value={payables}
                onChange={(e) => setPayables(Number(e.target.value) || 0)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded p-2.5 text-[#111113] font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
            </div>

            <div>
              <label className="text-[#52525B] font-semibold block mb-1">
                Total Unpaid Customer Invoices ({currency})
              </label>
              <input
                type="number"
                value={totalAR}
                onChange={(e) => setTotalAR(Number(e.target.value) || 0)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded p-2.5 text-[#111113] font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
            </div>

            <div>
              <label className="text-[#52525B] font-semibold block mb-1">
                Invoices Overdue &gt;60 Days ({currency})
              </label>
              <input
                type="number"
                value={overdue60}
                onChange={(e) => setOverdue60(Number(e.target.value) || 0)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded p-2.5 text-[#111113] font-mono tabular-nums focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
              />
            </div>
          </div>
        </div>
      )}

      {baselineSavedAlert && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] p-3.5 rounded text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Working capital figures saved to this isolated business session.</span>
        </div>
      )}

      {/* 4 Core Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#52525B]">
              Available Cash
            </span>
            <div className="p-1.5 rounded bg-[#ECFDF5] text-[#15803D]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#111113] mt-2 font-mono">
            {currency} {cash.toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-[#B91C1C] flex items-center gap-1 font-medium bg-[#FEF2F2] px-2.5 py-1 rounded border border-[#FECACA]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{currency} {payables.toLocaleString()} payables due</span>
          </div>
          <div className="mt-2 text-xs text-[#52525B]">
            Net liquidity:{' '}
            <span className={`font-bold font-mono ${currentNetLiquidity < 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>
              {currentNetLiquidity < 0 ? '-' : '+'}
              {currency} {Math.abs(currentNetLiquidity).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#52525B]">
              Credit Facility Drawn
            </span>
            <div className="p-1.5 rounded bg-[#FFFBEB] text-[#B45309]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#B45309] mt-2 font-mono">
            {currency} {overdraftUsed.toLocaleString()}
          </div>
          <div className="mt-3 w-full bg-[#E5E5E5] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#D97706] h-full rounded-full transition-all"
              style={{
                width: `${overdraftLimit > 0 ? Math.min(100, (overdraftUsed / overdraftLimit) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#52525B]">
            <span>Limit: {currency} {overdraftLimit.toLocaleString()}</span>
            <span className="text-[#B45309] font-bold">
              {overdraftLimit > 0 ? Math.round((overdraftUsed / overdraftLimit) * 100) : 0}% used
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#52525B]">
              Unpaid Invoices
            </span>
            <div className="p-1.5 rounded bg-[#F8F7F4] text-[#D97706]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#111113] mt-2 font-mono">
            {currency} {totalAR.toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-[#B91C1C] flex items-center gap-1 font-semibold bg-[#FEF2F2] px-2.5 py-1 rounded border border-[#FECACA]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{currency} {overdue60.toLocaleString()} &gt;60d overdue</span>
          </div>
          <div className="mt-2 text-xs text-[#52525B]">
            <span className="font-bold text-[#B91C1C] font-mono">
              {totalAR > 0 ? Math.round((overdue60 / totalAR) * 100) : 0}%
            </span>{' '}
            delinquent &gt;60 days
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#52525B]">
              Est. Interest Cost
            </span>
            <div className="p-1.5 rounded bg-[#FFFBEB] text-[#B45309]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#B45309] mt-2 font-mono">
            {currency} {Math.round(annualInterestCurrent).toLocaleString()}
            <span className="text-xs font-normal text-[#52525B]">/yr</span>
          </div>
          <div className="mt-3 text-xs text-[#52525B]">
            At ~{overdraftRatePercent}% rate on drawn balance
          </div>
          <div className="mt-2 text-xs text-[#B45309] font-medium">
            Interest cost on late client payments
          </div>
        </div>
      </div>

      {/* Interactive Recovery Simulator */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-lg font-bold text-[#111113]">
                Debt Collection &amp; Upfront Billing Simulator
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1">
              Test the cash release from collecting {currency} {overdue60.toLocaleString()} in overdue debt and requiring upfront deposits on hardware or materials.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-[#F8F7F4] px-4 py-2 rounded border border-[#111113]/15">
            <span className="text-xs font-semibold text-[#111113]">
              Upfront Materials/Hardware Policy:
            </span>
            <button
              type="button"
              onClick={() => setHardwarePolicyEnforced(!hardwarePolicyEnforced)}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                hardwarePolicyEnforced
                  ? 'bg-[#111113] text-[#FBBF24]'
                  : 'bg-[#E5E5E5] text-[#52525B] hover:bg-[#D4D4D8]'
              }`}
            >
              {hardwarePolicyEnforced ? 'ENFORCED' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#111113]">
                  Overdue Receivables Collection Rate
                </label>
                <span className="text-sm font-bold text-[#B45309] font-mono tabular-nums bg-[#FFFBEB] px-2.5 py-0.5 rounded border border-[#FDE68A]">
                  {recoveredPercent}% ({currency} {recoveredAmount.toLocaleString()})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={recoveredPercent}
                onChange={(e) => setRecoveredPercent(Number(e.target.value))}
                className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#D97706]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#111113]">
                  Monthly Supplies / Materials Outlay Protected
                </label>
                <span className="text-sm font-bold text-[#111113] font-mono tabular-nums bg-[#F8F7F4] px-2.5 py-0.5 rounded border border-[#111113]/15">
                  {currency} {monthlyHardwareVolume.toLocaleString()} / mo
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="60000"
                step="2500"
                value={monthlyHardwareVolume}
                onChange={(e) => setMonthlyHardwareVolume(Number(e.target.value))}
                className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#D97706]"
              />
            </div>
          </div>

          <div className="bg-[#F8F7F4] rounded p-5 border border-[#111113]/12 space-y-4 tabular-nums">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#111113] flex items-center justify-between border-b border-[#111113]/10 pb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#D97706]" />
                Projected Liquidity Impact
              </span>
              <span className="font-mono text-[#15803D] text-xs font-bold bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                +{currency} {recoveredAmount.toLocaleString()} Collected
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-white border border-[#111113]/10">
                <span className="text-[#52525B] block text-[11px] font-semibold">
                  Projected Overdraft
                </span>
                <span
                  className={`text-lg font-bold font-mono mt-0.5 block ${
                    simulatedOverdraftUsed === 0 ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}
                >
                  {currency} {simulatedOverdraftUsed.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#111113]/10">
                <span className="text-[#52525B] block text-[11px] font-semibold">
                  Facility Headroom
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  {currency} {simulatedHeadroom.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#111113]/10">
                <span className="text-[#52525B] block text-[11px] font-semibold">
                  Annual Interest Saved
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  +{currency} {Math.round(annualInterestSaved).toLocaleString()}/yr
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#111113]/10">
                <span className="text-[#52525B] block text-[11px] font-semibold">
                  Monthly Float Retained
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  +{currency} {hardwareFloatUnlocked.toLocaleString()}/mo
                </span>
              </div>
            </div>

            <div className="p-3 rounded bg-white border border-[#111113]/10 text-xs flex items-center justify-between">
              <span className="text-[#52525B] font-medium">Simulated Net Immediate Liquidity:</span>
              <span
                className={`font-mono font-bold text-sm ${
                  simulatedNetLiquidity >= 0 ? 'text-[#15803D]' : 'text-[#B45309]'
                }`}
              >
                {simulatedNetLiquidity < 0 ? '-' : '+'}
                {currency} {Math.abs(simulatedNetLiquidity).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
