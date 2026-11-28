import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  DollarSign,
  Bot,
  Sparkles,
  BarChart3,
  Activity,
  FileText,
  Download,
  Calendar,
  TrendingUp,
  LogOut,
  FileSpreadsheet,
  Users,
  Crown,
  Compass,
  ShieldAlert,
  ChevronDown,
  Menu,
  X,
  Zap,
  MessageSquarePlus,
} from 'lucide-react';
import {
  AccountUsageSummary,
  BusinessProfile,
  OverallHealthAssessment,
  SubscriptionTier,
} from '../types/bizpulse';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeProfile: BusinessProfile;
  overallHealth: OverallHealthAssessment | null;
  subscriptionTier?: SubscriptionTier;
  accountUsage?: AccountUsageSummary | null;
  isUnlocked?: boolean;
  userEmail?: string | null;
  onOpenCoachModal: () => void;
  onOpenExportModal: () => void;
  onOpenCheckoutModal?: () => void;
  onOpenFeedbackModal?: () => void;
  onSignOut?: () => void;
}

const CORE_TABS = [
  { id: 'essentials', label: '1. Profile', icon: Building2 },
  { id: 'health', label: '2. Health', icon: Activity },
  { id: 'documents', label: '3. Docs', icon: FileSpreadsheet },
  { id: 'recommendations', label: '4. Coaching', icon: Sparkles },
  { id: 'roadmap', label: '5. Action Plan', icon: Calendar },
  { id: 'memo', label: 'Executive Report', icon: FileText },
];

const TOOL_TABS = [
  {
    id: 'cashflow',
    label: 'Cash Flow & Ledger',
    description: '16-field working capital ledger, liquidity & debtor simulator',
    icon: DollarSign,
  },
  {
    id: 'clientmatrix',
    label: 'CRM & Clients',
    description: 'Pipeline contacts, concentration risk & outreach scripts',
    icon: Users,
  },
  {
    id: 'options',
    label: 'ROI & Options',
    description: 'Break-even payback & sensitivity modeling',
    icon: BarChart3,
  },
  {
    id: 'dashboard',
    label: 'Scoreboard & KPIs',
    description: 'Measure improvement, KPI tracker & weekly/monthly continuity',
    icon: TrendingUp,
  },
  {
    id: 'sprint',
    label: '7-Day Sprint & Templates',
    description: 'Collections email/SMS scripts & immediate 7-day execution checklist',
    icon: Zap,
  },
  {
    id: 'growthroadmap',
    label: 'Growth Roadmap',
    description: 'Staged capability milestones across business maturity',
    icon: Compass,
  },
];

const ADVISORY_TABS = [
  { id: 'challengeme', label: 'Challenge Me', icon: ShieldAlert },
  { id: 'aicoach', label: 'Chat with Coach', icon: Bot },
];

