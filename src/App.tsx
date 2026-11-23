import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CaseManagerBar } from './components/CaseManagerBar';
import { BusinessEssentialsView } from './components/BusinessEssentialsView';
import { BusinessHealthView } from './components/BusinessHealthView';
import { DocumentAnalysisView } from './components/DocumentAnalysisView';
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
import { GrowthRoadmapView } from './components/GrowthRoadmapView';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import {
  CaseRecord,
  BusinessProfile,
  HealthDimensionKey,
  HealthDimensionInput,
  RecommendationOutput,
  FinancialData,
  UploadedDocument,
  TurnaroundAction,
  SubscriptionTier,
} from './types/bizpulse';
import {
  subscribeUserCases,
  saveCaseToFirestore,
  deleteCaseFromFirestore,
  createPristineBlankCase,
  seedDemoCaseForUser,
} from './services/firestoreStorage';
import { calculateOverallHealth } from './services/caseStorage';
import { Database, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

function BizPulseWorkspace() {
  const { currentUser, loading: authLoading, logout } = useAuth();

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [casesLoading, setCasesLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('essentials');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [coachInitialPrompt, setCoachInitialPrompt] = useState<string | undefined>(undefined);

  const activeCaseRef = useRef<CaseRecord | null>(null);
  activeCaseRef.current = activeCase;

  const showNotice = (msg: string) => {
    setWorkspaceNotice(msg);
    setTimeout(() => setWorkspaceNotice(null), 4000);
  };

  // Real-time Firestore subscription strictly scoped to users/{userId}/cases
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
            setFirestoreError(
              'Failed to initialize workspace in Firestore: ' + (err.message || 'Unknown error')
            );
          } finally {
            setIsSyncing(false);
            setCasesLoading(false);
          }
          return;
        }

        setCases(loadedCases);

        const preferredId = localStorage.getItem(activeStorageKey);
        const currentActive = activeCaseRef.current;

        let target: CaseRecord | undefined;
        if (currentActive && loadedCases.some((c) => c.id === currentActive.id)) {
          target = loadedCases.find((c) => c.id === currentActive.id);
        } else if (preferredId && loadedCases.some((c) => c.id === preferredId)) {
          target = loadedCases.find((c) => c.id === preferredId);
        } else {
          target = loadedCases[0];
        }

        if (target) {
          setActiveCase(target);
          localStorage.setItem(activeStorageKey, target.id);
          if (!currentActive) {
            setActiveTab(target.profile.isDemonstrationCase ? 'memo' : 'essentials');
          }
        }
        setCasesLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setFirestoreError(
          'Firestore sync notice: ' + (error.message || 'Unable to connect to Cloud Firestore.')
        );
        setCasesLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const persistCase = async (updatedCase: CaseRecord, announceSave = false) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await saveCaseToFirestore(currentUser.uid, updatedCase);
      setActiveCase(updatedCase);
      setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (announceSave) {
        showNotice(`Saved changes for "${updatedCase.profile.name}".`);
      }
    } catch (err: any) {
      console.error('Error saving case to Firestore:', err);
      setFirestoreError('Failed to save changes: ' + (err.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveCurrentCase = () => {
    if (!activeCase) return;
    persistCase(
      {
        ...activeCase,
        updatedAt: new Date().toISOString(),
      },
      true
    );
  };

  const handleSwitchCase = (caseId: string) => {
    if (!currentUser) return;
    const found = cases.find((c) => c.id === caseId);
    if (found) {
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, caseId);
      setActiveCase(found);
      setCoachInitialPrompt(undefined);
      if (!found.profile.isDemonstrationCase && !found.recommendations) {
        setActiveTab('essentials');
      } else {
        setActiveTab('memo');
      }
      showNotice(`Switched to isolated business session: "${found.profile.name}".`);
    }
  };

  const handleNewCase = async () => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      const blank = createPristineBlankCase();
      await saveCaseToFirestore(currentUser.uid, blank);
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, blank.id);
      setActiveCase(blank);
      setCoachInitialPrompt(undefined);
      setActiveTab('essentials');
      showNotice('Created a clean, independent business session with zero carried-over data.');
    } catch (err: any) {
      console.error('Failed to create new case in Firestore:', err);
      setFirestoreError('Error creating new business session: ' + (err.message || ''));
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
      setCoachInitialPrompt(undefined);
      setActiveTab('memo');
      showNotice('Loaded benchmark demonstration MSP scenario.');
    } catch (err: any) {
      console.error('Failed to load demo case:', err);
      setFirestoreError('Error loading demonstration case: ' + (err.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      await deleteCaseFromFirestore(currentUser.uid, caseId);
      const remaining = cases.filter((c) => c.id !== caseId);
      if (remaining.length > 0) {
        setActiveCase(remaining[0]);
        localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, remaining[0].id);
      } else {
        const fresh = createPristineBlankCase();
        await saveCaseToFirestore(currentUser.uid, fresh);
        setActiveCase(fresh);
        localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, fresh.id);
        setActiveTab('essentials');
      }
      showNotice('Deleted business session cleanly.');
    } catch (err: any) {
      console.error('Failed to delete case from Firestore:', err);
      setFirestoreError('Error deleting case: ' + (err.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportJson = () => {
    if (!activeCase) return;
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeCase, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `${(activeCase.profile.name || 'business')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}_case.json`;
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
      const newId = 'imported-' + Date.now();
      parsed.id = newId;
      parsed.profile.caseId = newId;
      parsed.uploadedDocuments = parsed.uploadedDocuments || [];
      parsed.updatedAt = new Date().toISOString();

      await saveCaseToFirestore(currentUser.uid, parsed);
      localStorage.setItem(`bizpulse_active_case_${currentUser.uid}`, newId);
      setActiveCase(parsed);
      setActiveTab('memo');
      showNotice(`Imported "${parsed.profile.name}" as a separate business session.`);
    } catch (err: any) {
      console.error('Failed to import JSON case:', err);
      setFirestoreError('Failed to import case file: ' + (err.message || 'Invalid format'));
    }
  };

  const handleUpdateProfile = (updatedProfile: BusinessProfile) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      profile: updatedProfile,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateHealthInput = (key: HealthDimensionKey, updatedInput: HealthDimensionInput) => {
    if (!activeCase) return;
    const newHealthInputs = {
      ...activeCase.healthInputs,
      [key]: updatedInput,
    };
    const newOverallHealth = calculateOverallHealth(newHealthInputs, activeCase.financials);
    persistCase({
      ...activeCase,
      healthInputs: newHealthInputs,
      overallHealth: newOverallHealth,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRecalculateOverall = () => {
    if (!activeCase) return;
    const newOverallHealth = calculateOverallHealth(activeCase.healthInputs, activeCase.financials);
    persistCase(
      {
        ...activeCase,
        overallHealth: newOverallHealth,
        updatedAt: new Date().toISOString(),
      },
      true
    );
  };

  const handleUpdateRecommendations = (rec: RecommendationOutput) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      recommendations: rec,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateFinancials = (fin: FinancialData) => {
    if (!activeCase) return;
    const newOverallHealth = calculateOverallHealth(activeCase.healthInputs, fin);
    persistCase({
      ...activeCase,
      financials: fin,
      overallHealth: newOverallHealth,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddDocument = (doc: UploadedDocument) => {
    if (!activeCase) return;
    const prevUsage = activeCase.usageStats || {
      coachMessagesCount: 0,
      documentsAnalyzedCount: 0,
      recommendationsCount: 0,
    };
    persistCase({
      ...activeCase,
      uploadedDocuments: [doc, ...(activeCase.uploadedDocuments || [])],
      usageStats: {
        ...prevUsage,
        documentsAnalyzedCount: (prevUsage.documentsAnalyzedCount || 0) + 1,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteDocument = (docId: string) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      uploadedDocuments: (activeCase.uploadedDocuments || []).filter((d) => d.id !== docId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTrackUsage = (
    field: 'coachMessagesCount' | 'documentsAnalyzedCount' | 'recommendationsCount'
  ) => {
    if (!activeCaseRef.current) return;
    const curr = activeCaseRef.current;
    const prevUsage = curr.usageStats || {
      coachMessagesCount: 0,
      documentsAnalyzedCount: 0,
      recommendationsCount: 0,
    };
    persistCase({
      ...curr,
      usageStats: {
        ...prevUsage,
        [field]: (prevUsage[field] || 0) + 1,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateActionPlan = (updatedPlan: TurnaroundAction[]) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      actionPlan: updatedPlan,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleSprintItem = (sprintKey: string) => {
    if (!activeCase) return;
    const current = activeCase.sprintCompleted || {
      'sprint-1': false,
      'sprint-2': false,
      'sprint-3': false,
    };
    persistCase({
      ...activeCase,
      sprintCompleted: {
        ...current,
        [sprintKey]: !current[sprintKey],
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSelectPreviewTier = (tier: SubscriptionTier) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      subscriptionTier: tier,
      updatedAt: new Date().toISOString(),
    });
  };

  const handlePaymentSuccess = (paymentRecord: any) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      isUnlocked: true,
      paymentStatus: 'paid',
      paymentRecord,
      updatedAt: new Date().toISOString(),
    });
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

  // 1. Auth verification screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center text-[#111113] font-sans">
        <div className="w-12 h-12 rounded bg-[#111113] flex items-center justify-center font-bold text-white text-xl mb-4 border-b-2 border-[#D97706]">
          BP
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#52525B] font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-[#D97706]" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  // 2. Auth gate
  if (!currentUser) {
    return <AuthScreen />;
  }

  // 3. Initial Firestore load
  if (casesLoading || !activeCase) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center text-[#111113] font-sans">
        <div className="w-12 h-12 rounded bg-[#111113] flex items-center justify-center font-bold text-white text-xl mb-4 border-b-2 border-[#D97706]">
          BP
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#52525B] font-mono">
          <Database className="w-4 h-4 text-[#D97706]" />
          <span>Loading your private SME workspace...</span>
        </div>
      </div>
    );
  }

  // 4. Authenticated Workspace
  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#111113] flex flex-col font-sans selection:bg-[#D97706]/20 selection:text-[#111113]">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfile={activeCase.profile}
        overallHealth={activeCase.overallHealth}
        subscriptionTier={activeCase.subscriptionTier}
        isUnlocked={activeCase.isUnlocked}
        userEmail={currentUser.email}
        onOpenCoachModal={() => {
          setCoachInitialPrompt(undefined);
          setActiveTab('aicoach');
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenCheckoutModal={() => setIsCheckoutModalOpen(true)}
        onSignOut={handleLogout}
      />

      <CaseManagerBar
        cases={cases}
        activeCase={activeCase}
        isSyncing={isSyncing}
        lastSavedAt={lastSavedAt}
        onSwitchCase={handleSwitchCase}
        onNewCase={handleNewCase}
        onSaveCase={handleSaveCurrentCase}
        onReenterEssentials={() => setActiveTab('essentials')}
        onLoadDemoCase={handleLoadDemoCase}
        onDeleteCase={handleDeleteCase}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      {workspaceNotice && (
        <div className="bg-[#ECFDF5] border-b border-[#A7F3D0] px-4 py-2 text-xs text-[#15803D] print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{workspaceNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceNotice(null)}
              className="text-[#15803D] hover:underline font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {firestoreError && (
        <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-4 py-2 text-xs text-[#B45309] print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
              <span>{firestoreError}</span>
            </div>
            <button
              type="button"
              onClick={() => setFirestoreError(null)}
              className="text-[#B45309] hover:text-[#111113] text-xs px-2 py-0.5 rounded font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area (key={activeCase.id} enforces strict view isolation on switch/new case) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'essentials' && (
          <BusinessEssentialsView
            key={`essentials-${activeCase.id}`}
            profile={activeCase.profile}
            onUpdateProfile={handleUpdateProfile}
            onProceedToHealth={() => setActiveTab('health')}
            onProceedToDocuments={() => setActiveTab('documents')}
          />
        )}

        {activeTab === 'health' && (
          <BusinessHealthView
            key={`health-${activeCase.id}`}
            profile={activeCase.profile}
            healthInputs={activeCase.healthInputs}
            overallHealth={activeCase.overallHealth}
            onUpdateInput={handleUpdateHealthInput}
            onRecalculateOverall={handleRecalculateOverall}
            onProceedToRecommendations={() => setActiveTab('recommendations')}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentAnalysisView
            key={`docs-${activeCase.id}`}
            caseRecord={activeCase}
            onAddDocument={handleAddDocument}
            onDeleteDocument={handleDeleteDocument}
            onDiscussInCoach={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationView
            key={`rec-${activeCase.id}`}
            profile={activeCase.profile}
            healthInputs={activeCase.healthInputs}
            financials={activeCase.financials}
            overallHealth={activeCase.overallHealth}
            uploadedDocuments={activeCase.uploadedDocuments}
            recommendations={activeCase.recommendations}
            onUpdateRecommendations={handleUpdateRecommendations}
            onTrackUsage={handleTrackUsage}
            onNavigateToConsole={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'memo' && (
          <ExecutiveMemo
            key={`memo-${activeCase.id}`}
            activeCase={activeCase}
            onSwitchTab={(tab) => setActiveTab(tab)}
            onUpdateCase={(updated) => persistCase(updated)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onOpenCoachWithPrompt={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'cashflow' && (
          <CashFlowWorkbench
            key={`cash-${activeCase.id}`}
            caseRecord={activeCase}
            onUpdateFinancials={handleUpdateFinancials}
          />
        )}

        {activeTab === 'clientmatrix' && (
          <ClientMatrixCalculator
            key={`matrix-${activeCase.id}`}
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'options' && (
          <OptionsEvaluationMatrix
            key={`options-${activeCase.id}`}
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'roadmap' && (
          <Roadmap90Day
            key={`roadmap-${activeCase.id}`}
            caseRecord={activeCase}
            onUpdateActionPlan={handleUpdateActionPlan}
            onToggleSprintItem={handleToggleSprintItem}
          />
        )}

        {activeTab === 'dashboard' && (
          <WeeklyDashboardView
            key={`dash-${activeCase.id}`}
            caseRecord={activeCase}
          />
        )}

        {activeTab === 'sprint' && (
          <SevenDaySprint
            key={`sprint-${activeCase.id}`}
            caseRecord={activeCase}
            onToggleSprintItem={handleToggleSprintItem}
          />
        )}

        {activeTab === 'aicoach' && (
          <AICoachConsole
            key={`coach-${activeCase.id}`}
            caseRecord={activeCase}
            initialPrompt={coachInitialPrompt}
            onTrackUsage={handleTrackUsage}
            onUpdateCase={(updated) => {
              persistCase(updated);
            }}
          />
        )}

        {activeTab === 'growthroadmap' && (
          <GrowthRoadmapView
            businessName={activeCase.profile.name}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      <ReportExportModal
        caseRecord={activeCase}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onPrintReport={handlePrint}
      />

      <CheckoutModal
        caseRecord={activeCase}
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
        onSelectPreviewTier={handleSelectPreviewTier}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-[#111113]/10 py-5 text-center text-xs text-[#52525B] print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Relaunch BizPulse © 2026 • Executive Coaching &amp; Diagnostic OS
          </span>
          <div className="flex items-center gap-2">
            <span>Active Session:</span>
            <strong className="text-[#111113]">{activeCase.profile.name}</strong>
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
