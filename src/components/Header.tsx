import React from 'react';
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
  onSignOut?: () => void;
}

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
  onSignOut,
}) => {
  const tabs = [
    { id: 'essentials', label: '1. Essentials', icon: Building2 },
    { id: 'health', label: '2. Health (12D)', icon: Activity },
    { id: 'documents', label: '3. Documents', icon: FileSpreadsheet },
    { id: 'recommendations', label: '4. Coaching & Actions', icon: Sparkles },
    { id: 'memo', label: 'Executive Report', icon: FileText },
    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
    { id: 'clientmatrix', label: 'CRM & Clients', icon: Users },
    { id: 'options', label: 'ROI & Options', icon: BarChart3 },
    { id: 'roadmap', label: 'Action Plan', icon: Calendar },
    { id: 'dashboard', label: 'Scoreboard', icon: TrendingUp },
    { id: 'challengeme', label: 'Challenge Me', icon: ShieldAlert },
    { id: 'aicoach', label: 'Chat with Coach', icon: Bot },
    { id: 'growthroadmap', label: 'Growth Roadmap', icon: Compass },
  ];

  const getHealthBadgeStyle = (score: number | null) => {
    if (score === null) return 'bg-[#F8FAFC] text-[#475569] border-[#0F172A]/15';
    if (score >= 72) return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    if (score >= 45) return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
  };

  const resolvedTier = accountUsage?.subscription?.tierId || subscriptionTier;
  const tierLabel =
    resolvedTier === 'business_plus_monthly' || resolvedTier === 'founding_monthly'
      ? 'Business Plus'
      : resolvedTier === 'growth_monthly'
      ? 'Growth Plan'
      : resolvedTier === 'starter_monthly' || resolvedTier === 'essential_monthly' || isUnlocked
      ? 'Starter Plan'
      : 'Free Trial';

  const remainingCoach = accountUsage?.remaining?.coachMessages;

  return (
    <header className="sticky top-0 z-40 bg-white print:hidden">
      {/* Top Architectural Header Bar */}
      <div className="bg-white text-[#0F172A] border-b border-[#0F172A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Lockup */}
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-9 h-9 rounded bg-[#0B1324] flex items-center justify-center text-white font-bold text-base shrink-0 border-b-2 border-[#2563EB]">
              BP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-base sm:text-lg text-[#0F172A] tracking-tight whitespace-nowrap" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  RELAUNCH BIZPULSE <span className="font-light text-[#0F172A]/45">OS</span>
                </span>
                <span className="hidden md:inline-block text-[11px] text-[#475569] whitespace-nowrap">
                  · {activeProfile.industry} · {activeProfile.currency}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5 truncate max-w-xl">
                Active Business: <strong className="text-[#0F172A]">{activeProfile.name || 'Unnamed Business'}</strong>
                {activeProfile.primaryObjective ? ` · Goal: ${activeProfile.primaryObjective}` : ''}
              </p>
            </div>
          </div>

          {/* Executive Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {overallHealth && (
              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className={`hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded border text-xs whitespace-nowrap shrink-0 transition hover:opacity-90 ${getHealthBadgeStyle(overallHealth.overallScore)}`}
                title="View 12-Capability Business Health Breakdown"
              >
                <span className="opacity-80 font-medium">Health:</span>
                <span className="font-bold font-mono tabular-nums">
                  {overallHealth.overallScore !== null
                    ? `${overallHealth.overallScore}/100 (${overallHealth.overallRating})`
                    : overallHealth.overallRating}
                </span>
              </button>
            )}

            {onOpenCheckoutModal && (
              <button
                type="button"
                onClick={onOpenCheckoutModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold transition whitespace-nowrap shrink-0"
                title="View Monthly Account Plans, AI Quotas & Account Settings"
              >
                <Crown className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{tierLabel}</span>
                {typeof remainingCoach === 'number' && (
                  <span className="hidden sm:inline font-mono text-[10px] text-[#475569] border-l border-[#0F172A]/15 pl-1.5 tabular-nums">
                    {remainingCoach} AI left
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] text-xs font-semibold border border-[#0F172A]/15 transition whitespace-nowrap shrink-0"
              title="Download PDF, Word (.docx), PowerPoint (.pptx), or Scorecard (.csv)"
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              <span className="hidden sm:inline">Reports</span>
            </button>

            <button
              type="button"
              onClick={onOpenCoachModal}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[#0B1324] hover:bg-[#172554] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Consult Coach</span>
            </button>

            {userEmail && onSignOut && (
              <div className="flex items-center pl-2 ml-0.5 border-l border-[#0F172A]/10 space-x-2 shrink-0">
                <span
                  className="hidden 2xl:inline-block max-w-[140px] truncate text-[11px] text-[#475569] font-medium"
                  title={userEmail}
                >
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#FEF2F2] text-[#475569] hover:text-[#B91C1C] text-xs font-medium border border-[#0F172A]/12 transition whitespace-nowrap shrink-0"
                  title="Sign out of workspace"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clean Underline Navigation Bar */}
      <div className="bg-[#F8FAFC] border-b border-[#0F172A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center space-x-5 overflow-x-auto scrollbar-none" aria-label="Workspace navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 py-2.5 text-xs whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#2563EB] text-[#0F172A] font-bold'
                      : 'border-transparent text-[#0F172A]/65 hover:text-[#0F172A] font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#2563EB]' : 'text-[#0F172A]/55'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
