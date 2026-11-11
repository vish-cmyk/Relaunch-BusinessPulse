import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { login, register, resetPassword, authError, clearAuthError } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [email, setEmail] = useState('vish@relaunch.co.nz');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSwitchMode = (newMode: 'signin' | 'register' | 'forgot') => {
    clearAuthError();
    setValidationError(null);
    setSuccessNotice(null);
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setValidationError(null);
    setSuccessNotice(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setValidationError('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      try {
        setIsSubmitting(true);
        await resetPassword(cleanEmail);
        setSuccessNotice('Password reset email sent! Please check your inbox and follow the link.');
      } catch (err: any) {
        // authError is set in context
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setValidationError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match. Please verify both fields.');
        return;
      }

      try {
        setIsSubmitting(true);
        await register(cleanEmail, password);
        onSuccess?.();
      } catch (err) {
        // authError is set in context
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        setIsSubmitting(true);
        await login(cleanEmail, password);
        onSuccess?.();
      } catch (err) {
        // authError is set in context
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-slate-100">
      {/* Background radial accent glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-amber-500/10 via-orange-500/10 to-rose-600/5 blur-3xl pointer-events-none rounded-full" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 text-slate-950 font-black text-2xl shadow-xl shadow-orange-500/20 mb-4 border border-amber-400/30">
          BP
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Relaunch BizPulse
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Executive SME Turnaround & Diagnostic Operating System
        </p>
        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>Cloud Firestore & Firebase Auth Secured</span>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-2xl">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800 pb-4 mb-6">
            <button
              type="button"
              onClick={() => handleSwitchMode('signin')}
              className={`flex-1 text-center pb-2 text-xs font-semibold tracking-wide transition border-b-2 ${
                mode === 'signin'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`flex-1 text-center pb-2 text-xs font-semibold tracking-wide transition border-b-2 ${
                mode === 'register'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('forgot')}
              className={`flex-1 text-center pb-2 text-xs font-semibold tracking-wide transition border-b-2 ${
                mode === 'forgot'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Reset Key
            </button>
          </div>

          {/* Context Notice */}
          <div className="mb-5 text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
            {mode === 'signin' && (
              <p>
                Sign in to access your confidential client turnaround cases, customer profitability matrices, and AI coach consultations.
              </p>
            )}
            {mode === 'register' && (
              <p>
                Register an adviser account. Your client records are stored exclusively in your private Firestore vault (<code className="text-amber-400 font-mono">users/&#123;uid&#125;/cases</code>).
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Enter your registered email address to receive a secure password reset link via Firebase Authentication.
              </p>
            )}
          </div>

          {/* Feedback Alerts */}
          {(authError || validationError) && (
            <div className="mb-5 p-3.5 bg-rose-950/70 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{validationError || authError}</div>
            </div>
          )}

          {successNotice && (
            <div className="mb-5 p-3.5 bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{successNotice}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@business.co.nz"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs sm:text-sm transition"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot')}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs sm:text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs sm:text-sm transition"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Minimum 6 characters. Use a strong, unique password.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-orange-500/20 transition transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === 'signin' ? (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : mode === 'register' ? (
                <>
                  <span>Create Workspace & Start Diagnostic</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick toggle at bottom */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            {mode === 'signin' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strict Client Isolation — All cases scoped to <code className="font-mono text-slate-300">users/&#123;userId&#125;/cases</code></span>
          </p>
          <p>Relaunch BizPulse © 2026 • Confidential Commercial Operating System</p>
        </div>
      </div>
    </div>
  );
};
