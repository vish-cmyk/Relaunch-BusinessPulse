import React from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Briefcase
} from 'lucide-react';
import { WEEKLY_DASHBOARD_KPIS } from '../data/coachingBriefing';
import { WeeklyDashboardKPI, CaseRecord } from '../types/bizpulse';

interface WeeklyDashboardViewProps {
  caseRecord?: CaseRecord;
}

export const WeeklyDashboardView: React.FC<WeeklyDashboardViewProps> = ({ caseRecord }) => {
  const businessName = caseRecord?.profile?.name || 'Client SME';
  const currency = caseRecord?.profile?.currency || 'NZD';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Context Card */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30">
                Operating Rhythm
              </span>
              <span className="text-[#64748B] text-xs font-medium">Section 10 Executive Scoreboard</span>
              <span className="text-[#64748B] text-xs">·</span>
              <span className="text-[#14283F] text-xs font-semibold">{businessName}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#14283F] tracking-tight">
              The Monday 9:00 AM Management Dashboard
            </h2>
            <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
              Six commercial vital signs reviewed in a strictly time-boxed 45-minute standup every Monday. Clear targets, warning levels, critical redlines, and accountable roles to separate commercial facts from emotional anxiety.
            </p>
          </div>

          <div className="bg-[#F8F9FA] border border-[#E5EBEF] rounded-xl p-4 min-w-[240px] text-center shadow-2xs shrink-0">
            <span className="text-xs text-[#64748B] uppercase tracking-wider font-semibold block">Weekly Executive Cadence</span>
            <div className="text-xl font-bold text-[#14283F] mt-1">
              Every Monday
            </div>
            <div className="text-xs text-[#D99A35] font-mono font-medium mt-0.5">
              9:00 AM – 9:45 AM (Strict 45 Min)
            </div>
          </div>
        </div>
      </div>

      {/* 6 Core Vital Sign Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {WEEKLY_DASHBOARD_KPIS.map((kpi: WeeklyDashboardKPI, index: number) => {
          const isCritical = kpi.id === 'kpi-1' || kpi.id === 'kpi-2';
          return (
            <div
              key={kpi.id}
              className={`bg-white border rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-all hover:border-[#168C83]/50 hover:shadow-md ${
                isCritical ? 'border-[#FECACA] ring-1 ring-[#FECACA]/60' : 'border-[#E5EBEF]'
              }`}
            >
              <div className="space-y-4">
                {/* Header Tag & Role */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] px-2.5 py-0.5 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] font-mono">
                    {kpi.area}
                  </span>
                  <span className="text-xs font-semibold text-[#168C83] bg-[#E6F4F2] px-2 py-0.5 rounded">
                    Role: {kpi.accountableRole}
                  </span>
                </div>

                {/* KPI Title & Explanation */}
                <div>
                  <h3 className="font-bold text-[#14283F] text-base leading-snug">
                    {index + 1}. {kpi.name}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    {kpi.explanation}
                  </p>
                </div>

                {/* Current Reported Value Display */}
                <div className={`p-4 rounded-xl border space-y-1 ${
                  isCritical 
                    ? 'bg-[#FEF2F2] border-[#FECACA]' 
                    : 'bg-[#FDF6E9] border-[#FDE68A]'
                }`}>
                  <span className="text-xs font-semibold text-[#64748B] block uppercase tracking-wider">Reported Baseline:</span>
                  <div className={`text-xl font-extrabold font-mono tabular-nums ${
                    isCritical ? 'text-[#B91C1C]' : 'text-[#B45309]'
                  }`}>
                    {kpi.currentReportedValue}
                  </div>
                </div>

                {/* Target Benchmark vs Critical Redline */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]">
                    <span className="text-[#15803D] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Target Benchmark
                    </span>
                    <span className="text-[#15803D] font-semibold text-[11px] block">{kpi.targetBenchmark}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
                    <span className="text-[#B91C1C] font-bold block mb-1 uppercase tracking-wider text-[10px]">
                      Critical Redline
                    </span>
                    <span className="text-[#B91C1C] font-semibold text-[11px] block">{kpi.criticalThreshold}</span>
                  </div>
                </div>
              </div>

              {/* Classification Rationale Explanation */}
              <div className="mt-5 pt-3 border-t border-[#E5EBEF] text-xs text-[#64748B] leading-relaxed">
                <strong className="text-[#14283F] font-semibold">Classification Rationale: </strong>
                {kpi.criteriaExplanation}
              </div>
            </div>
          );
        })}
      </div>

      {/* Monday Agenda Operating Rules */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs">
        <h3 className="text-lg font-bold text-[#14283F] mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#D99A35]" />
          The 45-Minute Monday Meeting Operating Protocol
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-5 rounded-xl bg-[#F8F9FA] border border-[#E5EBEF] space-y-2">
            <span className="font-bold text-[#D99A35] text-sm block">1. Minutes 0–15: Cash & Credit Governance</span>
            <p className="text-[#64748B] leading-relaxed">
              Review current bank balance, remaining overdraft headroom, and invoices overdue past 20 days. Confirm stop-work notices for accounts past 45 days. No informal exceptions without formal payment arrangements.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#F8F9FA] border border-[#E5EBEF] space-y-2">
            <span className="font-bold text-[#168C83] text-sm block">2. Minutes 15–30: Top 12 Client & Service Health</span>
            <p className="text-[#64748B] leading-relaxed">
              Review green/amber/red status across the Top 12 clients. Inspect ticket backlog and senior technician focus block adherence. Ensure no reactive fires displace planned billable projects.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#F8F9FA] border border-[#E5EBEF] space-y-2">
            <span className="font-bold text-[#15803D] text-sm block">3. Minutes 30–45: 3 Commitments for the Week</span>
            <p className="text-[#64748B] leading-relaxed">
              Each leader names exactly 3 non-negotiable deliverables for the week. Document accountable owners and Friday 5:00 PM verification deadlines. Meeting ends promptly at 9:45 AM.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
