import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  UserCheck,
  Plus,
  Flame,
  Download,
  Check,
  Edit3,
  X,
  Gauge,
} from 'lucide-react';
import { PRIORITISED_TURNAROUND_PLAN } from '../data/coachingBriefing';
import { TurnaroundAction, CaseRecord } from '../types/bizpulse';
import { SevenDaySprint } from './SevenDaySprint';
import { InfoTooltip } from './InfoTooltip';
import { mergeDiagnosticsIntoActionPlan } from '../services/actionPlanEngine';

interface Roadmap90DayProps {
  caseRecord: CaseRecord;
  onUpdateActionPlan?: (updatedPlan: TurnaroundAction[]) => void;
  onToggleSprintItem?: (sprintKey: string) => void;
  onOpenKpiTracker?: () => void;
  onSwitchTab?: (tab: string) => void;
}

function normalizeHorizonBucket(horizon: string): '30' | '60' | '90' {
  if (horizon.includes('30 Days') || horizon.includes('First 7 Days') || horizon.includes('Days 1–7')) return '30';
  if (horizon.includes('60 Days') || horizon.includes('Days 8–30')) return '60';
  return '90';
}

export const Roadmap90Day: React.FC<Roadmap90DayProps> = ({
  caseRecord,
  onUpdateActionPlan,
  onToggleSprintItem,
  onOpenKpiTracker,
  onSwitchTab,
}) => {
  const isDemo = caseRecord.profile.isDemonstrationCase;
  const [subView, setSubView] = useState<'roadmap' | 'sprint'>('roadmap');
  const [selectedHorizon, setSelectedHorizon] = useState<'all' | '30' | '60' | '90'>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // New custom task state covering all 8 required fields
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskIssue, setNewTaskIssue] = useState('');
  const [newTaskRationale, setNewTaskRationale] = useState('');
  const [newTaskSuccessKpi, setNewTaskSuccessKpi] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('Business Owner');
  const [newTaskHorizon, setNewTaskHorizon] = useState<TurnaroundAction['horizon']>('30 Days (Quick Wins & Control)');
  const [newTaskPriority, setNewTaskPriority] = useState<TurnaroundAction['priority']>('Priority 1 (Urgent)');
  const [newTaskCostEffort, setNewTaskCostEffort] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Derive isolated per-case action plan using non-destructive diagnostic engine fallback
  const tasks: TurnaroundAction[] = useMemo(() => {
    if (caseRecord.actionPlan && caseRecord.actionPlan.length > 0) {
      return caseRecord.actionPlan;
    }
    if (isDemo) {
      return PRIORITISED_TURNAROUND_PLAN;
    }
    return mergeDiagnosticsIntoActionPlan(caseRecord);
  }, [caseRecord, isDemo]);

  const updateTask = (id: string, patch: Partial<TurnaroundAction>) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    onUpdateActionPlan?.(updated);
  };

  const toggleTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.completed;
    updateTask(id, { completed: nextDone, status: nextDone ? 'completed' : 'pending' });
  };

  const handleImportFromDiagnostics = () => {
    const baseRecord: CaseRecord = { ...caseRecord, actionPlan: tasks };
    const merged = mergeDiagnosticsIntoActionPlan(baseRecord);
    const addedCount = merged.length - tasks.length;

    if (addedCount <= 0) {
      setImportNotice(
        'All current Top 3 Priorities and Coaching Recommendation actions are already in your Action Plan.'
      );
    } else {
      onUpdateActionPlan?.(merged);
      setImportNotice(`Imported ${addedCount} action item(s) without overwriting existing work.`);
    }
    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const defaultTf = newTaskHorizon.includes('30 Days')
      ? 'Days 1–30'
      : newTaskHorizon.includes('60 Days')
      ? 'Days 31–60'
      : 'Days 61–90';
    const newAction: TurnaroundAction = {
      id: `task-${Date.now()}`,
      horizon: newTaskHorizon,
      priority: newTaskPriority,
      businessIssue: newTaskIssue.trim() || 'Owner-identified business priority',
      rationale:
        newTaskRationale.trim() ||
        'Protects cash flow, margin, or operational resilience.',
      action: newTaskTitle.trim(),
      accountableRole: newTaskOwner.trim() || 'Business Owner',
      timeframe: newTaskDueDate ? `${defaultTf} (Due ${newTaskDueDate})` : defaultTf,
      targetCompletionDate: newTaskDueDate || undefined,
      estimatedCostEffort: newTaskCostEffort.trim() || undefined,
      requiredInformationOrResources: ['Business records / owner oversight'],
      measurableSuccessIndicator:
        newTaskSuccessKpi.trim() || 'Action verified complete at Monday review',
      intendedImprovement:
        newTaskSuccessKpi.trim() || 'Measurable cash, margin, or operational relief',
      dependencyOrRisk: 'Avoid deferring behind daily operational fires',
      decisionStatus: 'accepted',
      status: 'pending',
      completed: false,
      sourceTag: 'Owner Added',
    };
    onUpdateActionPlan?.([...tasks, newAction]);
    setNewTaskTitle('');
    setNewTaskIssue('');
    setNewTaskRationale('');
    setNewTaskSuccessKpi('');
    setNewTaskCostEffort('');
    setNewTaskDueDate('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedHorizon !== 'all' && normalizeHorizonBucket(t.horizon) !== selectedHorizon) return false;
    if (selectedPriority !== 'all' && !t.priority.includes(selectedPriority)) return false;
    return true;
  });

  const activeTasks = tasks.filter((t) => t.decisionStatus !== 'rejected');
  const completedCount = activeTasks.filter((t) => t.completed).length;
  const progressPercent = activeTasks.length > 0 ? Math.round((completedCount / activeTasks.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sub-View Switcher (30/60/90-Day Plan vs Immediate 7-Day Sprint) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-white border border-[#0F172A]/15 rounded p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setSubView('roadmap')}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              subView === 'roadmap'
                ? 'bg-[#0F172A] text-white'
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            30 / 60 / 90-Day Execution &amp; Accountability
          </button>
          <button
            type="button"
            onClick={() => setSubView('sprint')}
            className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition ${
              subView === 'sprint'
                ? 'bg-[#2563EB] text-white'
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Next 7 Days Sprint</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenKpiTracker && (
            <button
              type="button"
              onClick={onOpenKpiTracker}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] text-xs font-semibold transition"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Measure Outcomes: KPI Tracker</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleImportFromDiagnostics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-[#EFF6FF] text-[#0F172A] border border-[#0F172A]/15 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Import Priorities &amp; Recommendations</span>
          </button>
          <span className="text-xs text-[#475569] font-medium">
            Active Business: <strong className="text-[#0F172A]">{caseRecord.profile.name}</strong>
          </span>
        </div>
      </div>

      {importNotice && (
        <div className="p-3 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs font-semibold">
          {importNotice}
        </div>
      )}

      {subView === 'sprint' ? (
        <SevenDaySprint
          caseRecord={caseRecord}
          onToggleSprintItem={onToggleSprintItem}
          onUpdateActionPlan={onUpdateActionPlan}
        />
      ) : (
        <>
          {/* Architectural Executive Navy Hero Header */}
          <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#0F172A]/15">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2.5">
                  <span className="bizpulse-label text-[#60A5FA]">
                    30 / 60 / 90-Day Accountability Engine
                  </span>
                  <span className="text-[#94A3B8] text-xs font-medium">
                    Accept · Modify · Reject · Measure Outcomes
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  30 / 60 / 90-Day Action Plan ({caseRecord.profile.name})
                </h2>
                <p className="text-sm text-[#CBD5E1] max-w-3xl leading-relaxed">
                  30 Days (Quick Wins &amp; Cash Control) &rarr; 60 Days (Systems &amp; Margin Fixes) &rarr; 90 Days (Sustainable Growth). Accept, modify, or reject actions and log actual commercial outcomes.
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded p-4 min-w-[210px] text-center shrink-0">
                <span className="text-[11px] font-mono text-[#60A5FA] uppercase tracking-wider font-bold block">
                  Completion (Active)
                </span>
                <div className="text-3xl font-bold text-white mt-1 font-mono tabular-nums">
                  {progressPercent}%
                </div>
                <div className="w-full bg-white/15 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-[#2563EB] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-[#CBD5E1] mt-1 tabular-nums">
                  {completedCount} of {activeTasks.length} actions completed
                </div>
              </div>
            </div>

            {/* Horizon & Priority Filters */}
            <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all' as const, label: 'All Horizons' },
                  { id: '30' as const, label: '30 Days (Quick Wins)' },
                  { id: '60' as const, label: '60 Days (Systems & Margin)' },
                  { id: '90' as const, label: '90 Days (Growth)' },
                ].map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHorizon(h.id)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      selectedHorizon === h.id
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-white/10 text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {['all', 'Urgent', 'High', 'Medium'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPriority(p)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      selectedPriority === p
                        ? 'bg-white text-[#0F172A]'
                        : 'bg-white/10 text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    {p === 'all' ? 'All Priorities' : p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add Custom Action Item Bar (All Key Accountability Fields) */}
          <form
            onSubmit={handleAddTask}
            className="bg-white border border-[#0F172A]/12 rounded p-4 sm:p-5 shadow-xs space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-bold uppercase tracking-wider text-[11px] text-[#0F172A]">
                Add Custom Action Item
              </span>
              <span className="text-[11px] text-[#475569]">
                Capture issue, recommended action, why it matters, owner, timeframe, and success measure.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newTaskIssue}
                onChange={(e) => setNewTaskIssue(e.target.value)}
                placeholder="1. Identified Issue / Opportunity (e.g., 60+ day debtors)"
                className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={`2. Recommended Action for ${caseRecord.profile.name}...`}
                className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
              />
              <input
                type="text"
                value={newTaskSuccessKpi}
                onChange={(e) => setNewTaskSuccessKpi(e.target.value)}
                placeholder="3. Success Measure / KPI (e.g., Recover $25k in 14 days)"
                className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                value={newTaskRationale}
                onChange={(e) => setNewTaskRationale(e.target.value)}
                placeholder="Reason for action (commercial why)..."
                className="flex-1 min-w-[200px] bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
              <input
                type="text"
                value={newTaskOwner}
                onChange={(e) => setNewTaskOwner(e.target.value)}
                placeholder="Responsible Person"
                className="w-36 bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
              <input
                type="text"
                value={newTaskCostEffort}
                onChange={(e) => setNewTaskCostEffort(e.target.value)}
                placeholder="Est. Cost / Effort"
                className="w-32 bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                title="Target completion date"
              />
              <select
                value={newTaskHorizon}
                onChange={(e) => setNewTaskHorizon(e.target.value as TurnaroundAction['horizon'])}
                className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="30 Days (Quick Wins & Control)">30 Days</option>
                <option value="60 Days (Systems & Margin Fixes)">60 Days</option>
                <option value="90 Days (Sustainable Growth)">90 Days</option>
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TurnaroundAction['priority'])}
                className="bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="Priority 1 (Urgent)">Priority 1 (Urgent)</option>
                <option value="Priority 2 (High)">Priority 2 (High)</option>
                <option value="Priority 3 (Medium)">Priority 3 (Medium)</option>
              </select>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 text-white font-semibold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Add Action</span>
              </button>
            </div>
          </form>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white border border-[#0F172A]/12 rounded p-8 sm:p-10 text-center space-y-4">
              <p className="text-sm font-bold text-[#0F172A]">
                No action items populated for {caseRecord.profile.name} yet.
              </p>
              <p className="text-xs text-[#475569] max-w-xl mx-auto leading-relaxed">
                Your 30/60/90-Day Action Plan automatically builds from your Top 3 Business Health Priorities and AI Coaching Plan, or you can import them with one click or add a custom item above.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleImportFromDiagnostics}
                  className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>Import Priorities &amp; Recommendations</span>
                </button>
                {onSwitchTab && (
                  <>
                    <button
                      type="button"
                      onClick={() => onSwitchTab('essentials')}
                      className="px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#0F172A]/15 text-xs font-semibold text-[#0F172A]"
                    >
                      1. Business Essentials &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchTab('health')}
                      className="px-3.5 py-2 rounded bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#0F172A]/15 text-xs font-semibold text-[#0F172A]"
                    >
                      2. 12-Capability Health &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchTab('recommendations')}
                      className="px-3.5 py-2 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-xs font-semibold text-[#1D4ED8]"
                    >
                      3. Generate Coaching Plan &rarr;
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => {
                const dec = task.decisionStatus || 'pending_review';
                return (
                  <div
                    key={task.id}
                    className={`p-5 sm:p-6 rounded border transition-all ${
                      dec === 'rejected'
                        ? 'bg-[#F8FAFC] border-[#CBD5E1] opacity-65'
                        : task.completed
                        ? 'bg-[#F8FAFC] border-[#A7F3D0] opacity-90'
                        : 'bg-white border-[#0F172A]/12 hover:border-[#2563EB] shadow-xs'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start space-x-3.5 flex-1 min-w-[260px]">
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          className="mt-0.5 shrink-0"
                          title="Toggle completion"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                          ) : (
                            <Circle className="w-5 h-5 text-[#94A3B8] hover:text-[#2563EB]" />
                          )}
                        </button>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0F172A] text-[#60A5FA] font-mono">
                              {task.horizon}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                task.priority.includes('Urgent')
                                  ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                  : task.priority.includes('High')
                                  ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                  : 'bg-[#F8FAFC] text-[#334155] border-[#CBD5E1]'
                              }`}
                            >
                              {task.priority}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-[#F8FAFC] text-[#0F172A] border border-[#0F172A]/15 flex items-center gap-1 font-semibold">
                              <UserCheck className="w-3 h-3 text-[#2563EB]" />
                              {task.accountableRole}
                            </span>
                            {task.sourceTag && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                Source: {task.sourceTag}
                              </span>
                            )}
                            {task.estimatedCostEffort && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-medium">
                                Effort/Cost: {task.estimatedCostEffort}
                              </span>
                            )}
                          </div>

                          {/* Editable Field 3: Recommended Action */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-0.5">
                              <span>Recommended Action</span>
                              <InfoTooltip
                                title="Recommended Action"
                                whatItMeans="The concrete, verifiable step to execute (editable if you want to refine the wording)."
                              />
                            </label>
                            <input
                              type="text"
                              value={task.action}
                              onChange={(e) => updateTask(task.id, { action: e.target.value })}
                              className={`w-full bg-transparent border border-transparent hover:border-[#0F172A]/15 focus:bg-white focus:border-[#2563EB] rounded px-2 py-1 text-sm sm:text-base font-bold focus:outline-none ${
                                task.completed || dec === 'rejected'
                                  ? 'line-through text-[#475569]'
                                  : 'text-[#0F172A]'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Accept / Modify / Reject Decision Controls */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateTask(task.id, { decisionStatus: 'accepted' })}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1 transition ${
                            dec === 'accepted'
                              ? 'bg-[#ECFDF5] text-[#15803D] border-[#15803D]'
                              : 'bg-white text-[#475569] border-[#0F172A]/15 hover:text-[#15803D]'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTask(task.id, { decisionStatus: 'modified' })}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1 transition ${
                            dec === 'modified'
                              ? 'bg-[#FFFBEB] text-[#B45309] border-[#B45309]'
                              : 'bg-white text-[#475569] border-[#0F172A]/15 hover:text-[#B45309]'
                          }`}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Modify</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTask(task.id, { decisionStatus: 'rejected' })}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1 transition ${
                            dec === 'rejected'
                              ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]'
                              : 'bg-white text-[#475569] border-[#0F172A]/15 hover:text-[#B91C1C]'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* Row 1: Priority, Identified Issue/Opportunity, Responsible Person, Horizon, Timeframe */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#0F172A]/10 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-1">
                          <span>1. Priority &amp; Horizon</span>
                          <InfoTooltip
                            title="Priority & Execution Window"
                            whatItMeans="Urgency rank and whether this belongs in Days 1–30 (quick wins), 31–60 (systems), or 61–90 (growth)."
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={task.priority}
                            onChange={(e) =>
                              updateTask(task.id, {
                                priority: e.target.value as TurnaroundAction['priority'],
                              })
                            }
                            className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2 py-1.5 text-[11px] font-semibold text-[#0F172A]"
                          >
                            <option value="Priority 1 (Urgent)">P1 Urgent</option>
                            <option value="Priority 2 (High)">P2 High</option>
                            <option value="Priority 3 (Medium)">P3 Medium</option>
                          </select>
                          <select
                            value={task.horizon}
                            onChange={(e) =>
                              updateTask(task.id, {
                                horizon: e.target.value as TurnaroundAction['horizon'],
                              })
                            }
                            className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2 py-1.5 text-[11px] font-semibold text-[#0F172A]"
                          >
                            <option value="30 Days (Quick Wins & Control)">30 Days</option>
                            <option value="60 Days (Systems & Margin Fixes)">60 Days</option>
                            <option value="90 Days (Sustainable Growth)">90 Days</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-1">
                          <span>2. Identified Issue / Opportunity</span>
                          <InfoTooltip
                            title="Identified Issue or Opportunity"
                            whatItMeans="The underlying business problem, cash leak, or commercial opportunity this action addresses."
                          />
                        </label>
                        <input
                          type="text"
                          value={task.businessIssue || ''}
                          onChange={(e) => updateTask(task.id, { businessIssue: e.target.value })}
                          placeholder="Underlying issue or opportunity..."
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-1">
                          <span>5. Suggested Timeframe</span>
                          <InfoTooltip
                            title="Suggested Timeframe"
                            whatItMeans="Target completion window or calendar deadline for accountability."
                          />
                        </label>
                        <input
                          type="text"
                          value={task.targetCompletionDate || task.timeframe || ''}
                          onChange={(e) =>
                            updateTask(task.id, {
                              timeframe: e.target.value,
                              targetCompletionDate: e.target.value,
                            })
                          }
                          placeholder="e.g., Next 7 days or YYYY-MM-DD"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-1">
                          <span>6. Responsible Person</span>
                          <InfoTooltip
                            title="Responsible Person"
                            whatItMeans="Single accountable owner responsible for seeing this action through to completion."
                            align="right"
                          />
                        </label>
                        <input
                          type="text"
                          value={task.accountableRole || ''}
                          onChange={(e) => updateTask(task.id, { accountableRole: e.target.value })}
                          placeholder="Owner / Role"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A]"
                        />
                      </div>
                    </div>

                    {/* Row 2: Reason for Action, Success Measure / KPI, Progress Status & Outcome */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-[#0F172A]/10 text-xs">
                      <div className="lg:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-1">
                          <span>4. Reason for Action (Commercial Rationale)</span>
                          <InfoTooltip
                            title="Reason for Action"
                            whatItMeans="Why doing this action now protects cash flow, lifts gross margin, or removes bottleneck risk."
                          />
                        </label>
                        <textarea
                          rows={2}
                          value={task.rationale ?? task.dependencyOrRisk ?? ''}
                          onChange={(e) => updateTask(task.id, { rationale: e.target.value })}
                          placeholder="Explain why this action matters commercially..."
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] inline-flex items-center gap-1 mb-1">
                          <span>7. Success Measure / KPI</span>
                          <InfoTooltip
                            title="Success Measure / KPI"
                            whatItMeans="Measurable result confirming the action worked (and optional KPI scoreboard link)."
                          />
                        </label>
                        <input
                          type="text"
                          value={task.measurableSuccessIndicator || ''}
                          onChange={(e) =>
                            updateTask(task.id, {
                              measurableSuccessIndicator: e.target.value,
                              intendedImprovement: e.target.value,
                            })
                          }
                          placeholder="Measurable KPI / success indicator"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A] mb-1.5"
                        />
                        <input
                          type="text"
                          value={task.metricLink || ''}
                          onChange={(e) => updateTask(task.id, { metricLink: e.target.value })}
                          placeholder="Linked KPI (e.g., Debtor Days, GM%)"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1 text-[10px] text-[#475569]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#15803D] inline-flex items-center gap-1 mb-1">
                          <span>8. Progress Status &amp; Outcome</span>
                          <InfoTooltip
                            title="Progress Status & Actual Outcome"
                            whatItMeans="Current execution stage and actual cash/margin result achieved."
                            align="right"
                          />
                        </label>
                        <select
                          value={task.status || (task.completed ? 'completed' : 'pending')}
                          onChange={(e) => {
                            const nextStatus = e.target.value as 'pending' | 'in_progress' | 'completed';
                            updateTask(task.id, {
                              status: nextStatus,
                              completed: nextStatus === 'completed',
                            });
                          }}
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A] mb-1.5"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <input
                          type="text"
                          value={task.actualResult || ''}
                          onChange={(e) => updateTask(task.id, { actualResult: e.target.value })}
                          placeholder="Record cash collected or result..."
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1 text-[10px] text-[#0F172A]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#0F172A]/10 text-xs">
                      <div className="p-3 bg-[#F8FAFC] rounded border border-[#0F172A]/10">
                        <span className="font-bold text-[#475569] uppercase tracking-wider block mb-1 text-[10px]">
                          Resources / Information Needed
                        </span>
                        <ul className="text-[#0F172A] list-disc list-inside space-y-0.5 text-[11px]">
                          {task.requiredInformationOrResources.map((res, i) => (
                            <li key={i}>{res}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-[#FEF2F2] rounded border border-[#FECACA]">
                        <span className="font-bold text-[#B91C1C] uppercase tracking-wider block mb-1 text-[10px]">
                          Dependency / Execution Risk
                        </span>
                        <p className="text-[#0F172A] leading-relaxed text-[11px]">
                          {task.dependencyOrRisk}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
