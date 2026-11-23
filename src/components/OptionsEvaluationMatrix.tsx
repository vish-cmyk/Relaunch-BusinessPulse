import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Calculator,
  Info,
} from 'lucide-react';
import { GROWTH_OPTIONS_EVALUATION } from '../data/coachingBriefing';
import { CaseRecord } from '../types/bizpulse';

interface OptionsEvaluationMatrixProps {
  caseRecord?: CaseRecord;
}

export const OptionsEvaluationMatrix: React.FC<OptionsEvaluationMatrixProps> = ({
  caseRecord,
}) => {
  const isDemo = caseRecord?.profile?.isDemonstrationCase ?? true;
  const profile = caseRecord?.profile;
  const currency = profile?.currency || 'NZD';
  const [selectedOptionId, setSelectedOptionId] = useState<'Option A' | 'Option B' | 'Option C'>(
    'Option C'
  );

  const selectedOption =
    GROWTH_OPTIONS_EVALUATION.find((o) => o.id === selectedOptionId) ||
    GROWTH_OPTIONS_EVALUATION[2];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Charcoal Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#FBBF24]">
                Capital Allocation &amp; Trade-Off Analysis
              </span>
              <span className="text-[#A1A1AA] text-xs font-medium">
                {isDemo ? 'NZ MSP Benchmark Scenario' : `Reference Decision Model for ${profile?.name || 'Active Business'}`}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Growth Investment Decision Matrix
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed">
              Test capital commitments before spending cash: Marketing Agency vs. Hiring Sales vs. Core Margin &amp; Liquidity Stabilization.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(['Option A', 'Option B', 'Option C'] as const).map((optId) => (
              <button
                key={optId}
                type="button"
                onClick={() => setSelectedOptionId(optId)}
                className={`px-3.5 py-2 rounded text-xs font-bold transition ${
                  selectedOptionId === optId
                    ? 'bg-[#D97706] text-white border border-[#D97706]'
                    : 'bg-white/10 text-[#D4D4D8] hover:text-white border border-white/15'
                }`}
              >
                {optId}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!isDemo && (
        <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <span>
            This framework illustrates how commercial coaching evaluates growth spending ({currency} outlays vs. pay-back thresholds) when cash headroom is tight. For advice tailored specifically to <strong>{profile?.name}</strong>, review the <strong>Coaching &amp; Actions</strong> tab or ask in the <strong>AI Coach</strong> tab.
          </span>
        </div>
      )}

      {/* 3 Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROWTH_OPTIONS_EVALUATION.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => setSelectedOptionId(opt.id)}
              className={`p-5 rounded cursor-pointer transition-all border flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-[#D97706] shadow-md ring-1 ring-[#D97706]/30'
                  : 'bg-white border-[#111113]/12 hover:border-[#111113]/30'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-[#111113] text-[#FBBF24] font-mono">
                    {opt.id}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      opt.id === 'Option C'
                        ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                        : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                    }`}
                  >
                    {opt.id === 'Option C' ? 'Lower Risk First' : 'Defer Until Cash Safe'}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-[#111113] text-sm line-clamp-2">{opt.title}</h3>
                  <p className="text-xs text-[#52525B] mt-1 line-clamp-2">{opt.proposedAction}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#111113]/10 space-y-1.5 text-xs tabular-nums">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#52525B]">Upfront Cash:</span>
                  <span className="text-[#111113] font-mono font-bold">
                    {opt.id === 'Option A'
                      ? `${currency} 20,000`
                      : opt.id === 'Option B'
                      ? `${currency} 15k–20k setup`
                      : `${currency} 0`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#52525B]">Ongoing Outlay:</span>
                  <span className="text-[#111113] font-mono font-semibold">
                    {opt.id === 'Option A'
                      ? `${currency} 3k–6k/mo`
                      : opt.id === 'Option B'
                      ? `~${currency} 7,460/mo`
                      : 'Management Focus'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Option Detail */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded bg-[#111113] text-[#FBBF24] font-mono font-bold text-sm">
                {selectedOption.id}
              </span>
              <h3 className="text-xl font-bold text-[#111113]">{selectedOption.title}</h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1.5 max-w-3xl leading-relaxed">
              {selectedOption.proposedAction}
            </p>
          </div>

          <div className="text-xs font-mono bg-[#F8F7F4] px-4 py-2.5 rounded border border-[#111113]/15 shrink-0">
            <span className="text-[#52525B] block text-[10px] uppercase font-bold">
              Cash Commitment
            </span>
            <span className="text-[#111113] font-bold">{selectedOption.upfrontCashRequirement}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
            <h4 className="font-bold text-[#15803D] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle className="w-4 h-4" />
              What Must Be True
            </h4>
            <ul className="space-y-1.5 text-[#111113]">
              {selectedOption.whatMustBeTrue.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
            <h4 className="font-bold text-[#B45309] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              Assumptions to Verify First
            </h4>
            <ul className="space-y-1.5 text-[#111113]">
              {selectedOption.commercialAssumptionsToTest.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2">
            <h4 className="font-bold text-[#D97706] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              Timeframe to Positive Cash Return
            </h4>
            <p className="text-[#111113] leading-relaxed">{selectedOption.routeToRevenueAndCash}</p>
          </div>

          <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-2">
            <h4 className="font-bold text-[#B91C1C] text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              Principal Commercial Risks
            </h4>
            <ul className="space-y-1.5 text-[#111113]">
              {selectedOption.principalRisks.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2.5 text-xs">
          <div className="flex items-center space-x-2 text-[#111113] font-bold text-sm">
            <Calculator className="w-4 h-4 text-[#D97706]" />
            <span>Break-Even Formula</span>
          </div>
          <div className="p-3 bg-white rounded font-mono text-[#111113] border border-[#111113]/15">
            {selectedOption.calculationFramework.formula}
          </div>
          <p className="text-[#52525B] leading-relaxed">
            {selectedOption.calculationFramework.explanation}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded space-y-1">
            <span className="font-bold text-[#15803D] uppercase tracking-wider block">
              Approval Conditions
            </span>
            <ul className="space-y-1 text-[#111113]">
              {selectedOption.approvalConditions.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
          <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded space-y-1">
            <span className="font-bold text-[#B45309] uppercase tracking-wider block">
              Deferral Conditions
            </span>
            <ul className="space-y-1 text-[#111113]">
              {selectedOption.deferralConditions.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
          <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded space-y-1">
            <span className="font-bold text-[#B91C1C] uppercase tracking-wider block">
              Rejection Conditions
            </span>
            <ul className="space-y-1 text-[#111113]">
              {selectedOption.rejectionConditions.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
