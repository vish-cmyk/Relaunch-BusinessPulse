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
} from 'lucide-react';
import { SCRIPT_PRESETS } from '../data/coachingBriefing';
import { ScriptPreset, CaseRecord, BusinessProfile, ChatMessage } from '../types/bizpulse';
import { getAuthHeaders } from '../services/firebase';

interface AICoachConsoleProps {
  caseRecord: CaseRecord;
  onUpdateCase?: (updated: CaseRecord) => void;
  onTrackUsage?: (field: 'coachMessagesCount') => void;
  initialPrompt?: string;
}

export const AICoachConsole: React.FC<AICoachConsoleProps> = ({
  caseRecord,
  onUpdateCase,
  onTrackUsage,
  initialPrompt,
}) => {
  const profile = caseRecord.profile;

  const getInitialWelcomeText = (p: BusinessProfile) => {
    if (p.isDemonstrationCase) {
      return `Kia ora Vish and Managing Partner. I am your direct, commercially minded executive business coach. I have reviewed your baseline numbers: NZ$1.28M revenue, NZ$100k operating profit, NZ$38k cash, NZ$52k overdraft drawn, and NZ$58k in >60-day overdue accounts.

Ask any tough commercial question below, challenge priorities, or use the quick communication templates to prepare overdue account notices and client outreach.`;
    }
    return `Welcome to your Executive Coaching Console for ${p.name || 'your business'}.
Context loaded: ${p.industry} (${p.country}, Currency: ${p.currency}) | Uploaded Documents: ${
      caseRecord.uploadedDocuments?.length || 0
    }.

Primary Objective: "${p.primaryObjective || 'Not entered yet'}"
Primary Concern: "${p.primaryConcern || 'Not entered yet'}"

Ask about cash flow, pricing adjustments, customer negotiations, staff workload, or document findings.`;
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
  const [selectedTopic, setSelectedTopic] = useState<string>('Cash Flow & Collections');

  const defaultRole = profile.isDemonstrationCase
    ? 'Managing Director (Vish)'
    : `Owner / Managing Director (${profile.name || 'SME'})`;
  const [userRole, setUserRole] = useState<string>(defaultRole);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);

  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<ScriptPreset | null>(null);

  useEffect(() => {
    setMessages(buildInitialMessages(caseRecord));
    setUserRole(
      caseRecord.profile.isDemonstrationCase
        ? 'Managing Director (Vish)'
        : `Owner / Managing Director (${caseRecord.profile.name || 'SME'})`
    );
    setGeneratedScript(null);
    setSelectedPreset(null);
  }, [caseRecord.id]);

  useEffect(() => {
    if (initialPrompt) {
      setInputPrompt(initialPrompt);
    }
  }, [initialPrompt]);

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

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: caseRecord.id,
          prompt: textToSend,
          topic: selectedTopic,
          userRole,
          businessProfile: caseRecord.profile,
          healthInputs: caseRecord.healthInputs,
          financials: caseRecord.financials,
          overallHealth: caseRecord.overallHealth,
          uploadedDocuments: caseRecord.uploadedDocuments || [],
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate coaching response.');
      }

      const data = await response.json();
      const coachMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        sender: 'coach',
        text: data.reply || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'coach',
        text: `Unable to reach Executive Coach: ${err.message || 'Please retry shortly.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePresetScript = async (preset: ScriptPreset) => {
    setSelectedPreset(preset);
    setIsGeneratingScript(true);
    setGeneratedScript(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/coach/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          caseId: caseRecord.id,
          scriptType: preset.title,
          businessProfile: caseRecord.profile,
          details: preset.defaultPrompt,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate communication draft.');
      }

      const data = await response.json();
      setGeneratedScript(data.script);
      onTrackUsage?.('coachMessagesCount');
    } catch (err: any) {
      console.error(err);
      setGeneratedScript(`Unable to generate draft: ${err.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptId(id);
    setTimeout(() => setCopiedScriptId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Black-to-Blue Hero Header */}
      <div className="bizpulse-hero-gradient text-white rounded-2xl p-6 sm:p-8 shadow-md border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#1D4ED8] text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Live Executive Coach
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">
                Evidence-Based SME Advisory
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Executive Coaching Console ({profile.name})
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              Grounded strictly in {profile.name} ({profile.industry}, {profile.country}) — including your 8 health scores, primary concern, and {caseRecord.uploadedDocuments?.length || 0} uploaded document{(caseRecord.uploadedDocuments?.length || 0) === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 shrink-0">
            <span className="text-xs text-[#CBD5E1] font-medium whitespace-nowrap">Role:</span>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="bg-[#0F172A] text-xs font-bold text-white border border-white/20 rounded-lg px-2.5 py-1.5 focus:outline-none max-w-[220px]"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Script Presets Bar */}
      <div className="bg-white border border-[#D9E2F0] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0B1324] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#1D4ED8]" />
            Commercial Script Drafts ({profile.country})
          </span>
          <span className="text-xs text-[#52627A]">1-Click Custom Draft</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SCRIPT_PRESETS.map((preset: ScriptPreset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleGeneratePresetScript(preset)}
              className="p-3 rounded-xl bg-[#F3F6FB] border border-[#D9E2F0] hover:border-[#1D4ED8] hover:bg-white transition text-left space-y-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-[#1D4ED8] border border-[#D9E2F0]">
                  {preset.category}
                </span>
                <Sparkles className="w-3 h-3 text-[#94A3B8] group-hover:text-[#1D4ED8] transition" />
              </div>
              <h4 className="font-bold text-[#0B1324] text-xs line-clamp-1 group-hover:text-[#1D4ED8]">
                {preset.title}
              </h4>
              <p className="text-[11px] text-[#52627A] line-clamp-2">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Generated Script Drawer */}
      {selectedPreset && (
        <div className="bg-white border border-[#1D4ED8]/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#E8EEF7]">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#1D4ED8]" />
              <div>
                <h3 className="font-bold text-[#0B1324] text-sm">
                  Draft Script: {selectedPreset.title}
                </h3>
                <p className="text-xs text-[#52627A]">
                  Calibrated for {profile.name} ({profile.country}, {profile.currency})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {generatedScript && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedScript, 'generated-script')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-xs font-bold hover:bg-[#1E40AF] transition"
                >
                  {copiedScriptId === 'generated-script' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedPreset(null)}
                className="px-2.5 py-1.5 text-xs text-[#52627A] hover:text-[#0B1324] font-semibold"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-4">
            {isGeneratingScript ? (
              <div className="py-8 text-center text-[#52627A] text-xs flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 text-[#1D4ED8] animate-spin" />
                <span>Drafting tailored communication...</span>
              </div>
            ) : (
              <div className="bg-[#F3F6FB] p-4 rounded-xl border border-[#CBD5E1] text-xs text-[#0B1324] font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {generatedScript}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Container */}
      <div className="bg-white border border-[#D9E2F0] rounded-2xl shadow-xs overflow-hidden flex flex-col h-[620px]">
        <div className="bg-[#F3F6FB] px-6 py-3 border-b border-[#D9E2F0] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#52627A] font-semibold">Topic:</span>
            <div className="flex flex-wrap gap-1">
              {[
                'Cash Flow & Collections',
                'Pricing & Margins',
                'Client Retention',
                'Team & Owner Capacity',
                'Documents & Numbers',
              ].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    selectedTopic === topic
                      ? 'bg-[#0F172A] text-white'
                      : 'text-[#52627A] hover:text-[#0B1324] hover:bg-white'
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
            className="flex items-center space-x-1 text-[#52627A] hover:text-[#0B1324] transition font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thread</span>
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#F8FAFC]">
          {messages.map((msg) => {
            const isCoach = msg.sender === 'coach';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isCoach ? 'justify-start' : 'justify-end'}`}
              >
                {isCoach && (
                  <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0 text-white">
                    <Bot className="w-4 h-4 text-[#93C5FD]" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isCoach
                      ? 'bg-white border border-[#D9E2F0] text-[#0B1324]'
                      : 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#0B1324] font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#52627A]">
                    <span className="font-bold uppercase tracking-wider">
                      {isCoach ? 'Executive Coach' : userRole}
                    </span>
                    <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>

                {!isCoach && (
                  <div className="w-8 h-8 rounded-lg bg-[#1D4ED8] flex items-center justify-center shrink-0 text-white">
                    <UserCheck className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0 text-white">
                <Bot className="w-4 h-4 text-[#93C5FD]" />
              </div>
              <div className="bg-white border border-[#D9E2F0] rounded-2xl p-4 text-xs text-[#52627A] flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-[#1D4ED8] animate-spin" />
                <span>Analyzing commercial context...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-4 bg-white border-t border-[#D9E2F0]">
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
              placeholder={`Ask about ${profile.name}'s cash flow, pricing, customer trade-offs, or uploaded documents...`}
              disabled={isLoading}
              className="flex-1 bg-[#F3F6FB] border border-[#CBD5E1] rounded-xl px-4 py-3 text-xs sm:text-sm text-[#0B1324] placeholder-[#52627A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25 focus:border-[#1D4ED8] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="px-5 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5 transition"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
