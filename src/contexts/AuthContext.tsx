import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  UserCredential
} from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  register: (email: string, password: string) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function formatFirebaseError(err: any): string {
  if (!err) return 'An unknown error occurred.';
  const code = err.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address format is invalid.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account exists with this email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in the Firebase Console.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to multiple failed attempts. Please try again later or reset password.';
    default:
      return err.message || 'Authentication failed. Please try again.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
      },
      (error) => {
        console.error('Firebase Auth State Error:', error);
        setAuthError(formatFirebaseError(error));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const register = async (email: string, pass: string): Promise<UserCredential> => {
    try {
      setAuthError(null);
      return await createUserWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = formatFirebaseError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const login = async (email: string, pass: string): Promise<UserCredential> => {
    try {
      setAuthError(null);
      return await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = formatFirebaseError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setAuthError(null);
      await signOut(auth);
    } catch (err: any) {
      const msg = formatFirebaseError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = formatFirebaseError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        authError,
        clearAuthError,
        register,
        login,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
