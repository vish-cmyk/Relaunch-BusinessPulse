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
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    return { 'Content-Type': 'application/json' };
  }
  try {
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID token:', err);
    return { 'Content-Type': 'application/json' };
  }
}

export default app;
