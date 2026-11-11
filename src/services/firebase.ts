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
export default app;
