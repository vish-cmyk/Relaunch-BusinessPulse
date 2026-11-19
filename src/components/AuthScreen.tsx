import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
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
        setSuccessNotice('Password reset email sent. Please check your inbox and follow the link.');
      } catch {
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
      } catch {
        // authError is set in context
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        setIsSubmitting(true);
        await login(cleanEmail, password);
        onSuccess?.();
      } catch {
        // authError is set in context
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bizpulse-hero-gradient flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-[#0B1324]">
      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1D4ED8] text-white font-extrabold text-2xl shadow-lg mb-4 border border-white/20">
          BP
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Relaunch BizPulse
        </h1>
        <p className="mt-1.5 text-sm text-[#CBD5E1]">
          Executive Coaching &amp; Diagnostic OS for SMEs
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-[#93C5FD] border border-white/15">
          <Database className="w-3.5 h-3.5 text-[#93C5FD]" />
          <span>Private Multi-Business Cloud Workspace</span>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white border border-[#D9E2F0] py-8 px-6 sm:px-10 shadow-2xl rounded-2xl">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-[#E8EEF7] pb-4 mb-6">
            <button
              type="button"
              onClick={() => handleSwitchMode('signin')}
              className={`flex-1 text-center pb-2 text-xs font-bold tracking-wide transition border-b-2 ${
                mode === 'signin'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-[#52627A] hover:text-[#0B1324]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`flex-1 text-center pb-2 text-xs font-bold tracking-wide transition border-b-2 ${
                mode === 'register'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-[#52627A] hover:text-[#0B1324]'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('forgot')}
              className={`flex-1 text-center pb-2 text-xs font-bold tracking-wide transition border-b-2 ${
                mode === 'forgot'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-[#52627A] hover:text-[#0B1324]'
              }`}
            >
              Reset Password
            </button>
          </div>

          {/* Context Notice */}
          <div className="mb-5 text-xs text-[#52627A] bg-[#F3F6FB] p-3.5 rounded-xl border border-[#E8EEF7] leading-relaxed">
            {mode === 'signin' && (
              <p>
                Sign in to resume your saved SME health diagnostics, uploaded document reviews, and executive action plans.
              </p>
            )}
            {mode === 'register' && (
              <p>
                Create your private coaching account. Each business you add stays isolated inside your personal workspace vault.
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Enter your registered email address to receive a password reset link via Firebase Authentication.
              </p>
            )}
          </div>

          {/* Feedback Alerts */}
          {(authError || validationError) && (
            <div className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{validationError || authError}</div>
            </div>
          )}

          {successNotice && (
            <div className="mb-5 p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successNotice}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0B1324] mb-1.5">
                Work Email Address
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52627A]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@business.co.nz"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl text-[#0B1324] placeholder-[#52627A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8] text-xs sm:text-sm transition"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#0B1324]">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot')}
                      className="text-[11px] text-[#1D4ED8] hover:text-[#1E40AF] font-semibold transition"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52627A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter password"
                    className="block w-full pl-10 pr-10 py-2.5 bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl text-[#0B1324] placeholder-[#52627A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8] text-xs sm:text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#52627A] hover:text-[#0B1324] transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#0B1324] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52627A]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat password"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl text-[#0B1324] placeholder-[#52627A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8] text-xs sm:text-sm transition"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#52627A]">
                  Minimum 6 characters required.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs sm:text-sm font-bold shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === 'signin' ? (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : mode === 'register' ? (
                <>
                  <span>Create Account &amp; Start Diagnostic</span>
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
          <div className="mt-6 pt-4 border-t border-[#E8EEF7] text-center text-xs text-[#52627A]">
            {mode === 'signin' ? (
              <p>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="text-[#1D4ED8] hover:text-[#1E40AF] font-bold transition"
                >
                  Register here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="text-[#1D4ED8] hover:text-[#1E40AF] font-bold transition"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Security footer */}
        <div className="mt-6 text-center text-[11px] text-[#CBD5E1] space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-white font-medium">
            <ShieldCheck className="w-4 h-4 text-[#93C5FD]" />
            <span>Confidential Multi-Business Isolation</span>
          </p>
          <p className="text-[#94A3B8]">Relaunch BizPulse © 2026 • Executive Coaching &amp; Diagnostic OS</p>
        </div>
      </div>
    </div>
  );
};
