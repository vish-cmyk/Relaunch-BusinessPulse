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
} from 'lucide-react';
import {
  HealthDimensionKey,
  HealthDimensionInput,
  HealthStatus,
  OverallHealthAssessment,
  BusinessProfile,
  DimensionScoreDetail,
} from '../types/bizpulse';

interface BusinessHealthViewProps {
  profile: BusinessProfile;
  healthInputs: Record<HealthDimensionKey, HealthDimensionInput>;
  overallHealth: OverallHealthAssessment | null;
  onUpdateInput: (key: HealthDimensionKey, updated: HealthDimensionInput) => void;
  onRecalculateOverall: () => void;
  onProceedToRecommendations: () => void;
}

const DIMENSION_ORDER: HealthDimensionKey[] = [
  'direction',
  'customers',
  'sales',
  'money',
  'operations',
  'people',
  'ownerDependency',
  'technology',
];

const SHORT_LABELS: Record<HealthDimensionKey, string> = {
  direction: 'Direction',
  customers: 'Customers',
  sales: 'Sales',
  money: 'Money',
  operations: 'Operations',
  people: 'People',
  ownerDependency: 'Owner Dep.',
  technology: 'Tech & Data',
};

export const BusinessHealthView: React.FC<BusinessHealthViewProps> = ({
  profile,
  healthInputs,
  overallHealth,
  onUpdateInput,
  onRecalculateOverall,
  onProceedToRecommendations,
}) => {
  const [expandedDimension, setExpandedDimension] = useState<HealthDimensionKey | null>('money');

  const handleStatusChange = (key: HealthDimensionKey, status: HealthStatus) => {
    const current = healthInputs[key];
    onUpdateInput(key, { ...current, status });
  };

  const handleNotesChange = (key: HealthDimensionKey, notes: string) => {
    const current = healthInputs[key];
    onUpdateInput(key, { ...current, notes });
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
          bg: 'bg-[#F1F5F9]',
          border: 'border-[#CBD5E1]',
          activeBorder: 'border-[#475569]',
          text: 'text-[#475569]',
          barColor: '#64748B',
          badge: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
          label: 'Not Sure / No Data',
          defaultScore: 40,
          icon: HelpCircle,
        };
      case 'unanswered':
      default:
        return {
          bg: 'bg-[#F8FAFC]',
          border: 'border-[#E2E8F0]',
          activeBorder: 'border-[#94A3B8]',
          text: 'text-[#64748B]',
          barColor: '#94A3B8',
          badge: 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]',
          label: 'Unanswered',
          defaultScore: null,
          icon: Clock,
        };
    }
  };

  const getScoreTextColor = (score: number | null) => {
    if (score === null) return 'text-[#475569]';
    if (score >= 72) return 'text-[#15803D]';
    if (score >= 45) return 'text-[#B45309]';
    return 'text-[#B91C1C]';
  };

  const getRatingBadgeClass = (rating: OverallHealthAssessment['overallRating']) => {
    if (rating === 'Healthy') return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    if (rating === 'Needs Attention') return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    if (rating === 'At Risk') return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
    return 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
  };

  const getDetailForDimension = (key: HealthDimensionKey): DimensionScoreDetail | undefined => {
    return overallHealth?.dimensionScores?.find((d) => d.key === key);
  };

  const renderRadarChart = () => {
    const size = 250;
    const center = size / 2;
    const radius = 88;
    const count = DIMENSION_ORDER.length;
    const angleStep = (Math.PI * 2) / count;

    const points = DIMENSION_ORDER.map((key, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const status = healthInputs[key]?.status || 'unanswered';
      let factor = 0.05;
      if (status === 'healthy') factor = 1.0;
      else if (status === 'needs_attention') factor = 0.55;
      else if (status === 'not_sure') factor = 0.4;
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
              stroke="#CBD5E1"
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
                stroke="#CBD5E1"
                strokeWidth="1"
              />
            );
          })}

          <polygon
            points={polygonPoints}
            fill="rgba(29, 78, 216, 0.16)"
            stroke="#1D4ED8"
            strokeWidth="2"
          />

          {points.map((p, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelDist = radius + 24;
            const lx = center + labelDist * Math.cos(angle);
            const ly = center + labelDist * Math.sin(angle);
            const dotColor = getStatusStyle(p.status).barColor;

            return (
              <g key={p.key}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill={dotColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor="middle"
                  className="text-[10px] font-bold fill-[#0B1324]"
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
    (k) => healthInputs[k]?.status !== 'unanswered'
  ).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Black-to-Blue Hero Header Card */}
      <div className="bizpulse-hero-gradient text-white rounded-2xl p-6 sm:p-8 shadow-md border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#1D4ED8] text-white">
                Step 2: 8-Dimension Business Health Check
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">
                {profile.name || 'Active Business'} · {profile.industry}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Business Health Assessment
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-2xl leading-relaxed">
              Rate every dimension honestly using your current evidence. Healthy (100), Needs Attention (55), At Risk (15), or Not Sure (40) immediately updates your overall score, semantic risk indicators, and coaching priorities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onRecalculateOverall}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#93C5FD]" />
              <span>Recalculate Score</span>
            </button>
            <button
              type="button"
              onClick={onProceedToRecommendations}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-bold shadow-sm transition border border-white/15"
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
            <strong className="text-white tabular-nums">{answeredCount} of 8 Dimensions Rated</strong>
          </span>
          <div className="w-56 bg-white/10 rounded-full h-2.5 overflow-hidden border border-white/15">
            <div
              className="bg-[#60A5FA] h-full rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* OVERALL BUSINESS HEALTH SUMMARY + RADAR + BAR CHART */}
      {overallHealth && (
        <div className="bg-white border border-[#D9E2F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#E8EEF7]">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#1D4ED8]" />
                Overall Health Summary
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1324]">
                {overallHealth.scoreLabel}
              </h3>
              <p className="text-xs sm:text-sm text-[#52627A] leading-relaxed">
                {overallHealth.overallExplanation}
              </p>
              <p className="text-xs text-[#52627A]">
                Assessed: <strong className="text-[#0B1324]">{overallHealth.assessmentDate}</strong> ·
                Rated: <strong className="text-[#0B1324] tabular-nums">{overallHealth.answeredCount}/8</strong> ·{' '}
                {overallHealth.isProvisional
                  ? 'Provisional (incomplete data or Not Sure responses present)'
                  : 'Confirmed Full 8-Dimension Assessment'}
              </p>
            </div>

            {/* Numeric Score Card */}
            <div className="bg-[#F3F6FB] px-7 py-5 rounded-2xl border border-[#D9E2F0] text-center min-w-[180px] shrink-0">
              <span className="text-[11px] text-[#52627A] uppercase tracking-wider font-bold block">
                Overall Health Score
              </span>
              <div
                className={`text-4xl font-extrabold mt-1 font-mono tabular-nums ${getScoreTextColor(
                  overallHealth.overallScore
                )}`}
              >
                {overallHealth.overallScore !== null ? overallHealth.overallScore : '—'}
                {overallHealth.overallScore !== null && (
                  <span className="text-xs font-normal text-[#52627A]"> /100</span>
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

          {/* Radar Chart + Semantic Bar Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar */}
            <div className="bg-[#F8FAFC] rounded-2xl border border-[#E8EEF7] p-5 flex flex-col items-center justify-between">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#0B1324] uppercase tracking-wider">
                  8-Dimension Balance Map
                </span>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#52627A]">
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
                    <span className="w-2.5 h-2.5 rounded-full bg-[#64748B]" /> Unclear
                  </span>
                </div>
              </div>
              {renderRadarChart()}
            </div>

            {/* Horizontal Dimension Score Bars */}
            <div className="bg-[#F8FAFC] rounded-2xl border border-[#E8EEF7] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0B1324] uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-[#1D4ED8]" />
                  Dimension Score Comparison
                </span>
                <span className="text-[11px] text-[#52627A] tabular-nums">Scale 0–100</span>
              </div>

              <div className="space-y-2.5 pt-1">
                {DIMENSION_ORDER.map((key) => {
                  const item = healthInputs[key];
                  const cfg = getStatusStyle(item.status);
                  const detail = getDetailForDimension(key);
                  const dimScore = detail ? detail.score : cfg.defaultScore;
                  const widthPct = dimScore === null ? 0 : Math.max(4, dimScore);

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#0B1324] truncate pr-2">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] font-bold ${cfg.text}`}>{cfg.label}</span>
                          <span className="font-mono font-bold text-[#0B1324] tabular-nums w-10 text-right">
                            {dimScore === null ? '—' : `${dimScore}`}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
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

          {/* Critical Risks, Strengths & Missing Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
              <span className="font-bold text-[#B91C1C] uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                Urgent Risks &amp; Bottlenecks
              </span>
              {overallHealth.criticalRisksIdentified.length > 0 ? (
                <ul className="space-y-1 text-[#0B1324]">
                  {overallHealth.criticalRisksIdentified.map((risk, i) => (
                    <li key={i}>• {risk}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#52627A]">No At-Risk dimensions flagged from current answers.</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
              <span className="font-bold text-[#15803D] uppercase tracking-wider block">
                Core Strengths
              </span>
              {overallHealth.strongestAreas.length > 0 ? (
                <ul className="space-y-1 text-[#0B1324]">
                  {overallHealth.strongestAreas.map((area, i) => (
                    <li key={i}>• {area}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#52627A]">Rate healthy pillars above to surface operational strengths.</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-1.5">
              <span className="font-bold text-[#475569] uppercase tracking-wider block">
                Missing / Unverified Areas
              </span>
              {overallHealth.missingEvidenceAreas.length > 0 ? (
                <ul className="space-y-1 text-[#0B1324]">
                  {overallHealth.missingEvidenceAreas.map((gap, i) => (
                    <li key={i}>• {gap}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#52627A]">All 8 dimensions have direct owner ratings.</p>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0] text-[11px] text-[#52627A]">
            <strong className="text-[#0B1324]">Scoring Safeguards: </strong>
            {overallHealth.scoringWeightRules}
          </div>
        </div>
      )}

      {/* THE EIGHT HEALTH DIMENSIONS INTERACTIVE CARDS */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <h3 className="text-base font-bold text-[#0B1324] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#1D4ED8]" />
            <span>The Eight Commercial Health Dimensions</span>
          </h3>
          <span className="text-xs text-[#52627A]">
            Select any parameter to update status, view score explanation, and enter evidence
          </span>
        </div>

        {DIMENSION_ORDER.map((key, index) => {
          const item = healthInputs[key];
          const statusConfig = getStatusStyle(item.status);
          const detail = getDetailForDimension(key);
          const isExpanded = expandedDimension === key;
          const Icon = statusConfig.icon;
          const dimScore = detail ? detail.score : statusConfig.defaultScore;

          return (
            <div
              key={key}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? 'bg-white border-[#1D4ED8]/50 shadow-sm'
                  : 'bg-white border-[#D9E2F0] hover:border-[#93C5FD]'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => setExpandedDimension(isExpanded ? null : key)}
                className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[#0B1324] text-sm">{item.title}</h4>
                    <p className="text-xs text-[#52627A] line-clamp-1">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 shrink-0">
                  <span className="font-mono font-bold text-xs text-[#0B1324] tabular-nums bg-[#F3F6FB] px-2.5 py-1 rounded-lg border border-[#D9E2F0]">
                    {dimScore === null ? '— / 100' : `${dimScore} / 100`}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusConfig.badge}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{statusConfig.label}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#52627A]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#52627A]" />
                  )}
                </div>
              </div>

              {/* Expanded Edit Form */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 border-t border-[#E8EEF7] space-y-4">
                  {/* Plain-English Diagnostic Explanation */}
                  {detail && (
                    <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${statusConfig.bg} ${statusConfig.border} text-[#0B1324]`}>
                      <strong className={`${statusConfig.text} uppercase tracking-wider text-[11px] block mb-0.5`}>
                        Diagnostic Assessment ({statusConfig.label}):
                      </strong>
                      {detail.explanation}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-[#0B1324] block mb-2">
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
                              className={`p-3 rounded-xl border text-left flex items-center space-x-2 transition ${
                                isSelected
                                  ? `${cfg.bg} ${cfg.activeBorder} ring-2 ring-[#1D4ED8]/20 ${cfg.text} font-bold shadow-2xs`
                                  : 'bg-[#F8FAFC] border-[#D9E2F0] text-[#52627A] hover:text-[#0B1324] hover:bg-[#F3F6FB]'
                              }`}
                            >
                              <StIcon
                                className={`w-4 h-4 shrink-0 ${isSelected ? cfg.text : 'text-[#52627A]'}`}
                              />
                              <span className="text-xs">{cfg.label}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Written Explanation Note */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#0B1324] flex flex-wrap items-center justify-between gap-2">
                      <span>Owner&apos;s Evidence &amp; Notes:</span>
                      <span className="text-[11px] text-[#52627A]">
                        Included in coaching analysis &amp; downloadable reports
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={item.notes}
                      onChange={(e) => handleNotesChange(key, e.target.value)}
                      placeholder={`Describe concrete facts or bottlenecks in ${item.title.toLowerCase()}...`}
                      className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-xs text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
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
