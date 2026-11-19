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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Black-to-Blue Executive Hero Card */}
      <div className="bizpulse-hero-gradient text-white rounded-2xl p-6 sm:p-8 shadow-md border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#1D4ED8] text-white">
                Step 1: Business Foundation
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">
                Isolated Business Profile
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Business Essentials
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-2xl leading-relaxed">
              Every SME session starts clean with zero carry-over from previous clients. Enter your real business context below so every health score, coaching action, and financial report is grounded in your business reality.
            </p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-xl p-4 min-w-[210px] text-center shrink-0">
            <span className="text-[11px] text-[#93C5FD] uppercase tracking-wider font-bold block">
              Isolated Session ID
            </span>
            <div className="text-xs font-mono font-bold text-white mt-1 truncate max-w-[190px] mx-auto">
              {formData.caseId}
            </div>
            <div className="text-[11px] text-[#CBD5E1] mt-1">
              {formData.isDemonstrationCase ? 'Benchmark Demo Case' : 'Private Client Assessment'}
            </div>
          </div>
        </div>
      </div>

      {isSaved && (
        <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold flex items-center justify-between">
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

      {/* Main Profile Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#D9E2F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0B1324] flex items-center justify-between">
              <span>Business / Trading Name *</span>
              <span className="text-[11px] text-[#52627A] font-normal">Legal or Trading</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Tasman Plumbing & Gas Ltd, Harbourside Cafe"
              className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
            />
          </div>

          {/* Industry Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0B1324]">
              Industry &amp; Sector *
            </label>
            <select
              value={formData.industry}
              onChange={(e) => handleChange('industry', e.target.value as IndustryType)}
              className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
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
            <label className="text-xs font-semibold text-[#0B1324]">
              Business Structure *
            </label>
            <select
              value={formData.businessType}
              onChange={(e) => handleChange('businessType', e.target.value as BusinessStructureType)}
              className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
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
              <label className="text-xs font-semibold text-[#0B1324]">Country *</label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="New Zealand, Australia..."
                className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0B1324]">Currency *</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
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
              <label className="text-xs font-semibold text-[#0B1324]">Years Operating</label>
              <input
                type="number"
                min="0"
                value={formData.yearsOperating}
                onChange={(e) => handleChange('yearsOperating', Number(e.target.value))}
                className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0B1324] tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0B1324]">Employees</label>
              <input
                type="number"
                min="0"
                value={formData.employeeCount}
                onChange={(e) => handleChange('employeeCount', Number(e.target.value))}
                className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0B1324] tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0B1324]">Subcontractors</label>
              <input
                type="number"
                min="0"
                value={formData.subcontractorCount}
                onChange={(e) => handleChange('subcontractorCount', Number(e.target.value))}
                className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#0B1324] tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
              />
            </div>
          </div>

          {/* Main Customer Types */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0B1324]">
              Main Customer Types *
            </label>
            <input
              type="text"
              required
              value={formData.mainCustomerTypes}
              onChange={(e) => handleChange('mainCustomerTypes', e.target.value)}
              placeholder="e.g., Commercial builders, residential homeowners, B2B SMBs"
              className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
            />
          </div>
        </div>

        {/* Main Products / Services */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#0B1324]">
            Main Products or Services Provided *
          </label>
          <textarea
            rows={2}
            required
            value={formData.mainProductsServices}
            onChange={(e) => handleChange('mainProductsServices', e.target.value)}
            placeholder="Describe what your business sells, installs, or delivers..."
            className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
          />
        </div>

        {/* Owner's Primary Objective */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#0B1324] flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>Owner&apos;s Primary Objective (Next 6–12 Months) *</span>
          </label>
          <input
            type="text"
            required
            value={formData.primaryObjective}
            onChange={(e) => handleChange('primaryObjective', e.target.value)}
            placeholder="e.g., Stabilize cash flow, improve net margin, reduce owner reliance"
            className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
          />
        </div>

        {/* The Most Important Concern */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#B45309] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
            <span>The Single Most Important Concern or Pressure Facing the Business *</span>
          </label>
          <textarea
            rows={3}
            required
            value={formData.primaryConcern}
            onChange={(e) => handleChange('primaryConcern', e.target.value)}
            placeholder="What is the biggest operational or financial pressure right now?"
            className="w-full bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#0B1324] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8]"
          />
        </div>

        {/* Form Actions */}
        <div className="pt-4 border-t border-[#E8EEF7] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs text-[#52627A]">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" />
            <span>Isolated to this business session only. Never shared with other cases.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-[#F3F6FB] text-[#0B1324] text-xs font-bold border border-[#CBD5E1] transition"
            >
              <Save className="w-4 h-4 text-[#1D4ED8]" />
              <span>{isSaved ? 'Saved' : 'Save Essentials'}</span>
            </button>

            {onProceedToDocuments && (
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile(formData);
                  onProceedToDocuments();
                }}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-bold border border-[#BFDBFE] transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload Documents (Optional)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onUpdateProfile(formData);
                onProceedToHealth();
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold shadow-sm transition"
            >
              <span>Proceed to Health Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
