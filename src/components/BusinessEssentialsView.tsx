import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  CheckCircle2, 
  HelpCircle, 
  Globe, 
  Users, 
  Coins, 
  Calendar, 
  Target, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { BusinessProfile, IndustryType, BusinessStructureType } from '../types/bizpulse';

interface BusinessEssentialsViewProps {
  profile: BusinessProfile;
  onUpdateProfile: (updated: BusinessProfile) => void;
  onProceedToHealth: () => void;
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
}) => {
  const [formData, setFormData] = useState<BusinessProfile>(profile);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleChange = (field: keyof BusinessProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner Card */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#EAF1FF] text-[#2563EB] border border-[#2563EB]/30">
                Phase 1: Foundation
              </span>
              <span className="text-[#64748B] text-xs">Onboarding & Context Isolation</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#14283F] tracking-tight">
              Business Essentials
            </h2>
            <p className="text-sm text-[#64748B] max-w-2xl leading-relaxed">
              Every SME has unique customer dynamics, cost drivers, and operational bottlenecks. Enter your actual business profile to ensure all AI coaching and diagnostics reflect your commercial reality.
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E5EBEF] rounded-xl p-4 min-w-[200px] text-center shadow-2xs shrink-0">
            <span className="text-xs text-[#64748B] uppercase tracking-wider font-semibold block">Active Case ID</span>
            <div className="text-xs font-mono font-bold text-[#2563EB] mt-1 truncate max-w-[180px]">
              {formData.caseId}
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              {formData.isDemonstrationCase ? 'Benchmark Demo MSP' : 'Custom Business Assessment'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E5EBEF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#14283F] flex items-center justify-between">
              <span>Business / Trading Name *</span>
              <span className="text-[11px] text-[#64748B] font-normal">Legal or Trading</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Apex Electrical Contracting, Horizon Cafe..."
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {/* Industry Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#14283F]">
              Industry & Sector *
            </label>
            <select
              value={formData.industry}
              onChange={(e) => handleChange('industry', e.target.value as IndustryType)}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Business Structure */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#14283F]">
              Business Structure *
            </label>
            <select
              value={formData.businessType}
              onChange={(e) => handleChange('businessType', e.target.value as BusinessStructureType)}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {BUSINESS_STRUCTURES.map((struct) => (
                <option key={struct} value={struct}>{struct}</option>
              ))}
            </select>
          </div>

          {/* Country & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#14283F]">
                Country *
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="New Zealand, Australia..."
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#14283F]">
                Currency *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Years Operating & Workforce */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#14283F]">
                Years Operating
              </label>
              <input
                type="number"
                min="0"
                value={formData.yearsOperating}
                onChange={(e) => handleChange('yearsOperating', Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#14283F]">
                Employees
              </label>
              <input
                type="number"
                min="0"
                value={formData.employeeCount}
                onChange={(e) => handleChange('employeeCount', Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#14283F]">
                Subcontractors
              </label>
              <input
                type="number"
                min="0"
                value={formData.subcontractorCount}
                onChange={(e) => handleChange('subcontractorCount', Number(e.target.value))}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          {/* Main Customer Types */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#14283F]">
              Main Customer Types *
            </label>
            <input
              type="text"
              required
              value={formData.mainCustomerTypes}
              onChange={(e) => handleChange('mainCustomerTypes', e.target.value)}
              placeholder="e.g. Local builders, residential homeowners, B2B corporate clients..."
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        {/* Main Products / Services */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#14283F]">
            Main Products or Services Provided *
          </label>
          <textarea
            rows={2}
            required
            value={formData.mainProductsServices}
            onChange={(e) => handleChange('mainProductsServices', e.target.value)}
            placeholder="Describe what your business sells, delivers, or installs..."
            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* Owner's Primary Objective */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#14283F] flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Owner's Primary Objective (Next 6–12 Months) *</span>
          </label>
          <input
            type="text"
            required
            value={formData.primaryObjective}
            onChange={(e) => handleChange('primaryObjective', e.target.value)}
            placeholder="e.g. Stabilize cash flow, reduce owner working hours, improve net profit margin..."
            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* The Most Important Concern */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#B45309] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#E87518]" />
            <span>The Single Most Important Concern or Pressure Facing the Business *</span>
          </label>
          <textarea
            rows={3}
            required
            value={formData.primaryConcern}
            onChange={(e) => handleChange('primaryConcern', e.target.value)}
            placeholder="What is keeping you awake at night? (e.g. Overdue debtors, rising costs, finding good technicians, thin margins, owner burnout...)"
            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-sm text-[#14283F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* Form Actions */}
        <div className="pt-4 border-t border-[#E5EBEF] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs text-[#64748B]">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <span>Case data is encrypted and securely isolated in Cloud Firestore.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-white hover:bg-[#F5F6F3] text-[#14283F] text-xs font-bold border border-[#CBD5E1] transition shadow-2xs"
            >
              <Save className="w-4 h-4" />
              <span>{isSaved ? 'Saved!' : 'Save Essentials'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateProfile(formData);
                onProceedToHealth();
              }}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs transition transform active:scale-95"
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
