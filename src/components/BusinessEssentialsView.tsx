import React, { useState, useEffect } from 'react';
import {
  Save,
  Target,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { BusinessProfile, IndustryType, BusinessStructureType } from '../types/bizpulse';

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

export const BusinessEssentialsView: React.FC<BusinessEssentialsViewProps> = ({
  profile,
  onUpdateProfile,
  onProceedToHealth,
  onProceedToDocuments,
}) => {
  const [formData, setFormData] = useState<BusinessProfile>(profile);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setFormData(profile);
    setIsSaved(false);
  }, [profile]);

  const handleChange = (field: keyof BusinessProfile, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 4000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Variation 1 Editorial Foundation Heading */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#111113]/10 pb-6">
        <div className="space-y-2">
          <div className="bizpulse-label">[01] Foundation · Isolated Business Session</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#111113] tracking-tight">
            Business Essentials
          </h2>
          <p className="text-sm text-[#52525B] max-w-2xl leading-relaxed">
            Every SME session starts clean with zero carry-over from previous clients. Enter your real business context below so every health score, coaching action, and financial report stays grounded in reality.
          </p>
        </div>

        <div className="bg-white border border-[#111113]/10 rounded px-4 py-3 text-left md:text-right shrink-0">
          <span className="bizpulse-label block">Session Reference</span>
          <div className="text-xs font-mono font-bold text-[#111113] mt-1 truncate max-w-[200px]">
            {formData.caseId}
          </div>
          <div className="text-[11px] text-[#D97706] font-semibold mt-0.5">
            {formData.isDemonstrationCase ? 'Benchmark Demo Case' : 'Private Client Assessment'}
          </div>
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
            onClick={() => onProceedToHealth()}
            className="text-[#15803D] underline font-bold"
          >
            Continue to Health Assessment &rarr;
          </button>
        </div>
      )}

      {/* Variation 1 Clean White Architectural Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#111113]/10 rounded p-6 sm:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between">
              <span className="bizpulse-label">Business / Trading Name *</span>
              <span className="text-[11px] text-[#52525B]">Legal or Trading</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Tasman Plumbing & Gas Ltd, Harbourside Cafe"
              className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
            />
          </div>

          {/* Industry Type */}
          <div className="space-y-1.5">
            <label className="bizpulse-label block">
              Industry &amp; Sector *
            </label>
            <select
              value={formData.industry}
              onChange={(e) => handleChange('industry', e.target.value as IndustryType)}
              className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Business Structure */}
          <div className="space-y-1.5">
            <label className="bizpulse-label block">
              Business Structure *
            </label>
            <select
              value={formData.businessType}
              onChange={(e) => handleChange('businessType', e.target.value as BusinessStructureType)}
              className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
            >
              {BUSINESS_STRUCTURES.map((struct) => (
                <option key={struct} value={struct}>
                  {struct}
                </option>
              ))}
            </select>
          </div>

          {/* Country & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="bizpulse-label block">Country *</label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="New Zealand, Australia..."
                className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="bizpulse-label block">Currency *</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Years Operating & Workforce */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="bizpulse-label block">Years Operating</label>
              <input
                type="number"
                min="0"
                value={formData.yearsOperating}
                onChange={(e) => handleChange('yearsOperating', Number(e.target.value))}
                className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3 py-2.5 text-sm text-[#111113] tabular-nums focus:bg-white focus:outline-none focus:border-[#D97706]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="bizpulse-label block">Employees</label>
              <input
                type="number"
                min="0"
                value={formData.employeeCount}
                onChange={(e) => handleChange('employeeCount', Number(e.target.value))}
                className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3 py-2.5 text-sm text-[#111113] tabular-nums focus:bg-white focus:outline-none focus:border-[#D97706]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="bizpulse-label block">Subcontractors</label>
              <input
                type="number"
                min="0"
                value={formData.subcontractorCount}
                onChange={(e) => handleChange('subcontractorCount', Number(e.target.value))}
                className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3 py-2.5 text-sm text-[#111113] tabular-nums focus:bg-white focus:outline-none focus:border-[#D97706]"
              />
            </div>
          </div>

          {/* Main Customer Types */}
          <div className="space-y-1.5">
            <label className="bizpulse-label block">
              Main Customer Types *
            </label>
            <input
              type="text"
              required
              value={formData.mainCustomerTypes}
              onChange={(e) => handleChange('mainCustomerTypes', e.target.value)}
              placeholder="e.g., Commercial builders, residential homeowners, B2B SMBs"
              className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
            />
          </div>
        </div>

        {/* Main Products / Services */}
        <div className="space-y-1.5">
          <label className="bizpulse-label block">
            Main Products or Services Provided *
          </label>
          <textarea
            rows={2}
            required
            value={formData.mainProductsServices}
            onChange={(e) => handleChange('mainProductsServices', e.target.value)}
            placeholder="Describe what your business sells, installs, or delivers..."
            className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
          />
        </div>

        {/* Owner's Primary Objective */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#D97706]" />
            <span className="bizpulse-label">Owner&apos;s Primary Objective (Next 6–12 Months) *</span>
          </label>
          <input
            type="text"
            required
            value={formData.primaryObjective}
            onChange={(e) => handleChange('primaryObjective', e.target.value)}
            placeholder="e.g., Stabilize cash flow, improve net margin, reduce owner reliance"
            className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
          />
        </div>

        {/* The Most Important Concern */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
            <span className="bizpulse-label text-[#B45309]">Single Most Important Concern or Pressure *</span>
          </label>
          <textarea
            rows={4}
            required
            value={formData.primaryConcern}
            onChange={(e) => handleChange('primaryConcern', e.target.value)}
            placeholder="What is the biggest operational or financial pressure right now?"
            className="w-full bg-[#FCFCFC] border border-[#111113]/12 rounded-xs px-3.5 py-2.5 text-sm text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
          />
        </div>

        {/* Form Actions */}
        <div className="pt-5 border-t border-[#111113]/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
            <span className="bizpulse-label">Isolated session active · Zero cross-client leakage</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#F8F7F4] hover:bg-[#EFECE6] text-[#111113] text-xs font-semibold uppercase tracking-wider border border-[#111113]/15 transition"
            >
              <Save className="w-4 h-4 text-[#D97706]" />
              <span>{isSaved ? 'Saved' : 'Save Essentials'}</span>
            </button>

            {onProceedToDocuments && (
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile(formData);
                  onProceedToDocuments();
                }}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] text-xs font-semibold uppercase tracking-wider border border-[#FDE68A] transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload Documents</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onUpdateProfile(formData);
                onProceedToHealth();
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded bg-[#111113] hover:bg-[#27272A] text-white text-xs font-semibold uppercase tracking-wider transition"
            >
              <span>Proceed to Health Assessment</span>
              <ArrowRight className="w-4 h-4 text-[#D97706]" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
