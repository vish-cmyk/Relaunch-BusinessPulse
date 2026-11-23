import React, { useState, useMemo } from 'react';
import {
  Users,
  AlertOctagon,
  CheckCircle,
  Layers,
  Percent,
  FileSpreadsheet,
  Info,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  Calculator,
  Bot,
  Sparkles,
  Trash2,
  Edit3,
  Clock,
  MessageSquarePlus,
  AlertTriangle,
  Target,
  Send,
  Loader2,
  X,
} from 'lucide-react';
import { REPORTED_FINANCIALS } from '../data/coachingBriefing';
import {
  CaseRecord,
  CrmRecord,
  CrmRecordType,
  CrmTier,
  CrmSalesStage,
  CrmStatus,
  CrmInteraction,
  BusinessDevPlan,
} from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface ClientMatrixCalculatorProps {
  caseRecord?: CaseRecord;
  onUpdateCrmContacts?: (contacts: CrmRecord[]) => void;
  onUpdateBusinessDevPlan?: (plan: BusinessDevPlan | null) => void;
  onEvaluateOpportunityInRoi?: (contact: CrmRecord) => void;
  onOpenCoachWithPrompt?: (prompt: string) => void;
  onTrackUsage?: (field: 'coachMessagesCount') => void;
}

const RECORD_TYPES: CrmRecordType[] = ['Customer', 'Prospect', 'Lead', 'Partner'];
const TIER_OPTIONS: CrmTier[] = ['Champion', 'Steady Core', 'Margin Squeeze', 'Chronic Drain', 'Prospect'];
const STAGE_OPTIONS: CrmSalesStage[] = [
  'Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'Dormant',
];
const STATUS_OPTIONS: CrmStatus[] = [
  'Active',
  'Follow-Up Due',
  'At Risk',
  'Paused',
  'Closed Won',
  'Closed Lost',
];
const INTERACTION_TYPES: CrmInteraction['type'][] = ['Call', 'Email', 'Meeting', 'Proposal', 'Note'];

const emptyFormState = () => ({
  companyOrName: '',
  contactPerson: '',
  email: '',
  phone: '',
  recordType: 'Prospect' as CrmRecordType,
  tier: 'Prospect' as CrmTier,
  salesStage: 'Lead' as CrmSalesStage,
  status: 'Active' as CrmStatus,
  opportunityValue: '',
  monthlyValue: '',
  nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  leadSource: '',
  notes: '',
});

