import React from 'react';
import { Calendar, Info } from 'lucide-react';
import { WEEKLY_DASHBOARD_KPIS } from '../data/coachingBriefing';
import { WeeklyDashboardKPI, CaseRecord } from '../types/bizpulse';

interface WeeklyDashboardViewProps {
  caseRecord?: CaseRecord;
}

export const WeeklyDashboardView: React.FC<WeeklyDashboardViewProps> = ({ caseRecord }) => {
  const isDemo = caseRecord?.profile?.isDemonstrationCase ?? false;
  const businessName = caseRecord?.profile?.name || 'Business Case';
  const currency = caseRecord?.profile?.currency || 'NZD';
  const fin = caseRecord?.financials;
  const health = caseRecord?.overallHealth;

  const actionPlanList = (caseRecord?.actionPlan || []).filter(
    (a) => a.decisionStatus !== 'rejected'
  );
  const doneActionsCount = actionPlanList.filter(
    (a) => a.completed || a.status === 'completed'
  ).length;
  const recItems = caseRecord?.recommendations?.actionItems || [];
  const recDoneCount = recItems.filter((a) => a.completed).length;

  const customKPIs: WeeklyDashboardKPI[] = [
    {
      id: 'c-kpi-1',
      name: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].name
        : 'Cash on Hand vs. Overdraft Drawn',
      area: 'Cash Liquidity',
      currentReportedValue: fin
        ? `Cash ${currency} ${(fin.cashInBank ?? 0).toLocaleString()} | Drawn ${currency} ${(
            fin.creditFacilityUsed ?? 0
          ).toLocaleString()}`
        : 'Not supplied yet',
      targetBenchmark: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].targetBenchmark
        : 'Cash buffer >= 4–8 weeks operating expenses',
      warningThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].warningThreshold
        : 'Credit facility drawn > 50% of limit',
      criticalThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].criticalThreshold
        : 'Negative net cash after near-term payables',
      explanation: isDemo
        ? WEEKLY_DASHBOARD_KPIS[0].explanation
        : 'Tracks genuine cash solvency weekly instead of paper revenue.',
      criteriaExplanation:
        'Updates live from your Cash Flow & Financial Ledger tab.',
      accountableRole: 'Owner / Finance Lead',
      measurementFrequency: 'Weekly (Monday Cash Check)',
    },
    {
      id: 'c-kpi-2',
      name: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].name
        : 'Overdue Customer Invoices (>60 Days)',
      area: 'Collections',
      currentReportedValue:
        fin && fin.overdueReceivables != null
          ? `${currency} ${fin.overdueReceivables.toLocaleString()}${
              fin.accountsReceivable
                ? ` (${Math.round((fin.overdueReceivables / fin.accountsReceivable) * 100)}% of AR)`
                : ''
            }`
          : 'Not supplied yet',
      targetBenchmark: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].targetBenchmark
        : '< 10% of receivables past 30 days',
      warningThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].warningThreshold
        : '15–25% receivables overdue',
      criticalThreshold: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].criticalThreshold
        : '> 25% receivables > 60 days overdue',
      explanation: isDemo
        ? WEEKLY_DASHBOARD_KPIS[1].explanation
        : 'Prevents funded work from turning into unpaid interest-free customer credit.',
      criteriaExplanation: 'Reviewed every Monday against aged debtors ledger.',
      accountableRole: 'Accounts / Owner',
      measurementFrequency: 'Weekly',
    },
    {
      id: 'c-kpi-3',
      name: '12-Capability Business Health Index',
      area: 'Overall Health',
      currentReportedValue:
        health && health.overallScore !== null
          ? `${health.overallScore}/100 (${health.overallRating})`
          : 'Assessment Pending',
      targetBenchmark: '72+ / 100 (Healthy across Money & Delivery)',
      warningThreshold: '45–71 / 100 (Needs Attention)',
      criticalThreshold: '< 45 / 100 or Money / Ops At Risk',
      explanation:
        'Summarizes strategic, financial, margin, staffing, and owner-dependency stability.',
      criteriaExplanation:
        'Updates dynamically from the 12 Business Health Capabilities tab.',
      accountableRole: 'Business Owner',
      measurementFrequency: 'Monthly / On Assessment',
    },
    {
      id: 'c-kpi-4',
      name: '30/60/90-Day Accountability Progress',
      area: 'Execution',
      currentReportedValue:
        actionPlanList.length > 0
          ? `${doneActionsCount} / ${actionPlanList.length} Plan Actions Done`
          : recItems.length > 0
          ? `${recDoneCount} / ${recItems.length} Actions Done`
          : isDemo
          ? WEEKLY_DASHBOARD_KPIS[3].currentReportedValue
          : '0 / 0 Plan Actions Done',
      targetBenchmark: 'Weekly completion of priority steps',
      warningThreshold: 'Actions stalled > 14 days',
      criticalThreshold: 'Repeated unplanned firefighting',
      explanation: 'Ensures coaching insights convert into tangible weekly execution.',
      criteriaExplanation: 'Tracked dynamically on 30/60/90-Day Action Plan & Coaching tabs.',
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
          ? `${Math.round((fin.operatingProfit / fin.annualRevenue) * 100)}% operating margin (${
              fin.pricingReviewLastYears != null
                ? `${fin.pricingReviewLastYears}y since price review`
                : 'review cadence unrecorded'
            })`
          : 'Not supplied yet',
      targetBenchmark: 'Annual price review + documented variation quotes',
      warningThreshold: 'Margins slipping on rising wage/supplier costs',
      criticalThreshold: 'Unbilled scope creep or loss-making jobs',
      explanation: 'Protects gross profit against inflation without sacrificing service quality.',
      criteriaExplanation: 'Updates from Cash Flow ledger and Client Matrix calculator.',
      accountableRole: 'Managing Director',
      measurementFrequency: 'Monthly',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Executive Navy Hero Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#2563EB] text-white">
                Weekly Operating Rhythm
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">{businessName}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Monday 9:00 AM Management Scoreboard
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              Six practical vital signs reviewed in 45 minutes every Monday morning to replace guesswork with calm, factual control.
            </p>
          </div>

          <div className="bg-white/5 border border-white/15 rounded p-4 min-w-[230px] text-center shrink-0">
            <span className="text-[11px] text-[#60A5FA] uppercase tracking-wider font-bold block">
              Weekly Cadence
            </span>
            <div className="text-xl font-bold text-white mt-1">Every Monday</div>
            <div className="text-xs text-[#CBD5E1] font-mono mt-0.5">
              9:00 AM – 9:45 AM (45 Mins)
            </div>
          </div>
        </div>
      </div>

      {!isDemo && !fin && (
        <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#0F172A] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <span>
            Metrics below reflect your actual ratings and any numbers entered for <strong>{businessName}</strong>. Missing accounting figures are shown as &ldquo;Not supplied yet&rdquo; rather than fabricated defaults.
          </span>
        </div>
      )}

      {/* Live Connected CRM & ROI Pipeline Summary Strip */}
      {(() => {
        const crm = caseRecord?.crmContacts || [];
        const roi = caseRecord?.roiScenarios || [];
        const todayIso = new Date().toISOString().slice(0, 10);
        const openPipeline = crm
          .filter((c) => c.salesStage !== 'Won' && c.salesStage !== 'Lost' && c.salesStage !== 'Dormant')
          .reduce((s, c) => s + (Number(c.opportunityValue) || 0), 0);
        const dueCount = crm.filter(
          (c) =>
            c.status === 'Follow-Up Due' ||
            c.status === 'At Risk' ||
            (Boolean(c.nextFollowUpDate) &&
              c.nextFollowUpDate <= todayIso &&
              c.salesStage !== 'Lost' &&
              c.status !== 'Closed Lost')
        ).length;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
            <div className="bg-white border border-[#0F172A]/12 rounded p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                CRM Active Pipeline
              </span>
              <div className="text-xl font-bold text-[#0F172A] font-mono mt-1">
                {currency} {openPipeline.toLocaleString()}
              </div>
              <span className="text-[11px] text-[#475569]">
                Across {crm.length} CRM contact{crm.length === 1 ? '' : 's'}
              </span>
            </div>
            <div
              className={`border rounded p-4 ${
                dueCount > 0 ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-white border-[#0F172A]/12'
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#B45309] block">
                CRM Follow-Ups Due / At Risk
              </span>
              <div className="text-xl font-bold text-[#B45309] font-mono mt-1">{dueCount}</div>
              <span className="text-[11px] text-[#475569]">
                Accounts needing Monday follow-up action
              </span>
            </div>
            <div className="bg-white border border-[#0F172A]/12 rounded p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569] block">
                Modeled ROI Scenarios
              </span>
              <div className="text-xl font-bold text-[#0F172A] font-mono mt-1">{roi.length}</div>
              <span className="text-[11px] text-[#475569]">
                Evaluated on ROI &amp; Options workbench
              </span>
            </div>
          </div>
        );
      })()}

      {/* 6 Vital Sign Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {customKPIs.map((kpi, index) => {
          const isAlert =
            kpi.currentReportedValue.includes('AT RISK') ||
            kpi.currentReportedValue.includes('At Risk');
          return (
            <div
              key={kpi.id}
              className="bg-white border border-[#0F172A]/12 rounded p-6 flex flex-col justify-between transition-all hover:border-[#2563EB]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F172A] px-2.5 py-0.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15 font-mono">
                    {kpi.area}
                  </span>
                  <span className="text-[11px] font-semibold text-[#1D4ED8] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                    {kpi.accountableRole}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-[#0F172A] text-base leading-snug">
                    {index + 1}. {kpi.name}
                  </h3>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed">{kpi.explanation}</p>
                </div>

                <div
                  className={`p-3.5 rounded border space-y-1 ${
                    isAlert
                      ? 'bg-[#FEF2F2] border-[#FECACA]'
                      : 'bg-[#F8FAFC] border-[#0F172A]/12'
                  }`}
                >
                  <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wider">
                    Current Reported Position
                  </span>
                  <div
                    className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                      isAlert ? 'text-[#B91C1C]' : 'text-[#0F172A]'
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
                    <span className="text-[#0F172A] font-medium text-[11px] block">
                      {kpi.targetBenchmark}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA]">
                    <span className="text-[#B91C1C] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Redline Alert
                    </span>
                    <span className="text-[#0F172A] font-medium text-[11px] block">
                      {kpi.criticalThreshold}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#0F172A]/10 text-xs text-[#475569] leading-relaxed">
                <strong className="text-[#0F172A] font-semibold">Review Basis: </strong>
                {kpi.criteriaExplanation}
              </div>
            </div>
          );
        })}
      </div>

      {/* 45-Minute Monday Meeting Protocol */}
      <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8">
        <h3 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#2563EB]" />
          <span>45-Minute Monday Meeting Protocol</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
            <span className="font-bold text-[#2563EB] text-sm block">
              1. Minutes 0–15: Cash &amp; Debtors
            </span>
            <p className="text-[#475569] leading-relaxed">
              Check bank balance, facility headroom, and overdue invoices past terms. Confirm collection calls and follow-up dates.
            </p>
          </div>
          <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
            <span className="font-bold text-[#0F172A] text-sm block">
              2. Minutes 15–30: Delivery &amp; Clients
            </span>
            <p className="text-[#475569] leading-relaxed">
              Review key customer status, overdue jobs or tickets, and senior staff capacity protection.
            </p>
          </div>
          <div className="p-5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2">
            <span className="font-bold text-[#15803D] text-sm block">
              3. Minutes 30–45: 3 Weekly Commitments
            </span>
            <p className="text-[#475569] leading-relaxed">
              Assign 3 clear non-negotiable actions with accountable owners and Friday completion check-ins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
