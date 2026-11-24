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

const optNum = (v: number | null | undefined, fallback: number | null = null): number | null =>
  v === undefined ? fallback : v;

export const CashFlowWorkbench: React.FC<CashFlowWorkbenchProps> = ({
  caseRecord,
  onUpdateFinancials,
}) => {
  const profile = caseRecord?.profile;
  const isDemo = profile?.isDemonstrationCase ?? false;
  const currency = profile?.currency || 'NZD';

  // Working capital 6 fields
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

  // P&L 4 fields
  const [annualRevenue, setAnnualRevenue] = useState<string>(() =>
    caseRecord?.financials?.annualRevenue != null
      ? String(caseRecord.financials.annualRevenue)
      : isDemo
      ? String(REPORTED_FINANCIALS.revenue)
      : ''
  );
  const [directCosts, setDirectCosts] = useState<string>(() =>
    caseRecord?.financials?.directCosts != null
      ? String(caseRecord.financials.directCosts)
      : isDemo
      ? String(REPORTED_FINANCIALS.directCosts)
      : ''
  );
  const [operatingExpenses, setOperatingExpenses] = useState<string>(() =>
    caseRecord?.financials?.operatingExpenses != null
      ? String(caseRecord.financials.operatingExpenses)
      : isDemo
      ? String(REPORTED_FINANCIALS.operatingExpenses)
      : ''
  );
  const [operatingProfit, setOperatingProfit] = useState<string>(() =>
    caseRecord?.financials?.operatingProfit != null
      ? String(caseRecord.financials.operatingProfit)
      : isDemo
      ? String(REPORTED_FINANCIALS.reportedOperatingProfit)
      : ''
  );

  // Customer concentration & payment/pricing 6 fields
  const [customerCount, setCustomerCount] = useState<string>(() =>
    caseRecord?.financials?.customerCount != null
      ? String(caseRecord.financials.customerCount)
      : isDemo
      ? String(REPORTED_FINANCIALS.activeCustomers)
      : ''
  );
  const [top5Conc, setTop5Conc] = useState<string>(() =>
    caseRecord?.financials?.top5ConcentrationPercent != null
      ? String(caseRecord.financials.top5ConcentrationPercent)
      : isDemo
      ? String(REPORTED_FINANCIALS.top5RevenueConcentration)
      : ''
  );
  const [top12Conc, setTop12Conc] = useState<string>(() =>
    caseRecord?.financials?.top12ConcentrationPercent != null
      ? String(caseRecord.financials.top12ConcentrationPercent)
      : isDemo
      ? String(REPORTED_FINANCIALS.top12RecurringConcentration)
      : ''
  );
  const [standardTermsDays, setStandardTermsDays] = useState<string>(() =>
    caseRecord?.financials?.standardPaymentTermsDays != null
      ? String(caseRecord.financials.standardPaymentTermsDays)
      : isDemo
      ? '20'
      : ''
  );
  const [actualDelayDays, setActualDelayDays] = useState<string>(() =>
    caseRecord?.financials?.actualPaymentDelayDays != null
      ? String(caseRecord.financials.actualPaymentDelayDays)
      : isDemo
      ? '60'
      : ''
  );
  const [pricingReviewYears, setPricingReviewYears] = useState<string>(() =>
    caseRecord?.financials?.pricingReviewLastYears != null
      ? String(caseRecord.financials.pricingReviewLastYears)
      : isDemo
      ? '3'
      : ''
  );

  const [isEditingBaseline, setIsEditingBaseline] = useState<boolean>(
    !isDemo && !caseRecord?.financials
  );
  const [baselineSavedAlert, setBaselineSavedAlert] = useState<boolean>(false);

  // Sync cleanly whenever active case changes (strict case isolation)
  useEffect(() => {
    const f = caseRecord?.financials;
    if (f) {
      setCash(f.cashInBank ?? 0);
      setOverdraftUsed(f.creditFacilityUsed ?? 0);
      setOverdraftLimit(f.creditFacilityLimit ?? 0);
      setPayables(f.accountsPayable ?? 0);
      setTotalAR(f.accountsReceivable ?? 0);
      setOverdue60(f.overdueReceivables ?? 0);
      setAnnualRevenue(f.annualRevenue != null ? String(f.annualRevenue) : '');
      setDirectCosts(f.directCosts != null ? String(f.directCosts) : '');
      setOperatingExpenses(f.operatingExpenses != null ? String(f.operatingExpenses) : '');
      setOperatingProfit(f.operatingProfit != null ? String(f.operatingProfit) : '');
      setCustomerCount(f.customerCount != null ? String(f.customerCount) : '');
      setTop5Conc(f.top5ConcentrationPercent != null ? String(f.top5ConcentrationPercent) : '');
      setTop12Conc(f.top12ConcentrationPercent != null ? String(f.top12ConcentrationPercent) : '');
      setStandardTermsDays(f.standardPaymentTermsDays != null ? String(f.standardPaymentTermsDays) : '');
      setActualDelayDays(f.actualPaymentDelayDays != null ? String(f.actualPaymentDelayDays) : '');
      setPricingReviewYears(f.pricingReviewLastYears != null ? String(f.pricingReviewLastYears) : '');
      setIsEditingBaseline(false);
    } else if (isDemo) {
      setCash(REPORTED_FINANCIALS.cashInBank);
      setOverdraftUsed(REPORTED_FINANCIALS.overdraftUsed);
      setOverdraftLimit(REPORTED_FINANCIALS.overdraftLimit);
      setPayables(REPORTED_FINANCIALS.supplierPayables);
      setTotalAR(REPORTED_FINANCIALS.accountsReceivable);
      setOverdue60(REPORTED_FINANCIALS.overdue60Days);
      setAnnualRevenue(String(REPORTED_FINANCIALS.revenue));
      setDirectCosts(String(REPORTED_FINANCIALS.directCosts));
      setOperatingExpenses(String(REPORTED_FINANCIALS.operatingExpenses));
      setOperatingProfit(String(REPORTED_FINANCIALS.reportedOperatingProfit));
      setCustomerCount(String(REPORTED_FINANCIALS.activeCustomers));
      setTop5Conc(String(REPORTED_FINANCIALS.top5RevenueConcentration));
      setTop12Conc(String(REPORTED_FINANCIALS.top12RecurringConcentration));
      setStandardTermsDays('20');
      setActualDelayDays('60');
      setPricingReviewYears('3');
      setIsEditingBaseline(false);
    } else {
      setCash(0);
      setOverdraftUsed(0);
      setOverdraftLimit(0);
      setPayables(0);
      setTotalAR(0);
      setOverdue60(0);
      setAnnualRevenue('');
      setDirectCosts('');
      setOperatingExpenses('');
      setOperatingProfit('');
      setCustomerCount('');
      setTop5Conc('');
      setTop12Conc('');
      setStandardTermsDays('');
      setActualDelayDays('');
      setPricingReviewYears('');
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

  const parseNullable = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const handleSaveCustomBaseline = () => {
    setIsEditingBaseline(false);
    setBaselineSavedAlert(true);
    setTimeout(() => setBaselineSavedAlert(false), 3500);

    if (onUpdateFinancials) {
      onUpdateFinancials({
        annualRevenue: optNum(parseNullable(annualRevenue)),
        directCosts: optNum(parseNullable(directCosts)),
        operatingExpenses: optNum(parseNullable(operatingExpenses)),
        operatingProfit: optNum(parseNullable(operatingProfit)),
        cashInBank: cash,
        accountsReceivable: totalAR,
        overdueReceivables: overdue60,
        accountsPayable: payables,
        creditFacilityLimit: overdraftLimit,
        creditFacilityUsed: overdraftUsed,
        customerCount: optNum(parseNullable(customerCount)),
        top5ConcentrationPercent: optNum(parseNullable(top5Conc)),
        top12ConcentrationPercent: optNum(parseNullable(top12Conc)),
        standardPaymentTermsDays: optNum(parseNullable(standardTermsDays)),
        actualPaymentDelayDays: optNum(parseNullable(actualDelayDays)),
        pricingReviewLastYears: optNum(parseNullable(pricingReviewYears)),
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
    setAnnualRevenue('');
    setDirectCosts('');
    setOperatingExpenses('');
    setOperatingProfit('');
    setCustomerCount('');
    setTop5Conc('');
    setTop12Conc('');
    setStandardTermsDays('');
    setActualDelayDays('');
    setPricingReviewYears('');
  };

  const handleResetToDemo = () => {
    setCash(REPORTED_FINANCIALS.cashInBank);
    setOverdraftUsed(REPORTED_FINANCIALS.overdraftUsed);
    setOverdraftLimit(REPORTED_FINANCIALS.overdraftLimit);
    setPayables(REPORTED_FINANCIALS.supplierPayables);
    setTotalAR(REPORTED_FINANCIALS.accountsReceivable);
    setOverdue60(REPORTED_FINANCIALS.overdue60Days);
    setAnnualRevenue(String(REPORTED_FINANCIALS.revenue));
    setDirectCosts(String(REPORTED_FINANCIALS.directCosts));
    setOperatingExpenses(String(REPORTED_FINANCIALS.operatingExpenses));
    setOperatingProfit(String(REPORTED_FINANCIALS.reportedOperatingProfit));
    setCustomerCount(String(REPORTED_FINANCIALS.activeCustomers));
    setTop5Conc(String(REPORTED_FINANCIALS.top5RevenueConcentration));
    setTop12Conc(String(REPORTED_FINANCIALS.top12RecurringConcentration));
    setStandardTermsDays('20');
    setActualDelayDays('60');
    setPricingReviewYears('3');
    setIsEditingBaseline(false);
  };

  const numRev = parseNullable(annualRevenue);
  const numDirect = parseNullable(directCosts);
  const numProfit = parseNullable(operatingProfit);
  const grossMarginPct =
    numRev && numRev > 0 && numDirect != null
      ? Math.round(((numRev - numDirect) / numRev) * 100)
      : null;
  const opMarginPct =
    numRev && numRev > 0 && numProfit != null ? Math.round((numProfit / numRev) * 100) : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Executive Navy Hero Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#60A5FA]">
                Cash Flow &amp; Financial Ledger Workbench
              </span>
              <span className="text-xs font-medium text-[#94A3B8]">
                {isDemo ? 'Benchmark Demo Case' : profile?.name || 'Custom Business'} · {currency}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Cash Position, P&amp;L Margins &amp; Facility Headroom
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed tabular-nums">
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
              <span className="text-[11px] font-mono text-[#60A5FA] uppercase tracking-wider font-bold block">
                Remaining Facility Headroom
              </span>
              <div className="text-3xl font-bold text-white mt-1 font-mono tabular-nums">
                {currency} {(overdraftLimit - overdraftUsed).toLocaleString()}
              </div>
              <div className="text-xs text-[#CBD5E1] mt-1 tabular-nums">
                of {currency} {overdraftLimit.toLocaleString()} limit
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingBaseline(!isEditingBaseline)}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>{isEditingBaseline ? 'Hide Financial Inputs' : 'Enter / Edit 16 Ledger Fields'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full 16-Field Editable Ledger Drawer */}
      {isEditingBaseline && (
        <div className="bg-white border border-[#2563EB] rounded p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#0F172A]/10">
            <div>
              <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#2563EB]" />
                <span>
                  {profile?.name || 'Active Business'} — Complete 16-Field Financial Ledger ({currency})
                </span>
              </h3>
              <p className="text-xs text-[#475569]">
                Enter verified figures from your accounting system or bank balance. Leave P&amp;L/terms fields blank if unknown — BizPulse never invents missing numbers.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isDemo ? (
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded bg-[#F8FAFC] text-xs font-semibold text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/15 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo Figures</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClearCustomBaseline}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded bg-[#F8FAFC] text-xs font-semibold text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/15 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Inputs</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveCustomBaseline}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold uppercase tracking-wider text-xs shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Save Financial Ledger</span>
              </button>
            </div>
          </div>

          {/* Group 1: Working Capital & Bank Liquidity */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
              1. Working Capital &amp; Bank Liquidity (6 Fields)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Available Cash in Bank ({currency})
                </label>
                <input
                  type="number"
                  value={cash}
                  onChange={(e) => setCash(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Overdraft / Credit Drawn ({currency})
                </label>
                <input
                  type="number"
                  value={overdraftUsed}
                  onChange={(e) => setOverdraftUsed(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Total Credit Facility Limit ({currency})
                </label>
                <input
                  type="number"
                  value={overdraftLimit}
                  onChange={(e) => setOverdraftLimit(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Outstanding Payables ({currency})
                </label>
                <input
                  type="number"
                  value={payables}
                  onChange={(e) => setPayables(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Total Unpaid Customer Invoices ({currency})
                </label>
                <input
                  type="number"
                  value={totalAR}
                  onChange={(e) => setTotalAR(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Invoices Overdue &gt;60 Days ({currency})
                </label>
                <input
                  type="number"
                  value={overdue60}
                  onChange={(e) => setOverdue60(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>

          {/* Group 2: P&L Revenue & Margin */}
          <div className="space-y-2.5 pt-3 border-t border-[#0F172A]/10">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
              2. Annual P&amp;L Revenue &amp; Profitability (4 Fields)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Annual Revenue ({currency})
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={annualRevenue}
                  onChange={(e) => setAnnualRevenue(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Direct Costs / COGS ({currency})
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={directCosts}
                  onChange={(e) => setDirectCosts(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Operating Expenses ({currency})
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={operatingExpenses}
                  onChange={(e) => setOperatingExpenses(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">
                  Operating Profit / EBITDA ({currency})
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={operatingProfit}
                  onChange={(e) => setOperatingProfit(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Customer Portfolio, Terms & Pricing */}
          <div className="space-y-2.5 pt-3 border-t border-[#0F172A]/10">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
              3. Customer Concentration, Debtor Terms &amp; Pricing Cadence (6 Fields)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[#475569] font-semibold block mb-1">Active Customers (#)</label>
                <input
                  type="number"
                  placeholder="e.g. 48"
                  value={customerCount}
                  onChange={(e) => setCustomerCount(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">Top 5 Revenue Share (%)</label>
                <input
                  type="number"
                  placeholder="0–100%"
                  value={top5Conc}
                  onChange={(e) => setTop5Conc(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">Top 12 Revenue Share (%)</label>
                <input
                  type="number"
                  placeholder="0–100%"
                  value={top12Conc}
                  onChange={(e) => setTop12Conc(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">Standard Payment Terms (Days)</label>
                <input
                  type="number"
                  placeholder="e.g. 20"
                  value={standardTermsDays}
                  onChange={(e) => setStandardTermsDays(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">Actual Payment Delay (Days)</label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={actualDelayDays}
                  onChange={(e) => setActualDelayDays(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold block mb-1">Years Since Last Price Review</label>
                <input
                  type="number"
                  placeholder="e.g. 2"
                  value={pricingReviewYears}
                  onChange={(e) => setPricingReviewYears(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {baselineSavedAlert && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] p-3.5 rounded text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>All financial ledger inputs saved to this isolated business session.</span>
        </div>
      )}

      {/* 4 Core Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white border border-[#0F172A]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569]">
              Available Cash
            </span>
            <div className="p-1.5 rounded bg-[#ECFDF5] text-[#15803D]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] mt-2 font-mono">
            {currency} {cash.toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-[#B91C1C] flex items-center gap-1 font-medium bg-[#FEF2F2] px-2.5 py-1 rounded border border-[#FECACA]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{currency} {payables.toLocaleString()} payables due</span>
          </div>
          <div className="mt-2 text-xs text-[#475569]">
            Net liquidity:{' '}
            <span className={`font-bold font-mono ${currentNetLiquidity < 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>
              {currentNetLiquidity < 0 ? '-' : '+'}
              {currency} {Math.abs(currentNetLiquidity).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#0F172A]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569]">
              Credit Facility Drawn
            </span>
            <div className="p-1.5 rounded bg-[#FFFBEB] text-[#B45309]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#B45309] mt-2 font-mono">
            {currency} {overdraftUsed.toLocaleString()}
          </div>
          <div className="mt-3 w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#D97706] h-full rounded-full transition-all"
              style={{
                width: `${overdraftLimit > 0 ? Math.min(100, (overdraftUsed / overdraftLimit) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#475569]">
            <span>Limit: {currency} {overdraftLimit.toLocaleString()}</span>
            <span className="text-[#B45309] font-bold">
              {overdraftLimit > 0 ? Math.round((overdraftUsed / overdraftLimit) * 100) : 0}% used
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#0F172A]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569]">
              Unpaid Invoices
            </span>
            <div className="p-1.5 rounded bg-[#EFF6FF] text-[#2563EB]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] mt-2 font-mono">
            {currency} {totalAR.toLocaleString()}
          </div>
          <div className="mt-3 text-xs text-[#B91C1C] flex items-center gap-1 font-semibold bg-[#FEF2F2] px-2.5 py-1 rounded border border-[#FECACA]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{currency} {overdue60.toLocaleString()} &gt;60d overdue</span>
          </div>
          <div className="mt-2 text-xs text-[#475569]">
            <span className="font-bold text-[#B91C1C] font-mono">
              {totalAR > 0 ? Math.round((overdue60 / totalAR) * 100) : 0}%
            </span>{' '}
            delinquent &gt;60 days
          </div>
        </div>

        <div className="bg-white border border-[#0F172A]/12 rounded p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569]">
              Est. Interest Cost
            </span>
            <div className="p-1.5 rounded bg-[#FFFBEB] text-[#B45309]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#B45309] mt-2 font-mono">
            {currency} {Math.round(annualInterestCurrent).toLocaleString()}
            <span className="text-xs font-normal text-[#475569]">/yr</span>
          </div>
          <div className="mt-3 text-xs text-[#475569]">
            At ~{overdraftRatePercent}% rate on drawn balance
          </div>
          <div className="mt-2 text-xs text-[#B45309] font-medium">
            Interest cost on late client payments
          </div>
        </div>
      </div>

      {/* P&L Margins, Concentration & Payment Delay Strip (only displays verified values) */}
      {(numRev != null || customerCount !== '' || standardTermsDays !== '' || pricingReviewYears !== '') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
              Revenue &amp; Gross Margin
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {numRev != null ? `${currency} ${numRev.toLocaleString()}` : 'Not supplied'}
            </div>
            <span className="text-[11px] text-[#475569]">
              {grossMarginPct != null ? `Gross Margin: ${grossMarginPct}%` : 'Supply direct costs for GM%'}
            </span>
          </div>

          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
              Operating Margin
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {numProfit != null ? `${currency} ${numProfit.toLocaleString()}` : 'Not supplied'}
            </div>
            <span className="text-[11px] text-[#475569]">
              {opMarginPct != null ? `${opMarginPct}% of annual revenue` : 'Supply profit & revenue for %'}
            </span>
          </div>

          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
              Debtor Terms vs Actual
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {actualDelayDays || '—'}d vs {standardTermsDays || '—'}d
            </div>
            <span className="text-[11px] text-[#475569]">
              {pricingReviewYears ? `Pricing last reviewed ${pricingReviewYears} yr(s) ago` : 'Pricing cadence unrecorded'}
            </span>
          </div>

          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
              Customer Concentration
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {top5Conc ? `Top 5: ${top5Conc}%` : customerCount ? `${customerCount} Clients` : 'Not supplied'}
            </div>
            <span className="text-[11px] text-[#475569]">
              {top12Conc ? `Top 12: ${top12Conc}% of revenue` : `${customerCount || '—'} active accounts`}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Recovery Simulator */}
      <div className="bg-white border border-[#0F172A]/12 rounded p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#0F172A]/10">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-lg font-bold text-[#0F172A]">
                Debt Collection &amp; Upfront Billing Simulator
              </h3>
            </div>
            <p className="text-xs text-[#475569] mt-1">
              Test the cash release from collecting {currency} {overdue60.toLocaleString()} in overdue debt and requiring upfront deposits on hardware or materials.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-[#F8FAFC] px-4 py-2 rounded border border-[#0F172A]/15">
            <span className="text-xs font-semibold text-[#0F172A]">
              Upfront Materials/Hardware Policy:
            </span>
            <button
              type="button"
              onClick={() => setHardwarePolicyEnforced(!hardwarePolicyEnforced)}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                hardwarePolicyEnforced
                  ? 'bg-[#0F172A] text-[#60A5FA]'
                  : 'bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]'
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
                <label className="text-sm font-semibold text-[#0F172A]">
                  Overdue Receivables Collection Rate
                </label>
                <span className="text-sm font-bold text-[#1D4ED8] font-mono tabular-nums bg-[#EFF6FF] px-2.5 py-0.5 rounded border border-[#BFDBFE]">
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
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#0F172A]">
                  Monthly Supplies / Materials Outlay Protected
                </label>
                <span className="text-sm font-bold text-[#0F172A] font-mono tabular-nums bg-[#F8FAFC] px-2.5 py-0.5 rounded border border-[#0F172A]/15">
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
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded p-5 border border-[#0F172A]/12 space-y-4 tabular-nums">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center justify-between border-b border-[#0F172A]/10 pb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                Projected Liquidity Impact
              </span>
              <span className="font-mono text-[#15803D] text-xs font-bold bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                +{currency} {recoveredAmount.toLocaleString()} Collected
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] block text-[11px] font-semibold">
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

              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] block text-[11px] font-semibold">
                  Facility Headroom
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  {currency} {simulatedHeadroom.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] block text-[11px] font-semibold">
                  Annual Interest Saved
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  +{currency} {Math.round(annualInterestSaved).toLocaleString()}/yr
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] block text-[11px] font-semibold">
                  Monthly Float Retained
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  +{currency} {hardwareFloatUnlocked.toLocaleString()}/mo
                </span>
              </div>
            </div>

            <div className="p-3 rounded bg-white border border-[#0F172A]/10 text-xs flex items-center justify-between">
              <span className="text-[#475569] font-medium">Simulated Net Immediate Liquidity:</span>
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
