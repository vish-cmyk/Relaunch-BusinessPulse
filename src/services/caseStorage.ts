import { 
  CaseRecord, 
  BusinessProfile, 
  HealthDimensionKey, 
  HealthDimensionInput, 
  OverallHealthAssessment, 
  FinancialData,
  IndustryType,
  BusinessStructureType
} from '../types/bizpulse';
import { DEMO_MSP_CASE, DEMO_CASE_ID, INITIAL_EMPTY_HEALTH_INPUTS } from '../data/demonstrationCase';

const STORAGE_KEY_CASES = 'bizpulse_cases_v2';
const STORAGE_KEY_ACTIVE_ID = 'bizpulse_active_case_id_v2';

export function createBlankHealthInputs(): Record<HealthDimensionKey, HealthDimensionInput> {
  const result: Record<string, HealthDimensionInput> = {};
  const keys = Object.keys(INITIAL_EMPTY_HEALTH_INPUTS) as HealthDimensionKey[];
  
  for (const key of keys) {
    result[key] = {
      key,
      title: INITIAL_EMPTY_HEALTH_INPUTS[key].title,
      description: INITIAL_EMPTY_HEALTH_INPUTS[key].description,
      status: 'unanswered',
      notes: '',
      evidenceType: 'unknown',
    };
  }
  return result as Record<HealthDimensionKey, HealthDimensionInput>;
}

export function createBlankCase(profileOverrides?: Partial<BusinessProfile>): CaseRecord {
  const caseId = 'case-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  const profile: BusinessProfile = {
    caseId,
    name: profileOverrides?.name || 'New Business Assessment',
    industry: profileOverrides?.industry || 'Trades / Contracting',
    businessType: profileOverrides?.businessType || 'Owner-operated',
    country: profileOverrides?.country || 'New Zealand',
    currency: profileOverrides?.currency || 'NZD',
    yearsOperating: profileOverrides?.yearsOperating || 3,
    employeeCount: profileOverrides?.employeeCount ?? 10,
    subcontractorCount: profileOverrides?.subcontractorCount ?? 0,
    mainProductsServices: profileOverrides?.mainProductsServices || '',
    mainCustomerTypes: profileOverrides?.mainCustomerTypes || '',
    primaryObjective: profileOverrides?.primaryObjective || 'Improve profitability and cash flow',
    primaryConcern: profileOverrides?.primaryConcern || '',
    isDemonstrationCase: false,
    createdAt: now,
    updatedAt: now,
  };

  const healthInputs = createBlankHealthInputs();

  const newCase: CaseRecord = {
    id: caseId,
    profile,
    healthInputs,
    overallHealth: null,
    financials: null,
    recommendations: null,
    uploadedDocuments: [],
    conversations: [
      {
        id: 'msg-' + Date.now(),
        sender: 'coach',
        text: `Welcome to BizPulse. I am your commercial business coach. Please complete your Business Essentials and the 8 Health Dimensions to receive your personalized, evidence-based turnaround assessment.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ],
    actionPlan: [],
    sprintCompleted: { 'sprint-1': false, 'sprint-2': false, 'sprint-3': false },
    dashboardMetrics: [],
    crmContacts: [],
    roiScenarios: [],
    businessDevPlan: null,
    challengeSession: null,
    subscriptionTier: 'free_trial',
    usageStats: { recommendationsCount: 0, coachMessagesCount: 0, documentsAnalyzedCount: 0 },
    isUnlocked: false,
    paymentStatus: 'free',
    paymentRecord: null,
    updatedAt: now,
  };

  saveCase(newCase);
  setActiveCaseId(caseId);
  return newCase;
}

export function loadAllCases(): CaseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CASES);
    if (!raw) {
      // First run: Seed the demonstration case into library
      const initial = [DEMO_MSP_CASE];
      localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(initial));
      return initial;
    }
    const parsed: CaseRecord[] = JSON.parse(raw);
    // Ensure Demo case is available in list
    if (!parsed.some(c => c.id === DEMO_CASE_ID)) {
      parsed.unshift(DEMO_MSP_CASE);
    }
    return parsed;
  } catch (err) {
    console.error('Error loading cases from localStorage:', err);
    return [DEMO_MSP_CASE];
  }
}

export function saveCase(caseRecord: CaseRecord): void {
  try {
    const all = loadAllCases();
    const index = all.findIndex(c => c.id === caseRecord.id);
    const updatedRecord = { ...caseRecord, updatedAt: new Date().toISOString() };
    
    if (index >= 0) {
      all[index] = updatedRecord;
    } else {
      all.push(updatedRecord);
    }
    localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(all));
  } catch (err) {
    console.error('Error saving case to localStorage:', err);
  }
}

export function getActiveCaseId(): string {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || DEMO_CASE_ID;
}

export function setActiveCaseId(caseId: string): void {
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, caseId);
}

export function loadActiveCase(): CaseRecord {
  const all = loadAllCases();
  const activeId = getActiveCaseId();
  const found = all.find(c => c.id === activeId);
  if (found) return found;
  
  // Default to Demo case if not found
  const demo = all.find(c => c.id === DEMO_CASE_ID) || DEMO_MSP_CASE;
  setActiveCaseId(demo.id);
  return demo;
}

export function deleteCase(caseId: string): CaseRecord {
  if (caseId === DEMO_CASE_ID) {
    // Reset Demo case to original rather than deleting
    saveCase(DEMO_MSP_CASE);
    return DEMO_MSP_CASE;
  }

  const all = loadAllCases().filter(c => c.id !== caseId);
  localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(all));
  
  const nextCase = all[0] || DEMO_MSP_CASE;
  setActiveCaseId(nextCase.id);
  return nextCase;
}

import { calculateOverallHealth } from './healthScoring';
export { calculateOverallHealth };
