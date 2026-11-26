import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyB_MoBqVMOPUV0uEfsqPEXAqED04CwNUrY",
  authDomain: "relaunch-bizpulse.firebaseapp.com",
  projectId: "relaunch-bizpulse",
  storageBucket: "relaunch-bizpulse.firebasestorage.app",
  messagingSenderId: "749688976773",
  appId: "1:749688976773:web:02c86fa2c3df0c0d9e00ec"
};

// Initialize Firebase once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Returns authorization headers including the current user's verified Firebase ID token.
 */
export async function getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    return { 'Content-Type': 'application/json' };
  }
  try {
    const token = await user.getIdToken(forceRefresh);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID token:', err);
    return { 'Content-Type': 'application/json' };
  }
}

/**
 * Trims heavy raw extracted file previews from uploadedDocuments before sending AI context
 * so multi-document workspaces never trigger payload size or prompt-token truncation errors.
 */
export function sanitizeDocumentsForAiPayload(docs?: any[]): any[] {
  if (!Array.isArray(docs)) return [];
  return docs.map((d) => {
    if (!d || typeof d !== 'object') return d;
    const { extractedPreview: _omit, ...rest } = d;
    return rest;
  });
}

export interface ApiFetchResult<T = any> {
  data: T;
  status: number;
}

/**
 * Authenticated JSON POST/GET helper with automatic 401 token-refresh retry,
 * timeout protection, and safe non-JSON proxy-error parsing.
 */
export async function apiFetchWithAuth<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<ApiFetchResult<T>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Your sign-in session is missing or expired. Please sign in again to continue.');
  }

  const execute = async (forceRefresh: boolean): Promise<Response> => {
    const headers = await getAuthHeaders(forceRefresh);
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 95_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        method: options.method || 'POST',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(
          'The AI coaching request timed out after 95 seconds. Please click Retry to try again.'
        );
      }
      throw new Error(
        `Network error reaching server (${err?.message || 'connection interrupted'}). Please check your connection and retry.`
      );
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await execute(false);
  if (response.status === 401) {
    // Token may be freshly expired or revoked locally — refresh once and retry
    response = await execute(true);
  }

  const rawText = await response.text();
  let parsed: any = {};
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!response.ok) {
        const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
        throw new Error(
          `Server returned HTTP ${response.status}${snippet ? `: ${snippet}` : '. Please retry shortly.'}`
        );
      }
      throw new Error('Server returned a malformed non-JSON response. Please retry.');
    }
  }

  if (!response.ok) {
    const err = new Error(
      parsed?.error || `Request failed with HTTP ${response.status}. Please retry.`
    ) as Error & { accountUsage?: any; status?: number; code?: string };
    if (parsed?.accountUsage) err.accountUsage = parsed.accountUsage;
    err.status = response.status;
    if (parsed?.code) err.code = parsed.code;
    throw err;
  }

  return { data: parsed as T, status: response.status };
}

export default app;
