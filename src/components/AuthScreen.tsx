import React, { useState, useRef } from 'react';
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
  Check,
  Compass,
  Users,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BIZPULSE_VISION, GROWTH_ROADMAP_PILLARS } from '../data/growthRoadmap';
import { PUBLIC_MEMBERSHIP_PLANS, MEMBERSHIP_BILLING_POLICIES } from '../data/membershipPlans';

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const { login, register, resetPassword, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedPillarId, setSelectedPillarId] = useState<string>('all');
  const [preferredPlanLabel, setPreferredPlanLabel] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const authPanelRef = useRef<HTMLDivElement | null>(null);

  const handleSwitchMode = (newMode: 'signin' | 'register' | 'forgot') => {
    clearAuthError();
    setValidationError(null);
    setSuccessNotice(null);
    setMode(newMode);
  };

  const focusAuthPanel = (targetMode: 'signin' | 'register', planName?: string) => {
    if (planName) {
      setPreferredPlanLabel(planName);
    }
    handleSwitchMode(targetMode);
    authPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 200);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const visiblePillars =
    selectedPillarId === 'all'
      ? GROWTH_ROADMAP_PILLARS
      : GROWTH_ROADMAP_PILLARS.filter((p) => p.id === selectedPillarId);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#2563EB]/20 selection:text-[#0F172A]">
      {/* Top Bar (3-zone architectural header) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#0F172A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded bg-[#0B1324] text-white font-bold text-sm inline-flex items-center justify-center border-b-2 border-[#2563EB]">
              BP
            </span>
            <span
              className="font-bold text-base sm:text-lg tracking-tight text-[#0F172A]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Relaunch BizPulse
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#475569]" aria-label="Landing navigation">
            <button
              type="button"
              onClick={() => scrollToSection('who-its-for')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Who It&apos;s For
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('continuity-rhythm')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Membership Continuity
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('membership-plans')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Plans &amp; Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('development-roadmap')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Platform Capabilities
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => focusAuthPanel(mode === 'register' ? 'signin' : 'register')}
              className="px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
            >
              {mode === 'register' ? 'Sign In' : 'Start Free Trial'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Public Hero + Auth Workspace Split */}
      <main id="top" className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left Column: Owner-Centric Outcomes */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569] font-mono uppercase tracking-widest">
                  <Compass className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>For Trades, Service Businesses &amp; Family SMEs (1–20 Staff)</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F172A] leading-[1.08] max-w-2xl">
                  Understand your business. Find hidden opportunities. Improve cash flow. Make better decisions. Keep moving forward.
                </h1>

                <p className="text-lg sm:text-xl font-bold text-[#2563EB]">
                  Your Business. Your Opportunities. Your Next Move.
                </p>

                <div className="space-y-3 text-sm sm:text-base text-[#475569] leading-relaxed max-w-2xl pt-1">
                  <p>
                    Relaunch BizPulse is a practical business health, profit intelligence, and ongoing membership co-pilot built for busy owners — helping you spot cash-flow pressure, unbilled margin leakage, slow debtors, and owner bottlenecks before they turn into crises.
                  </p>
                  <p>
                    Unlike generic AI chat that forgets your business every session, BizPulse remembers your saved financials, 12-capability health baseline, CRM pipeline, ROI models, and monthly progress reviews.
                  </p>
                </div>
              </div>

              {/* Action Strip */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => focusAuthPanel('register', 'Free Trial')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('membership-plans')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded bg-white hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Compare Plans (From NZ$0)</span>
                </button>
              </div>

              {/* Available Inside Workspace Summary */}
              <div id="platform-today" className="pt-6 border-t border-[#0F172A]/10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="bizpulse-label">What Members Receive Inside Their Workspace</span>
                  <span className="text-xs text-[#15803D] font-semibold">Live Today</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-[#0F172A]/12 rounded p-4 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">01</span>
                    <h2 className="text-sm font-bold text-[#0F172A]">12-Capability Health &amp; Leakage Scan</h2>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Diagnose cash flow, pricing, debtors, concentration, staffing, and sustainability across 16 SME profit-leakage levers.
                    </p>
                  </div>
                  <div className="bg-white border border-[#0F172A]/12 rounded p-4 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">02</span>
                    <h2 className="text-sm font-bold text-[#0F172A]">Connected CRM, ROI &amp; Docs</h2>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Upload P&amp;L/debtor files for verified fact extraction alongside CRM follow-ups, ROI payback modeling, and cash checks.
                    </p>
                  </div>
                  <div className="bg-white border border-[#0F172A]/12 rounded p-4 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">03</span>
                    <h2 className="text-sm font-bold text-[#0F172A]">Weekly, Monthly &amp; Quarterly Continuity</h2>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Lock your joining baseline, track Weekly Business Pulses, run Monthly Reviews, Challenge Me sessions, and export Word/PDF/PPTX packs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Private Workspace Auth Card */}
            <div ref={authPanelRef} className="lg:col-span-5 w-full">
              <div className="bg-white border border-[#0F172A]/12 py-7 px-6 sm:px-8 rounded text-[17px] shadow-xs">
                <div className="mb-5">
                  <span className="font-mono uppercase tracking-[0.14em] block mb-1 text-[#2563EB] font-bold text-left text-[12px]">Private Business Vault</span>
                  <h2 className="text-lg font-bold text-[#0F172A]">
                    {mode === 'signin'
                      ? 'Sign In to Your Workspace'
                      : mode === 'register'
                      ? 'Create Your Free Trial Account'
                      : 'Reset Your Password'}
                  </h2>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="flex border-b border-[#0F172A]/10 pb-3 mb-5">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className={`flex-1 text-center pb-2 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                      mode === 'signin'
                        ? 'border-[#2563EB] text-[#0F172A]'
                        : 'border-transparent text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className={`flex-1 text-center pb-2 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                      mode === 'register'
                        ? 'border-[#2563EB] text-[#0F172A]'
                        : 'border-transparent text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot')}
                    className={`flex-1 text-center pb-2 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                      mode === 'forgot'
                        ? 'border-[#2563EB] text-[#0F172A]'
                        : 'border-transparent text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Reset
                  </button>
                </div>

                {/* Context Notice */}
                <div className="mb-5 text-xs text-[#475569] bg-[#F8FAFC] p-3.5 rounded border border-[#0F172A]/10 leading-relaxed space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
                    <span>Invitation-Only SME Pilot · Free Access</span>
                  </div>
                  {mode === 'signin' && (
                    <p>
                      Sign in with your invited email to resume your saved SME health diagnostics, continuity reviews, CRM follow-ups, and 30/60/90-day action plans.
                    </p>
                  )}
                  {mode === 'register' && (
                    <p>
                      {preferredPlanLabel
                        ? `Starting with Free Pilot Access (noted tier interest: ${preferredPlanLabel}). Create your private account — no payment card is requested or billed during the pilot.`
                        : 'Create your private pilot account at zero cost (no card required). Each business stays isolated inside your personal workspace vault.'}
                    </p>
                  )}
                  {mode === 'forgot' && (
                    <p>
                      Enter your registered email address to receive a password reset link.
                    </p>
                  )}
                </div>

                {/* Feedback Alerts */}
                {(authError || validationError) && (
                  <div className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{validationError || authError}</div>
                  </div>
                )}

                {successNotice && (
                  <div className="mb-5 p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs rounded flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{successNotice}</div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Work Email Address
                    </label>
                    <div className="relative rounded">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#475569]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@yourbusiness.co.nz"
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-[#F8FAFC] border border-[#0F172A]/15 rounded text-[#0F172A] placeholder-[#64748B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-xs sm:text-sm transition"
                      />
                    </div>
                  </div>

                  {mode !== 'forgot' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          Password
                        </label>
                        {mode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => handleSwitchMode('forgot')}
                            className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] font-semibold transition"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative rounded">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#475569]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="Enter password"
                          className="block w-full pl-10 pr-10 py-2.5 bg-[#F8FAFC] border border-[#0F172A]/15 rounded text-[#0F172A] placeholder-[#64748B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-xs sm:text-sm transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#475569] hover:text-[#0F172A] transition"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                        Confirm Password
                      </label>
                      <div className="relative rounded">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#475569]">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          placeholder="Repeat password"
                          className="block w-full pl-10 pr-3.5 py-2.5 bg-[#F8FAFC] border border-[#0F172A]/15 rounded text-[#0F172A] placeholder-[#64748B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-xs sm:text-sm transition"
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#475569]">
                        Minimum 6 characters required.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded bg-[#0B1324] hover:bg-[#172554] text-white text-xs font-semibold uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : mode === 'signin' ? (
                      <>
                        <span>Sign In to Workspace</span>
                        <ArrowRight className="w-4 h-4 text-[#60A5FA]" />
                      </>
                    ) : mode === 'register' ? (
                      <>
                        <span>Create Free Account &amp; Start</span>
                        <ArrowRight className="w-4 h-4 text-[#60A5FA]" />
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ArrowRight className="w-4 h-4 text-[#60A5FA]" />
                      </>
                    )}
                  </button>
                </form>

                {/* Quick toggle at bottom */}
                <div className="mt-5 pt-4 border-t border-[#0F172A]/10 text-center text-xs text-[#475569]">
                  {mode === 'signin' ? (
                    <p>
                      Need an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('register')}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-bold transition"
                      >
                        Start your Free Trial here
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('signin')}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-bold transition"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#0F172A]/10 flex items-center justify-center gap-1.5 text-[11px] text-[#475569]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                  <span>Confidential Multi-Business Isolation · Account-Owned Data</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For + Why BizPulse vs Generic AI + What Happens Next */}
        <section id="who-its-for" className="border-t border-[#0F172A]/10 bg-white py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-6 space-y-4">
                <span className="bizpulse-label flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Built for Real-World Small &amp; Family Businesses</span>
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
                  Designed for Trades, Service Firms &amp; Family Operators (1–20 Staff)
                </h2>
                <p className="text-sm text-[#475569] leading-relaxed">
                  Whether you run an electrical, plumbing, or construction trade crew, a managed IT or accounting service firm, or a family-owned B2B operator, BizPulse gives you calm, structured clarity without jargon.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                    <strong className="text-[#0F172A] block">Cash &amp; Debtor Strain</strong>
                    <span className="text-[#475569]">Spot overdue invoices, overdraft pressure, and unbilled variations before payroll week hits.</span>
                  </div>
                  <div className="p-3.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                    <strong className="text-[#0F172A] block">Owner Dependency</strong>
                    <span className="text-[#475569]">See where quoting, key clients, or firefighting rely too heavily on one owner.</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 bg-[#0B1324] text-white rounded p-6 sm:p-8 space-y-4">
                <span className="text-xs font-mono uppercase tracking-wider text-[#60A5FA] block">
                  Why BizPulse Differs from Generic ChatGPT
                </span>
                <h3 className="text-xl font-bold text-white">
                  Persistent Business Memory, Deterministic Math &amp; Honest Evidence
                </h3>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#CBD5E1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span><strong className="text-white">Never starts from blank:</strong> Remembers your 12-Capability scores, ledger cash/AR/AP, CRM pipeline, ROI models, and prior monthly reviews.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span><strong className="text-white">Verified facts vs. assumptions:</strong> Never invents financial numbers — clearly marks missing figures as Insufficient Information.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                    <span><strong className="text-white">Challenges blind spots:</strong> Interactive &ldquo;Challenge Me&rdquo; mode tests decisions against your cash and staff capacity before you spend money.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Continuity Cadence + What Happens After Registration */}
            <div id="continuity-rhythm" className="pt-8 border-t border-[#0F172A]/10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-4">
                <span className="bizpulse-label flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Ongoing Membership Continuity</span>
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
                  From First Diagnostic to Measurable Month-on-Month Progress
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                    <span className="font-mono font-bold text-[#2563EB] block">AT JOINING</span>
                    <strong className="text-[#0F172A] block text-sm">Lock Your Baseline</strong>
                    <p className="text-[#475569]">Saves your starting health score, bank cash, overdue invoices, primary concern, and initial priorities.</p>
                  </div>
                  <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                    <span className="font-mono font-bold text-[#2563EB] block">WEEKLY</span>
                    <strong className="text-[#0F172A] block text-sm">Weekly Business Pulse</strong>
                    <p className="text-[#475569]">10-minute Monday check-in tracking completed vs. stalled actions, cash alerts, and next week&apos;s top 3 priorities.</p>
                  </div>
                  <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                    <span className="font-mono font-bold text-[#2563EB] block">MONTHLY</span>
                    <strong className="text-[#0F172A] block text-sm">Monthly Business Review</strong>
                    <p className="text-[#475569]">Compares current reality against both your joining baseline and last month — highlighting real gains and unresolved issues.</p>
                  </div>
                  <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1">
                    <span className="font-mono font-bold text-[#2563EB] block">QUARTERLY</span>
                    <strong className="text-[#0F172A] block text-sm">Sustainability Review</strong>
                    <p className="text-[#475569]">Tracks whether resilience is Strengthening, Holding, or Under Strain and guides whether to Stabilise, Improve, or Expand.</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#F8FAFC] border border-[#0F172A]/12 rounded p-6 space-y-4">
                <span className="bizpulse-label flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>What Happens After Registration</span>
                </span>
                <ol className="space-y-3 text-xs sm:text-sm text-[#0F172A]">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded bg-[#0B1324] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">1</span>
                    <div>
                      <strong className="block">Enter Your Business Profile &amp; 12 Health Checks</strong>
                      <span className="text-xs text-[#475569]">Takes ~10 minutes on a clean workspace (plus an optional Sample Demo Business to explore).</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded bg-[#0B1324] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">2</span>
                    <div>
                      <strong className="block">Generate Your Profit, Cash &amp; Sustainability Plan</strong>
                      <span className="text-xs text-[#475569]">Upload financials if available, review your 30/60/90-day plan, and lock your Joining Baseline.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded bg-[#0B1324] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">3</span>
                    <div>
                      <strong className="block">Run Weekly Pulses, Coach Chats &amp; Monthly Reviews</strong>
                      <span className="text-xs text-[#475569]">Stay on Free Trial or upgrade to a monthly NZD plan whenever you need higher allowances or multiple businesses.</span>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Pre-Registration Membership Plans & Billing Clarity */}
        <section id="membership-plans" className="border-t border-[#0F172A]/10 bg-[#F8FAFC] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#0F172A]/10 pb-5">
              <div className="space-y-1.5">
                <span className="bizpulse-label block">Transparent Membership Plans (NZD)</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
                  Start Free, Upgrade Only When Your Business Needs More Capacity
                </h2>
              </div>
              <span className="text-xs text-[#475569] font-medium">
                No lock-in contracts · Cancel anytime · Data remains yours
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {PUBLIC_MEMBERSHIP_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded p-6 border flex flex-col justify-between space-y-5 ${
                    plan.id === 'business_plus_monthly'
                      ? 'bg-[#0B1324] text-white border-[#0B1324]'
                      : plan.highlight
                      ? 'bg-white border-2 border-[#2563EB] text-[#0F172A]'
                      : 'bg-white border-[#0F172A]/12 text-[#0F172A]'
                  }`}
                >
                  <div className="space-y-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block ${
                        plan.id === 'business_plus_monthly' ? 'text-[#60A5FA]' : 'text-[#2563EB]'
                      }`}
                    >
                      {plan.badge}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                        <span className="text-2xl font-bold">NZ${plan.priceNzd}</span>
                        <span
                          className={`text-xs ${
                            plan.id === 'business_plus_monthly' ? 'text-[#CBD5E1]' : 'text-[#475569]'
                          }`}
                        >
                          {plan.priceNzd === 0 ? '/ month' : '/ month'}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-1.5 leading-relaxed ${
                          plan.id === 'business_plus_monthly' ? 'text-[#CBD5E1]' : 'text-[#475569]'
                        }`}
                      >
                        {plan.audience}
                      </p>
                    </div>

                    <ul
                      className={`space-y-2 text-xs pt-3 border-t ${
                        plan.id === 'business_plus_monthly'
                          ? 'border-white/15 text-[#E2E8F0]'
                          : 'border-[#0F172A]/10 text-[#0F172A]'
                      }`}
                    >
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2">
                          <Check
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              plan.id === 'business_plus_monthly' ? 'text-[#60A5FA]' : 'text-[#15803D]'
                            }`}
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => focusAuthPanel('register', plan.name)}
                    className={`w-full py-2.5 px-4 rounded text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                      plan.id === 'business_plus_monthly'
                        ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                        : plan.highlight
                        ? 'bg-[#0B1324] hover:bg-[#172554] text-white'
                        : 'bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15'
                    }`}
                  >
                    {plan.priceNzd === 0 ? 'Start Free Trial' : `Choose ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white border border-[#0F172A]/12 rounded p-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-[#475569]">
              <div>
                <strong className="text-[#0F172A] block mb-1">Monthly Allowance Behavior</strong>
                <p className="leading-relaxed">{MEMBERSHIP_BILLING_POLICIES.allowancePolicy}</p>
              </div>
              <div>
                <strong className="text-[#0F172A] block mb-1">Renewal &amp; Cancellation</strong>
                <p className="leading-relaxed">{MEMBERSHIP_BILLING_POLICIES.cancellationPolicy}</p>
              </div>
              <div>
                <strong className="text-[#0F172A] block mb-1">NZD Pricing &amp; GST Notice</strong>
                <p className="leading-relaxed">
                  {MEMBERSHIP_BILLING_POLICIES.currencyNotice} {MEMBERSHIP_BILLING_POLICIES.gstNotice}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Development Roadmap / Platform Capabilities Section */}
        <section
          id="development-roadmap"
          className="border-t border-[#0F172A]/10 bg-white py-14 lg:py-18"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#0F172A]/10 pb-5">
              <div className="space-y-1.5">
                <span className="bizpulse-label block">Integrated SME Toolkit</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
                  Platform Capabilities &amp; Roadmap
                </h2>
              </div>

              <div
                className="flex flex-wrap items-center gap-1 p-1 bg-[#F8FAFC] rounded border border-[#0F172A]/10"
                role="tablist"
                aria-label="Filter development roadmap pillars"
              >
                <button
                  type="button"
                  onClick={() => setSelectedPillarId('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap shrink-0 ${
                    selectedPillarId === 'all'
                      ? 'bg-[#0B1324] text-white'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  All 4 Pillars
                </button>
                {GROWTH_ROADMAP_PILLARS.map((pillar) => (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => setSelectedPillarId(pillar.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap shrink-0 ${
                      selectedPillarId === pillar.id
                        ? 'bg-[#0B1324] text-white'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {pillar.number}. {pillar.title.split('&')[0].trim()}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`grid grid-cols-1 ${
                visiblePillars.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'
              } gap-6`}
            >
              {visiblePillars.map((pillar) => (
                <article
                  key={pillar.id}
                  className="bg-[#F8FAFC] border border-[#0F172A]/12 rounded p-6 sm:p-8 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                      <span className="font-mono font-bold text-[#2563EB] tracking-wider">
                        {pillar.number}.
                      </span>
                      <span>{pillar.releaseStatus}</span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-[#0F172A]">
                        {pillar.number}. {pillar.title}
                      </h3>
                      <p className="text-sm font-semibold text-[#2563EB] mt-1">
                        {pillar.tagline}
                      </p>
                      <p className="text-sm text-[#475569] mt-3 leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#0F172A]/10 space-y-2.5">
                      <span className="bizpulse-label block">Capabilities</span>
                      <ul className="space-y-2">
                        {pillar.capabilities.map((cap) => (
                          <li
                            key={cap}
                            className="flex items-start gap-2.5 text-xs sm:text-sm text-[#0F172A]"
                          >
                            <Check className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Our Commitment & Simple Ambition */}
        <section id="our-commitment" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="bizpulse-hero-gradient text-white rounded p-8 sm:p-10 lg:p-12 border border-[#0F172A]/15 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-4">
                <span className="text-xs font-mono uppercase tracking-widest text-[#60A5FA] block">
                  Practical &amp; Progressive
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  {BIZPULSE_VISION.commitmentTitle}
                </h2>
                <div className="space-y-3 text-sm sm:text-base text-[#CBD5E1] leading-relaxed">
                  {BIZPULSE_VISION.commitmentParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-white/5 border border-white/15 rounded p-6 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#60A5FA] block">
                  {BIZPULSE_VISION.ambitionLead}
                </span>
                <p className="text-sm sm:text-base font-medium text-white leading-relaxed">
                  {BIZPULSE_VISION.ambitionStatement}
                </p>
                <button
                  type="button"
                  onClick={() => focusAuthPanel('register', 'Free Trial')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Start Your Free Diagnostic</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="pt-6 border-t border-white/15 text-xs italic text-[#CBD5E1]">
              Commercial decision-support platform only — not formal tax, legal, valuation, or insolvency advice. Consult your Chartered Accountant or lawyer on regulated decisions.
            </p>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-[#0F172A]/10 py-6 text-xs text-[#475569]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Relaunch BizPulse © 2026 · SME Business Health, Profit Intelligence &amp; Continuity</span>
          <span>Your Business. Your Opportunities. Your Next Move.</span>
        </div>
      </footer>
    </div>
  );
};
