import React, { useState } from 'react';
import { ArrowRight, Check, Compass } from 'lucide-react';
import { BIZPULSE_VISION, GROWTH_ROADMAP_PILLARS } from '../data/growthRoadmap';

interface GrowthRoadmapViewProps {
  onNavigateTab?: (tabId: string) => void;
  businessName?: string;
}

export const GrowthRoadmapView: React.FC<GrowthRoadmapViewProps> = ({
  onNavigateTab,
  businessName,
}) => {
  const [selectedPillarId, setSelectedPillarId] = useState<string>('all');

  const visiblePillars =
    selectedPillarId === 'all'
      ? GROWTH_ROADMAP_PILLARS
      : GROWTH_ROADMAP_PILLARS.filter((p) => p.id === selectedPillarId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Charcoal Editorial Hero */}
      <section className="bizpulse-hero-gradient text-white rounded p-6 sm:p-10 border border-[#111113]/15">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#FBBF24] font-mono uppercase tracking-widest">
            <Compass className="w-3.5 h-3.5" />
            <span>Platform Vision &amp; Development Roadmap</span>
            {businessName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#D4D4D8]">{businessName}</span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
            {BIZPULSE_VISION.headline}
          </h1>

          <p className="text-base sm:text-lg font-medium text-[#FBBF24]">
            {BIZPULSE_VISION.subheading}
          </p>

          <div className="space-y-3 pt-1 text-sm text-[#D4D4D8] leading-relaxed">
            {BIZPULSE_VISION.introParagraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap Filter Bar + Section Header */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#111113]/10 pb-4">
          <div>
            <span className="bizpulse-label block mb-1">Future Releases</span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111113]">
              Our Development Roadmap
            </h2>
          </div>

          {/* Interactive Filter Tabs */}
          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-[#EFECE6] rounded border border-[#111113]/10"
            role="tablist"
            aria-label="Filter roadmap pillars"
          >
            <button
              type="button"
              onClick={() => setSelectedPillarId('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap shrink-0 ${
                selectedPillarId === 'all'
                  ? 'bg-[#111113] text-white'
                  : 'text-[#52525B] hover:text-[#111113]'
              }`}
            >
              All 4 Pillars
            </button>
            {GROWTH_ROADMAP_PILLARS.map((pillar) => (
              <button
                key={pillar.id}
                type="button"
                onClick={() => setSelectedPillarId(pillar.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap shrink-0 ${
                  selectedPillarId === pillar.id
                    ? 'bg-[#111113] text-white'
                    : 'text-[#52525B] hover:text-[#111113]'
                }`}
              >
                {pillar.number}. {pillar.title.split('&')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* 2x2 Architectural Grid */}
        <div
          className={`grid grid-cols-1 ${
            visiblePillars.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'
          } gap-6`}
        >
          {visiblePillars.map((pillar) => (
            <article
              key={pillar.id}
              className="bg-white border border-[#111113]/12 rounded p-6 sm:p-7 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs text-[#52525B]">
                  <span className="font-mono font-bold text-[#D97706] tracking-wider">
                    Pillar {pillar.number}
                  </span>
                  <span>Planned Release</span>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#111113]">
                    {pillar.number}. {pillar.title}
                  </h3>
                  <p className="text-sm font-semibold text-[#B45309] mt-1">
                    {pillar.tagline}
                  </p>
                  <p className="text-xs sm:text-sm text-[#52525B] mt-3 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#111113]/10 space-y-2.5">
                  <span className="bizpulse-label block">Planned Capabilities</span>
                  <ul className="space-y-2">
                    {pillar.capabilities.map((cap) => (
                      <li
                        key={cap}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-[#111113]"
                      >
                        <Check className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {onNavigateTab && pillar.availableNowTab && pillar.availableNowLabel && (
                <div className="pt-4 border-t border-[#111113]/10 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#52525B]">
                    Available today in your workspace
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab(pillar.availableNowTab!)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#F8F7F4] hover:bg-[#EFECE6] text-[#111113] border border-[#111113]/15 text-xs font-semibold transition whitespace-nowrap shrink-0"
                  >
                    <span>{pillar.availableNowLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#D97706]" />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Our Commitment Section */}
      <section className="bg-white border border-[#111113]/12 rounded p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            <span className="bizpulse-label block">Progressive Evolution</span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111113]">
              {BIZPULSE_VISION.commitmentTitle}
            </h2>
            {BIZPULSE_VISION.commitmentParagraphs.map((para, idx) => (
              <p key={idx} className="text-sm text-[#52525B] leading-relaxed">
                {para}
              </p>
            ))}
          </div>

          <div className="lg:col-span-5 bg-[#F8F7F4] border border-[#111113]/12 rounded p-5 sm:p-6 space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B45309] block">
              {BIZPULSE_VISION.ambitionLead}
            </span>
            <p className="text-sm font-medium text-[#111113] leading-relaxed">
              {BIZPULSE_VISION.ambitionStatement}
            </p>
            {onNavigateTab && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('health')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#111113] hover:bg-[#27272A] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Assess Business Health Today</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FBBF24]" />
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="pt-4 border-t border-[#111113]/10 text-xs italic text-[#52525B]">
          {BIZPULSE_VISION.disclaimer}
        </p>
      </section>
    </div>
  );
};
