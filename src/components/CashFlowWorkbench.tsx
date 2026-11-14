import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  HelpCircle,
  Clock,
  Coins,
  Edit3,
  Save,
  RotateCcw
} from 'lucide-react';
import { REPORTED_FINANCIALS } from '../data/coachingBriefing';
import { CaseRecord, FinancialData } from '../types/bizpulse';

interface CashFlowWorkbenchProps {
  caseRecord?: CaseRecord;
  onUpdateFinancials?: (updated: FinancialData) => void;
}

export const CashFlowWorkbench: React.FC<CashFlowWorkbenchProps> = ({
  caseRecord,
  onUpdateFinancials
}) => {
  const profile = caseRecord?.profile;
  const isDemo = profile?.isDemonstrationCase ?? true;
  const currency = profile?.currency || 'NZD';

  // Base reported figures (editable for any business)
  const [cash, setCash] = useState<number>(() => {
    if (caseRecord?.financials?.cashInBank != null) return caseRecord.financials.cashInBank;
    return isDemo ? REPORTED_FINANCIALS.cashInBank : 0;
  });

  const [overdraftUsed, setOverdraftUsed] = useState<number>(() => {
    if (caseRecord?.financials?.creditFacilityUsed != null) return caseRecord.financials.creditFacilityUsed;
    return isDemo ? REPORTED_FINANCIALS.overdraftUsed : 0;
  });

  const [overdraftLimit, setOverdraftLimit] = useState<number>(() => {
    if (caseRecord?.financials?.creditFacilityLimit != null) return caseRecord.financials.creditFacilityLimit;
    return isDemo ? REPORTED_FINANCIALS.overdraftLimit : 0;
  });

  const [payables, setPayables] = useState<number>(() => {
    if (caseRecord?.financials?.accountsPayable != null) return caseRecord.financials.accountsPayable;
    return isDemo ? REPORTED_FINANCIALS.supplierPayables : 0;
  });

  const [totalAR, setTotalAR] = useState<number>(() => {
    if (caseRecord?.financials?.accountsReceivable != null) return caseRecord.financials.accountsReceivable;
    return isDemo ? REPORTED_FINANCIALS.accountsReceivable : 0;
  });

  const [overdue60, setOverdue60] = useState<number>(() => {
    if (caseRecord?.financials?.overdueReceivables != null) return caseRecord.financials.overdueReceivables;
    return isDemo ? REPORTED_FINANCIALS.overdue60Days : 0;
  });

  const [isEditingBaseline, setIsEditingBaseline] = useState<boolean>(false);
  const [baselineSavedAlert, setBaselineSavedAlert] = useState<boolean>(false);

  // Sync when active case changes (clean isolation between demo and client cases)
  useEffect(() => {
    if (caseRecord?.financials?.cashInBank != null) {
      setCash(caseRecord.financials.cashInBank);
      setOverdraftUsed(caseRecord.financials.creditFacilityUsed ?? 0);
      setOverdraftLimit(caseRecord.financials.creditFacilityLimit ?? 0);
      setPayables(caseRecord.financials.accountsPayable ?? 0);
      setTotalAR(caseRecord.financials.accountsReceivable ?? 0);
      setOverdue60(caseRecord.financials.overdueReceivables ?? 0);
    } else if (isDemo) {
      setCash(REPORTED_FINANCIALS.cashInBank);
      setOverdraftUsed(REPORTED_FINANCIALS.overdraftUsed);
      setOverdraftLimit(REPORTED_FINANCIALS.overdraftLimit);
      setPayables(REPORTED_FINANCIALS.supplierPayables);
      setTotalAR(REPORTED_FINANCIALS.accountsReceivable);
      setOverdue60(REPORTED_FINANCIALS.overdue60Days);
    } else {
      setCash(0);
      setOverdraftUsed(0);
      setOverdraftLimit(0);
      setPayables(0);
      setTotalAR(0);
      setOverdue60(0);
    }
  }, [caseRecord?.id, isDemo]);

  // Interactive recovery simulator states
  const [recoveredPercent, setRecoveredPercent] = useState<number>(65);
  const [hardwarePolicyEnforced, setHardwarePolicyEnforced] = useState<boolean>(true);
  const [monthlyHardwareVolume, setMonthlyHardwareVolume] = useState<number>(25000);
  const [overdraftRatePercent] = useState<number>(12.8); // Typical commercial overdraft rate

  // Calculations under recovery simulation
  const recoveredAmount = Math.round((overdue60 * recoveredPercent) / 100);
  
  // Simulated overdraft payoff
  const simulatedOverdraftUsed = Math.max(0, overdraftUsed - recoveredAmount);
  const excessCashFromRecovery = Math.max(0, recoveredAmount - overdraftUsed);
  const simulatedCash = cash + excessCashFromRecovery;
  const simulatedHeadroom = overdraftLimit - simulatedOverdraftUsed;

  // Annual overdraft interest savings
  const annualInterestCurrent = (overdraftUsed * (overdraftRatePercent / 100));
  const annualInterestSimulated = (simulatedOverdraftUsed * (overdraftRatePercent / 100));
  const annualInterestSaved = annualInterestCurrent - annualInterestSimulated;

  // Inventory / Hardware float unlocked
  const hardwareFloatUnlocked = hardwarePolicyEnforced ? monthlyHardwareVolume : 0;

  // Net immediate liquidity position
  const currentNetLiquidity = cash - payables;
  const simulatedNetLiquidity = simulatedCash - payables;

  const handleSaveCustomBaseline = () => {
    setIsEditingBaseline(false);
    setBaselineSavedAlert(true);
    setTimeout(() => setBaselineSavedAlert(false), 3000);

    if (onUpdateFinancials) {
      onUpdateFinancials({
        annualRevenue: caseRecord?.financials?.annualRevenue ?? 1000000,
        directCosts: caseRecord?.financials?.directCosts ?? 600000,
        operatingExpenses: caseRecord?.financials?.operatingExpenses ?? 300000,
        operatingProfit: caseRecord?.financials?.operatingProfit ?? 100000,
        cashInBank: cash,
        accountsReceivable: totalAR,
        overdueReceivables: overdue60,
        accountsPayable: payables,
        creditFacilityLimit: overdraftLimit,
        creditFacilityUsed: overdraftUsed,
        customerCount: caseRecord?.financials?.customerCount ?? 40,
        top5ConcentrationPercent: caseRecord?.financials?.top5ConcentrationPercent ?? 35,
        top12ConcentrationPercent: caseRecord?.financials?.top12ConcentrationPercent ?? 60,
        standardPaymentTermsDays: caseRecord?.financials?.standardPaymentTermsDays ?? 20,
        actualPaymentDelayDays: caseRecord?.financials?.actualPaymentDelayDays ?? 55,
        pricingReviewLastYears: caseRecord?.financials?.pricingReviewLastYears ?? 3,
      });
    }
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
    <div className="space-y-6">
      {/* Top Banner Alert */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                Pillar 1: Solvency Triage
              </span>
              <span className="text-[#64748B] text-xs font-medium">Direct Commercial Diagnosis</span>
              {isDemo ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EAF1FF] text-[#2563EB] border border-[#2563EB]/30">
                  Demo Case (NZ MSP)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {profile?.name}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-[#14283F] tracking-tight">
              Working Capital Deficit & Cash Conversion Engine
            </h2>
            <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
              Available cash: <span className="font-semibold text-[#14283F]">{currency} {cash.toLocaleString()}</span>, credit facility: <span className="font-semibold text-rose-700">{currency} {overdraftUsed.toLocaleString()} drawn</span>, payables owed: <span className="font-semibold text-rose-700">{currency} {payables.toLocaleString()}</span>. 
              Net immediate liquidity position: <span className={`font-bold ${currentNetLiquidity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {currentNetLiquidity < 0 ? '-' : '+'}{currency} {Math.abs(currentNetLiquidity).toLocaleString()}
              </span>.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="bg-[#F8FAFC] border border-[#E5EBEF] rounded-xl p-4 min-w-[240px] text-center shadow-sm">
              <span className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Remaining Facility Headroom</span>
              <div className="text-3xl font-extrabold text-[#E87518] mt-1 font-mono">
                {currency} {(overdraftLimit - overdraftUsed).toLocaleString()}
              </div>
              <div className="text-xs text-[#64748B] mt-1">
                of {currency} {overdraftLimit.toLocaleString()} total facility
              </div>
            </div>

            <button
              onClick={() => setIsEditingBaseline(!isEditingBaseline)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#14283F] text-xs font-semibold border border-[#CBD5E1] transition shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>{isEditingBaseline ? 'Hide Baseline Inputs' : 'Edit Working Capital Baseline'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editable Baseline Drawer */}
      {isEditingBaseline && (
        <div className="bg-white border border-[#E87518]/40 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EBEF]">
            <div>
              <h3 className="font-bold text-[#14283F] text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#E87518]" />
                Customize Working Capital Ledger Figures
              </h3>
              <p className="text-xs text-[#64748B]">
                Calibrate the workbench to your company&apos;s real bank account and creditor balances ({currency}).
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetToDemo}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#F8FAFC] text-xs font-medium text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1] hover:bg-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Demo Data</span>
              </button>
              <button
                onClick={handleSaveCustomBaseline}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#2563EB] text-white font-bold text-xs hover:bg-[#1D4ED8] shadow-sm transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Baseline</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[#64748B] font-semibold block mb-1">Available Cash in Bank ({currency})</label>
              <input
                type="number"
                value={cash}
                onChange={(e) => setCash(Number(e.target.value) || 0)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#14283F] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[#64748B] font-semibold block mb-1">Overdraft / Credit Facility Used ({currency})</label>
              <input
                type="number"
                value={overdraftUsed}
                onChange={(e) => setOverdraftUsed(Number(e.target.value) || 0)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#14283F] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[#64748B] font-semibold block mb-1">Total Credit Facility Limit ({currency})</label>
              <input
                type="number"
                value={overdraftLimit}
                onChange={(e) => setOverdraftLimit(Number(e.target.value) || 0)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#14283F] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[#64748B] font-semibold block mb-1">Outstanding Supplier Payables ({currency})</label>
              <input
                type="number"
                value={payables}
                onChange={(e) => setPayables(Number(e.target.value) || 0)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#14283F] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[#64748B] font-semibold block mb-1">Total Outstanding Customer Invoices ({currency})</label>
              <input
                type="number"
                value={totalAR}
                onChange={(e) => setTotalAR(Number(e.target.value) || 0)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#14283F] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[#64748B] font-semibold block mb-1">Invoices Delinquent &gt;60 Days ({currency})</label>
              <input
                type="number"
                value={overdue60}
                onChange={(e) => setOverdue60(Number(e.target.value) || 0)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2.5 text-[#14283F] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
          </div>
        </div>
      )}

      {baselineSavedAlert && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Working capital baseline saved successfully. All downstream models updated.</span>
        </div>
      )}

      {/* 4 Core Financial Vital Signs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Cash vs Payables */}
        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Available Cash</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#14283F] mt-2 font-mono">
            {currency} {cash.toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-rose-700 flex items-center gap-1 font-medium bg-rose-50 px-2 py-1 rounded">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{currency} {payables.toLocaleString()} payables waiting</span>
          </div>
          <div className="mt-2 text-xs text-[#64748B]">
            Net immediate cash: <span className={`font-semibold font-mono ${currentNetLiquidity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {currentNetLiquidity < 0 ? '-' : '+'}{currency} {Math.abs(currentNetLiquidity).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 2. Overdraft Exposure */}
        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Credit Facility Drawn</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-[#E87518]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#E87518] mt-2 font-mono">
            {currency} {overdraftUsed.toLocaleString()}
          </div>
          <div className="mt-3 w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[#E87518] h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (overdraftUsed / (overdraftLimit || 1)) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#64748B]">
            <span>Limit: {currency} {overdraftLimit.toLocaleString()}</span>
            <span className="text-[#E87518] font-bold">{Math.round((overdraftUsed / (overdraftLimit || 1)) * 100)}% used</span>
          </div>
        </div>

        {/* 3. Receivables & Delinquency */}
        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Total Unpaid Invoices</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#14283F] mt-2 font-mono">
            {currency} {totalAR.toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-rose-700 flex items-center gap-1 font-semibold bg-rose-50 px-2 py-1 rounded">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{currency} {overdue60.toLocaleString()} &gt;60 days overdue</span>
          </div>
          <div className="mt-2 text-xs text-[#64748B]">
            <span className="font-semibold text-rose-700 font-mono">{totalAR > 0 ? Math.round((overdue60 / totalAR) * 100) : 0}%</span> of receivables delinquent
          </div>
        </div>

        {/* 4. Trapped Overdraft Interest */}
        <div className="bg-white border border-[#E5EBEF] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Est. Annual Interest Burn</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {currency} {Math.round(annualInterestCurrent).toLocaleString()}<span className="text-xs font-normal text-[#64748B]">/yr</span>
          </div>
          <div className="mt-3 text-xs text-[#64748B]">
            Based on ~{overdraftRatePercent}% commercial rate on {currency} {overdraftUsed.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-amber-800 font-medium">
            Paying bank fees to fund client delays
          </div>
        </div>
      </div>

      {/* Interactive Working Capital & Debt Recovery Simulator */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#E5EBEF]">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-lg font-bold text-[#14283F]">
                Interactive Debt Recovery & Cash Infusion Simulator
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Simulate the mathematical impact of recovering the {currency} {overdue60.toLocaleString()} in overdue invoices (&gt;60 days) and shifting to 100% upfront supplies billing.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-[#F8FAFC] px-4 py-2 rounded-xl border border-[#CBD5E1]">
            <span className="text-xs font-semibold text-[#14283F]">100% Upfront Supplies/Hardware Policy:</span>
            <button
              onClick={() => setHardwarePolicyEnforced(!hardwarePolicyEnforced)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition shadow-sm ${
                hardwarePolicyEnforced
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#E2E8F0] text-[#64748B] hover:bg-[#CBD5E1]'
              }`}
            >
              {hardwarePolicyEnforced ? 'ENFORCED' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
          {/* Recovery Slider Controls */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#14283F]">
                  Target Recovery Rate for &gt;60-Day Debt
                </label>
                <span className="text-base font-bold text-[#2563EB] font-mono bg-[#EAF1FF] px-2.5 py-0.5 rounded-full border border-[#2563EB]/30">
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
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
              <div className="flex justify-between text-xs text-[#64748B] mt-1 font-mono">
                <span>0% ({currency}0)</span>
                <span>50%</span>
                <span className="text-[#2563EB] font-semibold">65% (Recommended)</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#14283F]">
                  Monthly Supplies / Hardware Procurement Volume
                </label>
                <span className="text-sm font-bold text-[#14283F] font-mono bg-[#F1F5F9] px-2.5 py-0.5 rounded border border-[#CBD5E1]">
                  {currency} {monthlyHardwareVolume.toLocaleString()} / mo
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="60000"
                step="2500"
                value={monthlyHardwareVolume}
                onChange={(e) => setMonthlyHardwareVolume(Number(e.target.value))}
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Requiring 100% upfront payment stops your company from acting as an interest-free bank for client hardware.
              </p>
            </div>
          </div>

          {/* Simulated Financial Outcome Matrix */}
          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#E5EBEF] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#14283F] flex items-center justify-between border-b border-[#E5EBEF] pb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                Simulated Solvency Outcome
              </span>
              <span className="font-mono text-emerald-700 text-sm font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">+{currency} {recoveredAmount.toLocaleString()} Inflow</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white border border-[#E5EBEF] shadow-sm">
                <span className="text-[#64748B] block text-[11px] font-semibold">Simulated Overdraft Balance</span>
                <span className={`text-lg font-bold font-mono mt-0.5 block ${
                  simulatedOverdraftUsed === 0 ? 'text-emerald-700' : 'text-[#E87518]'
                }`}>
                  {currency} {simulatedOverdraftUsed.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#64748B]">
                  down from {currency} {overdraftUsed.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#E5EBEF] shadow-sm">
                <span className="text-[#64748B] block text-[11px] font-semibold">Uncapped Bank Headroom</span>
                <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
                  {currency} {simulatedHeadroom.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#64748B]">
                  total emergency buffer
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#E5EBEF] shadow-sm">
                <span className="text-[#64748B] block text-[11px] font-semibold">Annual Interest Eliminated</span>
                <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
                  +{currency} {Math.round(annualInterestSaved).toLocaleString()} / yr
                </span>
                <span className="text-[10px] text-[#64748B]">
                  saved from bank financing fees
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#E5EBEF] shadow-sm">
                <span className="text-[#64748B] block text-[11px] font-semibold">Supplies Float Protected</span>
                <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
                  +{currency} {hardwareFloatUnlocked.toLocaleString()} / mo
                </span>
                <span className="text-[10px] text-[#64748B]">
                  float preserved upfront
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-[#E5EBEF] text-xs flex items-center justify-between shadow-sm">
              <span className="text-[#64748B] font-medium">Simulated Net Immediate Cash Position:</span>
              <span className={`font-mono font-bold text-sm ${simulatedNetLiquidity >= 0 ? 'text-emerald-700' : 'text-[#E87518]'}`}>
                {simulatedNetLiquidity < 0 ? '-' : '+'}{currency} {Math.abs(simulatedNetLiquidity).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
