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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BIZPULSE_VISION, GROWTH_ROADMAP_PILLARS } from '../data/growthRoadmap';

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
  const [selectedPillarId, setSelectedPillarId] = useState<string>('all');

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const authPanelRef = useRef<HTMLDivElement | null>(null);

  const handleSwitchMode = (newMode: 'signin' | 'register' | 'forgot') => {
    clearAuthError();
    setValidationError(null);
    setSuccessNotice(null);
    setMode(newMode);
  };

  const focusAuthPanel = (targetMode: 'signin' | 'register') => {
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
              onClick={() => scrollToSection('platform-today')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Platform Today
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('development-roadmap')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Development Roadmap
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('our-commitment')}
              className="hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
            >
              Our Commitment
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => focusAuthPanel(mode === 'register' ? 'signin' : 'register')}
              className="px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
            >
              {mode === 'register' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Public Hero + Auth Workspace Split */}
      <main id="top" className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left Column: Proposition & Current Diagnostic Platform */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569] font-mono uppercase tracking-widest">
                  <Compass className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>AI-Powered Business Health, Growth &amp; Development Platform</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0F172A] leading-[1.08] max-w-2xl">
                  {BIZPULSE_VISION.headline}
                </h1>

                <p className="text-lg sm:text-xl font-bold text-[#2563EB]">
                  {BIZPULSE_VISION.subheading}
                </p>

                <div className="space-y-4 text-sm sm:text-base text-[#475569] leading-relaxed max-w-2xl pt-1">
                  {BIZPULSE_VISION.introParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Action Strip */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => scrollToSection('development-roadmap')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Explore Development Roadmap</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => focusAuthPanel('signin')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded bg-white hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Access Private Workspace</span>
                </button>
              </div>

              {/* Available Today Summary */}
              <div id="platform-today" className="pt-6 border-t border-[#0F172A]/10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="bizpulse-label">Available Inside Your Workspace Today</span>
                  <span className="text-xs text-[#15803D] font-semibold">Live Today</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-[#0F172A]/12 rounded p-4 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">01</span>
                    <h2 className="text-sm font-bold text-[#0F172A]">12-Capability Health Audit</h2>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Structured diagnostic across cash flow, pricing &amp; margins, customers, competition, scalability, systems, and sustainability.
                    </p>
                  </div>
                  <div className="bg-white border border-[#0F172A]/12 rounded p-4 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">02</span>
                    <h2 className="text-sm font-bold text-[#0F172A]">CRM, ROI &amp; Cash Calculators</h2>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Upload financial statements for verified fact extraction alongside connected CRM pipelines, ROI break-even scenarios, and cash flow models.
                    </p>
                  </div>
                  <div className="bg-white border border-[#0F172A]/12 rounded p-4 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">03</span>
                    <h2 className="text-sm font-bold text-[#0F172A]">Executive Coaching &amp; Reports</h2>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      Practical 90-day turnarounds, 7-day sprints, Challenge Me stress-tests, AI coaching, and custom-edited PDF &amp; Word exports.
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
                      ? 'Create Your Account'
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
                <div className="mb-5 text-xs text-[#475569] bg-[#F8FAFC] p-3.5 rounded border border-[#0F172A]/10 leading-relaxed">
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
                        placeholder="name@business.co.nz"
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
                        <span>Create Account &amp; Start Diagnostic</span>
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
                        Register here
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
                  <span>Confidential Multi-Business Isolation · Firebase Secured</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Development Roadmap Section */}
        <section
          id="development-roadmap"
          className="border-t border-[#0F172A]/10 bg-white py-14 lg:py-18"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#0F172A]/10 pb-5">
              <div className="space-y-1.5">
                <span className="bizpulse-label block">Future Platform Evolution</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
                  Our Development Roadmap
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
                  onClick={() => focusAuthPanel('register')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap shrink-0"
                >
                  <span>Start Your Diagnostic</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="pt-6 border-t border-white/15 text-xs italic text-[#CBD5E1]">
              {BIZPULSE_VISION.disclaimer}
            </p>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-[#0F172A]/10 py-6 text-xs text-[#475569]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Relaunch BizPulse © 2026 · Executive Coaching &amp; Diagnostic OS</span>
          <span>Gain Clarity. Shape Your Future, Here and Now.</span>
        </div>
      </footer>
    </div>
  );
};