export const ClientMatrixCalculator: React.FC<ClientMatrixCalculatorProps> = ({
  caseRecord,
  onUpdateCrmContacts,
  onUpdateBusinessDevPlan,
  onEvaluateOpportunityInRoi,
  onOpenCoachWithPrompt,
  onTrackUsage,
}) => {
  const profile = caseRecord?.profile;
  const isDemo = profile?.isDemonstrationCase ?? true;
  const currency = profile?.currency || 'NZD';
  const fin = caseRecord?.financials;
  const crmContacts = caseRecord?.crmContacts || [];
  const businessDevPlan = caseRecord?.businessDevPlan || null;

  const clientCount = fin?.customerCount ?? (isDemo ? 48 : null);
  const top5Pct = fin?.top5ConcentrationPercent ?? (isDemo ? 38 : null);
  const top12Pct = fin?.top12ConcentrationPercent ?? (isDemo ? 60 : null);
  const next7Pct = top12Pct !== null && top5Pct !== null ? Math.max(0, top12Pct - top5Pct) : null;
  const tailPct = top12Pct !== null ? Math.max(0, 100 - top12Pct) : null;

  const annualRevenue = fin?.annualRevenue ?? (isDemo ? REPORTED_FINANCIALS.revenue : null);
  const operatingProfit =
    fin?.operatingProfit ?? (isDemo ? REPORTED_FINANCIALS.reportedOperatingProfit : null);

  // Price review sliders (preserved)
  const [priceableRevenueBase, setPriceableRevenueBase] = useState<number>(
    annualRevenue ? Math.round(annualRevenue * 0.65) : isDemo ? 850000 : 250000
  );
  const [priceIncreasePct, setPriceIncreasePct] = useState<number>(10);
  const [churnedClientsCount, setChurnedClientsCount] = useState<number>(2);
  const [averageChurnedClientMRR, setAverageChurnedClientMRR] = useState<number>(1100);
  const [churnedClientMarginPct, setChurnedClientMarginPct] = useState<number>(18);

  const grossPriceGain = Math.round(priceableRevenueBase * (priceIncreasePct / 100));
  const lostAnnualRevenue = churnedClientsCount * averageChurnedClientMRR * 12;
  const lostAnnualGrossProfit = Math.round(lostAnnualRevenue * (churnedClientMarginPct / 100));
  const netProfitImpact = grossPriceGain - lostAnnualGrossProfit;
  const newProjectedOperatingProfit =
    operatingProfit !== null ? operatingProfit + netProfitImpact : netProfitImpact;
  const totalHoursFreedPerMonth = churnedClientsCount * 16;

  // CRM State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | CrmRecordType>('ALL');
  const [filterStage, setFilterStage] = useState<'ALL' | CrmSalesStage>('ALL');
  const [onlyDueOrRisk, setOnlyDueOrRisk] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    crmContacts[0]?.id || null
  );

  // Add/Edit CRM Modal/Drawer State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState(emptyFormState());
  const [formError, setFormError] = useState<string | null>(null);

  // Interaction Logger State
  const [intType, setIntType] = useState<CrmInteraction['type']>('Call');
  const [intDate, setIntDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [intSummary, setIntSummary] = useState('');
  const [intOutcome, setIntOutcome] = useState('');

  // Business Development AI Plan State
  const [bizDevFocus, setBizDevFocus] = useState('');
  const [isGeneratingBizDev, setIsGeneratingBizDev] = useState(false);
  const [bizDevError, setBizDevError] = useState<string | null>(null);
  const [savedOutreachFeedback, setSavedOutreachFeedback] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  // Computed CRM Metrics
  const crmStats = useMemo(() => {
    const openOpportunities = crmContacts.filter(
      (c) => c.salesStage !== 'Won' && c.salesStage !== 'Lost' && c.salesStage !== 'Dormant'
    );
    const openPipelineValue = openOpportunities.reduce(
      (sum, c) => sum + (Number(c.opportunityValue) || 0),
      0
    );
    const activeMonthlyBase = crmContacts
      .filter((c) => c.status !== 'Closed Lost')
      .reduce((sum, c) => sum + (Number(c.monthlyValue) || 0), 0);
    const dueFollowUps = crmContacts.filter(
      (c) =>
        c.status === 'Follow-Up Due' ||
        c.status === 'At Risk' ||
        (Boolean(c.nextFollowUpDate) &&
          c.nextFollowUpDate <= todayIso &&
          c.salesStage !== 'Lost' &&
          c.status !== 'Closed Lost')
    );
    return {
      totalCount: crmContacts.length,
      openOpportunitiesCount: openOpportunities.length,
      openPipelineValue,
      activeMonthlyBase,
      dueFollowUps,
    };
  }, [crmContacts, todayIso]);

  // Deterministic Health + CRM + Cash Integration Alerts
  const connectedHealthAlerts = useMemo(() => {
    const alerts: { tone: 'red' | 'amber' | 'green'; title: string; detail: string }[] = [];
    const moneyStatus = caseRecord?.healthInputs?.money?.status;
    const customerStatus = caseRecord?.healthInputs?.customers?.status;
    const salesStatus = caseRecord?.healthInputs?.sales?.status;

    if (moneyStatus === 'at_risk' || (fin?.overdueReceivables && fin.overdueReceivables > 0)) {
      alerts.push({
        tone: 'red',
        title: 'Health Link — Collections Before Expansion',
        detail:
          fin?.overdueReceivables && fin.overdueReceivables > 0
            ? `Money dimension flagged with ${currency} ${fin.overdueReceivables.toLocaleString()} overdue receivables. Prioritize CRM retention & debtor collection calls before discounting new leads.`
            : 'Money & Cash Flow is flagged At Risk. Prioritize prompt-paying prospects and deposit/direct-debit terms on CRM proposals.',
      });
    }

    if (crmStats.dueFollowUps.length > 0) {
      alerts.push({
        tone: 'amber',
        title: `${crmStats.dueFollowUps.length} CRM Follow-Up${crmStats.dueFollowUps.length === 1 ? '' : 's'} Due or At Risk`,
        detail: crmStats.dueFollowUps
          .slice(0, 3)
          .map((c) => `${c.companyOrName} (${c.salesStage}, ${c.nextFollowUpDate || c.status})`)
          .join(' · '),
      });
    }

    if (customerStatus === 'at_risk' || salesStatus === 'at_risk') {
      alerts.push({
        tone: 'amber',
        title: 'Health Link — Concentration & Margin Hygiene',
        detail:
          'Customers or Sales dimension needs attention. Use "Evaluate ROI" on open proposals and anchor reviews to verify margin before committing technician/delivery capacity.',
      });
    }

    if (alerts.length === 0 && crmContacts.length > 0) {
      alerts.push({
        tone: 'green',
        title: 'Pipeline & Health Aligned',
        detail: `${crmContacts.length} CRM record(s) active with ${currency} ${crmStats.openPipelineValue.toLocaleString()} in open opportunities.`,
      });
    }
    return alerts;
  }, [caseRecord, fin, currency, crmStats, crmContacts.length]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return crmContacts.filter((c) => {
      if (filterType !== 'ALL' && c.recordType !== filterType) return false;
      if (filterStage !== 'ALL' && c.salesStage !== filterStage) return false;
      if (onlyDueOrRisk) {
        const isDue =
          c.status === 'Follow-Up Due' ||
          c.status === 'At Risk' ||
          (Boolean(c.nextFollowUpDate) &&
            c.nextFollowUpDate <= todayIso &&
            c.salesStage !== 'Lost' &&
            c.status !== 'Closed Lost');
        if (!isDue) return false;
      }
      if (!q) return true;
      return (
        c.companyOrName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    });
  }, [crmContacts, searchQuery, filterType, filterStage, onlyDueOrRisk, todayIso]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId) return filteredContacts[0] || null;
    return crmContacts.find((c) => c.id === selectedContactId) || filteredContacts[0] || null;
  }, [crmContacts, selectedContactId, filteredContacts]);

  const openNewContactForm = () => {
    setEditingId(null);
    setFormState(emptyFormState());
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditContactForm = (contact: CrmRecord) => {
    setEditingId(contact.id);
    setFormState({
      companyOrName: contact.companyOrName,
      contactPerson: contact.contactPerson,
      email: contact.email,
      phone: contact.phone,
      recordType: contact.recordType,
      tier: contact.tier,
      salesStage: contact.salesStage,
      status: contact.status,
      opportunityValue: String(contact.opportunityValue ?? 0),
      monthlyValue: String(contact.monthlyValue ?? 0),
      nextFollowUpDate: contact.nextFollowUpDate || '',
      leadSource: contact.leadSource || '',
      notes: contact.notes || '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.companyOrName.trim()) {
      setFormError('Company or customer name is required.');
      return;
    }

    const now = new Date().toISOString();
    const oppVal = Math.max(0, Number(formState.opportunityValue) || 0);
    const monVal = Math.max(0, Number(formState.monthlyValue) || 0);

    if (editingId) {
      const updated = crmContacts.map((c) =>
        c.id === editingId
          ? {
              ...c,
              companyOrName: formState.companyOrName.trim(),
              contactPerson: formState.contactPerson.trim(),
              email: formState.email.trim(),
              phone: formState.phone.trim(),
              recordType: formState.recordType,
              tier: formState.tier,
              salesStage: formState.salesStage,
              status: formState.status,
              opportunityValue: oppVal,
              monthlyValue: monVal,
              nextFollowUpDate: formState.nextFollowUpDate,
              leadSource: formState.leadSource.trim(),
              notes: formState.notes.trim(),
              updatedAt: now,
            }
          : c
      );
      onUpdateCrmContacts?.(updated);
      setSelectedContactId(editingId);
    } else {
      const newContact: CrmRecord = {
        id: `crm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companyOrName: formState.companyOrName.trim(),
        contactPerson: formState.contactPerson.trim(),
        email: formState.email.trim(),
        phone: formState.phone.trim(),
        recordType: formState.recordType,
        tier: formState.tier,
        salesStage: formState.salesStage,
        status: formState.status,
        opportunityValue: oppVal,
        monthlyValue: monVal,
        nextFollowUpDate: formState.nextFollowUpDate,
        leadSource: formState.leadSource.trim(),
        notes: formState.notes.trim(),
        interactions: [],
        createdAt: now,
        updatedAt: now,
      };
      onUpdateCrmContacts?.([newContact, ...crmContacts]);
      setSelectedContactId(newContact.id);
    }

    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDeleteContact = (id: string) => {
    const remaining = crmContacts.filter((c) => c.id !== id);
    onUpdateCrmContacts?.(remaining);
    if (selectedContactId === id) {
      setSelectedContactId(remaining[0]?.id || null);
    }
  };

  const handleQuickUpdateContact = (id: string, patch: Partial<CrmRecord>) => {
    const updated = crmContacts.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
    );
    onUpdateCrmContacts?.(updated);
  };

  const handleAddInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !intSummary.trim()) return;

    const newInteraction: CrmInteraction = {
      id: `int-${Date.now()}`,
      date: intDate || todayIso,
      type: intType,
      summary: intSummary.trim(),
      outcome: intOutcome.trim() || undefined,
    };

    const updated = crmContacts.map((c) =>
      c.id === selectedContact.id
        ? {
            ...c,
            interactions: [newInteraction, ...(c.interactions || [])],
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    onUpdateCrmContacts?.(updated);
    setIntSummary('');
    setIntOutcome('');
  };

  const handleGenerateBusinessDevPlan = async () => {
    if (!caseRecord) return;
    setIsGeneratingBizDev(true);
    setBizDevError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/business-development', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: caseRecord.id,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: caseRecord.uploadedDocuments || [],
          crmContacts,
          roiScenarios: caseRecord.roiScenarios || [],
          focusArea: bizDevFocus.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Unable to generate Business Development Plan.');
      }

      const data = await response.json();
      if (data.businessDevPlan) {
        onUpdateBusinessDevPlan?.(data.businessDevPlan);
        onTrackUsage?.('coachMessagesCount');
      }
    } catch (err: any) {
      console.error('BizDev plan error:', err);
      setBizDevError(err?.message || 'Unable to reach AI Business Development service.');
    } finally {
      setIsGeneratingBizDev(false);
    }
  };

  const handleSaveOutreachToCrm = (
    suggestionTitle: string,
    messageDraft: string,
    linkedCrmId?: string
  ) => {
    const targetId =
      linkedCrmId && crmContacts.some((c) => c.id === linkedCrmId)
        ? linkedCrmId
        : selectedContact?.id;

    if (!targetId) {
      setSavedOutreachFeedback('Select or add a CRM contact first to attach this outreach note.');
      setTimeout(() => setSavedOutreachFeedback(null), 3500);
      return;
    }

    const noteEntry: CrmInteraction = {
      id: `int-bd-${Date.now()}`,
      date: todayIso,
      type: 'Email',
      summary: `Outreach Plan: ${suggestionTitle} — ${messageDraft}`,
      outcome: 'Draft saved from Business Development module.',
    };

    const targetContact = crmContacts.find((c) => c.id === targetId);
    const updated = crmContacts.map((c) =>
      c.id === targetId
        ? {
            ...c,
            interactions: [noteEntry, ...(c.interactions || [])],
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    onUpdateCrmContacts?.(updated);
    setSelectedContactId(targetId);
    setSavedOutreachFeedback(`Saved outreach draft into ${targetContact?.companyOrName || 'CRM record'}.`);
    setTimeout(() => setSavedOutreachFeedback(null), 3500);
  };

  const stageBadgeClass = (stage: CrmSalesStage) => {
    if (stage === 'Won') return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    if (stage === 'Proposal Sent' || stage === 'Negotiation')
      return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    if (stage === 'Lost' || stage === 'Dormant')
      return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
    return 'bg-[#F8F7F4] text-[#111113] border-[#111113]/15';
  };

  const statusBadgeClass = (status: CrmStatus) => {
    if (status === 'At Risk' || status === 'Closed Lost')
      return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
    if (status === 'Follow-Up Due') return 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]';
    if (status === 'Closed Won' || status === 'Active')
      return 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]';
    return 'bg-[#F8F7F4] text-[#52525B] border-[#111113]/15';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Architectural Charcoal Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bizpulse-label text-[#FBBF24]">
                CRM, Pipeline &amp; Business Development
              </span>
              <span className="text-xs text-[#A1A1AA] font-medium">
                {profile?.name || 'Business Case'} ({profile?.industry || 'SME'})
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              CRM, Client Portfolio &amp; Growth Pipeline
            </h2>
            <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed tabular-nums">
              {clientCount !== null
                ? `Active portfolio baseline: ${clientCount} customers.`
                : 'Track customer and prospect relationships, follow-up dates, and sales opportunities.'}{' '}
              Connected directly to your Business Health risks, ROI scenarios, and AI Coach outreach drafts.
            </p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded p-4 min-w-[230px] text-center shrink-0">
            <span className="text-[11px] font-mono text-[#FBBF24] uppercase tracking-wider font-bold block">
              Open CRM Pipeline Value
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1 font-mono tabular-nums">
              {currency} {crmStats.openPipelineValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#D4D4D8] mt-1 tabular-nums">
              {crmStats.totalCount} records · {crmStats.dueFollowUps.length} due/at risk
            </div>
          </div>
        </div>
      </div>

      {/* CRM Live Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white border border-[#111113]/12 rounded p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#52525B] block">
            CRM Records
          </span>
          <div className="text-2xl font-bold text-[#111113] font-mono mt-1">
            {crmStats.totalCount}
          </div>
          <span className="text-[11px] text-[#52525B]">
            {crmStats.openOpportunitiesCount} active pipeline deal{crmStats.openOpportunitiesCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#52525B] block">
            Open Opportunity Value
          </span>
          <div className="text-2xl font-bold text-[#111113] font-mono mt-1">
            {currency} {crmStats.openPipelineValue.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#52525B]">Qualified, proposal &amp; negotiation</span>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#52525B] block">
            Tracked Monthly Value
          </span>
          <div className="text-2xl font-bold text-[#15803D] font-mono mt-1">
            {currency} {crmStats.activeMonthlyBase.toLocaleString()}/mo
          </div>
          <span className="text-[11px] text-[#52525B]">Retainers + pipeline MRR potential</span>
        </div>

        <div
          className={`border rounded p-4 ${
            crmStats.dueFollowUps.length > 0
              ? 'bg-[#FFFBEB] border-[#FDE68A]'
              : 'bg-white border-[#111113]/12'
          }`}
        >
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#B45309] block">
            Follow-Ups Due / At Risk
          </span>
          <div className="text-2xl font-bold text-[#B45309] font-mono mt-1">
            {crmStats.dueFollowUps.length}
          </div>
          <button
            type="button"
            onClick={() => setOnlyDueOrRisk((v) => !v)}
            className="text-[11px] font-semibold text-[#D97706] hover:underline mt-0.5"
          >
            {onlyDueOrRisk ? 'Show all contacts' : 'Filter priority contacts →'}
          </button>
        </div>
      </div>

      {/* Connected Health & Financial Priority Alerts */}
      {connectedHealthAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {connectedHealthAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded border text-xs flex items-start gap-2.5 ${
                alert.tone === 'red'
                  ? 'bg-[#FEF2F2] border-[#FECACA] text-[#111113]'
                  : alert.tone === 'amber'
                  ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#111113]'
                  : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#111113]'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  alert.tone === 'red'
                    ? 'text-[#B91C1C]'
                    : alert.tone === 'amber'
                    ? 'text-[#D97706]'
                    : 'text-[#15803D]'
                }`}
              />
              <div>
                <strong className="block">{alert.title}</strong>
                <span className="text-[#52525B]">{alert.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================== */}
      {/* SECTION 1: BASIC CRM & SALES PIPELINE WORKBENCH     */}
      {/* =================================================== */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-lg font-bold text-[#111113]">
                Customer &amp; Prospect Relationship Records (CRM)
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1">
              Manage customer and prospect details, sales stage, follow-up dates, and full interaction logs. Isolated cleanly per business session.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewContactForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#111113] hover:bg-[#27272A] text-white text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#FBBF24]" />
            <span>Add Customer / Prospect</span>
          </button>
        </div>

        {/* Add / Edit CRM Contact Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveContact}
            className="p-5 rounded bg-[#F8F7F4] border border-[#D97706]/50 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#111113]">
                {editingId ? 'Edit CRM Record' : 'New Customer / Prospect Record'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-[#52525B] hover:text-[#111113] flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#111113] block mb-1">
                  Company / Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={formState.companyOrName}
                  onChange={(e) => setFormState({ ...formState, companyOrName: e.target.value })}
                  placeholder="e.g., Harbourview Builders Ltd"
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Primary Contact Person</label>
                <input
                  type="text"
                  value={formState.contactPerson}
                  onChange={(e) => setFormState({ ...formState, contactPerson: e.target.value })}
                  placeholder="e.g., Jane Smith (Director)"
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Email</label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  placeholder="name@company.co.nz"
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Phone</label>
                <input
                  type="text"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  placeholder="+64 21 ..."
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#111113] block mb-1">Record Classification</label>
                <select
                  value={formState.recordType}
                  onChange={(e) =>
                    setFormState({ ...formState, recordType: e.target.value as CrmRecordType })
                  }
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                >
                  {RECORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Portfolio Tier</label>
                <select
                  value={formState.tier}
                  onChange={(e) => setFormState({ ...formState, tier: e.target.value as CrmTier })}
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Sales Stage</label>
                <select
                  value={formState.salesStage}
                  onChange={(e) =>
                    setFormState({ ...formState, salesStage: e.target.value as CrmSalesStage })
                  }
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Tracking Status</label>
                <select
                  value={formState.status}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value as CrmStatus })}
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#111113] block mb-1">
                  Opportunity Value ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={formState.opportunityValue}
                  onChange={(e) => setFormState({ ...formState, opportunityValue: e.target.value })}
                  placeholder="0"
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">
                  Monthly Value / Retainer ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={formState.monthlyValue}
                  onChange={(e) => setFormState({ ...formState, monthlyValue: e.target.value })}
                  placeholder="0"
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Next Follow-Up Date</label>
                <input
                  type="date"
                  value={formState.nextFollowUpDate}
                  onChange={(e) => setFormState({ ...formState, nextFollowUpDate: e.target.value })}
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113] font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111113] block mb-1">Lead Source</label>
                <input
                  type="text"
                  value={formState.leadSource}
                  onChange={(e) => setFormState({ ...formState, leadSource: e.target.value })}
                  placeholder="Referral, Website, Accountant..."
                  className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-[#111113] block mb-1">
                Commercial Notes, Payment Behaviour &amp; Context
              </label>
              <textarea
                rows={2}
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Key requirements, debtor aging status, renewal date, or scope boundaries..."
                className="w-full bg-white border border-[#111113]/15 rounded px-3 py-2 text-[#111113]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded bg-white border border-[#111113]/15 text-xs font-semibold text-[#52525B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold uppercase tracking-wider"
              >
                {editingId ? 'Save Record Updates' : 'Save to CRM'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, contact, email, or notes..."
              className="w-full bg-[#F8F7F4] border border-[#111113]/15 rounded pl-8 pr-3 py-2 text-[#111113]"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-[#F8F7F4] border border-[#111113]/15 rounded px-3 py-2 text-[#111113] font-medium"
          >
            <option value="ALL">All Types</option>
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}s
              </option>
            ))}
          </select>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value as any)}
            className="bg-[#F8F7F4] border border-[#111113]/15 rounded px-3 py-2 text-[#111113] font-medium"
          >
            <option value="ALL">All Sales Stages</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyDueOrRisk((v) => !v)}
            className={`px-3 py-2 rounded border font-semibold transition ${
              onlyDueOrRisk
                ? 'bg-[#FFFBEB] border-[#D97706] text-[#B45309]'
                : 'bg-[#F8F7F4] border-[#111113]/15 text-[#52525B] hover:text-[#111113]'
            }`}
          >
            Due / At Risk Only
          </button>
        </div>

        {/* CRM Split Workspace: List + Selected Record Detail */}
        {crmContacts.length === 0 ? (
          <div className="p-8 rounded bg-[#F8F7F4] border border-dashed border-[#111113]/20 text-center space-y-3">
            <Users className="w-8 h-8 text-[#D97706] mx-auto" />
            <h4 className="font-bold text-[#111113] text-sm">
              No CRM Records Yet for {profile?.name || 'This Business'}
            </h4>
            <p className="text-xs text-[#52525B] max-w-md mx-auto">
              Add your top customers, active prospects, or overdue accounts to track pipeline values, interaction history, and follow-up dates.
            </p>
            <button
              type="button"
              onClick={openNewContactForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#111113] text-white text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>Add First CRM Contact</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left List */}
            <div className="lg:col-span-5 space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredContacts.length === 0 ? (
                <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/12 text-xs text-[#52525B] text-center">
                  No records match your current filters.
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const isSelected = selectedContact?.id === c.id;
                  const isOverdueDate =
                    Boolean(c.nextFollowUpDate) &&
                    c.nextFollowUpDate <= todayIso &&
                    c.salesStage !== 'Lost' &&
                    c.status !== 'Closed Lost';
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContactId(c.id)}
                      className={`p-4 rounded border cursor-pointer transition space-y-2 ${
                        isSelected
                          ? 'bg-[#FFFBEB]/60 border-[#D97706] shadow-xs'
                          : 'bg-[#F8F7F4] border-[#111113]/12 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-[#111113] truncate">
                            {c.companyOrName}
                          </h4>
                          <p className="text-xs text-[#52525B] truncate">
                            {c.contactPerson || 'No primary contact'} · {c.recordType}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${stageBadgeClass(
                            c.salesStage
                          )}`}
                        >
                          {c.salesStage}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded border font-semibold ${statusBadgeClass(
                              c.status
                            )}`}
                          >
                            {c.status}
                          </span>
                          <span className="text-[#52525B] font-mono">{c.tier}</span>
                        </div>
                        <div className="font-mono font-bold text-[#111113]">
                          {c.opportunityValue > 0
                            ? `Opp: ${currency} ${c.opportunityValue.toLocaleString()}`
                            : `${currency} ${c.monthlyValue.toLocaleString()}/mo`}
                        </div>
                      </div>

                      {c.nextFollowUpDate && (
                        <div
                          className={`text-[11px] flex items-center gap-1 font-mono ${
                            isOverdueDate ? 'text-[#B91C1C] font-bold' : 'text-[#52525B]'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>
                            Follow-up: {c.nextFollowUpDate}
                            {isOverdueDate ? ' (Due / Overdue)' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Detail Panel */}
            <div className="lg:col-span-7">
              {selectedContact ? (
                <div className="bg-[#F8F7F4] border border-[#111113]/12 rounded p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#111113]/10">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#111113] text-[#FBBF24]">
                          {selectedContact.recordType} · {selectedContact.tier}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadgeClass(
                            selectedContact.status
                          )}`}
                        >
                          {selectedContact.status}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-[#111113] mt-1.5">
                        {selectedContact.companyOrName}
                      </h4>
                      <p className="text-xs text-[#52525B]">
                        {selectedContact.contactPerson || 'Primary contact unspecified'}
                        {selectedContact.leadSource ? ` · Source: ${selectedContact.leadSource}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditContactForm(selectedContact)}
                        className="px-2.5 py-1.5 rounded bg-white border border-[#111113]/15 text-xs font-semibold text-[#111113] hover:border-[#D97706] flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(selectedContact.id)}
                        className="px-2.5 py-1.5 rounded bg-white border border-[#FECACA] text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-1"
                        title="Delete CRM record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info & Value Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs tabular-nums">
                    <div className="p-3 bg-white rounded border border-[#111113]/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-[#52525B]">
                        <Mail className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>{selectedContact.email || 'No email entered'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#52525B]">
                        <Phone className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>{selectedContact.phone || 'No phone entered'}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded border border-[#111113]/10 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#52525B] block">
                          Opportunity
                        </span>
                        <span className="font-mono font-bold text-[#111113] text-sm">
                          {currency} {selectedContact.opportunityValue.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-[#52525B] block">
                          Monthly Retainer
                        </span>
                        <span className="font-mono font-bold text-[#15803D] text-sm">
                          {currency} {selectedContact.monthlyValue.toLocaleString()}/mo
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Inline Pipeline & Follow-up Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-[#52525B] block mb-1">
                        Sales Stage
                      </label>
                      <select
                        value={selectedContact.salesStage}
                        onChange={(e) =>
                          handleQuickUpdateContact(selectedContact.id, {
                            salesStage: e.target.value as CrmSalesStage,
                          })
                        }
                        className="w-full bg-white border border-[#111113]/15 rounded px-2.5 py-1.5 font-semibold text-[#111113]"
                      >
                        {STAGE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-[#52525B] block mb-1">
                        Status
                      </label>
                      <select
                        value={selectedContact.status}
                        onChange={(e) =>
                          handleQuickUpdateContact(selectedContact.id, {
                            status: e.target.value as CrmStatus,
                          })
                        }
                        className="w-full bg-white border border-[#111113]/15 rounded px-2.5 py-1.5 font-semibold text-[#111113]"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-[#52525B] block mb-1">
                        Next Follow-Up Date
                      </label>
                      <input
                        type="date"
                        value={selectedContact.nextFollowUpDate || ''}
                        onChange={(e) =>
                          handleQuickUpdateContact(selectedContact.id, {
                            nextFollowUpDate: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-[#111113]/15 rounded px-2.5 py-1.5 font-mono text-[#111113]"
                      />
                    </div>
                  </div>

                  {selectedContact.notes && (
                    <div className="p-3 bg-white rounded border border-[#111113]/10 text-xs text-[#111113]">
                      <strong className="block text-[10px] uppercase tracking-wider text-[#52525B] mb-1">
                        Account Notes
                      </strong>
                      {selectedContact.notes}
                    </div>
                  )}

                  {/* Connected Cross-Module Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onEvaluateOpportunityInRoi && (
                      <button
                        type="button"
                        onClick={() => onEvaluateOpportunityInRoi(selectedContact)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold transition"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Evaluate ROI for Opportunity</span>
                      </button>
                    )}

                    {onOpenCoachWithPrompt && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenCoachWithPrompt(
                            `Help me prepare a practical follow-up and outreach message for CRM record "${selectedContact.companyOrName}" (Contact: ${selectedContact.contactPerson || 'Owner'}, Type: ${selectedContact.recordType}, Tier: ${selectedContact.tier}, Stage: ${selectedContact.salesStage}, Status: ${selectedContact.status}, Opportunity: ${currency} ${selectedContact.opportunityValue.toLocaleString()}, Monthly: ${currency} ${selectedContact.monthlyValue.toLocaleString()}, Follow-up Due: ${selectedContact.nextFollowUpDate || 'Unscheduled'}). Context: ${selectedContact.notes || 'None'}.`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#111113] hover:bg-[#27272A] text-white text-xs font-bold transition"
                      >
                        <Bot className="w-3.5 h-3.5 text-[#FBBF24]" />
                        <span>Draft Outreach in AI Coach</span>
                      </button>
                    )}
                  </div>

                  {/* Interaction History Log */}
                  <div className="pt-3 border-t border-[#111113]/10 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#111113] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Interaction History ({selectedContact.interactions?.length || 0})</span>
                    </h5>

                    <form
                      onSubmit={handleAddInteraction}
                      className="p-3 bg-white rounded border border-[#111113]/12 space-y-2 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={intType}
                          onChange={(e) => setIntType(e.target.value as CrmInteraction['type'])}
                          className="bg-[#F8F7F4] border border-[#111113]/15 rounded px-2.5 py-1.5 font-semibold"
                        >
                          {INTERACTION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={intDate}
                          onChange={(e) => setIntDate(e.target.value)}
                          className="bg-[#F8F7F4] border border-[#111113]/15 rounded px-2.5 py-1.5 font-mono"
                        />
                        <input
                          type="text"
                          value={intOutcome}
                          onChange={(e) => setIntOutcome(e.target.value)}
                          placeholder="Next step / outcome (optional)"
                          className="bg-[#F8F7F4] border border-[#111113]/15 rounded px-2.5 py-1.5"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={intSummary}
                          onChange={(e) => setIntSummary(e.target.value)}
                          placeholder="Log call, email, meeting notes, or proposal sent..."
                          className="flex-1 bg-[#F8F7F4] border border-[#111113]/15 rounded px-3 py-1.5"
                        />
                        <button
                          type="submit"
                          disabled={!intSummary.trim()}
                          className="px-3.5 py-1.5 rounded bg-[#111113] disabled:opacity-40 text-white font-bold inline-flex items-center gap-1 shrink-0"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5 text-[#FBBF24]" />
                          <span>Log</span>
                        </button>
                      </div>
                    </form>

                    {selectedContact.interactions && selectedContact.interactions.length > 0 ? (
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {selectedContact.interactions.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 bg-white rounded border border-[#111113]/10 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[#D97706] uppercase">{item.type}</span>
                              <span className="font-mono text-[#52525B]">{item.date}</span>
                            </div>
                            <p className="text-[#111113]">{item.summary}</p>
                            {item.outcome && (
                              <p className="text-[#52525B] italic">Outcome: {item.outcome}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#52525B]">
                        No interactions logged yet for this contact.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded bg-[#F8F7F4] border border-[#111113]/12 text-center text-xs text-[#52525B]">
                  Select a CRM record from the list to inspect contact details and interaction history.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================== */}
      {/* SECTION 2: CONNECTED BUSINESS DEVELOPMENT & OUTREACH */}
      {/* =================================================== */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-lg font-bold text-[#111113]">
                Connected Business Development, Lead Generation &amp; Follow-Up Support
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1">
              Synthesizes your Business Health score, cash/margin situation, and live CRM pipeline into ideal customer targeting, follow-up priorities, and outreach scripts.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={bizDevFocus}
            onChange={(e) => setBizDevFocus(e.target.value)}
            placeholder="Optional growth focus (e.g., Target 10 accounting-referred SMEs, or win back dormant customers)"
            className="flex-1 bg-[#F8F7F4] border border-[#111113]/15 rounded px-3.5 py-2.5 text-xs text-[#111113]"
          />
          <button
            type="button"
            onClick={handleGenerateBusinessDevPlan}
            disabled={isGeneratingBizDev}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded bg-[#D97706] hover:bg-[#B45309] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
          >
            {isGeneratingBizDev ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Plan...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {businessDevPlan ? 'Refresh Lead & Outreach Plan' : 'Generate Lead & Outreach Plan'}
                </span>
              </>
            )}
          </button>
        </div>

        {bizDevError && (
          <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
            {bizDevError}
          </div>
        )}

        {savedOutreachFeedback && (
          <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#15803D] font-semibold">
            {savedOutreachFeedback}
          </div>
        )}

        {businessDevPlan ? (
          <div className="space-y-4">
            <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12 text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[#D97706] block">
                Recommended Ideal Customer Profile (ICP)
              </span>
              <p className="text-[#111113] leading-relaxed text-sm">
                {businessDevPlan.idealCustomerProfile}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                <span className="font-bold uppercase tracking-wider text-[#15803D] block">
                  Target Market &amp; Partnership Opportunities
                </span>
                <ul className="space-y-1.5 text-[#111113]">
                  {businessDevPlan.targetOpportunities.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <span className="font-bold uppercase tracking-wider text-[#B45309] block">
                  Priority Follow-Up Actions (CRM + Health Linked)
                </span>
                <ul className="space-y-1.5 text-[#111113]">
                  {businessDevPlan.followUpPriorities.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {businessDevPlan.outreachSuggestions.length > 0 && (
              <div className="space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#111113] block">
                  Tailored Outreach Drafts &amp; Follow-Up Messages
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {businessDevPlan.outreachSuggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-2 text-xs flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#111113] text-sm">{sug.title}</span>
                          <span className="px-2 py-0.5 rounded bg-white border border-[#111113]/15 font-mono text-[10px] text-[#D97706] font-bold">
                            {sug.channel}
                          </span>
                        </div>
                        <p className="text-[#52525B]">
                          <strong>Segment:</strong> {sug.targetSegment} — {sug.rationale}
                        </p>
                        <div className="p-3 rounded bg-white border border-[#111113]/10 text-[#111113] whitespace-pre-wrap leading-relaxed font-mono text-[11px]">
                          {sug.messageDraft}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveOutreachToCrm(sug.title, sug.messageDraft, sug.linkedCrmId)
                          }
                          className="px-3 py-1.5 rounded bg-white border border-[#111113]/15 hover:border-[#D97706] text-[11px] font-bold text-[#111113] inline-flex items-center gap-1"
                        >
                          <MessageSquarePlus className="w-3 h-3 text-[#D97706]" />
                          <span>Save to CRM Log</span>
                        </button>
                        {onOpenCoachWithPrompt && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenCoachWithPrompt(
                                `Refine this outreach campaign "${sug.title}" for ${profile?.name || 'our business'} (${sug.targetSegment} via ${sug.channel}):\n\n"${sug.messageDraft}"\n\nMake it sharper for objection handling and ROI framing.`
                              )
                            }
                            className="px-3 py-1.5 rounded bg-[#111113] text-white text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3 text-[#FBBF24]" />
                            <span>Refine in AI Coach</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 rounded bg-[#F8F7F4] border border-[#111113]/10 text-xs text-[#52525B] flex items-center justify-between gap-4">
            <span>
              Click <strong>Generate Lead &amp; Outreach Plan</strong> above to generate Health-grounded target customer profiles, partner ideas, and follow-up scripts connected to your CRM records.
            </span>
            <TrendingUp className="w-5 h-5 text-[#D97706] shrink-0" />
          </div>
        )}
      </div>

      {/* =================================================== */}
      {/* SECTION 3: EXISTING CLIENT CONCENTRATION & MATRIX   */}
      {/* =================================================== */}
      {!isDemo && annualRevenue === null && (
        <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <span>
            No historical revenue or customer concentration figures have been supplied for{' '}
            <strong>{profile?.name}</strong> yet. Use the modeling slider below to test scenarios cleanly without assuming unverified client data.
          </span>
        </div>
      )}

      {/* Concentration Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B91C1C]">
              Top 5 Anchor Clients
            </span>
            <AlertOctagon className="w-4 h-4 text-[#B91C1C]" />
          </div>
          <div className="text-2xl font-bold text-[#111113] font-mono">
            {top5Pct !== null ? `${top5Pct}% of Revenue` : 'Not supplied'}
          </div>
          <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#111113]">
            <strong>Risk Check: </strong>
            Losing any single anchor client requires formal relationship reviews and written renewal visibility.
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B45309]">
              Next Core Tier
            </span>
            <Users className="w-4 h-4 text-[#B45309]" />
          </div>
          <div className="text-2xl font-bold text-[#111113] font-mono">
            {next7Pct !== null ? `${next7Pct}% of Revenue` : 'Not supplied'}
          </div>
          <div className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#111113]">
            <strong>Retention Focus: </strong>
            Core recurring accounts respond well to predictable service roadmaps and transparent pricing updates.
          </div>
        </div>

        <div className="bg-white border border-[#111113]/12 rounded p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#111113]">
              Long-Tail Accounts
            </span>
            <Layers className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="text-2xl font-bold text-[#111113] font-mono">
            {tailPct !== null ? `${tailPct}% of Revenue` : 'Not supplied'}
          </div>
          <div className="p-2.5 rounded bg-[#F8F7F4] border border-[#111113]/10 text-xs text-[#111113]">
            <strong>Scope Hygiene: </strong>
            Small ad-hoc accounts often create disproportionate admin interruptions and unpaid support calls.
          </div>
        </div>
      </div>

      {/* Price Review & Churn Sensitivity Calculator */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#111113]/10">
          <div>
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-lg font-bold text-[#111113]">
                Scenario Simulator: Price Adjustment vs. Low-Margin Churn
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-1">
              Test what happens to annual net profit when you review pricing by 8–12% across your recurring revenue base.
            </p>
          </div>
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-1.5 rounded text-xs text-[#15803D] font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            <span>Margin Recovery Simulator</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
          <div className="space-y-5">
            {!isDemo && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-[#111113]">
                    Scenario Annual Recurring Revenue Base ({currency})
                  </label>
                  <span className="text-xs font-bold font-mono tabular-nums text-[#D97706]">
                    {currency} {priceableRevenueBase.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="50000"
                  max="2500000"
                  step="25000"
                  value={priceableRevenueBase}
                  onChange={(e) => setPriceableRevenueBase(Number(e.target.value))}
                  className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#D97706]"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#111113]">
                  Contract Price Adjustment (%)
                </label>
                <span className="text-sm font-bold text-[#B45309] font-mono tabular-nums bg-[#FFFBEB] px-2.5 py-0.5 rounded border border-[#FDE68A]">
                  +{priceIncreasePct}% (+{currency} {grossPriceGain.toLocaleString()}/yr)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={priceIncreasePct}
                onChange={(e) => setPriceIncreasePct(Number(e.target.value))}
                className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#D97706]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#111113]">
                  Estimated Low-Margin Clients Exiting
                </label>
                <span className="text-sm font-bold text-[#B91C1C] font-mono tabular-nums bg-[#FEF2F2] px-2.5 py-0.5 rounded border border-[#FECACA]">
                  {churnedClientsCount} clients
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="1"
                value={churnedClientsCount}
                onChange={(e) => setChurnedClientsCount(Number(e.target.value))}
                className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#DC2626]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-[#F8F7F4] border border-[#111113]/12 rounded">
                <label className="text-[#52525B] block font-semibold mb-1">
                  Avg Monthly Retainer ({currency})
                </label>
                <input
                  type="number"
                  value={averageChurnedClientMRR}
                  onChange={(e) => setAverageChurnedClientMRR(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded px-2.5 py-1 font-mono font-bold text-[#111113] tabular-nums focus:outline-none focus:border-[#D97706]"
                />
              </div>
              <div className="p-3 bg-[#F8F7F4] border border-[#111113]/12 rounded">
                <label className="text-[#52525B] block font-semibold mb-1">
                  Gross Margin on Churned (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={churnedClientMarginPct}
                  onChange={(e) => setChurnedClientMarginPct(Number(e.target.value) || 0)}
                  className="w-full bg-[#FCFCFC] border border-[#111113]/15 rounded px-2.5 py-1 font-mono font-bold text-[#111113] tabular-nums focus:outline-none focus:border-[#D97706]"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#F8F7F4] border border-[#111113]/12 rounded p-5 space-y-4 tabular-nums">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#111113] border-b border-[#111113]/10 pb-2">
              Projected Operating Profit Outcome
            </h4>

            <div className="space-y-3 divide-y divide-[#111113]/10 text-sm">
              <div className="flex justify-between items-center pt-1">
                <span className="text-[#52525B]">Gross Price Review Gain:</span>
                <span className="font-bold text-[#15803D] font-mono">
                  +{currency} {grossPriceGain.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#52525B]">Lost Gross Profit from Churn:</span>
                <span className="font-semibold text-[#B91C1C] font-mono">
                  -{currency} {lostAnnualGrossProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 bg-white p-3 rounded border border-[#111113]/12">
                <span className="font-bold text-[#111113]">Net Annual Profit Impact:</span>
                <span
                  className={`font-bold font-mono text-base ${
                    netProfitImpact >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                  }`}
                >
                  {netProfitImpact >= 0 ? '+' : '-'}
                  {currency} {Math.abs(netProfitImpact).toLocaleString()}
                </span>
              </div>
              {operatingProfit !== null && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#52525B]">New Projected Operating Profit:</span>
                  <span className="font-bold text-[#111113] font-mono text-lg">
                    {currency} {newProjectedOperatingProfit.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[#52525B]">Team Capacity Freed:</span>
                <span className="font-bold text-[#D97706] font-mono">
                  +{totalHoursFreedPerMonth} hrs / month
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Tier Segmentation Playbook */}
      <div className="bg-white border border-[#111113]/12 rounded p-6 shadow-xs">
        <h3 className="text-base font-bold text-[#111113] mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-[#D97706]" />
          <span>4-Tier Client Portfolio Segmentation Guide</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded bg-[#ECFDF5] border border-[#A7F3D0] space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#15803D] block">
              Tier 1: Champions
            </span>
            <p className="text-[#111113]">Prompt payers, high margin, strong mutual trust.</p>
            <p className="text-[#15803D] font-semibold">
              Action: Executive check-ins + value-led renewals.
            </p>
          </div>
          <div className="p-4 rounded bg-[#F8F7F4] border border-[#111113]/12 space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#111113] block">
              Tier 2: Steady Core
            </span>
            <p className="text-[#111113]">Predictable service needs, pays within 20–35 days.</p>
            <p className="text-[#D97706] font-semibold">
              Action: Scheduled CPI/cost price update + direct debit.
            </p>
          </div>
          <div className="p-4 rounded bg-[#FFFBEB] border border-[#FDE68A] space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#B45309] block">
              Tier 3: Margin Squeeze
            </span>
            <p className="text-[#111113]">Repeatedly demands discounts or extra free scope.</p>
            <p className="text-[#B45309] font-semibold">
              Action: Remove unbilled inclusions before matching price.
            </p>
          </div>
          <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
            <span className="font-bold uppercase tracking-wider text-[#B91C1C] block">
              Tier 4: Chronic Drain
            </span>
            <p className="text-[#111113]">Consistently 60+ days overdue with high ticket friction.</p>
            <p className="text-[#B91C1C] font-semibold">
              Action: Enforce credit stop-work or exit account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
