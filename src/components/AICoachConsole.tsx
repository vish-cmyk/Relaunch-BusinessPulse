import React, { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  FileText,
  Copy,
  Check,
  RotateCcw,
  UserCheck,
  Loader2,
  AlertTriangle,
  HelpCircle,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Users,
  BookmarkPlus,
  RefreshCw,
} from 'lucide-react';
import { SCRIPT_PRESETS } from '../data/coachingBriefing';
import {
  ScriptPreset,
  CaseRecord,
  BusinessProfile,
  ChatMessage,
  CoachSuggestedAction,
  TurnaroundAction,
  CrmRecord,
  AccountUsageSummary,
} from '../types/bizpulse';
import { apiFetchWithAuth, sanitizeDocumentsForAiPayload } from '../services/firebase';

interface AICoachConsoleProps {
  caseRecord: CaseRecord;
  onUpdateCase?: (updated: CaseRecord) => void;
  onTrackUsage?: (field: 'coachMessagesCount') => void;
  onAccountUsageUpdate?: (usage: AccountUsageSummary) => void;
  initialPrompt?: string;
  onOpenChallengeMe?: () => void;
}

const TOPIC_OPTIONS = [
  'Strategy & Growth',
  'Cash Flow & Collections',
  'Pricing & Margins',
  'Client Retention',
  'CRM & Pipeline',
  'ROI & Investments',
  'Team & Owner Capacity',
];

