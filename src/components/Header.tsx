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
} from 'lucide-react';
import { BusinessProfile, OverallHealthAssessment, SubscriptionTier } from '../types/bizpulse';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeProfile: BusinessProfile;
  overallHealth: OverallHealthAssessment | null;
  subscriptionTier?: SubscriptionTier;
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
  isUnlocked,
  userEmail,
  onOpenCoachModal,
  onOpenExportModal,
  onOpenCheckoutModal,
  onSignOut,
}) => {
  const tabs = [
    { id: 'essentials', label: '1. Essentials', icon: Building2 },
    { id: 'health', label: '2. Health (8D)', icon: Activity },
    { id: 'documents', label: '3. Documents', icon: FileSpreadsheet },
    { id: 'recommendations', label: '4. Coaching & Actions', icon: Sparkles },
    { id: 'memo', label: 'Executive Report', icon: FileText },
    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
    { id: 'clientmatrix', label: 'Client Matrix', icon: Users },
    { id: 'options', label: 'Options', icon: BarChart3 },
    { id: 'roadmap', label: 'Action Plan', icon: Calendar },
    { id: 'dashboard', label: 'Scoreboard', icon: TrendingUp },
    { id: 'aicoach', label: 'AI Coach', icon: Bot },
  ];

  const getHealthBadgeStyle = (score: number | null) => {
    if (score === null) return 'bg-white/10 text-[#CBD5E1] border-white/15';
    if (score >= 72) return 'bg-[#15803D]/25 text-[#86EFAC] border-[#15803D]/50';
    if (score >= 45) return 'bg-[#B45309]/25 text-[#FCD34D] border-[#D97706]/50';
    return 'bg-[#B91C1C]/30 text-[#FCA5A5] border-[#EF4444]/50';
  };

  const tierLabel =
    subscriptionTier === 'founding_monthly'
      ? 'Founding Member'
      : subscriptionTier === 'essential_monthly' || isUnlocked
      ? 'Essential Monthly'
      : 'Plans & Membership';

  return (
    <header className="sticky top-0 z-40 shadow-sm print:hidden">
      {/* Top Black-to-Blue Executive Header Bar */}
      <div className="bizpulse-bar-gradient text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Active Client Context */}
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] flex items-center justify-center shadow-sm text-white font-extrabold text-lg shrink-0 border border-white/20">
              BP
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight whitespace-nowrap">
                  Relaunch BizPulse
                </span>
                <span className="hidden md:inline-block text-[11px] px-2 py-0.5 rounded font-semibold bg-white/10 text-[#93C5FD] border border-white/15 whitespace-nowrap">
                  Executive Coaching &amp; Diagnostic OS
                </span>
                <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded font-medium bg-white/5 text-[#CBD5E1] border border-white/10 whitespace-nowrap">
                  {activeProfile.industry} · {activeProfile.currency}
                </span>
              </div>
              <p className="text-xs text-[#CBD5E1] mt-0.5 truncate max-w-xl">
                Active Business: <strong className="text-white">{activeProfile.name || 'Unnamed Business'}</strong>
                {activeProfile.primaryObjective ? ` · Goal: ${activeProfile.primaryObjective}` : ''}
              </p>
            </div>
          </div>

          {/* Executive Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Health Score Summary */}
            {overallHealth && (
              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className={`hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap shrink-0 transition hover:opacity-90 ${getHealthBadgeStyle(overallHealth.overallScore)}`}
                title="View Business Health Breakdown"
              >
                <span className="opacity-80 font-medium">Health:</span>
                <span className="font-bold font-mono tabular-nums">
                  {overallHealth.overallScore !== null
                    ? `${overallHealth.overallScore}/100 (${overallHealth.overallRating})`
                    : overallHealth.overallRating}
                </span>
              </button>
            )}

            {/* Membership / Plans Trigger */}
            {onOpenCheckoutModal && (
              <button
                type="button"
                onClick={onOpenCheckoutModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-semibold transition whitespace-nowrap shrink-0"
                title="View Two-Tier Monthly Plans & Founding Membership"
              >
                <Crown className="w-3.5 h-3.5 text-[#93C5FD]" />
                <span>{tierLabel}</span>
              </button>
            )}

            {/* Export Report Trigger */}
            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition whitespace-nowrap shrink-0"
              title="Download PDF, Word (.docx), PowerPoint (.pptx), or Scorecard (.csv)"
            >
              <Download className="w-3.5 h-3.5 text-[#CBD5E1]" />
              <span className="hidden sm:inline">Reports</span>
            </button>

            {/* Consult AI Coach Action */}
            <button
              type="button"
              onClick={onOpenCoachModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-bold shadow-sm transition whitespace-nowrap shrink-0 border border-white/15"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Consult Coach</span>
            </button>

            {/* Signed-In User & Sign Out */}
            {userEmail && onSignOut && (
              <div className="flex items-center pl-2 ml-0.5 border-l border-white/15 space-x-2 shrink-0">
                <span
                  className="hidden 2xl:inline-block max-w-[140px] truncate text-[11px] text-[#CBD5E1] font-medium"
                  title={userEmail}
                >
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-[#B91C1C]/40 text-[#CBD5E1] hover:text-white text-xs font-medium border border-white/15 transition whitespace-nowrap shrink-0"
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

      {/* Crisp White Sub-Navigation Tab Strip */}
      <div className="bg-white border-b border-[#D9E2F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none" aria-label="Workspace navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap shrink-0 transition-all ${
                    isActive
                      ? 'bg-[#0F172A] text-white font-bold shadow-xs'
                      : 'text-[#52627A] hover:text-[#0B1324] hover:bg-[#F3F6FB] font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#93C5FD]' : 'text-[#52627A]'}`} />
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
