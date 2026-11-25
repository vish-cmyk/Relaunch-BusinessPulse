import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  BarChart2,
  Compass,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  HealthDimensionKey,
  HealthDimensionInput,
  HealthStatus,
  OverallHealthAssessment,
  BusinessProfile,
  DimensionScoreDetail,
  CaseRecord,
} from '../types/bizpulse';
import { buildSessionDimensionTrajectory } from '../services/healthScoring';

interface BusinessHealthViewProps {
  profile: BusinessProfile;
  healthInputs: Record<HealthDimensionKey, HealthDimensionInput>;
  overallHealth: OverallHealthAssessment | null;
  savedSessions?: CaseRecord[];
  activeCaseId?: string;
  onUpdateInput: (key: HealthDimensionKey, updated: HealthDimensionInput) => void;
  onRecalculateOverall: () => void;
  onProceedToRecommendations: () => void;
}

const DIMENSION_ORDER: HealthDimensionKey[] = [
  'direction',
  'customers',
  'sales',
  'pricingMargins',
  'money',
  'operations',
  'people',
  'ownerDependency',
  'competition',
  'scalability',
  'technology',
  'sustainability',
];

const SHORT_LABELS: Record<HealthDimensionKey, string> = {
  direction: 'Direction',
  customers: 'Customers',
  sales: 'Sales',
  pricingMargins: 'Pricing',
  money: 'Money',
  operations: 'Operations',
  people: 'People',
  ownerDependency: 'Owner Dep.',
  competition: 'Compete',
  scalability: 'Scale',
  technology: 'Digital/AI',
  sustainability: 'Sustain.',
};

const DIMENSION_COLORS: Record<HealthDimensionKey, string> = {
  money: '#2563EB',
  pricingMargins: '#D97706',
  operations: '#0F766E',
  customers: '#7C3AED',
  ownerDependency: '#DC2626',
  sales: '#0284C7',
  direction: '#0F172A',
  people: '#15803D',
  competition: '#B45309',
  scalability: '#4F46E5',
  technology: '#0891B2',
  sustainability: '#059669',
};

type TrajectoryPresetId = 'core' | 'growth' | 'people' | 'all';

const TRAJECTORY_PRESETS: Record<
  TrajectoryPresetId,
  { label: string; keys: HealthDimensionKey[] }
> = {
  core: {
    label: 'Core Financial & Ops',
    keys: ['money', 'pricingMargins', 'operations', 'customers', 'ownerDependency'],
  },
  growth: {
    label: 'Commercial & Digital',
    keys: ['direction', 'sales', 'competition', 'scalability', 'technology'],
  },
  people: {
    label: 'People & Sustainability',
    keys: ['people', 'ownerDependency', 'sustainability', 'money'],
  },
  all: {
    label: 'All 12 Dimensions',
    keys: DIMENSION_ORDER,
  },
};

function getAdaptiveGuidancePrompt(key: HealthDimensionKey, profile: BusinessProfile): string {
  const teamTotal = (Number(profile.employeeCount) || 0) + (Number(profile.subcontractorCount) || 0);
  const scaleTag =
    teamTotal <= 3
      ? 'solo/micro team (1–3 people)'
      : teamTotal <= 10
      ? `small team (${teamTotal} staff/contractors)`
      : `growing SME (${teamTotal} staff/contractors)`;

  switch (key) {
    case 'direction':
      return `For a ${scaleTag} in ${profile.industry}, do leadership/partners agree on the top 90-day priority (cash stabilization vs expansion)?`;
    case 'customers':
      return `In ${profile.industry}, identify what share of revenue comes from your top 5 clients and whether any core accounts have complained or slowed payments.`;
    case 'sales':
      return `Assess whether ${profile.name || 'the business'} has predictable weekly leads outside word-of-mouth referrals, and what happens if referrals pause for 60 days.`;
    case 'pricingMargins':
      return `Check when ${profile.industry} rates were last increased against wage, material, or supplier inflation, and whether variations/scope creep go unbilled.`;
    case 'money':
      return `Look at cleared cash vs near-term payables/tax, facility drawn balance, and invoices overdue past 45–60 days — not just paper P&L profit.`;
    case 'operations':
      return `For a ${scaleTag}, evaluate how often urgent rework or emergencies derail planned work and whether key delivery steps rely on undocumented habits.`;
    case 'people':
      return `Assess workload sustainability across your ${teamTotal || 'core'} team, role clarity, and whether any critical team member is showing burnout or flight risk.`;
    case 'ownerDependency':
      return `Test what breaks if the owner steps away for 14 days: quoting, troubleshooting, customer approvals, or payroll/billing.`;
    case 'competition':
      return `Evaluate why ${profile.mainCustomerTypes || 'your buyers'} pick you over larger national or cheaper local competitors without discounting.`;
    case 'scalability':
      return `Estimate whether current onboarding, SOPs, and capacity could absorb +25% more ${profile.industry} revenue cleanly without margin collapse.`;
    case 'technology':
      return `Check if job costing, invoicing, CRM follow-ups, and practical AI/automation tools are saving hours or sitting underused.`;
    case 'sustainability':
      return `Review single-person risks, compliance/cyber hygiene, tax reserves, and whether the owner's weekly hours are sustainable long-term.`;
  }
}

