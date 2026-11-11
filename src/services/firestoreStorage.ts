import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  CaseRecord, 
  BusinessProfile, 
  HealthDimensionKey, 
  HealthDimensionInput 
} from '../types/bizpulse';
import { INITIAL_EMPTY_HEALTH_INPUTS, DEMO_MSP_CASE, DEMO_CASE_ID } from '../data/demonstrationCase';

/**
 * Deeply sanitizes objects before writing to Firestore.
 * Firestore will reject documents that contain `undefined` values.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    } else {
      clean[key] = null;
    }
  }
  return clean as T;
}

/**
 * Generates brand new pristine 8-dimension health inputs with zero answers carry-over.
 */
export function createPristineHealthInputs(): Record<HealthDimensionKey, HealthDimensionInput> {
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

/**
 * Creates a genuinely separate, blank business case for the user.
 * Never carries forward another client's answers, scores, diagnosis, or recommendations.
 */
export function createPristineBlankCase(profileOverrides?: Partial<BusinessProfile>): CaseRecord {
  const caseId = 'case-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  const now = new Date().toISOString();

  const profile: BusinessProfile = {
    caseId,
    name: profileOverrides?.name || 'New Client Assessment',
    industry: profileOverrides?.industry || 'Trades / Contracting',
    businessType: profileOverrides?.businessType || 'Owner-operated',
    country: profileOverrides?.country || 'New Zealand',
    currency: profileOverrides?.currency || 'NZD',
    yearsOperating: profileOverrides?.yearsOperating || 3,
    employeeCount: profileOverrides?.employeeCount ?? 10,
    subcontractorCount: profileOverrides?.subcontractorCount ?? 0,
    mainProductsServices: profileOverrides?.mainProductsServices || '',
    mainCustomerTypes: profileOverrides?.mainCustomerTypes || '',
    primaryObjective: profileOverrides?.primaryObjective || 'Improve profitability and working capital cash flow',
    primaryConcern: profileOverrides?.primaryConcern || '',
    isDemonstrationCase: false,
    createdAt: now,
    updatedAt: now,
  };

  const healthInputs = createPristineHealthInputs();

  const newCase: CaseRecord = {
    id: caseId,
    profile,
    healthInputs,
    overallHealth: null,
    financials: null,
    recommendations: null,
    conversations: [
      {
        id: 'msg-' + Date.now(),
        sender: 'coach',
        text: `Welcome to BizPulse. I am your commercial business coach. Please complete your Business Essentials and the 8 Health Dimensions to generate your evidence-based turnaround diagnostic.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ],
    actionPlan: [],
    dashboardMetrics: [],
    isUnlocked: false,
    paymentStatus: 'free',
    paymentRecord: null,
    updatedAt: now,
  };

  return newCase;
}

/**
 * Subscribes in real-time to a user's cases collection: users/{userId}/cases
 */
export function subscribeUserCases(
  userId: string,
  onUpdate: (cases: CaseRecord[]) => void,
  onError: (err: any) => void
): Unsubscribe {
  const casesRef = collection(db, 'users', userId, 'cases');
  return onSnapshot(
    casesRef,
    (snapshot) => {
      const records: CaseRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CaseRecord;
        if (data && data.profile) {
          records.push(data);
        }
      });
      // Sort by updatedAt descending (most recent first)
      records.sort((a, b) => {
        const timeA = new Date(a.updatedAt || 0).getTime();
        const timeB = new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
      onUpdate(records);
    },
    (err) => {
      console.error(`Firestore subscription error on users/${userId}/cases:`, err);
      onError(err);
    }
  );
}

/**
 * Loads all cases once for a user from Firestore: users/{userId}/cases
 */
export async function loadUserCasesOnce(userId: string): Promise<CaseRecord[]> {
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snapshot = await getDocs(casesRef);
    const records: CaseRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CaseRecord;
      if (data && data.profile) {
        records.push(data);
      }
    });
    records.sort((a, b) => {
      const timeA = new Date(a.updatedAt || 0).getTime();
      const timeB = new Date(b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
    return records;
  } catch (err) {
    console.error(`Failed to load cases from users/${userId}/cases:`, err);
    throw err;
  }
}

/**
 * Saves or updates a case in Cloud Firestore under: users/{userId}/cases/{caseId}
 */
export async function saveCaseToFirestore(userId: string, caseRecord: CaseRecord): Promise<void> {
  if (!userId || !caseRecord || !caseRecord.id) {
    throw new Error('Cannot save case: userId and caseRecord.id are required.');
  }

  const caseRef = doc(db, 'users', userId, 'cases', caseRecord.id);
  const updatedRecord: CaseRecord = {
    ...caseRecord,
    updatedAt: new Date().toISOString(),
  };

  const payload = sanitizeForFirestore(updatedRecord);
  await setDoc(caseRef, payload, { merge: true });
}

/**
 * Deletes a case from Cloud Firestore under: users/{userId}/cases/{caseId}
 */
export async function deleteCaseFromFirestore(userId: string, caseId: string): Promise<void> {
  if (!userId || !caseId) {
    throw new Error('Cannot delete case: userId and caseId are required.');
  }
  const caseRef = doc(db, 'users', userId, 'cases', caseId);
  await deleteDoc(caseRef);
}

/**
 * Seeds the NZ MSP Benchmark Demonstration Case into the user's private Firestore collection.
 */
export async function seedDemoCaseForUser(userId: string): Promise<CaseRecord> {
  const demoCopy: CaseRecord = {
    ...DEMO_MSP_CASE,
    updatedAt: new Date().toISOString(),
  };
  await saveCaseToFirestore(userId, demoCopy);
  return demoCopy;
}
