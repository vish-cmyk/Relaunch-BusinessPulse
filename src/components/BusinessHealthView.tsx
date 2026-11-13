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
  Layers
} from 'lucide-react';
import { 
  HealthDimensionKey, 
  HealthDimensionInput, 
  HealthStatus, 
  OverallHealthAssessment, 
  BusinessProfile 
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

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return {
          bg: 'bg-[#ECFDF5]',
          border: 'border-[#A7F3D0]',
          activeBorder: 'border-[#15803D]',
          text: 'text-[#15803D]',
          badge: 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]',
          label: 'Healthy',
          icon: CheckCircle2,
        };
      case 'needs_attention':
        return {
          bg: 'bg-[#FFFBEB]',
          border: 'border-[#FDE68A]',
          activeBorder: 'border-[#B45309]',
          text: 'text-[#B45309]',
          badge: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
          label: 'Needs Attention',
          icon: AlertTriangle,
        };
      case 'at_risk':
        return {
          bg: 'bg-[#FEF2F2]',
          border: 'border-[#FECACA]',
          activeBorder: 'border-[#B91C1C]',
          text: 'text-[#B91C1C]',
          badge: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
          label: 'At Risk',
          icon: AlertOctagon,
        };
      case 'not_sure':
        return {
          bg: 'bg-[#F1F5F9]',
          border: 'border-[#CBD5E1]',
          activeBorder: 'border-[#475569]',
          text: 'text-[#475569]',
          badge: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
          label: 'Not Sure / No Data',
          icon: HelpCircle,
        };
      case 'unanswered':
      default:
        return {
          bg: 'bg-[#F8FAFC]',
          border: 'border-[#E2E8F0]',
          activeBorder: 'border-[#94A3B8]',
          text: 'text-[#64748B]',
          badge: 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]',
          label: 'Unanswered',
          icon: Clock,
        };
    }
  };

  // Radar / Spider Chart SVG generator for 8 dimensions
  const renderRadarChart = () => {
    const size = 260;
    const center = size / 2;
    const radius = 95;
    const count = DIMENSION_ORDER.length;
    const angleStep = (Math.PI * 2) / count;

    const points = DIMENSION_ORDER.map((key, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const status = healthInputs[key]?.status || 'unanswered';
      let factor = 0;
      if (status === 'healthy') factor = 1.0;
      else if (status === 'needs_attention') factor = 0.55;
      else if (status === 'not_sure') factor = 0.35;
      else if (status === 'at_risk') factor = 0.2;
      else factor = 0.08;

      const r = radius * factor;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y, key, status };
    });

    const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <div className="flex flex-col items-center justify-center p-2">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Concentric Circles */}
          {[0.25, 0.5, 0.75, 1.0].map((level) => (
            <circle
              key={level}
              cx={center}
              cy={center}
              r={radius * level}
              fill="none"
              stroke="#E2E8F0"
              strokeDasharray={level < 1 ? '2 3' : 'none'}
              strokeWidth="1"
            />
          ))}

          {/* Spokes */}
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
                stroke="#E2E8F0"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Polygon Area */}
          <polygon
            points={polygonPoints}
            fill="rgba(22, 140, 131, 0.18)"
            stroke="#168C83"
            strokeWidth="2"
          />

          {/* Dots & Labels */}
          {points.map((p, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelDist = radius + 22;
            const lx = center + labelDist * Math.cos(angle);
            const ly = center + labelDist * Math.sin(angle);

            return (
              <g key={p.key}>
                <circle cx={p.x} cy={p.y} r="4" fill="#168C83" stroke="#FFFFFF" strokeWidth="2" />
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor="middle"
                  className="text-[10px] font-bold uppercase fill-[#14283F] font-mono tracking-tighter"
                >
                  {p.key.substring(0, 4)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const answeredCount = DIMENSION_ORDER.filter(k => healthInputs[k]?.status !== 'unanswered').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Context Card */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#E6F4F2] text-[#168C83] border border-[#168C83]/30">
                Phase 2: Commercial Diagnostics
              </span>
              <span className="text-[#64748B] text-xs">8 Dimensions + Executive Score</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#14283F] tracking-tight">
              Business Health Assessment
            </h2>
            <p className="text-sm text-[#64748B] max-w-2xl leading-relaxed">
              Rate each of the 8 commercial dimensions based on current operational evidence. This forms the factual baseline for your turnaround strategy.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onRecalculateOverall}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F5F6F3] text-[#14283F] text-xs font-semibold border border-[#CBD5E1] transition shadow-2xs"
              title="Recalculate overall score based on current inputs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#168C83]" />
              <span>Update Score</span>
            </button>
            <button
              onClick={onProceedToRecommendations}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#168C83] hover:bg-[#12726B] text-white text-xs font-bold shadow-xs transition"
            >
              <span>View Recommendations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="mt-6 pt-5 border-t border-[#E5EBEF] flex items-center justify-between text-xs text-[#64748B]">
          <span>Assessment Progress: <strong className="text-[#14283F]">{answeredCount} of 8 Dimensions Completed</strong></span>
          <div className="w-48 bg-[#F1F5F9] rounded-full h-2.5 overflow-hidden border border-[#E2E8F0]">
            <div 
              className="bg-[#168C83] h-full rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* OVERALL BUSINESS HEALTH GRAPHICAL SUMMARY */}
      {overallHealth && (
        <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#E5EBEF]">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#168C83] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#168C83]" />
                Executive Summary: Overall Commercial Health
              </span>
              <h3 className="text-2xl font-extrabold text-[#14283F]">
                {overallHealth.scoreLabel}
              </h3>
              <p className="text-xs text-[#64748B] max-w-xl">
                Assessment Date: <strong className="text-[#14283F]">{overallHealth.assessmentDate}</strong> · 
                Status: <span className="text-[#14283F] font-bold">{overallHealth.overallRating}</span> · 
                {overallHealth.isProvisional ? ' (Provisional: Incomplete inputs or unverified debtor data)' : ' (Confirmed)'}
              </p>
            </div>

            {/* Score Badge */}
            <div className="flex items-center space-x-6">
              <div className="text-center bg-[#F8FAFC] px-6 py-4 rounded-2xl border border-[#E5EBEF] shadow-2xs min-w-[150px]">
                <span className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold block">Overall Score</span>
                <div className={`text-4xl font-extrabold mt-1 font-mono tabular-nums ${
                  overallHealth.overallScore >= 70 ? 'text-[#15803D]' :
                  overallHealth.overallScore >= 45 ? 'text-[#B45309]' : 'text-[#B91C1C]'
                }`}>
                  {overallHealth.overallScore}
                  <span className="text-xs font-normal text-[#64748B]"> /100</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1.5 inline-block border ${
                  overallHealth.overallRating === 'Healthy' ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]' :
                  overallHealth.overallRating === 'Needs Attention' ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' : 
                  'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                }`}>
                  {overallHealth.overallRating}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Radar & Diagnostic Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Visual Radar Graphic */}
            <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5EBEF] p-5 flex flex-col items-center">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                8-Dimension Equilibrium
              </span>
              {renderRadarChart()}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-[11px] text-[#64748B]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#15803D]"></span> Healthy</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#D99A35]"></span> Needs Attention</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#B91C1C]"></span> At Risk</span>
              </div>
            </div>

            {/* Diagnostic Breakdown */}
            <div className="lg:col-span-2 space-y-4 text-xs">
              {/* Critical Risks */}
              <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
                <span className="font-bold text-[#B91C1C] uppercase tracking-wider block flex items-center gap-1.5 text-xs">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Most Urgent Vulnerabilities / Bottlenecks:
                </span>
                <ul className="space-y-1 text-[#14283F]">
                  {overallHealth.criticalRisksIdentified.map((risk, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#B91C1C] font-bold">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Strongest Areas & Missing Evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
                  <span className="font-bold text-[#15803D] uppercase tracking-wider block text-xs">
                    Core Operational Strengths:
                  </span>
                  <ul className="space-y-1 text-[#14283F]">
                    {overallHealth.strongestAreas.map((area, i) => (
                      <li key={i}>• {area}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-1">
                  <span className="font-bold text-[#475569] uppercase tracking-wider block text-xs">
                    Information Gaps / Missing Data:
                  </span>
                  <ul className="space-y-1 text-[#14283F]">
                    {overallHealth.missingEvidenceAreas.map((gap, i) => (
                      <li key={i}>• {gap}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Scoring Rules Explanation */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E5EBEF] text-[11px] text-[#64748B]">
                <strong className="text-[#14283F]">Weighting & Non-Averaging Rules: </strong>
                {overallHealth.scoringWeightRules}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THE EIGHT HEALTH DIMENSIONS INPUT ACCORDION / LIST */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base font-bold text-[#14283F] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#168C83]" />
            <span>The Eight Health Dimensions (Owner-Reported Inputs)</span>
          </h3>
          <span className="text-xs text-[#64748B]">Click any dimension to update status and notes</span>
        </div>

        {DIMENSION_ORDER.map((key, index) => {
          const item = healthInputs[key];
          const statusConfig = getStatusColor(item.status);
          const isExpanded = expandedDimension === key;
          const Icon = statusConfig.icon;

          return (
            <div
              key={key}
              className={`rounded-2xl border transition-all ${
                isExpanded ? 'bg-white border-[#168C83]/50 shadow-sm' : 'bg-white border-[#E5EBEF] hover:border-[#CBD5E1]'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => setExpandedDimension(isExpanded ? null : key)}
                className="p-5 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-[#F8FAFC] text-[#14283F] font-bold text-xs flex items-center justify-center border border-[#E5EBEF]">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-[#14283F] text-sm">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#64748B] line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusConfig.badge}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{statusConfig.label}</span>
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                </div>
              </div>

              {/* Expanded Edit Form */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 border-t border-[#E5EBEF] space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#14283F] block mb-2">
                      Select Health Status for this Dimension:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['healthy', 'needs_attention', 'at_risk', 'not_sure'] as HealthStatus[]).map((st) => {
                        const cfg = getStatusColor(st);
                        const isSelected = item.status === st;
                        const StIcon = cfg.icon;

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              handleStatusChange(key, st);
                            }}
                            className={`p-3 rounded-xl border text-left flex items-center space-x-2 transition ${
                              isSelected
                                ? `${cfg.bg} ${cfg.activeBorder} ring-2 ring-[#168C83]/20 ${cfg.text} font-bold shadow-2xs`
                                : 'bg-[#F8FAFC] border-[#E5EBEF] text-[#64748B] hover:text-[#14283F] hover:bg-[#F1F5F9]'
                            }`}
                          >
                            <StIcon className={`w-4 h-4 ${isSelected ? cfg.text : 'text-[#64748B]'}`} />
                            <span className="text-xs">{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Written Explanation Note */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#14283F] flex items-center justify-between">
                      <span>Owner's Context & Specific Operational Evidence:</span>
                      <span className="text-[11px] text-[#64748B]">Optional but strongly recommended for AI diagnostic accuracy</span>
                    </label>
                    <textarea
                      rows={2}
                      value={item.notes}
                      onChange={(e) => handleNotesChange(key, e.target.value)}
                      placeholder={`Describe what is happening in ${item.title.toLowerCase()}...`}
                      className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-xs text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#168C83]"
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
