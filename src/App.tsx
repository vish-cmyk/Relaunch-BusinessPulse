import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CaseManagerBar } from './components/CaseManagerBar';
import { BusinessEssentialsView } from './components/BusinessEssentialsView';
import { BusinessHealthView } from './components/BusinessHealthView';
import { RecommendationView } from './components/RecommendationView';
import { ExecutiveMemo } from './components/ExecutiveMemo';
import { CashFlowWorkbench } from './components/CashFlowWorkbench';
import { ClientMatrixCalculator } from './components/ClientMatrixCalculator';
import { OptionsEvaluationMatrix } from './components/OptionsEvaluationMatrix';
import { Roadmap90Day } from './components/Roadmap90Day';
import { WeeklyDashboardView } from './components/WeeklyDashboardView';
import { SevenDaySprint } from './components/SevenDaySprint';
import { AICoachConsole } from './components/AICoachConsole';
import { ReportExportModal } from './components/ReportExportModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthScreen } from './components/AuthScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { 
  CaseRecord, 
  BusinessProfile, 
  HealthDimensionKey, 
  HealthDimensionInput, 
  RecommendationOutput,
  FinancialData 
} from './types/bizpulse';
import { 
  subscribeUserCases, 
  saveCaseToFirestore, 
  deleteCaseFromFirestore, 
  createPristineBlankCase, 
  seedDemoCaseForUser 
} from './services/firestoreStorage';
import { calculateOverallHealth } from './services/caseStorage';
import { DEMO_CASE_ID } from './data/demonstrationCase';
import { Database, AlertTriangle, RefreshCw } from 'lucide-react';

