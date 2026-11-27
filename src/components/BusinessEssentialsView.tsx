import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  Target,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import { BusinessProfile, IndustryType, BusinessStructureType } from '../types/bizpulse';
import { InfoTooltip } from './InfoTooltip';

interface BusinessEssentialsViewProps {
  profile: BusinessProfile;
  onUpdateProfile: (updated: BusinessProfile) => void;
  onProceedToHealth: () => void;
  onProceedToDocuments?: () => void;
}

const INDUSTRIES: IndustryType[] = [
  'Trades / Contracting',
  'Retail / E-commerce',
  'Professional Services',
  'Hospitality & Food',
  'IT & Managed Services',
  'Manufacturing & Engineering',
  'Healthcare & Wellness',
  'Transport & Logistics',
  'Other',
];

const BUSINESS_STRUCTURES: BusinessStructureType[] = [
  'Owner-operated',
  'Family business',
  'Partnership',
  'Company with management team',
];

const CURRENCIES = [
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar (NZD)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD)' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CAD)' },
];

interface EssentialStepMeta {
  stepNumber: number;
  shortLabel: string;
  questionTitle: string;
  helperText: string;
  required: boolean;
  isComplete: (p: BusinessProfile) => boolean;
}

const ESSENTIAL_STEPS: EssentialStepMeta[] = [
  {
    stepNumber: 1,
    shortLabel: 'Name',
    questionTitle: 'What is the legal or trading name of your business?',
    helperText: 'Used across all health diagnostics, action plans, and exported executive reports.',
    required: true,
    isComplete: (p) => Boolean(p.name && p.name.trim()),
  },
  {
    stepNumber: 2,
    shortLabel: 'Industry',
    questionTitle: 'Which industry sector best describes your primary operations?',
    helperText: 'Calibrates KPI presets, margin benchmarks, and coaching scenarios for your trade or sector.',
    required: true,
    isComplete: (p) => Boolean(p.industry && p.industry.trim()),
  },
  {
    stepNumber: 3,
    shortLabel: 'Structure',
    questionTitle: 'What is your current ownership and management structure?',
    helperText: 'Helps BizPulse evaluate owner dependency, delegation readiness, and continuity risks.',
    required: true,
    isComplete: (p) => Boolean(p.businessType && p.businessType.trim()),
  },
  {
    stepNumber: 4,
    shortLabel: 'Location & Currency',
    questionTitle: 'Where does the business operate and in which reporting currency?',
    helperText: 'Aligns tax/payment-term context and ensures all financial figures display in your currency.',
    required: true,
    isComplete: (p) => Boolean(p.country && p.country.trim() && p.currency && p.currency.trim()),
  },
  {
    stepNumber: 5,
    shortLabel: 'Scale & Tenure',
    questionTitle: 'How long has the business operated, and how many staff or subcontractors work in it?',
    helperText: 'Establishes workforce capacity for revenue-per-person metrics and delegation planning.',
    required: false,
    isComplete: (p) => Number(p.yearsOperating) > 0 || Number(p.employeeCount) > 0 || Number(p.subcontractorCount) > 0,
  },
  {
    stepNumber: 6,
    shortLabel: 'Turnover',
    questionTitle: 'What is your approximate annual turnover band?',
    helperText: 'Optional context used to size commercial recommendations when exact P&L numbers are not yet entered.',
    required: false,
    isComplete: (p) => Boolean(p.turnoverRange && p.turnoverRange.trim()),
  },
  {
    stepNumber: 7,
    shortLabel: 'Customers',
    questionTitle: 'Who are your main customer types?',
    helperText: 'Specify the customer segments you rely on (e.g., commercial builders, residential homeowners, B2B SMEs).',
    required: true,
    isComplete: (p) => Boolean(p.mainCustomerTypes && p.mainCustomerTypes.trim()),
  },
  {
    stepNumber: 8,
    shortLabel: 'Offerings',
    questionTitle: 'What main products or services do you sell and deliver?',
    helperText: 'Describe your core revenue-generating work so profit leakage and pricing advice stay grounded.',
    required: true,
    isComplete: (p) => Boolean(p.mainProductsServices && p.mainProductsServices.trim()),
  },
  {
    stepNumber: 9,
    shortLabel: 'Objective',
    questionTitle: 'What is your primary business objective over the next 6–12 months?',
    helperText: 'Sets the commercial direction against which all recommendations and Challenge Me tests are benchmarked.',
    required: true,
    isComplete: (p) => Boolean(p.primaryObjective && p.primaryObjective.trim()),
  },
  {
    stepNumber: 10,
    shortLabel: 'Primary Concern',
    questionTitle: 'What is the single most important concern or pressure right now?',
    helperText: 'Be candid about cash stress, margin squeeze, workload, or client risk so coaching tackles the real issue first.',
    required: true,
    isComplete: (p) => Boolean(p.primaryConcern && p.primaryConcern.trim()),
  },
];

