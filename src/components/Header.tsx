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
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { BusinessProfile, OverallHealthAssessment } from '../types/bizpulse';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeProfile: BusinessProfile;
  overallHealth: OverallHealthAssessment | null;
  isUnlocked?: boolean;
  userEmail?: string | null;
  isSyncing?: boolean;
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
  isUnlocked,
  userEmail,
  isSyncing,
  onOpenCoachModal,
  onOpenExportModal,
  onOpenCheckoutModal,
  onSignOut
}) => {
  const tabs = [
    { id: 'essentials', label: '1. Essentials', icon: Building2 },
    { id: 'health', label: '2. Business Health', icon: Activity },
    { id: 'recommendations', label: '3. Recommendations', icon: Sparkles, isSpecial: true },
    { id: 'memo', label: 'Executive Report', icon: FileText },
    { id: 'cashflow', label: 'Cash & Working Capital', icon: DollarSign },
    { id: 'options', label: 'Options & Decisions', icon: BarChart3 },
    { id: 'roadmap', label: 'Action Plan', icon: Calendar },
    { id: 'dashboard', label: 'Weekly Dashboard', icon: TrendingUp },
    { id: 'aicoach', label: 'AI Coach Console', icon: Bot },
  ];

  return (
    <header className="bg-gradient-to-r from-[#080F20] via-[#102B63] to-[#1D4ED8] border-b border-[#263D69] sticky top-0 z-40 text-white shadow-xs print:hidden">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & Active Case Context */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1D4ED8] via-blue-700 to-[#14283F] flex items-center justify-center shadow-xs text-white font-extrabold text-xl shrink-0">
            BP
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">Relaunch BizPulse</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-white/15 text-white border border-[#1D4ED8]/30">
                Business opportunity & performance coach
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {activeProfile.industry} • {activeProfile.currency}
              </span>
            </div>
            <p className="text-xs text-blue-100/75 mt-0.5 truncate max-w-xl">
              Active Client: <strong className="text-white">{activeProfile.name}</strong> • Objective: {activeProfile.primaryObjective}
            </p>
          </div>
        </div>

        {/* Status Indicators & Executive Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Health Score Tag */}
          {overallHealth && (
            <div className="hidden lg:flex items-center space-x-2 bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#E5EBEF] text-xs">
              <span className="text-[#64748B] font-medium">Health:</span>
              <span className={`font-bold font-mono ${
                overallHealth.overallScore >= 70 ? 'text-[#15803D]' :
                overallHealth.overallScore >= 45 ? 'text-[#B45309]' : 'text-[#B91C1C]'
              }`}>
                {overallHealth.overallScore}/100 ({overallHealth.overallRating})
              </span>
            </div>
          )}

          {/* License Status / Unlock Diagnostic Button */}
          {activeProfile.isDemonstrationCase ? (
            <span className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] text-xs font-semibold">
              <span>Benchmark Case</span>
            </span>
          ) : isUnlocked ? (
            <span className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0] text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]"></span>
              <span>Diagnostic License: Active</span>
            </span>
          ) : (
            <button
              onClick={onOpenCheckoutModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] text-xs font-bold transition shadow-xs"
              title="Unlock full commercial diagnostic and executive reports"
            >
              <span>Explore paid review</span>
            </button>
          )}

          {/* Export Report Modal Trigger */}
          <button
            onClick={onOpenExportModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F5F6F3] text-[#14283F] text-xs font-semibold border border-[#CBD5E1] transition shadow-xs"
            title="Export Word, PowerPoint, PDF or CSV report"
          >
            <Download className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="hidden sm:inline">Export Report</span>
          </button>

          {/* AI Coach Action Button */}
          <button
            onClick={onOpenCoachModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#F28C28] hover:bg-[#E87518] text-white text-xs font-bold shadow-xs transition transform active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Consult Coach</span>
          </button>

          {/* User Email & Sign Out */}
          {userEmail && (
            <div className="flex items-center pl-2 ml-1 border-l border-[#E5EBEF] space-x-2">
              <div 
                className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E5EBEF] text-[11px] text-[#64748B]"
                title={`Signed in as ${userEmail} • Cloud Firestore Active`}
              >
                <span className="w-2 h-2 rounded-full bg-[#15803D] shrink-0" />
                <span className="max-w-[140px] truncate text-[#14283F] font-medium">{userEmail}</span>
              </div>

              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C] text-[#64748B] text-xs font-medium border border-[#E5EBEF] hover:border-[#FECACA] transition"
                  title="Sign out of workspace"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Bar (All 9 Tabs Preserved) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/15">
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#EAF1FF] text-[#2563EB] border border-[#2563EB]/30 shadow-xs font-semibold'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                } ${tab.isSpecial && !isActive ? 'text-[#E87518] font-semibold' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#2563EB]' : tab.isSpecial ? 'text-[#E87518]' : 'text-[#64748B]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
