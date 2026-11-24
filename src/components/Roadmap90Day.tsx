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
} from 'lucide-react';
import { PRIORITISED_TURNAROUND_PLAN } from '../data/coachingBriefing';
import { TurnaroundAction, CaseRecord } from '../types/bizpulse';
import { SevenDaySprint } from './SevenDaySprint';

interface Roadmap90DayProps {
  caseRecord: CaseRecord;
  onUpdateActionPlan?: (updatedPlan: TurnaroundAction[]) => void;
  onToggleSprintItem?: (sprintKey: string) => void;
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
}) => {
  const isDemo = caseRecord.profile.isDemonstrationCase;
  const [subView, setSubView] = useState<'roadmap' | 'sprint'>('roadmap');
  const [selectedHorizon, setSelectedHorizon] = useState<'all' | '30' | '60' | '90'>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // New custom task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('Business Owner');
  const [newTaskHorizon, setNewTaskHorizon] = useState<TurnaroundAction['horizon']>('30 Days (Quick Wins & Control)');
  const [newTaskPriority, setNewTaskPriority] = useState<TurnaroundAction['priority']>('Priority 1 (Urgent)');
  const [newTaskCostEffort, setNewTaskCostEffort] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Derive isolated per-case action plan
  const tasks: TurnaroundAction[] = useMemo(() => {
    if (caseRecord.actionPlan && caseRecord.actionPlan.length > 0) {
      return caseRecord.actionPlan;
    }
    if (isDemo) {
      return PRIORITISED_TURNAROUND_PLAN;
    }
    if (caseRecord.recommendations?.actionItems?.length) {
      return caseRecord.recommendations.actionItems.map((item, idx) => ({
        id: item.id || `custom-act-${idx + 1}`,
        horizon:
          item.timeframe.toLowerCase().includes('48') ||
          item.timeframe.toLowerCase().includes('7') ||
          item.timeframe.toLowerCase().includes('30')
            ? '30 Days (Quick Wins & Control)'
            : item.timeframe.toLowerCase().includes('60')
            ? '60 Days (Systems & Margin Fixes)'
            : '90 Days (Sustainable Growth)',
        priority: item.priority,
        action: item.action,
        accountableRole: item.ownerRole,
        timeframe: item.timeframe,
        requiredInformationOrResources: ['Owner review & internal records'],
        measurableSuccessIndicator: item.expectedImpact,
        intendedImprovement: item.expectedImpact,
        dependencyOrRisk: 'Requires consistent weekly review cadence',
        decisionStatus: 'pending_review',
        completed: item.completed,
      }));
    }
    return [];
  }, [caseRecord.actionPlan, caseRecord.recommendations, isDemo]);

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
    const existingActions = new Set(tasks.map((t) => t.action.trim().toLowerCase()));
    const toAdd: TurnaroundAction[] = [];

    if (caseRecord.recommendations?.actionItems?.length) {
      caseRecord.recommendations.actionItems.forEach((item, idx) => {
        if (!existingActions.has(item.action.trim().toLowerCase())) {
          existingActions.add(item.action.trim().toLowerCase());
          toAdd.push({
            id: item.id || `rec-act-${Date.now()}-${idx}`,
            horizon:
              item.timeframe.toLowerCase().includes('48') ||
              item.timeframe.toLowerCase().includes('7') ||
              item.timeframe.toLowerCase().includes('30')
                ? '30 Days (Quick Wins & Control)'
                : item.timeframe.toLowerCase().includes('60')
                ? '60 Days (Systems & Margin Fixes)'
                : '90 Days (Sustainable Growth)',
            priority: item.priority,
            action: item.action,
            accountableRole: item.ownerRole,
            timeframe: item.timeframe,
            requiredInformationOrResources: ['Coaching & diagnostic baseline'],
            measurableSuccessIndicator: item.expectedImpact,
            intendedImprovement: item.expectedImpact,
            dependencyOrRisk: 'Requires weekly Monday review check-in',
            decisionStatus: 'pending_review',
            completed: Boolean(item.completed),
          });
        }
      });
    }

    if (caseRecord.overallHealth?.topThreePriorities?.length) {
      caseRecord.overallHealth.topThreePriorities.forEach((p) => {
        const title = `Address Priority #${p.rank}: ${p.title}`;
        if (!existingActions.has(title.toLowerCase())) {
          existingActions.add(title.toLowerCase());
          toAdd.push({
            id: `prio-${p.key}-${Date.now()}`,
            horizon: p.rank === 1 ? '30 Days (Quick Wins & Control)' : p.rank === 2 ? '60 Days (Systems & Margin Fixes)' : '90 Days (Sustainable Growth)',
            priority: p.rank === 1 ? 'Priority 1 (Urgent)' : 'Priority 2 (High)',
            businessIssue: p.title,
            action: title,
            accountableRole: 'Business Owner',
            timeframe: p.rank === 1 ? 'Days 1–30' : p.rank === 2 ? 'Days 31–60' : 'Days 61–90',
            requiredInformationOrResources: ['Business Health Capability notes'],
            measurableSuccessIndicator: p.recommendedFocus,
            intendedImprovement: p.recommendedFocus,
            dependencyOrRisk: p.rationale,
            decisionStatus: 'pending_review',
            completed: false,
          });
        }
      });
    }

    if (toAdd.length === 0) {
      setImportNotice('All current Top 3 Priorities and Recommendation actions are already in your plan.');
    } else {
      onUpdateActionPlan?.([...tasks, ...toAdd]);
      setImportNotice(`Imported ${toAdd.length} action item(s) without overwriting existing work.`);
    }
    setTimeout(() => setImportNotice(null), 4000);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newAction: TurnaroundAction = {
      id: `task-${Date.now()}`,
      horizon: newTaskHorizon,
      priority: newTaskPriority,
      action: newTaskTitle.trim(),
      accountableRole: newTaskOwner.trim() || 'Business Owner',
      timeframe:
        newTaskHorizon.includes('30 Days')
          ? 'Days 1–30'
          : newTaskHorizon.includes('60 Days')
          ? 'Days 31–60'
          : 'Days 61–90',
      targetCompletionDate: newTaskDueDate || undefined,
      estimatedCostEffort: newTaskCostEffort.trim() || undefined,
      requiredInformationOrResources: ['Business records / owner oversight'],
      measurableSuccessIndicator: 'Action verified complete at Monday review',
      intendedImprovement: 'Measurable cash, margin, or operational relief',
      dependencyOrRisk: 'Avoid deferring behind daily operational fires',
      decisionStatus: 'accepted',
      completed: false,
    };
    onUpdateActionPlan?.([...tasks, newAction]);
    setNewTaskTitle('');
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

          {/* Add Custom Action Item Bar */}
          <form
            onSubmit={handleAddTask}
            className="bg-white border border-[#0F172A]/12 rounded p-4 shadow-xs flex flex-wrap items-center gap-2.5 text-xs"
          >
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={`Add accountable action for ${caseRecord.profile.name}...`}
              className="flex-1 min-w-[200px] bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3.5 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
            />
            <input
              type="text"
              value={newTaskOwner}
              onChange={(e) => setNewTaskOwner(e.target.value)}
              placeholder="Owner"
              className="w-32 bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
            />
            <input
              type="text"
              value={newTaskCostEffort}
              onChange={(e) => setNewTaskCostEffort(e.target.value)}
              placeholder="Est. Cost / Effort"
              className="w-36 bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-3 py-2 text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB]"
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
              <option value="Priority 1 (Urgent)">Urgent</option>
              <option value="Priority 2 (High)">High</option>
              <option value="Priority 3 (Medium)">Medium</option>
            </select>
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="px-4 py-2 rounded bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 text-white font-semibold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Add Action</span>
            </button>
          </form>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white border border-[#0F172A]/12 rounded p-10 text-center space-y-2">
              <p className="text-sm font-bold text-[#0F172A]">
                No turnaround actions added for {caseRecord.profile.name} yet.
              </p>
              <p className="text-xs text-[#475569] max-w-md mx-auto">
                Click &ldquo;Import Priorities &amp; Recommendations&rdquo; above or add your own accountable task.
              </p>
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
                        ? 'bg-[#F8FAFC] border-[#CBD5E1] opacity-60'
                        : task.completed
                        ? 'bg-[#F8FAFC] border-[#A7F3D0] opacity-85'
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
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0F172A] text-[#60A5FA] font-mono">
                              {task.horizon}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                task.priority.includes('Urgent')
                                  ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                  : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                              }`}
                            >
                              {task.priority}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-[#F8FAFC] text-[#0F172A] border border-[#0F172A]/15 flex items-center gap-1 font-semibold">
                              <UserCheck className="w-3 h-3 text-[#2563EB]" />
                              {task.accountableRole}
                            </span>
                            {task.estimatedCostEffort && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] font-medium">
                                Effort/Cost: {task.estimatedCostEffort}
                              </span>
                            )}
                          </div>
                          <h3
                            className={`text-base font-bold mt-2 ${
                              task.completed || dec === 'rejected'
                                ? 'line-through text-[#475569]'
                                : 'text-[#0F172A]'
                            }`}
                          >
                            {task.action}
                          </h3>
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

                    {/* Editable Accountability Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#0F172A]/10 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block mb-1">
                          Execution Status
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
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A]"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block mb-1">
                          Linked Scoreboard Metric
                        </label>
                        <input
                          type="text"
                          value={task.metricLink || ''}
                          onChange={(e) => updateTask(task.id, { metricLink: e.target.value })}
                          placeholder="e.g., Aged Debtors, Cash, GM%"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block mb-1">
                          Target Date / Timeframe
                        </label>
                        <input
                          type="text"
                          value={task.targetCompletionDate || task.timeframe || ''}
                          onChange={(e) => updateTask(task.id, { targetCompletionDate: e.target.value })}
                          placeholder="YYYY-MM-DD or timeframe"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block mb-1">
                          Intended Improvement
                        </label>
                        <input
                          type="text"
                          value={task.intendedImprovement || task.measurableSuccessIndicator || ''}
                          onChange={(e) => updateTask(task.id, { intendedImprovement: e.target.value })}
                          placeholder="Expected measurable impact"
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#15803D] block mb-1">
                          Actual Result Logged
                        </label>
                        <input
                          type="text"
                          value={task.actualResult || ''}
                          onChange={(e) => updateTask(task.id, { actualResult: e.target.value })}
                          placeholder="Record cash collected, margin gained, or status..."
                          className="w-full bg-[#FCFCFC] border border-[#0F172A]/15 rounded px-2.5 py-1.5 text-[11px] text-[#0F172A]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-[#0F172A]/10 text-xs">
                      <div className="p-3 bg-[#F8FAFC] rounded border border-[#0F172A]/10">
                        <span className="font-bold text-[#475569] uppercase tracking-wider block mb-1 text-[10px]">
                          Resources Needed
                        </span>
                        <ul className="text-[#0F172A] list-disc list-inside space-y-0.5 text-[11px]">
                          {task.requiredInformationOrResources.map((res, i) => (
                            <li key={i}>{res}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-[#ECFDF5] rounded border border-[#A7F3D0]">
                        <span className="font-bold text-[#15803D] uppercase tracking-wider block mb-1 text-[10px]">
                          Success Indicator
                        </span>
                        <p className="text-[#0F172A] leading-relaxed text-[11px]">
                          {task.measurableSuccessIndicator}
                        </p>
                      </div>
                      <div className="p-3 bg-[#FEF2F2] rounded border border-[#FECACA]">
                        <span className="font-bold text-[#B91C1C] uppercase tracking-wider block mb-1 text-[10px]">
                          Dependency / Risk
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
