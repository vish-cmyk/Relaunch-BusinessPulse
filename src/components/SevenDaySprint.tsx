import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  Circle,
  Copy,
  Check,
} from 'lucide-react';
import { CaseRecord, TurnaroundAction } from '../types/bizpulse';

interface SevenDaySprintProps {
  caseRecord: CaseRecord;
  onToggleSprintItem?: (sprintKey: string) => void;
  onUpdateActionPlan?: (updatedPlan: TurnaroundAction[]) => void;
}

export const SevenDaySprint: React.FC<SevenDaySprintProps> = ({
  caseRecord,
  onToggleSprintItem,
  onUpdateActionPlan,
}) => {
  const isDemo = caseRecord.profile.isDemonstrationCase;
  const profile = caseRecord.profile;
  const currency = profile.currency || 'NZD';
  const completedActions = caseRecord.sprintCompleted || {
    'sprint-1': false,
    'sprint-2': false,
    'sprint-3': false,
  };

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const actionPlanTasks = caseRecord.actionPlan || [];
  const sprintActionItems = actionPlanTasks
    .filter(
      (t) =>
        t.decisionStatus !== 'rejected' &&
        (t.horizon.includes('30 Days') ||
          t.horizon.includes('7 Days') ||
          t.priority.includes('Urgent'))
    )
    .slice(0, 6);

  const handleTogglePlanTask = (taskId: string) => {
    if (!onUpdateActionPlan) return;
    const updated = actionPlanTasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextDone = !t.completed;
      return {
        ...t,
        completed: nextDone,
        status: (nextDone ? 'completed' : 'pending') as TurnaroundAction['status'],
      };
    });
    onUpdateActionPlan(updated);
  };

  const handleToggle = (key: string) => {
    onToggleSprintItem?.(key);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const action1Script = isDemo
    ? `Kia ora [Client Name],

I hope you are well.

I am writing regarding invoice [Invoice #] for NZ$[Amount], which is currently [Days] days overdue against our standard 20-day terms.

We value our partnership and have continued servicing your team in good faith. However, to maintain our engineer scheduling and cloud supplier commitments, our company policy requires that accounts overdue past 45 days be brought current.

Please arrange payment by [Day after tomorrow at 5:00 PM], or contact me directly today to agree on a formal payment arrangement. If we do not hear from you or receive remittance, non-emergency technical support tickets will be paused until the balance is cleared.

Thank you for your prompt attention to this matter.

Ngā mihi,
Finance & Accounts Team
${profile.name}`
    : `Hello [Client Name],

I hope you are keeping well.

I am following up regarding invoice [Invoice #] for ${currency} [Amount], which is currently [Days] days past our standard payment terms.

To keep our delivery schedule and supplier commitments running smoothly for all customers, we require overdue balances to be cleared or placed on a confirmed payment schedule by [Date at 5:00 PM].

Please let me know once payment is processed or reply directly if you would like to discuss a payment plan today.

Kind regards,
[Your Name]
${profile.name}`;

  const action2Script = isDemo
    ? `Kia ora [Client MD/CEO Name],

Vish here. I wanted to reach out directly to check in on how our team has been supporting you over the past quarter.

With IT and cybersecurity evolving so rapidly in New Zealand, I'd love to buy you a coffee or lunch next Tuesday or Thursday to review your technology roadmap for the coming 12 months.

Let me know what day works best for your schedule.

Ngā mihi,
Vish
Managing Director`
    : `Hello [Customer Decision Maker],

[Your Name] here from ${profile.name}. I wanted to check in personally on how our work has been supporting your team lately.

I'd value 20 minutes over coffee or a call next week to review your upcoming priorities and make sure our service is delivering full value for you.

Let me know what time works best next Tuesday or Thursday.

Best regards,
[Your Name]
${profile.name}`;

  const customRecImmediate =
    caseRecord.recommendations?.immediateAction ||
    `Review overdue invoices and urgent cash commitments for ${profile.name} within the next 48 hours.`;
  const customRecCore =
    caseRecord.recommendations?.initialRecommendation ||
    `Focus management attention on your single biggest risk (${profile.primaryConcern || 'cash & operational stability'}) before taking on new fixed costs.`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Executive Navy Hero Banner */}
      <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 border border-[#0F172A]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#B91C1C] text-white flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                Next 7 Days Execution Sprint
              </span>
              <span className="text-[#CBD5E1] text-xs font-medium">{profile.name}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Three Immediate Priorities for the Next 7 Days
            </h2>
            <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
              {isDemo
                ? 'Execute these three moves over the next 7 days to protect cash headroom and prevent senior technician burnout.'
                : `Focused 7-day execution checklist isolated to ${profile.name} (${profile.industry}).`}
            </p>
          </div>

          <div className="bg-white/5 border border-white/15 rounded p-4 min-w-[200px] text-center shrink-0">
            <span className="text-[11px] text-[#60A5FA] uppercase tracking-wider font-bold block">
              Sprint Progress
            </span>
            <div className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
              {Object.values(completedActions).filter(Boolean).length} / 3 Done
            </div>
            <div className="text-xs text-[#CBD5E1] mt-0.5">Saved per business</div>
          </div>
        </div>
      </div>

      {/* Synchronized Live Urgent Actions from 30/60/90-Day Action Plan */}
      {sprintActionItems.length > 0 && (
        <div className="bg-white border border-[#0F172A]/12 rounded p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#0F172A]/10">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2563EB] block">
                Live Sync with 30/60/90-Day Action Plan
              </span>
              <h3 className="text-sm font-bold text-[#0F172A]">
                Urgent &amp; 30-Day Execution Queue ({sprintActionItems.filter((t) => t.completed || t.status === 'completed').length}/{sprintActionItems.length} completed)
              </h3>
            </div>
            <span className="text-[11px] text-[#475569]">
              Changes sync automatically with your Action Plan &amp; Scoreboard
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {sprintActionItems.map((task) => {
              const isDone = Boolean(task.completed || task.status === 'completed');
              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded border flex items-start gap-2.5 transition ${
                    isDone
                      ? 'bg-[#ECFDF5]/60 border-[#A7F3D0] opacity-80'
                      : 'bg-[#F8FAFC] border-[#CBD5E1]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleTogglePlanTask(task.id)}
                    disabled={!onUpdateActionPlan}
                    className="mt-0.5 shrink-0 disabled:opacity-60"
                    title="Toggle completion in Action Plan"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#64748B] hover:text-[#2563EB]" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                        {task.priority}
                      </span>
                      <span className="text-[10px] text-[#475569] font-medium">
                        {task.accountableRole} · {task.targetCompletionDate || task.timeframe}
                      </span>
                    </div>
                    <p className={`font-semibold text-[#0F172A] ${isDone ? 'line-through text-[#475569]' : ''}`}>
                      {task.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 Sprint Cards */}
      <div className="space-y-5">
        {/* Card #1 */}
        <div
          className={`p-6 rounded border transition-all ${
            completedActions['sprint-1']
              ? 'bg-[#F8FAFC] border-[#A7F3D0] opacity-85'
              : 'bg-white border-[#0F172A]/12'
          }`}
        >
          <div className="flex items-start space-x-3.5">
            <button
              type="button"
              onClick={() => handleToggle('sprint-1')}
              className="mt-1 shrink-0"
              aria-label="Toggle Sprint Item 1"
            >
              {completedActions['sprint-1'] ? (
                <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
              ) : (
                <Circle className="w-6 h-6 text-[#64748B] hover:text-[#2563EB]" />
              )}
            </button>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] font-bold text-xs border border-[#FECACA]">
                    #1 · Day 1–3 Priority
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#F8FAFC] text-[#0F172A] font-semibold border border-[#0F172A]/15">
                    {isDemo ? 'Owners: Finance Lead + Vish' : `Owner: Managing Director (${profile.name})`}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mt-2">
                  {isDemo
                    ? 'Execute 48-Hour Collection Notices on NZ$58,000 Overdue Accounts'
                    : 'Immediate 48–72 Hour Cash & Priority Control'}
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-2 text-[#0F172A] leading-relaxed">
                  <strong>Action Summary:</strong>
                  <p className="text-[#475569]">
                    {isDemo
                      ? 'Send written 48-hour payment notices to accounts over 45 days overdue and telephone the top 3 debtors directly to agree payment dates.'
                      : customRecImmediate}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A]">
                      Ready-to-Use Overdue Account Email Template:
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(action1Script, 'action-1')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#0F172A]/15 text-[11px] font-semibold whitespace-nowrap shrink-0"
                    >
                      {copiedKey === 'action-1' ? (
                        <Check className="w-3 h-3 text-[#15803D]" />
                      ) : (
                        <Copy className="w-3 h-3 text-[#2563EB]" />
                      )}
                      <span>{copiedKey === 'action-1' ? 'Copied' : 'Copy Email'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-[#FCFCFC] rounded border border-[#0F172A]/15 text-[#0F172A] font-mono text-[11px] whitespace-pre-wrap max-h-44 overflow-y-auto">
                    {action1Script}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card #2 */}
        <div
          className={`p-6 rounded border transition-all ${
            completedActions['sprint-2']
              ? 'bg-[#F8FAFC] border-[#A7F3D0] opacity-85'
              : 'bg-white border-[#0F172A]/12'
          }`}
        >
          <div className="flex items-start space-x-3.5">
            <button
              type="button"
              onClick={() => handleToggle('sprint-2')}
              className="mt-1 shrink-0"
              aria-label="Toggle Sprint Item 2"
            >
              {completedActions['sprint-2'] ? (
                <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
              ) : (
                <Circle className="w-6 h-6 text-[#64748B] hover:text-[#2563EB]" />
              )}
            </button>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309] font-bold text-xs border border-[#FDE68A]">
                    #2 · Day 2–5 Priority
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#F8FAFC] text-[#0F172A] font-semibold border border-[#0F172A]/15">
                    {isDemo ? 'Owner: Vish' : `Owner: Account / Client Lead (${profile.name})`}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mt-2">
                  {isDemo
                    ? 'Protect Anchor Customer Relationship with Direct MD Outreach'
                    : `Proactive Executive Check-In with Top Customers (${profile.mainCustomerTypes || 'Key Accounts'})`}
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                <div className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 space-y-1.5 text-[#475569] leading-relaxed">
                  <strong className="text-[#0F172A] block">Why This Protects Margin:</strong>
                  <p>
                    {isDemo
                      ? 'Meet the flight-risk anchor client face-to-face to reinforce named engineer accountability and service responsiveness rather than offering desperate fee discounts.'
                      : 'Speaking directly with your highest-value clients surfaces delivery friction early and builds trust ahead of any pricing or scope review.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A]">Executive Check-In Message:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(action2Script, 'action-2')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#0F172A]/15 text-[11px] font-semibold whitespace-nowrap shrink-0"
                    >
                      {copiedKey === 'action-2' ? (
                        <Check className="w-3 h-3 text-[#15803D]" />
                      ) : (
                        <Copy className="w-3 h-3 text-[#2563EB]" />
                      )}
                      <span>{copiedKey === 'action-2' ? 'Copied' : 'Copy Invite'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-[#FCFCFC] rounded border border-[#0F172A]/15 text-[#0F172A] font-mono text-[11px] whitespace-pre-wrap max-h-44 overflow-y-auto">
                    {action2Script}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card #3 */}
        <div
          className={`p-6 rounded border transition-all ${
            completedActions['sprint-3']
              ? 'bg-[#F8FAFC] border-[#A7F3D0] opacity-85'
              : 'bg-white border-[#0F172A]/12'
          }`}
        >
          <div className="flex items-start space-x-3.5">
            <button
              type="button"
              onClick={() => handleToggle('sprint-3')}
              className="mt-1 shrink-0"
              aria-label="Toggle Sprint Item 3"
            >
              {completedActions['sprint-3'] ? (
                <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
              ) : (
                <Circle className="w-6 h-6 text-[#64748B] hover:text-[#2563EB]" />
              )}
            </button>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#0F172A] text-white font-bold text-xs border border-[#0F172A]">
                  #3 · Day 1–7 Priority
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#F8FAFC] text-[#0F172A] font-semibold border border-[#0F172A]/15">
                  {isDemo
                    ? 'Owners: Senior Tech + Service Desk'
                    : `Owner: Operations & Delivery (${profile.name})`}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A]">
                {isDemo
                  ? 'Install Service Desk Triage Firewall & 4-Hour Deep Work Shield'
                  : 'Stabilize Delivery Workflow & Protect Core Team Capacity'}
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] p-4 rounded border border-[#0F172A]/12">
                {isDemo
                  ? 'Route all incoming phone calls through the service desk queue so the senior technician gets uninterrupted 10:00 AM–2:00 PM project and outage resolution blocks.'
                  : customRecCore}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
