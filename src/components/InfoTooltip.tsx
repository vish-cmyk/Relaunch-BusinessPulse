import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface InfoTooltipProps {
  title: string;
  whatItMeans: string;
  whyItMatters?: string;
  actionOrCalculation?: string;
  align?: 'left' | 'right' | 'center';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  whatItMeans,
  whyItMatters,
  actionOrCalculation,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsPinned(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsPinned(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const positionClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0';

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => {
        if (!isPinned) setIsOpen(true);
      }}
      onMouseLeave={() => {
        if (!isPinned) setIsOpen(false);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsPinned((prev) => {
            const next = !prev;
            setIsOpen(next);
            return next;
          });
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          if (!isPinned) setIsOpen(false);
        }}
        aria-label={`More information about ${title}`}
        aria-expanded={isOpen}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
          isOpen
            ? 'bg-[#2563EB] text-white'
            : 'bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] border border-[#BFDBFE]'
        }`}
      >
        <HelpCircle className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={`absolute bottom-full mb-2 ${positionClass} z-50 w-72 sm:w-80 bg-white border border-[#0F172A]/20 rounded shadow-lg p-3.5 text-left text-xs text-[#0F172A] space-y-2`}
        >
          <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-[#0F172A]/10">
            <span className="font-bold text-[#0F172A] leading-snug">{title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                setIsPinned(false);
              }}
              aria-label="Close explanation"
              className="text-[#64748B] hover:text-[#0F172A] p-0.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[#334155] leading-relaxed">{whatItMeans}</p>

          {whyItMatters && (
            <div className="p-2 rounded bg-[#F8FAFC] border border-[#0F172A]/10 text-[11px] text-[#0F172A] leading-relaxed">
              <strong className="text-[#1D4ED8]">Why it matters: </strong>
              {whyItMatters}
            </div>
          )}

          {actionOrCalculation && (
            <div className="p-2 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] text-[#1E3A8A] leading-relaxed">
              <strong>How to use / act on this: </strong>
              {actionOrCalculation}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