const ALL_TABS = [...CORE_TABS, ...TOOL_TABS, ...ADVISORY_TABS];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeProfile,
  overallHealth,
  subscriptionTier = 'free_trial',
  accountUsage,
  isUnlocked,
  userEmail,
  onOpenCoachModal,
  onOpenExportModal,
  onOpenCheckoutModal,
  onOpenFeedbackModal,
  onSignOut,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolsOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const getHealthBadgeStyle = (score: number | null) => {
    if (score === null) return 'bg-[#F8FAFC] text-[#475569] border-[#0F172A]/15';
    if (score >= 72) return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    if (score >= 45) return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
  };

  const resolvedTier = accountUsage?.subscription?.tierId || subscriptionTier;
  const isPilotMode =
    accountUsage?.subscription?.stripeConfigured === false ||
    accountUsage?.subscription?.pilotMode === true;

  const tierLabel =
    resolvedTier === 'business_plus_monthly' || resolvedTier === 'founding_monthly'
      ? 'Business Plus'
      : resolvedTier === 'growth_monthly'
      ? 'Growth Plan'
      : resolvedTier === 'starter_monthly' || resolvedTier === 'essential_monthly' || isUnlocked
      ? 'Starter Plan'
      : isPilotMode
      ? 'Pilot Access'
      : 'Free Trial';

  const remainingCoach = accountUsage?.remaining?.coachMessages;
  const activeTool = TOOL_TABS.find((t) => t.id === activeTab);
  const activeTabInfo = ALL_TABS.find((t) => t.id === activeTab);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setToolsOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white print:hidden">
      {/* Top Architectural Header Bar */}
      <div className="bg-white text-[#0F172A] border-b border-[#0F172A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* Brand Lockup */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-[#0A2E6E] flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0 border-b-2 border-[#F5761A]">
              BP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="font-bold text-sm sm:text-base text-[#0F172A] tracking-tight whitespace-nowrap"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  RELAUNCH BIZPULSE <span className="font-light text-[#0F172A]/45">OS</span>
                </span>
                <span className="hidden lg:inline-block text-[11px] text-[#475569] whitespace-nowrap">
                  · {activeProfile.industry} · {activeProfile.currency}
                </span>
              </div>
              <p className="hidden sm:block text-xs text-[#475569] mt-0.5 truncate max-w-md">
                Active Business: <strong className="text-[#0F172A]">{activeProfile.name || 'Unnamed Business'}</strong>
              </p>
            </div>
          </div>

          {/* Executive Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {overallHealth && (
              <button
                type="button"
                onClick={() => handleSelectTab('health')}
                className={`hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded border text-xs whitespace-nowrap shrink-0 transition hover:opacity-90 ${getHealthBadgeStyle(overallHealth.overallScore)}`}
                title="View 12-Capability Business Health Breakdown"
              >
                <span className="opacity-80 font-medium">Health:</span>
                <span className="font-bold font-mono tabular-nums">
                  {overallHealth.overallScore !== null
                    ? `${overallHealth.overallScore}/100`
                    : overallHealth.overallRating}
                </span>
              </button>
            )}

            {onOpenFeedbackModal && (
              <button
                type="button"
                onClick={onOpenFeedbackModal}
                className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-[#EDF3FD] hover:bg-[#DCE8FC] text-[#0F52BA] border border-[#B7CEF7] text-xs font-semibold transition whitespace-nowrap shrink-0"
                title="Submit pilot usability feedback on any feature"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Pilot Feedback</span>
              </button>
            )}

            {onOpenCheckoutModal && (
              <button
                type="button"
                onClick={onOpenCheckoutModal}
                className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#EDF3FD] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold transition whitespace-nowrap shrink-0"
                title="View Pilot Allowances, Quotas & Account Ownership"
              >
                <Crown className="w-3.5 h-3.5 text-[#0F52BA]" />
                <span>{tierLabel}</span>
                {typeof remainingCoach === 'number' && (
                  <span className="hidden md:inline font-mono text-[10px] text-[#475569] border-l border-[#0F172A]/15 pl-1.5 tabular-nums">
                    {remainingCoach} AI left
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#EDF3FD] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition whitespace-nowrap shrink-0"
              title="Download PDF, Word (.docx), PowerPoint (.pptx), or Scorecard (.csv)"
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              <span className="hidden sm:inline">Reports</span>
            </button>

            <button
              type="button"
              onClick={onOpenCoachModal}
              className="flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded bg-[#0F52BA] hover:bg-[#0A3D8F] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#EDF3FD]" />
              <span className="hidden sm:inline">Consult Coach</span>
              <span className="sm:hidden">Coach</span>
            </button>

            {userEmail && onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#FEF2F2] text-[#475569] hover:text-[#B91C1C] text-xs font-medium border border-[#0F172A]/12 transition whitespace-nowrap shrink-0"
                title={`Sign out (${userEmail})`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Sign Out</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close workspace sections menu' : 'Open workspace sections menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/15 text-xs font-semibold text-[#0F172A] whitespace-nowrap shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span>Sections</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Structured Navigation Bar (Core Steps + Financial & Tracking Dropdown + Advisory) */}
      <div className="hidden md:block bg-[#F8FAFC] border-b border-[#0F172A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <nav className="flex items-center space-x-4 lg:space-x-5" aria-label="Workspace navigation">
            {CORE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`flex items-center space-x-1.5 py-2.5 text-xs whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#0F52BA] text-[#0F172A] font-bold'
                      : 'border-transparent text-[#0F172A]/70 hover:text-[#0F172A] font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0F52BA]' : 'text-[#0F172A]/55'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {/* Grouped Dropdown for Financial, CRM, ROI, KPIs, 7-Day Sprint & Growth Roadmap */}
            <div ref={toolsRef} className="relative">
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                className={`flex items-center space-x-1.5 py-2.5 text-xs whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  activeTool
                    ? 'border-[#0F52BA] text-[#0F172A] font-bold'
                    : 'border-transparent text-[#0F172A]/70 hover:text-[#0F172A] font-medium'
                }`}
              >
                <TrendingUp className={`w-3.5 h-3.5 ${activeTool ? 'text-[#0F52BA]' : 'text-[#0F172A]/55'}`} />
                <span>{activeTool ? `Tools: ${activeTool.label}` : 'Financial & Tracking'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {toolsOpen && (
                <div className="absolute left-0 top-full mt-0.5 w-80 bg-white border border-[#0F172A]/15 rounded shadow-xl py-1.5 z-50">
                  {TOOL_TABS.map((tool) => {
                    const ToolIcon = tool.icon;
                    const isToolActive = activeTab === tool.id;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => handleSelectTab(tool.id)}
                        className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition ${
                          isToolActive
                            ? 'bg-[#EDF3FD] text-[#0F52BA]'
                            : 'hover:bg-[#F8FAFC] text-[#0F172A]'
                        }`}
                      >
                        <ToolIcon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isToolActive ? 'text-[#0F52BA]' : 'text-[#475569]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">{tool.label}</div>
                          <div className="text-[11px] text-[#475569] leading-snug mt-0.5">
                            {tool.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-[#0F172A]/15 shrink-0" />

            {ADVISORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`flex items-center space-x-1.5 py-2.5 text-xs whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#0F52BA] text-[#0F172A] font-bold'
                      : 'border-transparent text-[#0F172A]/70 hover:text-[#0F172A] font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0F52BA]' : 'text-[#0F172A]/55'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Compact Current-Tab Strip */}
      <div className="md:hidden bg-[#F8FAFC] border-b border-[#0F172A]/10 px-4 py-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-[#0F172A] truncate">
          {activeTabInfo?.label || 'Workspace'} · {activeProfile.name || 'Active Business'}
        </span>
        {onOpenFeedbackModal && (
          <button
            type="button"
            onClick={onOpenFeedbackModal}
            className="text-[#0F52BA] font-semibold inline-flex items-center gap-1 shrink-0"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>
        )}
      </div>

      {/* Mobile Collapsible Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#0F172A]/15 shadow-lg px-4 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0F52BA] block">
              Core Diagnostic Workflow
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {CORE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-semibold text-left ${
                      active
                        ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#0F172A]/10'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#6495ED]' : 'text-[#0F52BA]'}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
              Financial, Tracking &amp; Execution Tools
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {TOOL_TABS.map((tool) => {
                const Icon = tool.icon;
                const active = activeTab === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleSelectTab(tool.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded border text-xs font-semibold text-left ${
                      active
                        ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#0F172A]/10'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#6495ED]' : 'text-[#0F52BA]'}`} />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
              AI Coach &amp; Account
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {ADVISORY_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-semibold text-left ${
                      active
                        ? 'bg-[#0A2E6E] text-white border-[#0A2E6E]'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-[#0F172A]/10'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#6495ED]' : 'text-[#0F52BA]'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              {onOpenCheckoutModal && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenCheckoutModal();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-[#0F172A]/10 bg-[#F8FAFC] text-xs font-semibold text-[#0F172A]"
                >
                  <Crown className="w-3.5 h-3.5 text-[#0F52BA]" />
                  <span>{tierLabel}</span>
                </button>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignOut();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-[#FECACA] bg-[#FEF2F2] text-xs font-semibold text-[#B91C1C]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