export const BusinessEssentialsView: React.FC<BusinessEssentialsViewProps> = ({
  profile,
  onUpdateProfile,
  onProceedToHealth,
  onProceedToDocuments,
}) => {
  const getSmartInitialPosition = (p: BusinessProfile): { stepIdx: number; reviewMode: boolean } => {
    const cleanName = (p.name || '').trim();
    const isBlankStarter =
      !cleanName || cleanName === 'New Business Case' || cleanName === 'My Business Assessment';
    if (isBlankStarter) {
      return { stepIdx: 0, reviewMode: false };
    }
    const firstIncompleteIdx = ESSENTIAL_STEPS.findIndex((s) => s.required && !s.isComplete(p));
    if (firstIncompleteIdx >= 0) {
      return { stepIdx: firstIncompleteIdx, reviewMode: false };
    }
    return { stepIdx: 0, reviewMode: true };
  };

  const initialPos = getSmartInitialPosition(profile);
  const [formData, setFormData] = useState<BusinessProfile>(profile);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(initialPos.stepIdx);
  const [showAllReview, setShowAllReview] = useState<boolean>(initialPos.reviewMode);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const latestFormRef = useRef<BusinessProfile>(profile);
  const isDirtyRef = useRef<boolean>(false);
  const onUpdateProfileRef = useRef(onUpdateProfile);
  onUpdateProfileRef.current = onUpdateProfile;

  useEffect(() => {
    const nextPos = getSmartInitialPosition(profile);
    setFormData(profile);
    latestFormRef.current = profile;
    isDirtyRef.current = false;
    setCurrentStepIdx(nextPos.stepIdx);
    setShowAllReview(nextPos.reviewMode);
    setIsSaved(false);
    setStepError(null);
  }, [profile.caseId]);

  // Flush any unsaved changes if user switches away to another top navigation tab
  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        onUpdateProfileRef.current({
          ...latestFormRef.current,
          updatedAt: new Date().toISOString(),
        });
        isDirtyRef.current = false;
      }
    };
  }, []);

  const persistIfDirty = (dataToSave?: BusinessProfile, showToast = false) => {
    const target = dataToSave || latestFormRef.current;
    if (isDirtyRef.current || showToast) {
      onUpdateProfile({
        ...target,
        updatedAt: new Date().toISOString(),
      });
      isDirtyRef.current = false;
      if (showToast) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3500);
      }
    }
  };

  const handleChange = (field: keyof BusinessProfile, value: string | number | boolean) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      latestFormRef.current = next;
      return next;
    });
    isDirtyRef.current = true;
    setIsSaved(false);
    setStepError(null);
  };

  const currentStep = ESSENTIAL_STEPS[currentStepIdx];
  const completedCount = ESSENTIAL_STEPS.filter((s) => s.isComplete(formData)).length;
  const requiredCompletedCount = ESSENTIAL_STEPS.filter((s) => s.required && s.isComplete(formData)).length;
  const totalRequiredCount = ESSENTIAL_STEPS.filter((s) => s.required).length;
  const progressPct = Math.round(((currentStepIdx + 1) / ESSENTIAL_STEPS.length) * 100);

  const validateCurrentStep = (): boolean => {
    if (currentStep.required && !currentStep.isComplete(formData)) {
      setStepError(`Please complete Question ${currentStep.stepNumber} (${currentStep.shortLabel}) before continuing.`);
      return false;
    }
    setStepError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    persistIfDirty();
    if (currentStepIdx < ESSENTIAL_STEPS.length - 1) {
      setCurrentStepIdx((idx) => idx + 1);
    } else {
      setShowAllReview(true);
      persistIfDirty(formData, true);
    }
  };

  const handlePrevious = () => {
    setStepError(null);
    persistIfDirty();
    if (showAllReview) {
      setShowAllReview(false);
      setCurrentStepIdx(ESSENTIAL_STEPS.length - 1);
      return;
    }
    if (currentStepIdx > 0) {
      setCurrentStepIdx((idx) => idx - 1);
    }
  };

  const handleJumpToStep = (idx: number) => {
    setStepError(null);
    persistIfDirty();
    setShowAllReview(false);
    setCurrentStepIdx(idx);
  };

  const handleSaveManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    persistIfDirty(formData, true);
  };

  const renderStepInputs = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        return (
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="bizpulse-label">
                Business / Trading Name <span className="text-[#B91C1C]">* (Mandatory)</span>
              </span>
              <span className="text-[11px] text-[#475569]">Legal or Trading</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => persistIfDirty()}
              placeholder="e.g., Tasman Plumbing & Gas Ltd, Harbourside Cafe"
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-2">
            <label className="bizpulse-label block">
              Industry &amp; Sector <span className="text-[#B91C1C]">* (Mandatory)</span>
            </label>
            <select
              value={formData.industry}
              onChange={(e) => {
                handleChange('industry', e.target.value as IndustryType);
                persistIfDirty({ ...latestFormRef.current, industry: e.target.value as IndustryType });
              }}
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        );

      case 3:
        return (
          <div className="space-y-2">
            <label className="bizpulse-label block">
              Business Structure <span className="text-[#B91C1C]">* (Mandatory)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BUSINESS_STRUCTURES.map((struct) => {
                const active = formData.businessType === struct;
                return (
                  <button
                    key={struct}
                    type="button"
                    onClick={() => {
                      handleChange('businessType', struct);
                      persistIfDirty({ ...latestFormRef.current, businessType: struct });
                    }}
                    className={`p-3.5 rounded border text-left text-sm font-semibold transition ${
                      active
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-[#FCFCFC] text-[#0F172A] border-[#0F172A]/15 hover:border-[#2563EB]'
                    }`}
                  >
                    {struct}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="bizpulse-label block">
                Country <span className="text-[#B91C1C]">* (Mandatory)</span>
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                onBlur={() => persistIfDirty()}
                placeholder="e.g., New Zealand, Australia"
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-3.5 py-2.5 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="bizpulse-label block">
                Reporting Currency <span className="text-[#B91C1C]">* (Mandatory)</span>
              </label>
              <select
                value={formData.currency}
                onChange={(e) => {
                  handleChange('currency', e.target.value);
                  persistIfDirty({ ...latestFormRef.current, currency: e.target.value });
                }}
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-3.5 py-2.5 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="bizpulse-label block">Years Operating (Optional)</label>
              <input
                type="number"
                min="0"
                value={formData.yearsOperating}
                onChange={(e) => handleChange('yearsOperating', Math.max(0, Number(e.target.value) || 0))}
                onBlur={() => persistIfDirty()}
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-3.5 py-2.5 text-sm text-[#0F172A] tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="bizpulse-label block">Employees (Optional)</label>
              <input
                type="number"
                min="0"
                value={formData.employeeCount}
                onChange={(e) => handleChange('employeeCount', Math.max(0, Number(e.target.value) || 0))}
                onBlur={() => persistIfDirty()}
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-3.5 py-2.5 text-sm text-[#0F172A] tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="bizpulse-label block">Subcontractors (Optional)</label>
              <input
                type="number"
                min="0"
                value={formData.subcontractorCount}
                onChange={(e) => handleChange('subcontractorCount', Math.max(0, Number(e.target.value) || 0))}
                onBlur={() => persistIfDirty()}
                className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-3.5 py-2.5 text-sm text-[#0F172A] tabular-nums focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-2">
            <label className="bizpulse-label block">Annual Turnover Range (Optional)</label>
            <select
              value={formData.turnoverRange || ''}
              onChange={(e) => {
                handleChange('turnoverRange', e.target.value);
                persistIfDirty({ ...latestFormRef.current, turnoverRange: e.target.value });
              }}
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Select turnover band (optional)</option>
              <option value="< 250k">Under {formData.currency} 250k</option>
              <option value="250k – 500k">{formData.currency} 250k – 500k</option>
              <option value="500k – 1M">{formData.currency} 500k – 1M</option>
              <option value="1M – 2.5M">{formData.currency} 1M – 2.5M</option>
              <option value="2.5M – 5M">{formData.currency} 2.5M – 5M</option>
              <option value="5M+">{formData.currency} 5M+</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        );

      case 7:
        return (
          <div className="space-y-2">
            <label className="bizpulse-label block">
              Main Customer Types <span className="text-[#B91C1C]">* (Mandatory)</span>
            </label>
            <input
              type="text"
              required
              value={formData.mainCustomerTypes}
              onChange={(e) => handleChange('mainCustomerTypes', e.target.value)}
              onBlur={() => persistIfDirty()}
              placeholder="e.g., Commercial builders, residential property managers, regional SMEs"
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        );

      case 8:
        return (
          <div className="space-y-2">
            <label className="bizpulse-label block">
              Main Products or Services Provided <span className="text-[#B91C1C]">* (Mandatory)</span>
            </label>
            <textarea
              rows={3}
              required
              value={formData.mainProductsServices}
              onChange={(e) => handleChange('mainProductsServices', e.target.value)}
              onBlur={() => persistIfDirty()}
              placeholder="Describe what your business sells, installs, services, or delivers..."
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        );

      case 9:
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="bizpulse-label">
                Owner&apos;s Primary Objective (Next 6–12 Months){' '}
                <span className="text-[#B91C1C]">* (Mandatory)</span>
              </span>
            </label>
            <input
              type="text"
              required
              value={formData.primaryObjective}
              onChange={(e) => handleChange('primaryObjective', e.target.value)}
              onBlur={() => persistIfDirty()}
              placeholder="e.g., Stabilize cash flow, improve net margin, reduce owner reliance"
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        );

      case 10:
      default:
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
              <span className="bizpulse-label text-[#B45309]">
                Single Most Important Concern or Pressure{' '}
                <span className="text-[#B91C1C]">* (Mandatory)</span>
              </span>
            </label>
            <textarea
              rows={4}
              required
              value={formData.primaryConcern}
              onChange={(e) => handleChange('primaryConcern', e.target.value)}
              onBlur={() => persistIfDirty()}
              placeholder="What is the biggest operational, pricing, staffing, or cash flow pressure right now?"
              className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded-xs px-4 py-3 text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Editorial Foundation Heading */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#0F172A]/10 pb-6">
        <div className="space-y-2">
          <div className="bizpulse-label">[01] Foundation · Isolated Business Session</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
            <span>Business Essentials</span>
            <InfoTooltip
              title="Why Sequential Business Essentials Matter"
              whatItMeans="Each step captures core commercial context used across your 12-Capability Health Diagnostic, Cash Flow checks, AI Coaching, and Executive Report."
              whyItMatters="Complete mandatory fields (*) in order so recommendations and action plans reflect your actual size, sector, and primary pressure."
              actionOrCalculation="Answers auto-save whenever you click Next, Previous, or switch steps."
            />
          </h2>
          <p className="text-sm text-[#475569] max-w-2xl leading-relaxed">
            Work through the 10 foundation questions in sequence. Your answers save automatically between steps and can be reviewed or amended at any time.
          </p>
        </div>

        <div className="bg-white border border-[#0F172A]/10 rounded px-4 py-3 text-left md:text-right shrink-0">
          <span className="bizpulse-label block">Session Reference</span>
          <div className="text-xs font-mono font-bold text-[#0F172A] mt-1 truncate max-w-[200px]">
            {formData.caseId}
          </div>
          <div className="text-[11px] text-[#2563EB] font-semibold mt-0.5">
            {formData.isDemonstrationCase ? 'Benchmark Demo Case' : 'Private Client Assessment'}
          </div>
        </div>
      </div>

      {/* Sequential Progress & Clickable Question Step Strip */}
      <div className="bg-white border border-[#0F172A]/10 rounded p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-[#0F172A] text-white font-mono font-bold">
              {showAllReview ? 'Review Summary' : `Question ${currentStep.stepNumber} of ${ESSENTIAL_STEPS.length}`}
            </span>
            <span className="text-[#475569] font-medium tabular-nums">
              Mandatory completed: <strong className="text-[#0F172A]">{requiredCompletedCount}/{totalRequiredCount}</strong> · Total answered:{' '}
              <strong className="text-[#0F172A]">{completedCount}/{ESSENTIAL_STEPS.length}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              persistIfDirty();
              setShowAllReview((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] font-semibold border border-[#BFDBFE] transition"
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>{showAllReview ? 'Return to Step-by-Step View' : 'Review & Edit All 10 Answers'}</span>
          </button>
        </div>

        <div className="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#2563EB] h-full rounded-full transition-all duration-300"
            style={{ width: `${showAllReview ? 100 : progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
          {ESSENTIAL_STEPS.map((step, idx) => {
            const done = step.isComplete(formData);
            const isCurrent = !showAllReview && idx === currentStepIdx;
            return (
              <button
                key={step.stepNumber}
                type="button"
                onClick={() => handleJumpToStep(idx)}
                className={`px-2 py-2 rounded border text-left transition flex flex-col justify-between gap-0.5 ${
                  isCurrent
                    ? 'bg-[#0F172A] text-white border-[#0F172A]'
                    : done
                    ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0] hover:border-[#15803D]'
                    : 'bg-[#F8FAFC] text-[#475569] border-[#0F172A]/10 hover:border-[#2563EB]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                  <span>Q{step.stepNumber}</span>
                  {step.required && !done && (
                    <span className={isCurrent ? 'text-[#FCA5A5]' : 'text-[#B91C1C]'}>*</span>
                  )}
                  {done && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                </div>
                <span className="text-[11px] font-semibold truncate">{step.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isSaved && (
        <div className="p-3.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Business essentials saved to your isolated session ({formData.name || 'Active Business'}).</span>
          </div>
          <button
            type="button"
            onClick={() => {
              persistIfDirty();
              onProceedToHealth();
            }}
            className="text-[#15803D] underline font-bold"
          >
            Continue to Health Assessment &rarr;
          </button>
        </div>
      )}

      {showAllReview ? (
        <form
          onSubmit={handleSaveManual}
          className="bg-white border border-[#0F172A]/10 rounded p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#0F172A]/10">
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">
                All 10 Business Essentials Answers (Quick Review &amp; Edit)
              </h3>
              <p className="text-xs text-[#475569]">
                Click any question below to jump back into sequential editing or amend directly here.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {ESSENTIAL_STEPS.map((step, idx) => (
              <div
                key={step.stepNumber}
                className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/10 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#0F172A] text-white font-mono font-bold text-[11px]">
                      Q{step.stepNumber}
                    </span>
                    <span className="text-sm font-bold text-[#0F172A]">{step.questionTitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(idx)}
                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    Focus Step {step.stepNumber}
                  </button>
                </div>
                {renderStepInputs(step.stepNumber)}
              </div>
            ))}
          </div>

          <div className="pt-5 border-t border-[#0F172A]/10 space-y-3">
            {isSaved && (
              <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>All business essentials answers saved cleanly for {formData.name || 'this business'}.</span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
                <span className="bizpulse-label">Isolated session active · Auto-saved</span>
              </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold uppercase tracking-wider border border-[#0F172A]/15 transition"
              >
                <Save className="w-4 h-4 text-[#2563EB]" />
                <span>{isSaved ? 'Saved' : 'Save All Answers'}</span>
              </button>

              {onProceedToDocuments && (
                <button
                  type="button"
                  onClick={() => {
                    persistIfDirty();
                    onProceedToDocuments();
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold uppercase tracking-wider border border-[#BFDBFE] transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Upload Documents</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  persistIfDirty();
                  onProceedToHealth();
                }}
                className="flex items-center space-x-2 px-5 py-2.5 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold uppercase tracking-wider transition"
              >
                <span>Proceed to Health Assessment</span>
                <ArrowRight className="w-4 h-4 text-[#60A5FA]" />
              </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNext();
          }}
          className="bg-white border border-[#0F172A]/10 rounded p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div className="space-y-2 pb-4 border-b border-[#0F172A]/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                Question {currentStep.stepNumber} of {ESSENTIAL_STEPS.length} ·{' '}
                {currentStep.required ? 'Mandatory' : 'Optional'}
              </span>
              <span className="text-xs text-[#475569] font-medium">
                {currentStep.shortLabel}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-snug">
              {currentStep.questionTitle}
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              {currentStep.helperText}
            </p>
          </div>

          {renderStepInputs(currentStep.stepNumber)}

          {stepError && (
            <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{stepError}</span>
            </div>
          )}

          {/* Sequential Navigation & Save Controls */}
          <div className="pt-5 border-t border-[#0F172A]/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStepIdx === 0}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] disabled:opacity-40 text-[#0F172A] text-xs font-semibold uppercase tracking-wider border border-[#0F172A]/15 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveManual()}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-white hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-semibold uppercase tracking-wider border border-[#0F172A]/15 transition"
              >
                <Save className="w-4 h-4 text-[#2563EB]" />
                <span>{isSaved ? 'Saved' : 'Save Now'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {currentStepIdx < ESSENTIAL_STEPS.length - 1 ? (
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-5 py-2.5 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold uppercase tracking-wider transition"
                >
                  <span>Save &amp; Next Question</span>
                  <ArrowRight className="w-4 h-4 text-[#60A5FA]" />
                </button>
              ) : (
                <>
                  {onProceedToDocuments && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!validateCurrentStep()) return;
                        persistIfDirty();
                        onProceedToDocuments();
                      }}
                      className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold uppercase tracking-wider border border-[#BFDBFE] transition"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Upload Documents</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateCurrentStep()) return;
                      persistIfDirty();
                      onProceedToHealth();
                    }}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold uppercase tracking-wider transition"
                  >
                    <span>Finish &amp; Go to Health Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isSaved && (
            <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Saved Q{currentStep.stepNumber} answers cleanly.</span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-xs text-[#475569]">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
            <span className="bizpulse-label">
              Isolated session active · Answers save automatically between steps
            </span>
          </div>
        </form>
      )}
    </div>
  );
};

