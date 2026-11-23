import React from 'react';
import { Calendar, Info } from 'lucide-react';
import { WEEKLY_DASHBOARD_KPIS } from '../data/coachingBriefing';
import { WeeklyDashboardKPI, CaseRecord } from '../types/bizpulse';

interface WeeklyDashboardViewProps {
  caseRecord?: CaseRecord;
}

export const WeeklyDashboardView: React.FC<WeeklyDashboardViewProps> = ({ caseRecord }) => {
  const isDemo = caseRecord?.profile?.isDemonstrationCase ?? true;
  const businessName = caseRecord?.profile?.name || 'Business Case';
  const currency = caseRecord?.profile?.currency || 'NZD';
  const fin = caseRecord?.financials;
  const health = caseRecord?.overallHealth;

  const customKPIs: WeeklyDashboardKPI[] = isDemo
    ? WEEKLY_DASHBOARD_KPIS
    : [
        {
          id: 'c-kpi-1',
          name: 'Cash on Hand vs. Overdraft Drawn',
          area: 'Cash Liquidity',
          currentReportedValue: fin
            ? `Cash ${currency} ${(fin.cashInBank ?? 0).toLocaleString()} | Drawn ${currency} ${(
                fin.creditFacilityUsed ?? 0
              ).toLocaleString()}`
            : 'Not supplied yet',
          targetBenchmark: 'Cash buffer >= 4–8 weeks operating expenses',
          warningThreshold: 'Credit facility drawn > 50% of limit',
          criticalThreshold: 'Negative net cash after near-term payables',
          explanation: 'Tracks genuine cash solvency weekly instead of paper revenue.',
          criteriaExplanation:
            'Enter actual bank balances in the Cash Flow tab to monitor liquidity accurately.',
          accountableRole: 'Owner / Finance Lead',
          measurementFrequency: 'Weekly (Monday Cash Check)',
        },
        {
          id: 'c-kpi-2',
          name: 'Overdue Customer Invoices (>60 Days)',
          area: 'Collections',
          currentReportedValue:
            fin && fin.overdueReceivables != null
              ? `${currency} ${fin.overdueReceivables.toLocaleString()}`
              : 'Not supplied yet',
          targetBenchmark: '< 10% of receivables past 30 days',
          warningThreshold: '15–25% receivables overdue',
          criticalThreshold: '> 25% receivables > 60 days overdue',
          explanation: 'Prevents funded work from turning into unpaid interest-free customer credit.',
          criteriaExplanation:
            'Reviewed every Monday against aged debtors ledger.',
          accountableRole: 'Accounts / Owner',
          measurementFrequency: 'Weekly',
        },
        {
          id: 'c-kpi-3',
          name: '8-Dimension Business Health Index',
          area: 'Overall Health',
          currentReportedValue:
            health && health.overallScore !== null
              ? `${health.overallScore}/100 (${health.overallRating})`
              : 'Assessment Pending',
          targetBenchmark: '72+ / 100 (Healthy across Money & Delivery)',
          warningThreshold: '45–71 / 100 (Needs Attention)',
          criticalThreshold: '< 45 / 100 or Money / Ops At Risk',
          explanation: 'Summarizes strategic, financial, staffing, and owner-dependency stability.',
          criteriaExplanation: 'Updates dynamically from the 8 Health Dimensions tab.',
          accountableRole: 'Business Owner',
          measurementFrequency: 'Monthly / On Assessment',
        },
        {
          id: 'c-kpi-4',
          name: 'Primary Bottleneck Progress',
          area: 'Execution',
          currentReportedValue: `${
            caseRecord?.recommendations?.actionItems?.filter((a) => a.completed).length ?? 0
          } / ${caseRecord?.recommendations?.actionItems?.length ?? 0} Actions Done`,
          targetBenchmark: 'Weekly completion of priority steps',
          warningThreshold: 'Actions stalled > 14 days',
          criticalThreshold: 'Repeated unplanned firefighting',
          explanation: 'Ensures coaching insights convert into tangible weekly execution.',
          criteriaExplanation: 'Tracked on Action Plan & Coaching tabs.',
          accountableRole: 'Operations Lead',
          measurementFrequency: 'Weekly',
        },
        {
          id: 'c-kpi-5',
          name: 'Core Team & Owner Workload',
          area: 'People & Capacity',
          currentReportedValue: caseRecord?.healthInputs?.ownerDependency?.status
            ? caseRecord.healthInputs.ownerDependency.status.replace('_', ' ').toUpperCase()
            : 'UNRATED',
          targetBenchmark: 'Healthy (< 45 hrs/wk owner focus on high-value work)',
          warningThreshold: 'Needs Attention (frequent escalations)',
          criticalThreshold: 'At Risk (single-point failure / burnout)',
          explanation: 'Protects staff retention and reduces owner dependency on routine decisions.',
          criteriaExplanation: 'Rated in Dimension 6 (People) and Dimension 7 (Owner Dependency).',
          accountableRole: 'Owner / Team Lead',
          measurementFrequency: 'Fortnightly',
        },
        {
          id: 'c-kpi-6',
          name: 'Pricing & Margin Integrity',
          area: 'Profitability',
          currentReportedValue:
            fin && fin.operatingProfit != null && fin.annualRevenue
              ? `${Math.round((fin.operatingProfit / fin.annualRevenue) * 100)}% est. operating margin`
              : 'Not supplied yet',
          targetBenchmark: 'Annual price review + documented variation quotes',
          warningThreshold: 'Margins slipping on rising wage/supplier costs',
          criticalThreshold: 'Unbilled scope creep or loss-making jobs',
          explanation: 'Protects gross profit against inflation without sacrificing service quality.',
          criteriaExplanation: 'Model scenarios in the Client Matrix calculator.',
          accountableRole: 'Managing Director',
          measurementFrequency: 'Monthly',
        },
      ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Charcoal Hero Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#D97706] text-white">
                Weekly Operating Rhythm
              </span>
              <span className="text-[#D4D4D8] text-xs font-medium">{businessName}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Monday 9:00 AM Management Scoreboard
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed">
              Six practical vital signs reviewed in 45 minutes every Monday morning to replace guesswork with calm, factual control.
            </p>
          </div>

          <div className="bg-white/5 border border-white/15 rounded p-4 min-w-[230px] text-center shrink-0">
            <span className="text-[11px] text-[#FBBF24] uppercase tracking-wider font-bold block">
              Weekly Cadence
            </span>
            <div className="text-xl font-bold text-white mt-1">Every Monday</div>
            <div className="text-xs text-[#D4D4D8] font-mono mt-0.5">
              9:00 AM – 9:45 AM (45 Mins)
            </div>
          </div>
        </div>
      </div>

      {!isDemo && !fin && (
        <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <span>
            Metrics below reflect your actual ratings and any numbers entered for <strong>{businessName}</strong>. Missing accounting figures are shown as &ldquo;Not supplied yet&rdquo; rather than fabricated defaults.
          </span>
        </div>
      )}

      {/* 6 Vital Sign Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {customKPIs.map((kpi, index) => {
          const isAlert =
            kpi.currentReportedValue.includes('AT RISK') ||
            kpi.currentReportedValue.includes('At Risk');
          return (
            <div
              key={kpi.id}
              className="bg-white border border-[#111113]/12 rounded p-6 flex flex-col justify-between transition-all hover:border-[#D97706]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#111113] px-2.5 py-0.5 rounded bg-[#F8F7F4] border border-[#111113]/15 font-mono">
                    {kpi.area}
                  </span>
                  <span className="text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] px-2 py-0.5 rounded border border-[#FDE68A]">
                    {kpi.accountableRole}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-[#111113] text-base leading-snug">
                    {index + 1}. {kpi.name}
                  </h3>
                  <p className="text-xs text-[#52525B] mt-1 leading-relaxed">{kpi.explanation}</p>
                </div>

                <div
                  className={`p-3.5 rounded border space-y-1 ${
                    isAlert
                      ? 'bg-[#FEF2F2] border-[#FECACA]'
                      : 'bg-[#F8F7F4] border-[#111113]/12'
                  }`}
                >
                  <span className="text-[10px] font-bold text-[#52525B] block uppercase tracking-wider">
                    Current Reported Position
                  </span>
                  <div
                    className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                      isAlert ? 'text-[#B91C1C]' : 'text-[#111113]'
                    }`}
                  >
                    {kpi.currentReportedValue}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0]">
                    <span className="text-[#15803D] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Healthy Target
                    </span>
                    <span className="text-[#111113] font-medium text-[11px] block">
                      {kpi.targetBenchmark}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
                    <span className="text-[#B91C1C] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Redline Alert
                    </span>
                    <span className="text-[#111113] font-medium text-[11px] block">
                      {kpi.criticalThreshold}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#111113]/10 text-xs text-[#52525B] leading-relaxed">
                <strong className="text-[#111113] font-semibold">Review Basis: </strong>
                {kpi.criteriaExplanation}
              </div>
            </div>
          );
        })}
      </div>

      {/* 45-Minute Monday Meeting Protocol */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8">
        <h3 className="text-lg font-bold text-[#111113] mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#D97706]" />
          <span>45-Minute Monday Meeting Protocol</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2">
            <span className="font-bold text-[#B45309] text-sm block">
              1. Minutes 0–15: Cash &amp; Debtors
            </span>
            <p className="text-[#52525B] leading-relaxed">
              Check bank balance, facility headroom, and overdue invoices past terms. Confirm collection calls and follow-up dates.
            </p>
          </div>
          <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2">
            <span className="font-bold text-[#111113] text-sm block">
              2. Minutes 15–30: Delivery &amp; Clients
            </span>
            <p className="text-[#52525B] leading-relaxed">
              Review key customer status, overdue jobs or tickets, and senior staff capacity protection.
            </p>
          </div>
          <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2">
            <span className="font-bold text-[#15803D] text-sm block">
              3. Minutes 30–45: 3 Weekly Commitments
            </span>
            <p className="text-[#52525B] leading-relaxed">
              Assign 3 clear non-negotiable actions with accountable owners and Friday completion check-ins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