export const BusinessHealthView: React.FC<BusinessHealthViewProps> = ({
  profile,
  healthInputs,
  overallHealth,
  savedSessions,
  activeCaseId,
  onUpdateInput,
  onRecalculateOverall,
  onProceedToRecommendations,
}) => {
  const [expandedDimension, setExpandedDimension] = useState<HealthDimensionKey | null>('money');
  const [trajectoryPreset, setTrajectoryPreset] = useState<TrajectoryPresetId>('core');
  const [visibleDimensions, setVisibleDimensions] = useState<HealthDimensionKey[]>(
    TRAJECTORY_PRESETS.core.keys
  );

  const handleSelectPreset = (presetId: TrajectoryPresetId) => {
    setTrajectoryPreset(presetId);
    setVisibleDimensions(TRAJECTORY_PRESETS[presetId].keys);
  };

  const handleToggleDimensionLine = (key: HealthDimensionKey) => {
    setVisibleDimensions((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  const resolvedSessions: CaseRecord[] = React.useMemo(() => {
    const fallbackCase: CaseRecord = {
      id: activeCaseId || profile.caseId || 'active-case',
      profile,
      healthInputs,
      overallHealth,
      financials: null,
      recommendations: null,
      conversations: [],
      actionPlan: [],
      dashboardMetrics: [],
      updatedAt: profile.updatedAt || new Date().toISOString(),
    };

    if (!savedSessions || savedSessions.length === 0) {
      return [fallbackCase];
    }

    const targetId = activeCaseId || profile.caseId;
    const merged = savedSessions.map((session) =>
      session.id === targetId
        ? {
            ...session,
            profile,
            healthInputs,
            overallHealth: overallHealth ?? session.overallHealth,
          }
        : session
    );

    if (targetId && !merged.some((s) => s.id === targetId)) {
      merged.unshift(fallbackCase);
    }
    return merged;
  }, [savedSessions, activeCaseId, profile, healthInputs, overallHealth]);

  const trajectoryData = React.useMemo(
    () => buildSessionDimensionTrajectory(resolvedSessions, activeCaseId || profile.caseId, 3),
    [resolvedSessions, activeCaseId, profile.caseId]
  );

  const handleStatusChange = (key: HealthDimensionKey, status: HealthStatus) => {
    const current = healthInputs[key];
    onUpdateInput(key, { ...current, status });
  };

  const handleNotesChange = (key: HealthDimensionKey, notes: string) => {
    const current = healthInputs[key];
    onUpdateInput(key, { ...current, notes });
  };

  const handleEvidenceTypeChange = (
    key: HealthDimensionKey,
    evidenceType: HealthDimensionInput['evidenceType']
  ) => {
    const current = healthInputs[key];
    onUpdateInput(key, { ...current, evidenceType });
  };

  const getStatusStyle = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return {
          bg: 'bg-[#ECFDF5]',
          border: 'border-[#A7F3D0]',
          activeBorder: 'border-[#15803D]',
          text: 'text-[#15803D]',
          barColor: '#15803D',
          badge: 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]',
          label: 'Healthy',
          defaultScore: 100,
          icon: CheckCircle2,
        };
      case 'needs_attention':
        return {
          bg: 'bg-[#FFFBEB]',
          border: 'border-[#FDE68A]',
          activeBorder: 'border-[#B45309]',
          text: 'text-[#B45309]',
          barColor: '#D97706',
          badge: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
          label: 'Needs Attention',
          defaultScore: 55,
          icon: AlertTriangle,
        };
      case 'at_risk':
        return {
          bg: 'bg-[#FEF2F2]',
          border: 'border-[#FECACA]',
          activeBorder: 'border-[#B91C1C]',
          text: 'text-[#B91C1C]',
          barColor: '#DC2626',
          badge: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
          label: 'At Risk',
          defaultScore: 15,
          icon: AlertOctagon,
        };
      case 'not_sure':
        return {
          bg: 'bg-[#EFF6FF]',
          border: 'border-[#BFDBFE]',
          activeBorder: 'border-[#1D4ED8]',
          text: 'text-[#1D4ED8]',
          barColor: '#2563EB',
          badge: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
          label: 'Insufficient Info / Not Sure',
          defaultScore: null,
          icon: HelpCircle,
        };
      case 'unanswered':
      default:
        return {
          bg: 'bg-[#EFF6FF]',
          border: 'border-[#DBEAFE]',
          activeBorder: 'border-[#2563EB]',
          text: 'text-[#1D4ED8]',
          barColor: '#3B82F6',
          badge: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]',
          label: 'Unanswered (Info Needed)',
          defaultScore: null,
          icon: Clock,
        };
    }
  };

  const getScoreTextColor = (score: number | null) => {
    if (score === null) return 'text-[#1D4ED8]';
    if (score >= 72) return 'text-[#15803D]';
    if (score >= 45) return 'text-[#B45309]';
    return 'text-[#B91C1C]';
  };

  const getRatingBadgeClass = (rating: OverallHealthAssessment['overallRating']) => {
    if (rating === 'Healthy') return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    if (rating === 'Needs Attention') return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    if (rating === 'At Risk') return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
    return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
  };

  const getDetailForDimension = (key: HealthDimensionKey): DimensionScoreDetail | undefined => {
    return overallHealth?.dimensionScores?.find((d) => d.key === key);
  };

  const renderRadarChart = () => {
    const size = 310;
    const center = size / 2;
    const radius = 100;
    const count = DIMENSION_ORDER.length;
    const angleStep = (Math.PI * 2) / count;

    const points = DIMENSION_ORDER.map((key, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const status = healthInputs[key]?.status || 'unanswered';
      let factor = 0.06;
      if (status === 'healthy') factor = 1.0;
      else if (status === 'needs_attention') factor = 0.55;
      else if (status === 'not_sure') factor = 0.28;
      else if (status === 'at_risk') factor = 0.15;

      const r = radius * factor;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y, key, status };
    });

    const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <div className="flex flex-col items-center justify-center p-2">
        <svg width={size} height={size} className="overflow-visible">
          {[0.25, 0.5, 0.75, 1.0].map((level) => (
            <circle
              key={level}
              cx={center}
              cy={center}
              r={radius * level}
              fill="none"
              stroke="rgba(15, 23, 42, 0.14)"
              strokeDasharray={level < 1 ? '2 3' : 'none'}
              strokeWidth="1"
            />
          ))}

          {DIMENSION_ORDER.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x2 = center + radius * Math.cos(angle);
            const y2 = center + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="rgba(15, 23, 42, 0.14)"
                strokeWidth="1"
              />
            );
          })}

          <polygon
            points={polygonPoints}
            fill="rgba(37, 99, 235, 0.16)"
            stroke="#2563EB"
            strokeWidth="2"
          />

          {points.map((p, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelDist = radius + 27;
            const lx = center + labelDist * Math.cos(angle);
            const ly = center + labelDist * Math.sin(angle);
            const dotColor = getStatusStyle(p.status).barColor;

            return (
              <g key={p.key}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.2"
                  fill={dotColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor="middle"
                  className="text-[9.5px] font-bold fill-[#0F172A]"
                >
                  {SHORT_LABELS[p.key]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const answeredCount = DIMENSION_ORDER.filter(
    (k) => healthInputs[k]?.status && healthInputs[k].status !== 'unanswered'
  ).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Executive Navy Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#60A5FA]">
                [02] 12-Capability Diagnostic
              </span>
              <span className="text-[#94A3B8] text-xs font-medium">
                {profile.name || 'Active Business'} · {profile.industry}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Business Health &amp; Intelligence Assessment
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-2xl leading-relaxed">
              Rate all 12 commercial capabilities using current evidence. Healthy (100), Needs Attention (55), and At Risk (15) score confirmed health, while &ldquo;Not Sure&rdquo; isolates data visibility gaps without distorting confirmed scores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onRecalculateOverall}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Recalculate Score</span>
            </button>
            <button
              type="button"
              onClick={onProceedToRecommendations}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider shadow-sm transition whitespace-nowrap"
            >
              <span>Generate Coaching Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-[#CBD5E1]">
          <span>
            Completion Status:{' '}
            <strong className="text-white tabular-nums">{answeredCount} of 12 Capabilities Rated</strong>
          </span>
          <div className="w-56 bg-white/10 rounded-full h-2 overflow-hidden border border-white/15">
            <div
              className="bg-[#2563EB] h-full rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / 12) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* OVERALL BUSINESS HEALTH SUMMARY + TOP 3 PRIORITIES + RADAR + BAR CHART */}
      {overallHealth && (
        <div className="bg-white border border-[#0F172A]/12 rounded p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#0F172A]/10">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#2563EB]" />
                Overall Health Summary
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
                {overallHealth.scoreLabel}
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                {overallHealth.overallExplanation}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475569]">
                <span>
                  Assessed: <strong className="text-[#0F172A]">{overallHealth.assessmentDate}</strong>
                </span>
                <span>·</span>
                <span>
                  Rated: <strong className="text-[#0F172A] tabular-nums">{overallHealth.answeredCount ?? answeredCount}/12</strong>
                </span>
                <span>·</span>
                <span>
                  Data Visibility:{' '}
                  <strong className="text-[#0F172A] tabular-nums">
                    {overallHealth.dataVisibilityScore ?? 100}%
                  </strong>
                </span>
                <span>·</span>
                <span>
                  {overallHealth.isProvisional
                    ? 'Provisional (incomplete data or Not Sure responses present)'
                    : 'Confirmed Full 12-Capability Assessment'}
                </span>
              </div>
            </div>

            {/* Numeric Score Card */}
            <div className="bg-[#F8FAFC] px-7 py-5 rounded border border-[#0F172A]/12 text-center min-w-[190px] shrink-0">
              <span className="text-[11px] font-mono text-[#475569] uppercase tracking-wider font-bold block">
                Confirmed Health Score
              </span>
              <div
                className={`text-4xl font-bold mt-1 font-mono tabular-nums ${getScoreTextColor(
                  overallHealth.overallScore
                )}`}
              >
                {overallHealth.overallScore !== null ? overallHealth.overallScore : '—'}
                {overallHealth.overallScore !== null && (
                  <span className="text-xs font-normal text-[#475569]"> /100</span>
                )}
              </div>
              <span
                className={`text-[11px] font-bold px-3 py-0.5 rounded-full mt-2 inline-block border ${getRatingBadgeClass(
                  overallHealth.overallRating
                )}`}
              >
                {overallHealth.overallRating}
              </span>
            </div>
          </div>

          {/* Deterministic Top 3 Improvement Priorities */}
          {overallHealth.topThreePriorities && overallHealth.topThreePriorities.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[#2563EB]" />
                  Top 3 Improvement Priorities
                </span>
                <span className="text-[11px] text-[#475569]">
                  Ranked automatically by commercial severity &amp; cash impact
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {overallHealth.topThreePriorities.map((p) => {
                  const style = getStatusStyle(p.status);
                  return (
                    <div
                      key={p.key}
                      onClick={() => setExpandedDimension(p.key)}
                      className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:border-[#2563EB] cursor-pointer transition space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#0F172A] text-[#60A5FA] font-mono font-bold text-[11px]">
                          Priority #{p.rank}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-sm">{p.title}</h4>
                      <p className="text-[#475569] leading-relaxed">{p.rationale}</p>
                      <div className="pt-1.5 border-t border-[#0F172A]/10 text-[#0F172A]">
                        <strong className="text-[#2563EB]">Focus: </strong>
                        {p.recommendedFocus}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Radar Chart + Semantic Bar Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar */}
            <div className="bg-[#F8FAFC] rounded border border-[#0F172A]/10 p-5 flex flex-col items-center justify-between">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  12-Capability Balance Map
                </span>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#475569]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#15803D]" /> Healthy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> Attention
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> At Risk
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Insufficient Info
                  </span>
                </div>
              </div>
              {renderRadarChart()}
            </div>

            {/* Horizontal Dimension Score Bars */}
            <div className="bg-[#F8FAFC] rounded border border-[#0F172A]/10 p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-[#2563EB]" />
                  Capability Score Comparison
                </span>
                <span className="text-[11px] text-[#475569] font-mono tabular-nums">Scale 0–100</span>
              </div>

              <div className="space-y-2 pt-1">
                {DIMENSION_ORDER.map((key) => {
                  const item = healthInputs[key];
                  if (!item) return null;
                  const cfg = getStatusStyle(item.status);
                  const detail = getDetailForDimension(key);
                  const dimScore = detail ? detail.score : cfg.defaultScore;
                  const widthPct = dimScore === null ? 0 : Math.max(4, dimScore);

                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#0F172A] truncate pr-2">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
                          <span className="font-mono font-bold text-[#0F172A] tabular-nums w-8 text-right">
                            {dimScore === null ? '—' : `${dimScore}`}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: cfg.barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recharts Line Chart: Dimension Score Trajectory Over Last 3 Saved Sessions */}
          <div className="bg-[#F8FAFC] rounded border border-[#0F172A]/10 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                  Health Dimension Trajectory (Last 3 Saved Sessions)
                </span>
                <p className="text-[11px] text-[#475569] mt-0.5 tabular-nums">
                  Plotting {trajectoryData.length} of {resolvedSessions.length} saved business session
                  {resolvedSessions.length === 1 ? '' : 's'} · Confirmed scale 0–100 (Not Sure omitted)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded border border-[#0F172A]/10">
                {(Object.keys(TRAJECTORY_PRESETS) as TrajectoryPresetId[]).map((presetId) => {
                  const isActive = trajectoryPreset === presetId;
                  return (
                    <button
                      key={presetId}
                      type="button"
                      onClick={() => handleSelectPreset(presetId)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                        isActive
                          ? 'bg-[#0F172A] text-white'
                          : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {TRAJECTORY_PRESETS[presetId].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Dimension Series Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              {DIMENSION_ORDER.map((key) => {
                const selected = visibleDimensions.includes(key);
                const color = DIMENSION_COLORS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleToggleDimensionLine(key)}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                      selected
                        ? 'bg-white text-[#0F172A] border-[#0F172A]/25 shadow-2xs'
                        : 'bg-transparent text-[#64748B] border-[#0F172A]/10 hover:text-[#0F172A]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: selected ? color : '#CBD5E1' }}
                    />
                    <span>{SHORT_LABELS[key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="w-full h-[300px] bg-white rounded border border-[#0F172A]/10 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trajectoryData}
                  margin={{ top: 14, right: 22, left: -8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(15, 23, 42, 0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="sessionLabel"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: 'rgba(15, 23, 42, 0.16)' }}
                    tickLine={false}
                    padding={{ left: 24, right: 24 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 15, 45, 55, 72, 100]}
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(15, 23, 42, 0.16)' }}
                    tickLine={false}
                  />
                  <ReferenceLine
                    y={72}
                    stroke="#15803D"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                  />
                  <ReferenceLine
                    y={45}
                    stroke="#DC2626"
                    strokeDasharray="4 4"
                    strokeOpacity={0.45}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0]?.payload;
                      return (
                        <div className="bg-[#0F172A] text-white rounded border border-white/15 p-3 shadow-lg text-xs space-y-2 max-w-xs">
                          <div className="border-b border-white/15 pb-1.5">
                            <div className="font-bold text-white truncate">
                              {pt?.fullSessionName}
                              {pt?.isActive ? ' (Active)' : ''}
                              {pt?.isDemo ? ' · Sample Demo' : ''}
                            </div>
                            <div className="text-[11px] text-[#94A3B8] font-mono tabular-nums">
                              Updated {pt?.updatedAtLabel} · Overall:{' '}
                              {pt?.overallScore !== null && pt?.overallScore !== undefined
                                ? `${pt.overallScore}/100`
                                : 'Pending'}
                            </div>
                          </div>
                          <div className="space-y-1 tabular-nums">
                            {visibleDimensions.map((dimKey) => {
                              const val = pt?.[dimKey];
                              const st: HealthStatus = pt?.statuses?.[dimKey] || 'unanswered';
                              return (
                                <div
                                  key={dimKey}
                                  className="flex items-center justify-between gap-4 text-[11px]"
                                >
                                  <span className="flex items-center gap-1.5 text-[#E2E8F0]">
                                    <span
                                      className="w-2 h-2 rounded-xs shrink-0"
                                      style={{ backgroundColor: DIMENSION_COLORS[dimKey] }}
                                    />
                                    {SHORT_LABELS[dimKey]}
                                  </span>
                                  <span className="font-mono font-bold text-white">
                                    {val !== null && val !== undefined
                                      ? `${val}/100`
                                      : st === 'not_sure'
                                      ? 'Not Sure'
                                      : 'Unrated'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {visibleDimensions.map((dimKey) => (
                    <Line
                      key={dimKey}
                      type="monotone"
                      dataKey={dimKey}
                      name={SHORT_LABELS[dimKey]}
                      stroke={DIMENSION_COLORS[dimKey]}
                      strokeWidth={2.25}
                      dot={{ r: 4.5, strokeWidth: 1.5, fill: '#FFFFFF' }}
                      activeDot={{ r: 6.5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {trajectoryData.length < 2 && (
              <p className="text-[11px] text-[#475569]">
                Currently showing 1 saved session. Create or save additional business sessions from
                the Business Session bar above to compare dimension trends over up to 3 saved
                sessions.
              </p>
            )}
          </div>

          {/* Critical Risks, Strengths & Missing Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
              <span className="font-bold text-[#B91C1C] uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                Urgent Risks &amp; Bottlenecks
              </span>
              {overallHealth.criticalRisksIdentified.length > 0 ? (
                <ul className="space-y-1 text-[#0F172A]">
                  {overallHealth.criticalRisksIdentified.map((risk, i) => (
                    <li key={i}>• {risk}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#475569]">No At-Risk capabilities flagged from current answers.</p>
              )}
            </div>

            <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
              <span className="font-bold text-[#15803D] uppercase tracking-wider block">
                Core Strengths
              </span>
              {overallHealth.strongestAreas.length > 0 ? (
                <ul className="space-y-1 text-[#0F172A]">
                  {overallHealth.strongestAreas.map((area, i) => (
                    <li key={i}>• {area}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#475569]">Rate healthy capabilities above to surface operational strengths.</p>
              )}
            </div>

            <div className="p-4 rounded bg-[#EFF6FF] border border-[#BFDBFE] space-y-1.5">
              <span className="font-bold text-[#1D4ED8] uppercase tracking-wider block">
                Insufficient Info / Unverified Areas (Blue)
              </span>
              {overallHealth.missingEvidenceAreas.length > 0 ? (
                <ul className="space-y-1 text-[#0F172A]">
                  {overallHealth.missingEvidenceAreas.map((gap, i) => (
                    <li key={i}>• {gap}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#475569]">All 12 capabilities have confirmed evidence.</p>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[11px] text-[#475569]">
            <strong className="text-[#0F172A]">Scoring Safeguards: </strong>
            {overallHealth.scoringWeightRules}
          </div>
        </div>
      )}

      {/* THE TWELVE HEALTH CAPABILITIES INTERACTIVE CARDS */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2563EB]" />
            <span>The Twelve Business Health Capabilities</span>
          </h3>
          <span className="text-xs text-[#475569]">
            Select any capability to update status, see tailored {profile.industry} guidance, and enter evidence
          </span>
        </div>

        {DIMENSION_ORDER.map((key, index) => {
          const item = healthInputs[key];
          if (!item) return null;
          const statusConfig = getStatusStyle(item.status);
          const detail = getDetailForDimension(key);
          const isExpanded = expandedDimension === key;
          const Icon = statusConfig.icon;
          const dimScore = detail ? detail.score : statusConfig.defaultScore;

          return (
            <div
              key={key}
              className={`rounded border transition-all ${
                isExpanded
                  ? 'bg-white border-[#2563EB] shadow-sm'
                  : 'bg-white border-[#0F172A]/12 hover:border-[#0F172A]/30'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => setExpandedDimension(isExpanded ? null : key)}
                className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded bg-[#0F172A] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[#0F172A] text-sm">{item.title}</h4>
                    <p className="text-xs text-[#475569] line-clamp-1">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 shrink-0">
                  <span className="font-mono font-bold text-xs text-[#0F172A] tabular-nums bg-[#F8FAFC] px-2.5 py-1 rounded border border-[#0F172A]/12">
                    {dimScore === null ? '— / 100' : `${dimScore} / 100`}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusConfig.badge}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{statusConfig.label}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#475569]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#475569]" />
                  )}
                </div>
              </div>

              {/* Expanded Edit Form */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 border-t border-[#0F172A]/10 space-y-4">
                  {/* Adaptive Industry & Team-Size Guidance */}
                  <div className="p-3.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#0F172A] flex items-start gap-2">
                    <Compass className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1D4ED8] uppercase tracking-wider text-[10px] block mb-0.5">
                        Tailored Diagnostic Prompt ({profile.industry}):
                      </strong>
                      {getAdaptiveGuidancePrompt(key, profile)}
                    </div>
                  </div>

                  {/* 6-Part Capability Diagnostic Card Breakdown */}
                  {detail && (
                    <div className={`p-4 rounded border text-xs leading-relaxed ${statusConfig.bg} ${statusConfig.border} text-[#0F172A] space-y-2.5`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/10">
                        <strong className={`${statusConfig.text} uppercase tracking-wider text-[11px]`}>
                          {statusConfig.label} · {detail.score !== null ? `${detail.score}/100` : 'Excluded from Confirmed Score'}
                        </strong>
                        <span className="text-[11px] font-mono text-[#475569] uppercase">
                          Evidence Basis: {item.evidenceType.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
                        <div className="p-2.5 rounded bg-white/80 border border-black/8">
                          <strong className="text-[#0F172A] block uppercase text-[10px] tracking-wider">1. What Is Measured</strong>
                          <span className="text-[#334155]">{detail.whatMeasured || item.description}</span>
                        </div>
                        <div className="p-2.5 rounded bg-white/80 border border-black/8">
                          <strong className="text-[#0F172A] block uppercase text-[10px] tracking-wider">2. Why It Matters Commercially</strong>
                          <span className="text-[#334155]">{detail.whyMatters || detail.explanation}</span>
                        </div>
                        <div className="p-2.5 rounded bg-white/80 border border-black/8">
                          <strong className="text-[#0F172A] block uppercase text-[10px] tracking-wider">3. Evidence Used</strong>
                          <span className="text-[#334155]">{detail.evidenceUsed || item.notes || 'No owner notes entered yet.'}</span>
                        </div>
                        <div className="p-2.5 rounded bg-white/80 border border-black/8">
                          <strong className={`${statusConfig.text} block uppercase text-[10px] tracking-wider`}>4. Gap Diagnosis (Info vs Risk)</strong>
                          <span className="text-[#334155]">{detail.gapDiagnosis || detail.explanation}</span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-black/10 text-[11px]">
                        <strong className="text-[#1D4ED8] uppercase text-[10px] tracking-wider mr-1.5">5. Actionable Next Step:</strong>
                        <span className="text-[#0F172A] font-medium">{detail.recommendedStep || detail.explanation}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-[#0F172A] block mb-2">
                      Rate Current Business State for {item.title}:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['healthy', 'needs_attention', 'at_risk', 'not_sure'] as HealthStatus[]).map(
                        (st) => {
                          const cfg = getStatusStyle(st);
                          const isSelected = item.status === st;
                          const StIcon = cfg.icon;

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(key, st)}
                              className={`p-3 rounded border text-left flex items-center space-x-2 transition ${
                                isSelected
                                  ? `${cfg.bg} ${cfg.activeBorder} ring-1 ring-[#2563EB]/30 ${cfg.text} font-bold shadow-2xs`
                                  : 'bg-[#FCFCFC] border-[#0F172A]/12 text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                              }`}
                            >
                              <StIcon
                                className={`w-4 h-4 shrink-0 ${isSelected ? cfg.text : 'text-[#475569]'}`}
                              />
                              <span className="text-xs">{cfg.label}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Evidence Basis & Written Explanation Note */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#0F172A]">
                        Owner&apos;s Evidence &amp; Notes:
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#475569]">Basis:</span>
                        <select
                          value={item.evidenceType}
                          onChange={(e) =>
                            handleEvidenceTypeChange(
                              key,
                              e.target.value as HealthDimensionInput['evidenceType']
                            )
                          }
                          aria-label={`Evidence basis for ${item.title}`}
                          className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        >
                          <option value="verified">Verified Records</option>
                          <option value="owner_reported">Owner Reported</option>
                          <option value="assumption">Working Assumption</option>
                          <option value="hypothesis">Initial Hypothesis</option>
                          <option value="unknown">Unverified / Unknown</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={item.notes}
                      onChange={(e) => handleNotesChange(key, e.target.value)}
                      placeholder={`Describe concrete facts or bottlenecks in ${item.title.toLowerCase()}...`}
                      className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-4 py-2.5 text-xs text-[#0F172A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