function BizPulseWorkspace() {
  const { currentUser, loading: authLoading, logout } = useAuth();

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [casesLoading, setCasesLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('memo');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [coachInitialPrompt, setCoachInitialPrompt] = useState<string | undefined>(undefined);

  // Keep a ref to activeCase to avoid stale closures in Firestore subscriber
  const activeCaseRef = useRef<CaseRecord | null>(null);
  activeCaseRef.current = activeCase;

  // Real-time Firestore subscription scoped strictly to users/{userId}/cases
  useEffect(() => {
    if (!currentUser) {
      setCases([]);
      setActiveCase(null);
      setCasesLoading(false);
      return;
    }

    setCasesLoading(true);
    setFirestoreError(null);

    const activeStorageKey = `bizpulse_active_case_${currentUser.uid}`;

    const unsubscribe = subscribeUserCases(
      currentUser.uid,
      async (loadedCases) => {
        setFirestoreError(null);

        // If brand new user with no cases in Firestore yet, automatically seed their first pristine blank case
        if (loadedCases.length === 0) {
          try {
            setIsSyncing(true);
            const freshCase = createPristineBlankCase({
              name: 'My Business Assessment',
            });
            await saveCaseToFirestore(currentUser.uid, freshCase);
            localStorage.setItem(activeStorageKey, freshCase.id);
            setCases([freshCase]);
            setActiveCase(freshCase);
            setActiveTab('essentials');
          } catch (err: any) {
            console.error('Failed to initialize first user case:', err);
            setFirestoreError('Failed to initialize workspace in Firestore: ' + (err.message || 'Unknown error'));
          } finally {
            setIsSyncing(false);
            setCasesLoading(false);
          }
          return;
        }

        setCases(loadedCases);

        // Determine which case should be active
        const preferredId = localStorage.getItem(activeStorageKey);
        const currentActive = activeCaseRef.current;

        let target: CaseRecord | undefined;
        if (currentActive && loadedCases.some(c => c.id === currentActive.id)) {
          // Keep current active case with latest snapshot data
          target = loadedCases.find(c => c.id === currentActive.id);
        } else if (preferredId && loadedCases.some(c => c.id === preferredId)) {
          target = loadedCases.find(c => c.id === preferredId);
        } else {
          target = loadedCases[0];
        }

        if (target) {
          setActiveCase(target);
          localStorage.setItem(activeStorageKey, target.id);
        }
        setCasesLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setFirestoreError('Firestore sync notice: ' + (error.message || 'Unable to connect to Cloud Firestore. Please check security rules.'));
        setCasesLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Persist case helper
  const persistCase = async (updatedCase: CaseRecord) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await saveCaseToFirestore(currentUser.uid, updatedCase);
      // Optimistic update
      setActiveCase(updatedCase);
      setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
    } catch (err: any) {
      console.error('Error saving case to Firestore:', err);
      setFirestoreError('Failed to save changes to Firestore: ' + (err.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSwitchCase = (caseId: string) => {
    if (!currentUser) return;
    const found = cases.find(c => c.id === caseId);
    if (found) {
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, caseId);
      setActiveCase(found);
      if (!found.profile.isDemonstrationCase && !found.recommendations) {
        setActiveTab('essentials');
      } else {
        setActiveTab('memo');
      }
    }
  };

  // Requirement 6: Ensure New Client creates a genuinely separate case and never carries forward another client's answers
  const handleNewCase = async () => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      const blank = createPristineBlankCase();
      await saveCaseToFirestore(currentUser.uid, blank);
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, blank.id);
      setActiveCase(blank);
      setActiveTab('essentials');
    } catch (err: any) {
      console.error('Failed to create new case in Firestore:', err);
      alert('Error creating new case in Firestore: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadDemoCase = async () => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      const demo = await seedDemoCaseForUser(currentUser.uid);
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, demo.id);
      setActiveCase(demo);
      setActiveTab('memo');
    } catch (err: any) {
      console.error('Failed to load demo case:', err);
      alert('Error loading demonstration case: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      await deleteCaseFromFirestore(currentUser.uid, caseId);
      const remaining = cases.filter(c => c.id !== caseId);
      if (remaining.length > 0) {
        setActiveCase(remaining[0]);
        localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, remaining[0].id);
      } else {
        // If all cases deleted, create a fresh blank one
        const fresh = createPristineBlankCase();
        await saveCaseToFirestore(currentUser.uid, fresh);
        setActiveCase(fresh);
        localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, fresh.id);
      }
    } catch (err: any) {
      console.error('Failed to delete case from Firestore:', err);
      alert('Error deleting case from Firestore: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportJson = () => {
    if (!activeCase) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeCase, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `${activeCase.profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_case.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = async (jsonString: string) => {
    if (!currentUser) return;
    try {
      const parsed: CaseRecord = JSON.parse(jsonString);
      if (!parsed.profile || !parsed.healthInputs) {
        throw new Error('Missing profile or health inputs in case JSON');
      }
      // Ensure unique case ID
      const newId = 'imported-' + Date.now();
      parsed.id = newId;
      parsed.profile.caseId = newId;
      parsed.updatedAt = new Date().toISOString();

      await saveCaseToFirestore(currentUser.uid, parsed);
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, newId);
      setActiveCase(parsed);
      setActiveTab('memo');
    } catch (err: any) {
      console.error('Failed to import JSON case:', err);
      alert('Failed to import case file: ' + err.message);
    }
  };

  const handleUpdateProfile = (updatedProfile: BusinessProfile) => {
    if (!activeCase) return;
    const updatedCase: CaseRecord = {
      ...activeCase,
      profile: updatedProfile,
      updatedAt: new Date().toISOString(),
    };
    persistCase(updatedCase);
  };

  const handleUpdateHealthInput = (key: HealthDimensionKey, updatedInput: HealthDimensionInput) => {
    if (!activeCase) return;
    const newHealthInputs = {
      ...activeCase.healthInputs,
      [key]: updatedInput,
    };
    const newOverallHealth = calculateOverallHealth(newHealthInputs, activeCase.financials);
    const updatedCase: CaseRecord = {
      ...activeCase,
      healthInputs: newHealthInputs,
      overallHealth: newOverallHealth,
      updatedAt: new Date().toISOString(),
    };
    persistCase(updatedCase);
  };

  const handleRecalculateOverall = () => {
    if (!activeCase) return;
    const newOverallHealth = calculateOverallHealth(activeCase.healthInputs, activeCase.financials);
    const updatedCase: CaseRecord = {
      ...activeCase,
      overallHealth: newOverallHealth,
      updatedAt: new Date().toISOString(),
    };
    persistCase(updatedCase);
  };

  const handleUpdateRecommendations = (rec: RecommendationOutput) => {
    if (!activeCase) return;
    const updatedCase: CaseRecord = {
      ...activeCase,
      recommendations: rec,
      updatedAt: new Date().toISOString(),
    };
    persistCase(updatedCase);
  };

  const handleUpdateFinancials = (fin: FinancialData) => {
    if (!activeCase) return;
    const newOverallHealth = calculateOverallHealth(activeCase.healthInputs, fin);
    const updatedCase: CaseRecord = {
      ...activeCase,
      financials: fin,
      overallHealth: newOverallHealth,
      updatedAt: new Date().toISOString(),
    };
    persistCase(updatedCase);
  };

  const handlePaymentSuccess = (paymentRecord: any) => {
    if (!activeCase) return;
    const updatedCase: CaseRecord = {
      ...activeCase,
      isUnlocked: true,
      paymentStatus: 'paid',
      paymentRecord,
      updatedAt: new Date().toISOString(),
    };
    persistCase(updatedCase);
    setIsCheckoutModalOpen(false);
  };

  const handlePrint = () => {
    setActiveTab('memo');
    setIsExportModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // 1. Initial Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6F3] flex flex-col items-center justify-center text-[#14283F] font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#168C83] to-[#12726B] flex items-center justify-center font-extrabold text-white text-2xl shadow-md mb-4 animate-pulse">
          BP
        </div>
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#168C83]" />
          <span>Verifying Firebase session...</span>
        </div>
      </div>
    );
  }

  // 2. Requirement 3: Require users to sign in before accessing their private business workspace
  if (!currentUser) {
    return <AuthScreen />;
  }

  // 3. User is signed in, but initial Firestore cases are loading
  if (casesLoading || !activeCase) {
    return (
      <div className="min-h-screen bg-[#F5F6F3] flex flex-col items-center justify-center text-[#14283F] font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#168C83] to-[#12726B] flex items-center justify-center font-extrabold text-white text-2xl shadow-md mb-4">
          BP
        </div>
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Database className="w-4 h-4 animate-bounce text-[#168C83]" />
          <span>Loading client workspace from Cloud Firestore...</span>
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Vault: <code className="font-mono text-[#14283F]">users/{currentUser.uid}/cases</code>
        </p>
      </div>
    );
  }

  // 4. Authenticated Workspace
  return (
    <div className="min-h-screen bg-[#F5F6F3] text-[#14283F] flex flex-col font-sans selection:bg-[#168C83]/20 selection:text-[#14283F]">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfile={activeCase.profile}
        overallHealth={activeCase.overallHealth}
        isUnlocked={activeCase.isUnlocked}
        userEmail={currentUser.email}
        isSyncing={isSyncing}
        onOpenCoachModal={() => {
          setCoachInitialPrompt(undefined);
          setActiveTab('aicoach');
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenCheckoutModal={() => setIsCheckoutModalOpen(true)}
        onSignOut={handleLogout}
      />

      {/* Case Management Bar */}
      <CaseManagerBar
        cases={cases}
        activeCase={activeCase}
        onSwitchCase={handleSwitchCase}
        onNewCase={handleNewCase}
        onLoadDemoCase={handleLoadDemoCase}
        onDeleteCase={handleDeleteCase}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      {/* Sync / Firestore Error Banner if any */}
      {firestoreError && (
        <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-4 py-2 text-xs text-[#B45309] flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 text-[#D99A35] shrink-0" />
            <span>{firestoreError}</span>
          </div>
          <button 
            onClick={() => setFirestoreError(null)}
            className="text-[#B45309] hover:text-[#14283F] text-xs px-2 py-0.5 rounded font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'essentials' && (
          <BusinessEssentialsView
            profile={activeCase.profile}
            onUpdateProfile={handleUpdateProfile}
            onProceedToHealth={() => setActiveTab('health')}
          />
        )}

        {activeTab === 'health' && (
          <BusinessHealthView
            profile={activeCase.profile}
            healthInputs={activeCase.healthInputs}
            overallHealth={activeCase.overallHealth}
            onUpdateInput={handleUpdateHealthInput}
            onRecalculateOverall={handleRecalculateOverall}
            onProceedToRecommendations={() => setActiveTab('recommendations')}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationView
            profile={activeCase.profile}
            healthInputs={activeCase.healthInputs}
            financials={activeCase.financials}
            overallHealth={activeCase.overallHealth}
            recommendations={activeCase.recommendations}
            onUpdateRecommendations={handleUpdateRecommendations}
            onNavigateToConsole={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'memo' && (
          <ExecutiveMemo
            activeCase={activeCase}
            onSwitchTab={(tab) => setActiveTab(tab)}
            onOpenCoachWithPrompt={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'cashflow' && (
          <CashFlowWorkbench
            caseRecord={activeCase}
            onUpdateFinancials={handleUpdateFinancials}
          />
        )}

        {activeTab === 'options' && (
          <OptionsEvaluationMatrix
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'roadmap' && (
          <Roadmap90Day
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'dashboard' && (
          <WeeklyDashboardView
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'sprint' && (
          <SevenDaySprint
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'aicoach' && (
          <AICoachConsole
            caseRecord={activeCase}
            initialPrompt={coachInitialPrompt}
            onUpdateCase={(updated) => {
              persistCase(updated);
            }}
          />
        )}
      </main>

      {/* Export Report Modal */}
      <ReportExportModal
        caseRecord={activeCase}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onPrintReport={handlePrint}
      />

      {/* Stripe Payment Checkout Modal */}
      <CheckoutModal
        caseRecord={activeCase}
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5EBEF] py-6 text-center text-xs text-[#64748B] print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Relaunch BizPulse © 2026 • Evidence-Based SME Turnaround Operating System</span>
          <div className="flex items-center gap-2 text-[#64748B]">
            <span>Firestore Vault:</span>
            <strong className="text-[#14283F]">{activeCase.profile.name}</strong>
            <span className="text-[#15803D] flex items-center gap-1 font-mono text-[11px] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
              Connected
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BizPulseWorkspace />
    </AuthProvider>
  );
}
