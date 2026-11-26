import React, { useState, useEffect, useRef, useCallback } from 'react';
import { deleteUser } from 'firebase/auth';
import { Header } from './components/Header';
import { CaseManagerBar } from './components/CaseManagerBar';
import { BusinessEssentialsView } from './components/BusinessEssentialsView';
import { BusinessHealthView } from './components/BusinessHealthView';
import { DocumentAnalysisView } from './components/DocumentAnalysisView';
import { RecommendationView } from './components/RecommendationView';
import { ExecutiveMemo } from './components/ExecutiveMemo';
import { CashFlowWorkbench } from './components/CashFlowWorkbench';
import { ClientMatrixCalculator } from './components/ClientMatrixCalculator';
import { OptionsEvaluationMatrix, PendingRoiDraft } from './components/OptionsEvaluationMatrix';
import { Roadmap90Day } from './components/Roadmap90Day';
import { WeeklyDashboardView, ContinuitySubTab } from './components/WeeklyDashboardView';
import { SevenDaySprint } from './components/SevenDaySprint';
import { AICoachConsole } from './components/AICoachConsole';
import { ChallengeMeView } from './components/ChallengeMeView';
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
  CrmRecord,
  RoiScenario,
  BusinessDevPlan,
  AccountUsageSummary,
  CrossDocumentSynthesis,
  ProfitOpportunityItem,
  MembershipContinuity,
  KpiTrackerState,
} from './types/bizpulse';
import {
  subscribeUserCases,
  saveCaseToFirestore,
  deleteCaseFromFirestore,
  createPristineBlankCase,
  seedDemoCaseForUser,
} from './services/firestoreStorage';
import { calculateOverallHealth } from './services/healthScoring';
import { mergeDiagnosticsIntoActionPlan } from './services/actionPlanEngine';
import { getAuthHeaders } from './services/firebase';
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
  const [accountUsage, setAccountUsage] = useState<AccountUsageSummary | null>(null);

  const [activeTab, setActiveTab] = useState<string>('essentials');
  const [dashboardInitialSubTab, setDashboardInitialSubTab] = useState<ContinuitySubTab>('scoreboard');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [coachInitialPrompt, setCoachInitialPrompt] = useState<string | undefined>(undefined);
  const [pendingRoiDraft, setPendingRoiDraft] = useState<PendingRoiDraft | null>(null);

  const activeCaseRef = useRef<CaseRecord | null>(null);
  activeCaseRef.current = activeCase;
  const pendingSaveCountRef = useRef<number>(0);

  const showNotice = (msg: string) => {
    setWorkspaceNotice(msg);
    setTimeout(() => setWorkspaceNotice(null), 5000);
  };

  const refreshAccountUsage = useCallback(async () => {
    if (!currentUser) {
      setAccountUsage(null);
      return;
    }
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/account/usage', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.accountUsage) {
          setAccountUsage(data.accountUsage);
        }
      }
    } catch (err) {
      console.warn('Unable to load account usage summary:', err);
    }
  }, [currentUser]);

  // Verify returning Stripe checkout session & load account usage on auth
  useEffect(() => {
    if (!currentUser) {
      setAccountUsage(null);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const paymentFlag = params.get('payment');
    const sessionId = params.get('session_id');
    const caseIdParam = params.get('case_id');

    const runVerificationAndUsage = async () => {
      if (paymentFlag === 'success' && sessionId) {
        try {
          const authHeaders = await getAuthHeaders();
          const res = await fetch('/api/payment/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify({
              sessionId,
              caseId: caseIdParam || activeCaseRef.current?.id || '',
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.paid) {
            if (data.accountUsage) {
              setAccountUsage(data.accountUsage);
            }
            showNotice(`Subscription activated: ${data.record?.tier || 'Paid Plan'}.`);
          }
        } catch (err) {
          console.warn('Payment verification error:', err);
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (paymentFlag === 'cancelled') {
        showNotice('Checkout cancelled. No charges were made.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      await refreshAccountUsage();
    };

    runVerificationAndUsage();
  }, [currentUser, refreshAccountUsage]);

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
    pendingSaveCountRef.current += 1;
    setIsSyncing(true);
    try {
      await saveCaseToFirestore(currentUser.uid, updatedCase);
      if (activeCaseRef.current?.id === updatedCase.id) {
        setActiveCase(updatedCase);
      }
      setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (announceSave) {
        showNotice(`Saved changes for "${updatedCase.profile.name}".`);
      }
    } catch (err: any) {
      console.error('Error saving case to Firestore:', err);
      setFirestoreError('Failed to save changes: ' + (err.message || ''));
    } finally {
      pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
      if (pendingSaveCountRef.current === 0) {
        setIsSyncing(false);
      }
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
      const customCaseIds = cases.filter((c) => !c.profile.isDemonstrationCase).map((c) => c.id);
      const authHeaders = await getAuthHeaders();
      const checkRes = await fetch('/api/account/check-case-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          currentCustomCaseCount: customCaseIds.length,
          customCaseIds,
        }),
      });

      const limitData = await checkRes.json().catch(() => ({}));
      if (!checkRes.ok) {
        setFirestoreError(limitData.error || 'Unable to verify plan session quota. Please try again.');
        return;
      }
      if (limitData.accountUsage) {
        setAccountUsage(limitData.accountUsage);
      }
      if (!limitData.allowed) {
        setIsCheckoutModalOpen(true);
        showNotice(
          `Your ${limitData.planName} allows up to ${limitData.maxCustomCases} custom business session(s). Upgrade your plan to add more businesses.`
        );
        return;
      }

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

  const handleExportAllAccountData = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      accountEmail: currentUser?.email || null,
      accountUsage,
      cases,
    };
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `bizpulse_account_export_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('Exported all account data (.json) cleanly.');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;

    const authHeaders = await getAuthHeaders();

    // 1. Delete every user case from client Firestore while user token is active
    for (const c of cases) {
      await deleteCaseFromFirestore(currentUser.uid, c.id).catch(() => {});
    }

    // 2. Cancel Stripe subscription + wipe server-side quota/billing records
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Unable to purge server-side account state.');
    }

    // 3. Delete Firebase Auth record from client SDK
    try {
      await deleteUser(currentUser);
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        await logout();
        throw new Error(
          'Your workspace data and subscription were deleted. Please sign in again once to finalize Firebase credential removal.'
        );
      }
      // If server Admin SDK already deleted the Auth record, sign out gracefully
      await logout().catch(() => {});
    }
    setIsCheckoutModalOpen(false);
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
    const updatedActionPlan = !activeCase.profile.isDemonstrationCase
      ? mergeDiagnosticsIntoActionPlan({ ...activeCase, overallHealth: newOverallHealth })
      : activeCase.actionPlan;
    persistCase(
      {
        ...activeCase,
        overallHealth: newOverallHealth,
        actionPlan: updatedActionPlan,
        updatedAt: new Date().toISOString(),
      },
      true
    );
  };

  const handleUpdateRecommendations = (rec: RecommendationOutput) => {
    if (!activeCase) return;
    const shouldMergePlan =
      !activeCase.profile.isDemonstrationCase ||
      !activeCase.actionPlan ||
      activeCase.actionPlan.length === 0;
    const updatedActionPlan = shouldMergePlan
      ? mergeDiagnosticsIntoActionPlan({ ...activeCase, recommendations: rec }, rec)
      : activeCase.actionPlan;
    persistCase({
      ...activeCase,
      recommendations: rec,
      actionPlan: updatedActionPlan,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateContinuity = (continuity: MembershipContinuity) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      continuity,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateKpiTracker = (kpiTracker: KpiTrackerState) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      kpiTracker,
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

  const handleSynthesizeDocuments = (synthesis: CrossDocumentSynthesis) => {
    if (!activeCase) return;
    persistCase(
      {
        ...activeCase,
        crossDocumentSynthesis: synthesis,
        updatedAt: new Date().toISOString(),
      },
      true
    );
  };

  const handleAddOpportunityToPlan = (opp: ProfitOpportunityItem) => {
    if (!activeCase) return;
    const horizon: TurnaroundAction['horizon'] =
      opp.horizon === '0-30 Days'
        ? '30 Days (Quick Wins & Control)'
        : opp.horizon === '30-90 Days'
        ? '60 Days (Systems & Margin Fixes)'
        : '90 Days (Sustainable Growth)';

    const existingPlan = activeCase.actionPlan || [];
    if (existingPlan.some((a) => a.action.toLowerCase() === opp.title.toLowerCase())) {
      showNotice(`"${opp.title}" is already in your 30/60/90-Day Action Plan.`);
      return;
    }

    const newAction: TurnaroundAction = {
      id: `act-opp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      horizon,
      priority: opp.horizon === '0-30 Days' ? 'Priority 1 (Urgent)' : 'Priority 2 (High)',
      businessIssue: `Profit Opportunity (${opp.area})`,
      action: opp.title,
      accountableRole: 'Business Owner',
      timeframe: opp.horizon,
      requiredInformationOrResources: [opp.evidenceBasis],
      measurableSuccessIndicator: opp.estimatedFinancialImpact,
      dependencyOrRisk: opp.risks?.[0] || 'Confirm baseline margins before scaling.',
      status: 'pending',
      completed: false,
      decisionStatus: 'accepted',
      estimatedCostEffort: opp.effortCost,
      intendedImprovement: opp.estimatedFinancialImpact,
      sourceTag: 'Profit Opportunity',
    };

    persistCase({
      ...activeCase,
      actionPlan: [newAction, ...existingPlan],
      updatedAt: new Date().toISOString(),
    });
    showNotice(`Added "${opp.title}" to your 30/60/90-Day Action Plan.`);
  };

  const handleTestOpportunityInRoi = (opp: ProfitOpportunityItem) => {
    setPendingRoiDraft({
      linkedCrmId: opp.linkedCrmId || opp.id,
      linkedCrmLabel: opp.title,
      opportunityValue: 0,
      monthlyValue: 0,
      notes: `[${opp.area} · ${opp.horizon}] Impact: ${opp.estimatedFinancialImpact}. Effort/Cost: ${opp.effortCost}. Basis: ${opp.evidenceBasis}`,
    });
    setActiveTab('options');
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

  const handleUpdateCrmContacts = (crmContacts: CrmRecord[]) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      crmContacts,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateRoiScenarios = (roiScenarios: RoiScenario[]) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      roiScenarios,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateBusinessDevPlan = (businessDevPlan: BusinessDevPlan | null) => {
    if (!activeCase) return;
    persistCase({
      ...activeCase,
      businessDevPlan,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleEvaluateOpportunityInRoi = (contact: CrmRecord) => {
    setPendingRoiDraft({
      linkedCrmId: contact.id,
      linkedCrmLabel: contact.companyOrName,
      opportunityValue: contact.opportunityValue || 0,
      monthlyValue: contact.monthlyValue || 0,
      notes: contact.notes,
    });
    setActiveTab('options');
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
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-[#0F172A] font-sans">
        <div className="w-12 h-12 rounded bg-[#0B1324] flex items-center justify-center font-bold text-white text-xl mb-4 border-b-2 border-[#2563EB]">
          BP
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#475569] font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
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
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-[#0F172A] font-sans">
        <div className="w-12 h-12 rounded bg-[#0B1324] flex items-center justify-center font-bold text-white text-xl mb-4 border-b-2 border-[#2563EB]">
          BP
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#475569] font-mono">
          <Database className="w-4 h-4 text-[#2563EB]" />
          <span>Loading your private SME workspace...</span>
        </div>
      </div>
    );
  }

  // 4. Authenticated Workspace
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#2563EB]/20 selection:text-[#0F172A]">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfile={activeCase.profile}
        overallHealth={activeCase.overallHealth}
        subscriptionTier={activeCase.subscriptionTier}
        accountUsage={accountUsage}
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
              className="text-[#B45309] hover:text-[#0F172A] text-xs px-2 py-0.5 rounded font-semibold"
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
            savedSessions={cases}
            activeCaseId={activeCase.id}
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
            onSynthesizeDocuments={handleSynthesizeDocuments}
            onAccountUsageUpdate={setAccountUsage}
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
            crossDocumentSynthesis={activeCase.crossDocumentSynthesis}
            crmContacts={activeCase.crmContacts}
            roiScenarios={activeCase.roiScenarios}
            actionPlan={activeCase.actionPlan}
            continuity={activeCase.continuity}
            recommendations={activeCase.recommendations}
            onUpdateRecommendations={handleUpdateRecommendations}
            onAddOpportunityToPlan={handleAddOpportunityToPlan}
            onTestOpportunityInRoi={handleTestOpportunityInRoi}
            onAccountUsageUpdate={setAccountUsage}
            onTrackUsage={handleTrackUsage}
            onOpenChallengeMe={() => setActiveTab('challengeme')}
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
            onAccountUsageUpdate={setAccountUsage}
            onOpenKpiTracker={() => {
              setDashboardInitialSubTab('kpis');
              setActiveTab('dashboard');
            }}
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
            onUpdateCrmContacts={handleUpdateCrmContacts}
            onUpdateBusinessDevPlan={handleUpdateBusinessDevPlan}
            onEvaluateOpportunityInRoi={handleEvaluateOpportunityInRoi}
            onTrackUsage={handleTrackUsage}
            onAccountUsageUpdate={setAccountUsage}
            onOpenCoachWithPrompt={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'options' && (
          <OptionsEvaluationMatrix
            key={`options-${activeCase.id}`}
            caseRecord={activeCase}
            onUpdateRoiScenarios={handleUpdateRoiScenarios}
            pendingRoiDraft={pendingRoiDraft}
            onClearPendingRoiDraft={() => setPendingRoiDraft(null)}
            onAccountUsageUpdate={setAccountUsage}
            onOpenCoachWithPrompt={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'roadmap' && (
          <Roadmap90Day
            key={`roadmap-${activeCase.id}`}
            caseRecord={activeCase}
            onUpdateActionPlan={handleUpdateActionPlan}
            onToggleSprintItem={handleToggleSprintItem}
            onSwitchTab={(tab) => setActiveTab(tab)}
            onOpenKpiTracker={() => {
              setDashboardInitialSubTab('kpis');
              setActiveTab('dashboard');
            }}
          />
        )}

        {activeTab === 'dashboard' && (
          <WeeklyDashboardView
            key={`dash-${activeCase.id}`}
            caseRecord={activeCase}
            initialSubTab={dashboardInitialSubTab}
            onUpdateContinuity={handleUpdateContinuity}
            onUpdateKpiTracker={handleUpdateKpiTracker}
            onAccountUsageUpdate={setAccountUsage}
          />
        )}

        {activeTab === 'sprint' && (
          <SevenDaySprint
            key={`sprint-${activeCase.id}`}
            caseRecord={activeCase}
            onToggleSprintItem={handleToggleSprintItem}
            onUpdateActionPlan={handleUpdateActionPlan}
          />
        )}

        {activeTab === 'challengeme' && (
          <ChallengeMeView
            key={`challenge-${activeCase.id}`}
            caseRecord={activeCase}
            onUpdateCase={(updated) => {
              persistCase(updated);
            }}
            onTrackUsage={handleTrackUsage}
            onAccountUsageUpdate={setAccountUsage}
            onOpenCoachWithPrompt={(prompt) => {
              setCoachInitialPrompt(prompt);
              setActiveTab('aicoach');
            }}
          />
        )}

        {activeTab === 'aicoach' && (
          <AICoachConsole
            key={`coach-${activeCase.id}`}
            caseRecord={activeCase}
            initialPrompt={coachInitialPrompt}
            onTrackUsage={handleTrackUsage}
            onAccountUsageUpdate={setAccountUsage}
            onOpenChallengeMe={() => setActiveTab('challengeme')}
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
        accountUsage={accountUsage}
        userEmail={currentUser.email}
        onUsageUpdated={setAccountUsage}
        onExportAllAccountData={handleExportAllAccountData}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-[#0F172A]/10 py-5 text-center text-xs text-[#475569] print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Relaunch BizPulse © 2026 • Executive Coaching &amp; Diagnostic OS
          </span>
          <div className="flex items-center gap-2">
            <span>Active Session:</span>
            <strong className="text-[#0F172A]">{activeCase.profile.name}</strong>
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