export const AICoachConsole: React.FC<AICoachConsoleProps> = ({
  caseRecord,
  onUpdateCase,
  onTrackUsage,
  onAccountUsageUpdate,
  initialPrompt,
  onOpenChallengeMe,
}) => {
  const profile = caseRecord.profile;

  const getInitialWelcomeText = (p: BusinessProfile) => {
    if (p.isDemonstrationCase) {
      return `Kia ora Vish and Managing Partner. I am your ongoing AI Business Coach for Apex Managed Services Ltd. I have loaded your 12-Capability Health scores, baseline financials (NZ$1.28M revenue, NZ$38k cash, NZ$52k overdraft drawn, NZ$58k >60-day overdue debtors), CRM pipeline, and ROI models.

Ask questions, disagree with any recommendation, compare options, or turn our discussion directly into Action Plan and CRM follow-up tasks.`;
    }
    return `Welcome to Chat with Coach for ${p.name || 'your business'}.
Context active: ${p.industry} (${p.country}, Currency: ${p.currency}) | Health: ${
      caseRecord.overallHealth?.overallScore ?? 'Pending'
    }/100 | CRM: ${caseRecord.crmContacts?.length || 0} record(s) | ROI Scenarios: ${
      caseRecord.roiScenarios?.length || 0
    } | Docs: ${caseRecord.uploadedDocuments?.length || 0}.

Primary Objective: "${p.primaryObjective || 'Not entered yet'}"
Primary Concern: "${p.primaryConcern || 'Not entered yet'}"

Ask about cash flow, profitability, growth options, client priorities, or challenge any recommendation below.`;
  };

  const buildInitialMessages = (record: CaseRecord): ChatMessage[] => {
    if (record.conversations && record.conversations.length > 0) {
      return record.conversations;
    }
    return [
      {
        id: 'm-0',
        sender: 'coach',
        text: getInitialWelcomeText(record.profile),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => buildInitialMessages(caseRecord));
  const [inputPrompt, setInputPrompt] = useState<string>(initialPrompt || '');
  const [selectedTopic, setSelectedTopic] = useState<string>('Strategy & Growth');

  const defaultRole = profile.isDemonstrationCase
    ? 'Managing Director (Vish)'
    : `Owner / Managing Director (${profile.name || 'SME'})`;
  const [userRole, setUserRole] = useState<string>(defaultRole);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Record<string, boolean>>({});

  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<ScriptPreset | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(buildInitialMessages(caseRecord));
    setUserRole(
      caseRecord.profile.isDemonstrationCase
        ? 'Managing Director (Vish)'
        : `Owner / Managing Director (${caseRecord.profile.name || 'SME'})`
    );
    setGeneratedScript(null);
    setSelectedPreset(null);
    setSavedMessageIds({});
    setChatError(null);
    setLastFailedPrompt(null);
    setScriptError(null);
  }, [caseRecord.id]);

  // Keep local messages synchronized if Firestore updates conversations on the active case
  useEffect(() => {
    if (caseRecord.conversations && caseRecord.conversations.length > 0) {
      setMessages(caseRecord.conversations);
    }
  }, [caseRecord.conversations]);

  useEffect(() => {
    if (initialPrompt) {
      setInputPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const showTempNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const roleOptions = profile.isDemonstrationCase
    ? ['Managing Director (Vish)', 'Finance/Operations (Partner)', 'Senior Systems Engineer']
    : [
        `Owner / Managing Director (${profile.name || 'SME'})`,
        'Finance & Administration Lead',
        'Operations / Service Manager',
        'General Manager / Partner',
      ];

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isLoading) return;

    const priorMessages = [...messages];
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      metadata: {
        topic: selectedTopic,
        role: userRole,
      },
    };

    const nextMessages = [...priorMessages, userMsg];
    setMessages(nextMessages);
    if (!customPrompt) setInputPrompt('');
    setIsLoading(true);
    setChatError(null);
    setLastFailedPrompt(null);

    try {
      const { data } = await apiFetchWithAuth<any>('/api/coach/query', {
        method: 'POST',
        body: {
          caseId: caseRecord.id,
          prompt: textToSend,
          conversationHistory: priorMessages.slice(-14).map((m) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
          })),
          topic: selectedTopic,
          userRole,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: sanitizeDocumentsForAiPayload(caseRecord.uploadedDocuments || []),
          crossDocumentSynthesis: caseRecord.crossDocumentSynthesis || null,
          crmContacts: caseRecord.crmContacts || [],
          roiScenarios: caseRecord.roiScenarios || [],
          recommendations: caseRecord.recommendations,
          actionPlan: caseRecord.actionPlan || [],
          continuity: caseRecord.continuity || null,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      const coachMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        sender: 'coach',
        text: data.reply || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metadata: {
          topic: selectedTopic,
          estimatesAndAssumptions: Array.isArray(data.estimatesAndAssumptions)
            ? data.estimatesAndAssumptions
            : [],
          followUpQuestions: Array.isArray(data.followUpQuestions)
            ? data.followUpQuestions
            : [],
          suggestedActions: Array.isArray(data.suggestedActions)
            ? data.suggestedActions
            : [],
        },
      };

      const finalMessages = [...nextMessages, coachMsg];
      setMessages(finalMessages);
      onUpdateCase?.({
        ...caseRecord,
        conversations: finalMessages,
        updatedAt: new Date().toISOString(),
      });
      onTrackUsage?.('coachMessagesCount');
    } catch (err: any) {
      console.error('Coach query failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      // Restore prior clean conversation history and keep the failed prompt ready for 1-click retry
      setMessages(priorMessages);
      if (!customPrompt) setInputPrompt(textToSend);
      setLastFailedPrompt(textToSend);
      setChatError(err?.message || 'Unable to reach Chat with Coach right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertSuggestedAction = (messageId: string, act: CoachSuggestedAction) => {
    if (act.savedToPlan) return;
    const nowIso = new Date().toISOString();

    const updatedConversations = messages.map((m) => {
      if (m.id !== messageId || !m.metadata?.suggestedActions) return m;
      return {
        ...m,
        metadata: {
          ...m.metadata,
          suggestedActions: m.metadata.suggestedActions.map((sa) =>
            sa.id === act.id ? { ...sa, savedToPlan: true } : sa
          ),
        },
      };
    });

    if (act.targetType === 'crm_followup') {
      const followUpDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const newCrmFollowUp: CrmRecord = {
        id: `crm-coach-${Date.now()}`,
        companyOrName: act.title.slice(0, 80),
        contactPerson: act.ownerRole || 'Owner Follow-up',
        email: '',
        phone: '',
        recordType: 'Lead',
        tier: 'Prospect',
        salesStage: 'Contacted',
        status: 'Follow-Up Due',
        opportunityValue: 0,
        monthlyValue: 0,
        nextFollowUpDate: followUpDate,
        leadSource: `Chat with Coach (${selectedTopic})`,
        notes: `Agreed in Chat with Coach (${act.timeframe}): ${act.title}`,
        interactions: [
          {
            id: `int-${Date.now()}`,
            date: nowIso.slice(0, 10),
            type: 'Note',
            summary: `Created follow-up task from Chat with Coach: ${act.title}`,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setMessages(updatedConversations);
      onUpdateCase?.({
        ...caseRecord,
        crmContacts: [newCrmFollowUp, ...(caseRecord.crmContacts || [])],
        conversations: updatedConversations,
        updatedAt: nowIso,
      });
      showTempNotice(`Added CRM follow-up task ("${act.title.slice(0, 48)}...") due ${followUpDate}.`);
      return;
    }

    const newAction: TurnaroundAction = {
      id: `act-coach-${Date.now()}`,
      horizon: act.priority.includes('Urgent')
        ? 'Horizon 1 (First 7 Days)'
        : act.priority.includes('High')
        ? 'Horizon 2 (Days 8–30)'
        : 'Horizon 3 (Days 31–90)',
      priority: act.priority,
      businessIssue: `Agreed in Chat with Coach (${selectedTopic})`,
      action: act.title,
      accountableRole: act.ownerRole || 'Owner',
      timeframe: act.timeframe || 'Within 7 days',
      requiredInformationOrResources: ['Agreed in Chat with Coach session'],
      measurableSuccessIndicator: `Completed within ${act.timeframe || 'target window'}`,
      dependencyOrRisk: 'Verify working assumptions before committing cash.',
      status: 'pending',
      completed: false,
    };

    setMessages(updatedConversations);
    onUpdateCase?.({
      ...caseRecord,
      actionPlan: [newAction, ...(caseRecord.actionPlan || [])],
      conversations: updatedConversations,
      updatedAt: nowIso,
    });
    showTempNotice(`Added "${act.title.slice(0, 48)}..." to your 90-Day Action Plan.`);
  };

  const handleSaveReplyAsAction = (msg: ChatMessage) => {
    if (savedMessageIds[msg.id]) return;
    const summaryLine =
      msg.text
        .split('\n')
        .map((line) => line.replace(/^[-*•\d.]+\s*/, '').trim())
        .find((line) => line.length > 15) || msg.text.slice(0, 120);

    const newAction: TurnaroundAction = {
      id: `act-msg-${Date.now()}`,
      horizon: 'Horizon 1 (First 7 Days)',
      priority: 'Priority 2 (High)',
      businessIssue: `Coach Discussion (${msg.metadata?.topic || selectedTopic})`,
      action: summaryLine.slice(0, 180),
      accountableRole: userRole,
      timeframe: 'Within 7 days',
      requiredInformationOrResources: ['Notes from Chat with Coach thread'],
      measurableSuccessIndicator: 'Action reviewed and confirmed with coach metrics',
      dependencyOrRisk: 'Confirm any flagged AI assumptions first.',
      status: 'pending',
      completed: false,
    };

    setSavedMessageIds((prev) => ({ ...prev, [msg.id]: true }));
    onUpdateCase?.({
      ...caseRecord,
      actionPlan: [newAction, ...(caseRecord.actionPlan || [])],
      updatedAt: new Date().toISOString(),
    });
    showTempNotice('Saved coaching insight to your 90-Day Action Plan.');
  };

  const handleGeneratePresetScript = async (preset: ScriptPreset) => {
    setSelectedPreset(preset);
    setIsGeneratingScript(true);
    setGeneratedScript(null);
    setScriptError(null);

    try {
      const { data } = await apiFetchWithAuth<any>('/api/coach/generate-script', {
        method: 'POST',
        body: {
          caseId: caseRecord.id,
          scriptType: preset.title,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: sanitizeDocumentsForAiPayload(caseRecord.uploadedDocuments || []),
          crmContacts: caseRecord.crmContacts || [],
          roiScenarios: caseRecord.roiScenarios || [],
          recommendations: caseRecord.recommendations,
          actionPlan: caseRecord.actionPlan || [],
          details: preset.defaultPrompt,
        },
      });

      if (data.accountUsage) onAccountUsageUpdate?.(data.accountUsage);
      setGeneratedScript(data.script);
      onTrackUsage?.('coachMessagesCount');
    } catch (err: any) {
      console.error('Script generation failed:', err);
      if (err?.accountUsage) onAccountUsageUpdate?.(err.accountUsage);
      setScriptError(err?.message || 'Failed to generate communication draft.');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptId(id);
    setTimeout(() => setCopiedScriptId(null), 2000);
  };

  const quickConversationStarters = [
    `I disagree with part of the current recommendation — let's test an alternative approach for ${profile.name}.`,
    `Which 2 CRM or cash-flow actions give the fastest payback with least risk right now?`,
    `Walk me through the biggest unverified assumptions in my plan before I spend cash.`,
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Executive Navy Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#2563EB] text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Chat with Coach
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">
                Ongoing Context-Aware Business Advisory
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Chat with Coach ({profile.name})
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              Multi-turn advisory grounded in {profile.name} ({profile.industry}, {profile.country}) — using your 12-Capability Health scores, {caseRecord.recommendations ? 'saved diagnostic recommendations, ' : ''}{caseRecord.crmContacts?.length || 0} CRM record{(caseRecord.crmContacts?.length || 0) === 1 ? '' : 's'}, {caseRecord.roiScenarios?.length || 0} ROI scenario{(caseRecord.roiScenarios?.length || 0) === 1 ? '' : 's'}, and {caseRecord.uploadedDocuments?.length || 0} document{(caseRecord.uploadedDocuments?.length || 0) === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0">
            <div className="flex items-center space-x-2.5 bg-white/5 px-3.5 py-2 rounded border border-white/15">
              <span className="text-xs text-[#CBD5E1] font-medium whitespace-nowrap">Role:</span>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="bg-[#0F172A] text-xs font-bold text-white border border-white/20 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#2563EB] max-w-[220px]"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {onOpenChallengeMe && (
              <button
                type="button"
                onClick={onOpenChallengeMe}
                className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Switch to Challenge Me</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold rounded flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button type="button" onClick={() => setActionNotice(null)} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Script Presets Bar */}
      <div className="bg-white border border-[#0F172A]/12 rounded p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="bizpulse-label text-[#0F172A] font-bold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
            Commercial Script Drafts ({profile.country})
          </span>
          <span className="text-xs text-[#475569]">1-Click Custom Draft</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SCRIPT_PRESETS.map((preset: ScriptPreset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleGeneratePresetScript(preset)}
              className="p-3 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:border-[#2563EB] hover:bg-white transition text-left space-y-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-[#1D4ED8] border border-[#0F172A]/12">
                  {preset.category}
                </span>
                <Sparkles className="w-3 h-3 text-[#64748B] group-hover:text-[#2563EB] transition" />
              </div>
              <h4 className="font-bold text-[#0F172A] text-xs line-clamp-1 group-hover:text-[#2563EB]">
                {preset.title}
              </h4>
              <p className="text-[11px] text-[#475569] line-clamp-2">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Generated Script Drawer */}
      {selectedPreset && (
        <div className="bg-white border border-[#2563EB] rounded p-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#0F172A]/10">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#2563EB]" />
              <div>
                <h3 className="font-bold text-[#0F172A] text-sm">
                  Draft Script: {selectedPreset.title}
                </h3>
                <p className="text-xs text-[#475569]">
                  Calibrated for {profile.name} ({profile.country}, {profile.currency})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {generatedScript && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedScript, 'generated-script')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#0F172A] text-white text-xs font-bold hover:bg-[#1E293B] transition whitespace-nowrap shrink-0"
                >
                  {copiedScriptId === 'generated-script' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#60A5FA]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#60A5FA]" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedPreset(null)}
                className="px-2.5 py-1.5 text-xs text-[#475569] hover:text-[#0F172A] font-semibold"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-4">
            {isGeneratingScript ? (
              <div className="py-8 text-center text-[#475569] text-xs flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
                <span>Drafting tailored communication...</span>
              </div>
            ) : scriptError ? (
              <div className="p-4 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scriptError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => selectedPreset && handleGeneratePresetScript(selectedPreset)}
                  className="px-3 py-1.5 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold inline-flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Draft</span>
                </button>
              </div>
            ) : (
              <div className="bg-[#FCFCFC] p-4 rounded border border-[#0F172A]/15 text-xs text-[#0F172A] font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {generatedScript}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Container */}
      <div className="bg-white border border-[#0F172A]/12 rounded overflow-hidden flex flex-col min-h-[640px] max-h-[780px]">
        <div className="bg-[#F8FAFC] px-6 py-3 border-b border-[#0F172A]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#475569] font-semibold">Topic:</span>
            <div className="flex flex-wrap gap-1">
              {TOPIC_OPTIONS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                    selectedTopic === topic
                      ? 'bg-[#0F172A] text-white'
                      : 'text-[#475569] hover:text-[#0F172A] hover:bg-white'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const resetMsgs: ChatMessage[] = [
                {
                  id: 'm-reset',
                  sender: 'coach',
                  text: getInitialWelcomeText(profile),
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              ];
              setMessages(resetMsgs);
              onUpdateCase?.({
                ...caseRecord,
                conversations: resetMsgs,
                updatedAt: new Date().toISOString(),
              });
            }}
            className="flex items-center space-x-1 text-[#475569] hover:text-[#0F172A] transition font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thread</span>
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-[#FCFCFC]">
          {messages.map((msg) => {
            const isCoach = msg.sender === 'coach';
            const estimates = msg.metadata?.estimatesAndAssumptions || [];
            const followUps = msg.metadata?.followUpQuestions || [];
            const suggestedActions = msg.metadata?.suggestedActions || [];
            const isInitialGreeting = msg.id === 'm-0' || msg.id === 'm-reset' || msg.id.startsWith('err-');

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isCoach ? 'justify-start' : 'justify-end'}`}
              >
                {isCoach && (
                  <div className="w-8 h-8 rounded bg-[#0F172A] flex items-center justify-center shrink-0 text-white">
                    <Bot className="w-4 h-4 text-[#60A5FA]" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded p-4 text-xs sm:text-sm leading-relaxed space-y-3 ${
                    isCoach
                      ? 'bg-white border border-[#0F172A]/12 text-[#0F172A]'
                      : 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#0F172A] font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[10px] text-[#475569]">
                    <span className="font-bold uppercase tracking-wider">
                      {isCoach ? 'AI Business Coach' : msg.metadata?.role || userRole}
                      {msg.metadata?.topic ? ` · ${msg.metadata.topic}` : ''}
                    </span>
                    <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* AI-Generated Estimates & Working Assumptions Callout */}
                  {isCoach && estimates.length > 0 && (
                    <div className="p-3 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-[#B45309] uppercase tracking-wider text-[10px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>AI Estimates &amp; Working Assumptions (Verify Against Actual Records)</span>
                      </div>
                      <ul className="space-y-1 text-[#0F172A]">
                        {estimates.map((est, i) => (
                          <li key={i} className="leading-relaxed">• {est}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Clickable Coach Follow-Up Questions */}
                  {isCoach && followUps.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-[#2563EB]" />
                        Coach Follow-Up Questions (Click to Answer):
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {followUps.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setInputPrompt(`In response to "${q}": `)}
                            className="text-left text-xs px-3 py-2 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#0F172A]/12 hover:border-[#2563EB] text-[#0F172A] transition"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Convertible Suggested Actions / CRM Follow-Ups */}
                  {isCoach && suggestedActions.length > 0 && (
                    <div className="pt-2 border-t border-[#0F172A]/10 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A] block">
                        Convert Discussion to Tracked Action or CRM Follow-Up:
                      </span>
                      <div className="space-y-2">
                        {suggestedActions.map((act) => (
                          <div
                            key={act.id}
                            className="p-2.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white border ${
                                    act.targetType === 'crm_followup'
                                      ? 'border-[#BFDBFE] text-[#1D4ED8]'
                                      : 'border-[#FDE68A] text-[#B45309]'
                                  }`}
                                >
                                  {act.targetType === 'crm_followup' ? 'CRM Follow-Up' : act.priority}
                                </span>
                                <span className="text-[11px] text-[#475569] font-medium">
                                  {act.ownerRole} · {act.timeframe}
                                </span>
                              </div>
                              <p className="font-semibold text-[#0F172A]">{act.title}</p>
                            </div>

                            <button
                              type="button"
                              disabled={Boolean(act.savedToPlan)}
                              onClick={() => handleConvertSuggestedAction(msg.id, act)}
                              className={`px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                                act.savedToPlan
                                  ? 'bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0]'
                                  : 'bg-[#0F172A] hover:bg-[#1E293B] text-white'
                              }`}
                            >
                              {act.savedToPlan ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Saved</span>
                                </>
                              ) : act.targetType === 'crm_followup' ? (
                                <>
                                  <Users className="w-3.5 h-3.5 text-[#60A5FA]" />
                                  <span>Add CRM Follow-Up</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5 text-[#60A5FA]" />
                                  <span>Add to Action Plan</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Save Insight button for any substantive coach reply */}
                  {isCoach && !isInitialGreeting && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={Boolean(savedMessageIds[msg.id])}
                        onClick={() => handleSaveReplyAsAction(msg)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#475569] hover:text-[#0F172A] disabled:text-[#15803D] transition"
                      >
                        {savedMessageIds[msg.id] ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Saved to Action Plan</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5 text-[#2563EB]" />
                            <span>Save Insight as Action Task</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {!isCoach && (
                  <div className="w-8 h-8 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white">
                    <UserCheck className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {messages.length <= 1 && !isLoading && (
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#475569] block">
                Starter Coaching Prompts for {profile.name}:
              </span>
              <div className="flex flex-wrap gap-2">
                {quickConversationStarters.map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(starter)}
                    className="text-left text-xs px-3 py-2 rounded bg-white hover:bg-[#EFF6FF] border border-[#0F172A]/15 hover:border-[#2563EB] text-[#0F172A] transition"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded bg-[#0F172A] flex items-center justify-center shrink-0 text-white">
                <Bot className="w-4 h-4 text-[#60A5FA]" />
              </div>
              <div className="bg-white border border-[#0F172A]/12 rounded p-4 text-xs text-[#475569] flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin" />
                <span>Reviewing {profile.name}’s business context &amp; conversation history...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Form + Inline Retry Error Banner */}
        <div className="p-4 bg-white border-t border-[#0F172A]/12 space-y-3">
          {chatError && (
            <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{chatError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lastFailedPrompt && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSendMessage(lastFailedPrompt)}
                    className="px-3 py-1 rounded bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Last Message</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setChatError(null);
                    setLastFailedPrompt(null);
                  }}
                  className="font-bold hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask ${profile.name}'s coach, challenge a recommendation, or test a growth/ROI decision...`}
              disabled={isLoading}
              className="flex-1 bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-4 py-3 text-xs sm:text-sm text-[#0F172A] placeholder-[#64748B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="px-5 py-3 rounded bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition whitespace-nowrap shrink-0"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5 text-[#60A5FA]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
