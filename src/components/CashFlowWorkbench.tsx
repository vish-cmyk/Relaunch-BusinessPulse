import React, { useState, useEffect, useRef } from 'react';
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
import { InfoTooltip } from './InfoTooltip';

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

  const parseNullable = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // Working capital 6 fields (string drafts prevent forced zero-snapping mid-keystroke)
  const [cashInput, setCashInput] = useState<string>(() =>
    caseRecord?.financials?.cashInBank != null
      ? String(caseRecord.financials.cashInBank)
      : isDemo
      ? String(REPORTED_FINANCIALS.cashInBank)
      : ''
  );
  const [overdraftUsedInput, setOverdraftUsedInput] = useState<string>(() =>
    caseRecord?.financials?.creditFacilityUsed != null
      ? String(caseRecord.financials.creditFacilityUsed)
      : isDemo
      ? String(REPORTED_FINANCIALS.overdraftUsed)
      : ''
  );
  const [overdraftLimitInput, setOverdraftLimitInput] = useState<string>(() =>
    caseRecord?.financials?.creditFacilityLimit != null
      ? String(caseRecord.financials.creditFacilityLimit)
      : isDemo
      ? String(REPORTED_FINANCIALS.overdraftLimit)
      : ''
  );
  const [payablesInput, setPayablesInput] = useState<string>(() =>
    caseRecord?.financials?.accountsPayable != null
      ? String(caseRecord.financials.accountsPayable)
      : isDemo
      ? String(REPORTED_FINANCIALS.supplierPayables)
      : ''
  );
  const [totalARInput, setTotalARInput] = useState<string>(() =>
    caseRecord?.financials?.accountsReceivable != null
      ? String(caseRecord.financials.accountsReceivable)
      : isDemo
      ? String(REPORTED_FINANCIALS.accountsReceivable)
      : ''
  );
  const [overdue60Input, setOverdue60Input] = useState<string>(() =>
    caseRecord?.financials?.overdueReceivables != null
      ? String(caseRecord.financials.overdueReceivables)
      : isDemo
      ? String(REPORTED_FINANCIALS.overdue60Days)
      : ''
  );

  const cash = Math.max(0, parseNullable(cashInput) ?? 0);
  const overdraftUsed = Math.max(0, parseNullable(overdraftUsedInput) ?? 0);
  const overdraftLimit = Math.max(0, parseNullable(overdraftLimitInput) ?? 0);
  const payables = Math.max(0, parseNullable(payablesInput) ?? 0);
  const totalAR = Math.max(0, parseNullable(totalARInput) ?? 0);
  const overdue60 = Math.max(0, parseNullable(overdue60Input) ?? 0);

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
      setCashInput(f.cashInBank != null ? String(f.cashInBank) : '');
      setOverdraftUsedInput(f.creditFacilityUsed != null ? String(f.creditFacilityUsed) : '');
      setOverdraftLimitInput(f.creditFacilityLimit != null ? String(f.creditFacilityLimit) : '');
      setPayablesInput(f.accountsPayable != null ? String(f.accountsPayable) : '');
      setTotalARInput(f.accountsReceivable != null ? String(f.accountsReceivable) : '');
      setOverdue60Input(f.overdueReceivables != null ? String(f.overdueReceivables) : '');
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
      setCashInput(String(REPORTED_FINANCIALS.cashInBank));
      setOverdraftUsedInput(String(REPORTED_FINANCIALS.overdraftUsed));
      setOverdraftLimitInput(String(REPORTED_FINANCIALS.overdraftLimit));
      setPayablesInput(String(REPORTED_FINANCIALS.supplierPayables));
      setTotalARInput(String(REPORTED_FINANCIALS.accountsReceivable));
      setOverdue60Input(String(REPORTED_FINANCIALS.overdue60Days));
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
      setCashInput('');
      setOverdraftUsedInput('');
      setOverdraftLimitInput('');
      setPayablesInput('');
      setTotalARInput('');
      setOverdue60Input('');
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

  const liveResultsRef = useRef<HTMLDivElement | null>(null);

  const handleSaveCustomBaseline = () => {
    setIsEditingBaseline(false);
    setBaselineSavedAlert(true);
    setTimeout(() => setBaselineSavedAlert(false), 4500);
    requestAnimationFrame(() => {
      liveResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

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
    setCashInput('');
    setOverdraftUsedInput('');
    setOverdraftLimitInput('');
    setPayablesInput('');
    setTotalARInput('');
    setOverdue60Input('');
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
    setCashInput(String(REPORTED_FINANCIALS.cashInBank));
    setOverdraftUsedInput(String(REPORTED_FINANCIALS.overdraftUsed));
    setOverdraftLimitInput(String(REPORTED_FINANCIALS.overdraftLimit));
    setPayablesInput(String(REPORTED_FINANCIALS.supplierPayables));
    setTotalARInput(String(REPORTED_FINANCIALS.accountsReceivable));
    setOverdue60Input(String(REPORTED_FINANCIALS.overdue60Days));
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
              <span className="bizpulse-label text-[#6495ED]">
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
              <span className="text-[11px] font-mono text-[#6495ED] uppercase tracking-wider font-bold inline-flex items-center justify-center gap-1.5">
                <span>Remaining Facility Headroom</span>
                <InfoTooltip
                  title="Remaining Facility Headroom"
                  whatItMeans="Total bank overdraft or credit limit minus the amount currently drawn."
                  whyItMatters="Shows your remaining emergency cash buffer before bank facilities max out and supplier/payroll payments bounce."
                  actionOrCalculation="Calculated as Credit Facility Limit − Credit Drawn. Keep at least 1 month of fixed overheads in combined cash + headroom."
                  align="right"
                />
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
              <Edit3 className="w-3.5 h-3.5 text-[#6495ED]" />
              <span>{isEditingBaseline ? 'Hide Financial Inputs' : 'Enter / Edit 16 Ledger Fields'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full 16-Field Editable Ledger Drawer */}
      {isEditingBaseline && (
        <div className="bg-white border border-[#0F52BA] rounded p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#0F172A]/10">
            <div>
              <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0F52BA]" />
                <span>
                  {profile?.name || 'Active Business'} — Complete 16-Field Financial Ledger ({currency})
                </span>
              </h3>
              <p className="text-xs text-[#475569]">
                Enter verified figures from your accounting system or bank balance. Tap or hover any <span className="font-semibold text-[#0F52BA]">?</span> icon for plain-English explanations.
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
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] text-white font-semibold uppercase tracking-wider text-xs shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5 text-white" />
                <span>Save Financial Ledger</span>
              </button>
            </div>
          </div>

          {/* Group 1: Working Capital & Bank Liquidity */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
              1. Working Capital &amp; Bank Liquidity (6 Fields)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Available Cash in Bank ({currency})</span>
                  <InfoTooltip
                    title="Available Cash in Bank"
                    whatItMeans="Cleared funds currently sitting in your everyday business operating accounts (excluding overdraft)."
                    whyItMatters="Cash pays wages, GST/tax, and suppliers this week—paper profit cannot."
                    actionOrCalculation="Check your live online banking balance today and enter the cleared total."
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Overdraft / Credit Drawn ({currency})</span>
                  <InfoTooltip
                    title="Overdraft / Credit Drawn"
                    whatItMeans="The amount currently borrowed on your business overdraft or short-term working capital facility."
                    whyItMatters="Persistent overdraft borrowing usually signals unpaid invoices or unbilled work consuming working capital."
                    actionOrCalculation="Enter the current negative/drawn balance on your overdraft or revolving credit account."
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={overdraftUsedInput}
                  onChange={(e) => setOverdraftUsedInput(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Total Credit Facility Limit ({currency})</span>
                  <InfoTooltip
                    title="Total Credit Facility Limit"
                    whatItMeans="The maximum borrowing limit approved by your bank on your overdraft or line of credit."
                    whyItMatters="Remaining headroom (Limit minus Drawn) defines how much sudden cash shock your business can absorb."
                    actionOrCalculation="Enter the total approved facility cap (not just what is drawn)."
                    align="right"
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={overdraftLimitInput}
                  onChange={(e) => setOverdraftLimitInput(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Outstanding Payables ({currency})</span>
                  <InfoTooltip
                    title="Outstanding Payables"
                    whatItMeans="Total unpaid bills you owe to suppliers, subcontractors, GST/PAYE, and short-term creditors."
                    whyItMatters="Comparing Cash minus Payables reveals immediate net liquidity pressure."
                    actionOrCalculation="Pull your Aged Payables summary from Xero, MYOB, or QuickBooks."
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={payablesInput}
                  onChange={(e) => setPayablesInput(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Total Unpaid Customer Invoices ({currency})</span>
                  <InfoTooltip
                    title="Total Unpaid Customer Invoices (Accounts Receivable)"
                    whatItMeans="Total dollar value of invoices already issued to customers that have not yet been paid."
                    whyItMatters="Every dollar sitting in receivables is cash funding your customers instead of your own bank account."
                    actionOrCalculation="Check your Aged Receivables total in your accounting software."
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={totalARInput}
                  onChange={(e) => setTotalARInput(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>

              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Invoices Overdue &gt;60 Days ({currency})</span>
                  <InfoTooltip
                    title="Invoices Overdue >60 Days"
                    whatItMeans="Subset of unpaid customer invoices that are more than 60 days past their invoice or due date."
                    whyItMatters="Debt older than 60 days carries escalating write-off risk and triggers an At Risk cash flow alert when >=30% of receivables."
                    actionOrCalculation="Filter your Aged Receivables report to 60+ and 90+ days columns and enter the combined total."
                    align="right"
                  />
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={overdue60Input}
                  onChange={(e) => setOverdue60Input(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
            </div>
          </div>

          {/* Group 2: P&L Revenue & Margin */}
          <div className="space-y-2.5 pt-3 border-t border-[#0F172A]/10">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
              2. Annual P&amp;L Revenue &amp; Profitability (4 Fields)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Annual Revenue ({currency})</span>
                  <InfoTooltip
                    title="Annual Revenue (Sales)"
                    whatItMeans="Total sales invoiced over the last 12 months (excluding GST/VAT)."
                    whyItMatters="Establishes business scale and serves as the denominator for Gross Margin %, Opex %, and Debtor Days."
                    actionOrCalculation="Use your trailing 12-month Profit & Loss total income figure."
                  />
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={annualRevenue}
                  onChange={(e) => setAnnualRevenue(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Direct Costs / COGS ({currency})</span>
                  <InfoTooltip
                    title="Direct Costs / Cost of Goods Sold"
                    whatItMeans="Materials, subcontractors, direct project labour, and licences incurred directly to deliver customer jobs."
                    whyItMatters="Revenue minus Direct Costs determines Gross Margin—the true cash contribution paying your overheads."
                    actionOrCalculation="Take Cost of Sales / Direct Costs from your 12-month P&L."
                  />
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={directCosts}
                  onChange={(e) => setDirectCosts(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Operating Expenses ({currency})</span>
                  <InfoTooltip
                    title="Operating Expenses (Overheads)"
                    whatItMeans="Fixed and administrative overheads (rent, admin salaries, vehicles, insurance, software, marketing)."
                    whyItMatters="Shows your monthly fixed burn rate that Gross Profit must cover before the business makes a dollar."
                    actionOrCalculation="Enter total Operating Expenses / Overheads from your 12-month P&L."
                  />
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={operatingExpenses}
                  onChange={(e) => setOperatingExpenses(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Operating Profit / EBITDA ({currency})</span>
                  <InfoTooltip
                    title="Operating Profit / EBITDA"
                    whatItMeans="Net profit earned from core operations before tax and interest (or after owner drawings if paid as salary)."
                    whyItMatters="Tests whether pricing and capacity actually leave commercial surplus after all overheads."
                    actionOrCalculation="Enter Net Operating Profit from your trailing 12-month P&L."
                    align="right"
                  />
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={operatingProfit}
                  onChange={(e) => setOperatingProfit(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Customer Portfolio, Terms & Pricing */}
          <div className="space-y-2.5 pt-3 border-t border-[#0F172A]/10">
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0F52BA]">
              3. Customer Concentration, Debtor Terms &amp; Pricing Cadence (6 Fields)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Active Customers (#)</span>
                  <InfoTooltip
                    title="Active Customers"
                    whatItMeans="Number of distinct clients or accounts who bought from you or held an active contract in the last 12 months."
                    whyItMatters="Too few active customers magnifies churn risk and reduces pricing power."
                    actionOrCalculation="Count active recurring or repeat invoicing accounts in your CRM/accounting system."
                  />
                </label>
                <input
                  type="number"
                  placeholder="e.g. 48"
                  value={customerCount}
                  onChange={(e) => setCustomerCount(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Top 5 Revenue Share (%)</span>
                  <InfoTooltip
                    title="Top 5 Customer Revenue Share (%)"
                    whatItMeans="Percentage of total annual revenue generated by your 5 largest customers combined."
                    whyItMatters="Above 35–40% means losing even one or two anchor clients can immediately erase operating profit."
                    actionOrCalculation="Formula: (Revenue from Top 5 Customers ÷ Total Annual Revenue) × 100."
                  />
                </label>
                <input
                  type="number"
                  placeholder="0–100%"
                  value={top5Conc}
                  onChange={(e) => setTop5Conc(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Top 12 Revenue Share (%)</span>
                  <InfoTooltip
                    title="Top 12 Customer Revenue Share (%)"
                    whatItMeans="Percentage of annual revenue coming from your top 12 accounts."
                    whyItMatters="Shows whether recurring revenue is diversified or concentrated in a handful of relationships."
                    actionOrCalculation="Formula: (Revenue from Top 12 Customers ÷ Total Annual Revenue) × 100."
                    align="right"
                  />
                </label>
                <input
                  type="number"
                  placeholder="0–100%"
                  value={top12Conc}
                  onChange={(e) => setTop12Conc(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Standard Payment Terms (Days)</span>
                  <InfoTooltip
                    title="Standard Payment Terms (Days)"
                    whatItMeans="Number of days stated on your customer invoices before payment is due (e.g., 7, 14, or 20th of following month)."
                    whyItMatters="Baseline benchmark used to spot whether customers are paying on time or stretching you."
                    actionOrCalculation="Enter the standard credit days printed on your quotes and invoices."
                  />
                </label>
                <input
                  type="number"
                  placeholder="e.g. 20"
                  value={standardTermsDays}
                  onChange={(e) => setStandardTermsDays(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Actual Payment Delay (Days)</span>
                  <InfoTooltip
                    title="Actual Average Payment Delay (Debtor Days)"
                    whatItMeans="Average number of days it actually takes customers to pay an invoice from issue date."
                    whyItMatters="Every day beyond your standard terms forces you to finance client work on your overdraft."
                    actionOrCalculation="Formula: (Accounts Receivable ÷ Annual Revenue) × 365, or check Debtor Days in your accounting report."
                  />
                </label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={actualDelayDays}
                  onChange={(e) => setActualDelayDays(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
              <div>
                <label className="text-[#475569] font-semibold flex items-center gap-1.5 mb-1">
                  <span>Years Since Last Price Review</span>
                  <InfoTooltip
                    title="Years Since Last Price Review"
                    whatItMeans="How long it has been since you systematically increased hourly rates, retainers, or product markups."
                    whyItMatters="Going 2+ years without a price review lets wage, fuel, and supplier inflation silently erode gross margin."
                    actionOrCalculation="Enter years since your last across-the-board rate/price update (e.g., 0.5, 1, 3)."
                    align="right"
                  />
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 2"
                  value={pricingReviewYears}
                  onChange={(e) => setPricingReviewYears(e.target.value)}
                  className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded p-2.5 text-[#0F172A] font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#0F52BA]"
                />
              </div>
            </div>
          </div>
          {/* Bottom Ledger Action Footer (Prevents scrolling back up after field 16) */}
          <div className="pt-4 border-t border-[#0F172A]/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#475569]">
              Saving updates your Net Liquidity, Gross Margin, Runway, and Business Health Score immediately.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingBaseline(false)}
                className="px-3.5 py-2 rounded bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#475569] border border-[#0F172A]/15 transition"
              >
                Cancel
              </button>
              {isDemo ? (
                <button
                  type="button"
                  onClick={handleResetToDemo}
                  className="flex items-center space-x-1 px-3 py-2 rounded bg-[#F8FAFC] text-xs font-semibold text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/15 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo Figures</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClearCustomBaseline}
                  className="flex items-center space-x-1 px-3 py-2 rounded bg-[#F8FAFC] text-xs font-semibold text-[#475569] hover:text-[#0F172A] border border-[#0F172A]/15 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Inputs</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveCustomBaseline}
                className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] text-white font-semibold uppercase tracking-wider text-xs shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5 text-white" />
                <span>Save Financial Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={liveResultsRef} id="cashflow-live-results" className="scroll-mt-24 space-y-6">
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
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1.5">
              <span>Available Cash</span>
              <InfoTooltip
                title="Available Cash & Net Liquidity"
                whatItMeans="Cleared bank cash compared directly against short-term bills/payables currently owed."
                whyItMatters="Negative net liquidity means payables exceed cash on hand, creating immediate cash squeeze."
                actionOrCalculation="Net Immediate Liquidity = Cash in Bank − Outstanding Payables."
              />
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
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1.5">
              <span>Credit Facility Drawn</span>
              <InfoTooltip
                title="Credit Facility Utilisation"
                whatItMeans="Percentage of your approved overdraft or credit facility currently consumed."
                whyItMatters="Once utilisation exceeds 65–70%, one delayed client invoice or tax bill can freeze payroll."
                actionOrCalculation="Formula: (Credit Drawn ÷ Credit Limit) × 100."
              />
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
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1.5">
              <span>Unpaid Invoices</span>
              <InfoTooltip
                title="Unpaid Customer Invoices & Delinquency"
                whatItMeans="Total receivables awaiting payment and the share that is over 60 days past due."
                whyItMatters="Overdue invoices are interest-free loans you are giving slow payers while paying bank overdraft interest."
                actionOrCalculation="Delinquent % = (Overdue >60d ÷ Total Unpaid Invoices) × 100. Chase >60d accounts weekly."
              />
            </span>
            <div className="p-1.5 rounded bg-[#EDF3FD] text-[#0F52BA]">
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
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1.5">
              <span>Est. Interest Cost</span>
              <InfoTooltip
                title="Estimated Annual Overdraft Interest"
                whatItMeans="Annualized financing cost at ~12.8% p.a. on your currently drawn overdraft balance."
                whyItMatters="Directly reduces net profit—collecting overdue invoices immediately saves this cash leak."
                actionOrCalculation="Formula: Credit Drawn × 12.8%. Check your exact bank facility rate on your statement."
                align="right"
              />
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
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
              <span>Revenue &amp; Gross Margin</span>
              <InfoTooltip
                title="Gross Margin %"
                whatItMeans="Percentage of each sales dollar left after direct job materials, subcontractors, and delivery labour."
                whyItMatters="If Gross Margin is too thin, selling more volume only creates busy work without extra profit."
                actionOrCalculation="Formula: ((Annual Revenue − Direct Costs) ÷ Annual Revenue) × 100."
              />
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {numRev != null ? `${currency} ${numRev.toLocaleString()}` : 'Not supplied'}
            </div>
            <span className="text-[11px] text-[#475569]">
              {grossMarginPct != null ? `Gross Margin: ${grossMarginPct}%` : 'Supply direct costs for GM%'}
            </span>
          </div>

          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
              <span>Operating Margin</span>
              <InfoTooltip
                title="Operating Profit Margin %"
                whatItMeans="Share of annual revenue kept as operating profit after both direct job costs and fixed overheads."
                whyItMatters="Healthy SME service businesses generally target 12–20%+ after fair owner compensation."
                actionOrCalculation="Formula: (Operating Profit ÷ Annual Revenue) × 100."
              />
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {numProfit != null ? `${currency} ${numProfit.toLocaleString()}` : 'Not supplied'}
            </div>
            <span className="text-[11px] text-[#475569]">
              {opMarginPct != null ? `${opMarginPct}% of annual revenue` : 'Supply profit & revenue for %'}
            </span>
          </div>

          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
              <span>Debtor Terms vs Actual</span>
              <InfoTooltip
                title="Debtor Terms vs Actual Payment Delay"
                whatItMeans="Compares the payment terms promised on your invoices (e.g., 20 days) against how many days clients actually take to pay."
                whyItMatters="A wide gap proves you are unintentionally acting as a free bank for slow-paying clients."
                actionOrCalculation="Tighten automated reminders at +3/+7 days overdue and enforce stop-credit rules."
              />
            </span>
            <div className="text-lg font-bold font-mono text-[#0F172A] mt-1">
              {actualDelayDays || '—'}d vs {standardTermsDays || '—'}d
            </div>
            <span className="text-[11px] text-[#475569]">
              {pricingReviewYears ? `Pricing last reviewed ${pricingReviewYears} yr(s) ago` : 'Pricing cadence unrecorded'}
            </span>
          </div>

          <div className="bg-white border border-[#0F172A]/12 rounded p-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
              <span>Customer Concentration</span>
              <InfoTooltip
                title="Customer Revenue Concentration"
                whatItMeans="Shows how dependent your revenue is on your top 5 and top 12 accounts."
                whyItMatters="High concentration (>35–40% in Top 5) exposes cash flow to sudden contract cancellation or price squeezing."
                actionOrCalculation="Lock top accounts into multi-year agreements while building mid-tier pipeline in CRM."
                align="right"
              />
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
              <Zap className="w-5 h-5 text-[#0F52BA]" />
              <h3 className="text-lg font-bold text-[#0F172A]">
                Debt Collection &amp; Upfront Billing Simulator
              </h3>
            </div>
            <p className="text-xs text-[#475569] mt-1">
              Test the cash release from collecting {currency} {overdue60.toLocaleString()} in overdue debt and requiring upfront deposits on hardware or materials.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-[#F8FAFC] px-4 py-2 rounded border border-[#0F172A]/15">
            <span className="text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
              <span>Upfront Materials/Hardware Policy:</span>
              <InfoTooltip
                title="Upfront Materials & Hardware Policy"
                whatItMeans="Requires customers to pay 100% of third-party hardware, software, or materials upfront before ordering."
                whyItMatters="Stops you funding supplier bills out of your overdraft while waiting 45–60 days for customer payment."
                actionOrCalculation="Toggle ENFORCED to see monthly working capital float retained."
                align="right"
              />
            </span>
            <button
              type="button"
              onClick={() => setHardwarePolicyEnforced(!hardwarePolicyEnforced)}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                hardwarePolicyEnforced
                  ? 'bg-[#0A2E6E] text-[#6495ED]'
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
                <label className="text-sm font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
                  <span>Overdue Receivables Collection Rate</span>
                  <InfoTooltip
                    title="Overdue Receivables Collection Rate"
                    whatItMeans="Share of your >60-day overdue invoices successfully collected into your bank account."
                    whyItMatters="Collected cash reduces overdraft borrowing dollar-for-dollar before adding to cash reserves."
                    actionOrCalculation="Slide to model recovering 25%–100% of overdue >60d receivables."
                  />
                </label>
                <span className="text-sm font-bold text-[#0F52BA] font-mono tabular-nums bg-[#EDF3FD] px-2.5 py-0.5 rounded border border-[#B7CEF7]">
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
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#0F52BA]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
                  <span>Monthly Supplies / Materials Outlay Protected</span>
                  <InfoTooltip
                    title="Monthly Materials / Hardware Float Protected"
                    whatItMeans="Estimated monthly spend on client hardware, parts, or third-party licences billed upfront instead of in arrears."
                    whyItMatters="Retains this cash inside your account instead of financing client purchases."
                    actionOrCalculation="Set close to your typical monthly parts/hardware pass-through spend."
                  />
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
                className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#0F52BA]"
              />
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded p-5 border border-[#0F172A]/12 space-y-4 tabular-nums">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center justify-between border-b border-[#0F172A]/10 pb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0F52BA]" />
                Projected Liquidity Impact
              </span>
              <span className="font-mono text-[#15803D] text-xs font-bold bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
                +{currency} {recoveredAmount.toLocaleString()} Collected
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] text-[11px] font-semibold inline-flex items-center gap-1">
                  <span>Projected Overdraft</span>
                  <InfoTooltip
                    title="Projected Overdraft Balance"
                    whatItMeans="Estimated overdraft drawn after applying collected overdue debt."
                    actionOrCalculation="Formula: max(0, Current Overdraft Drawn − Collected Overdue Amount)."
                  />
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
                <span className="text-[#475569] text-[11px] font-semibold inline-flex items-center gap-1">
                  <span>Facility Headroom</span>
                  <InfoTooltip
                    title="Projected Facility Headroom"
                    whatItMeans="Remaining borrowing safety margin after overdue debt collection."
                    actionOrCalculation="Formula: Credit Limit − Projected Overdraft."
                    align="right"
                  />
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  {currency} {simulatedHeadroom.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] text-[11px] font-semibold inline-flex items-center gap-1">
                  <span>Annual Interest Saved</span>
                  <InfoTooltip
                    title="Annual Interest Saved"
                    whatItMeans="Recurring yearly bank interest avoided by paying down the overdraft."
                    actionOrCalculation="Formula: (Current Overdraft − Projected Overdraft) × 12.8%."
                  />
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  +{currency} {Math.round(annualInterestSaved).toLocaleString()}/yr
                </span>
              </div>

              <div className="p-3 rounded bg-white border border-[#0F172A]/10">
                <span className="text-[#475569] text-[11px] font-semibold inline-flex items-center gap-1">
                  <span>Monthly Float Retained</span>
                  <InfoTooltip
                    title="Monthly Working Capital Float Retained"
                    whatItMeans="Cash kept in your bank account each month by collecting deposits upfront on materials/hardware."
                    align="right"
                  />
                </span>
                <span className="text-lg font-bold font-mono text-[#15803D] mt-0.5 block">
                  +{currency} {hardwareFloatUnlocked.toLocaleString()}/mo
                </span>
              </div>
            </div>

            <div className="p-3 rounded bg-white border border-[#0F172A]/10 text-xs flex items-center justify-between">
              <span className="text-[#475569] font-medium inline-flex items-center gap-1.5">
                <span>Simulated Net Immediate Liquidity:</span>
                <InfoTooltip
                  title="Simulated Net Immediate Liquidity"
                  whatItMeans="Projected cash in bank (after paying off overdraft) minus outstanding supplier payables."
                  whyItMatters="Moving this number from negative to positive removes acute short-term solvency strain."
                />
              </span>
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
  </div>
  );
};
