import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  UserCheck,
  Plus,
  Flame,
} from 'lucide-react';
import { PRIORITISED_TURNAROUND_PLAN } from '../data/coachingBriefing';
import { TurnaroundAction, CaseRecord } from '../types/bizpulse';
import { SevenDaySprint } from './SevenDaySprint';

interface Roadmap90DayProps {
  caseRecord: CaseRecord;
  onUpdateActionPlan?: (updatedPlan: TurnaroundAction[]) => void;
  onToggleSprintItem?: (sprintKey: string) => void;
}

export const Roadmap90Day: React.FC<Roadmap90DayProps> = ({
  caseRecord,
  onUpdateActionPlan,
  onToggleSprintItem,
}) => {
  const isDemo = caseRecord.profile.isDemonstrationCase;
  const [subView, setSubView] = useState<'roadmap' | 'sprint'>('roadmap');
  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // New custom task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('Business Owner');
  const [newTaskHorizon, setNewTaskHorizon] = useState<TurnaroundAction['horizon']>('Horizon 1 (First 7 Days)');
  const [newTaskPriority, setNewTaskPriority] = useState<TurnaroundAction['priority']>('Priority 2 (High)');

  // Derive isolated per-case action plan (never leak Vish's demo tasks into custom cases!)
  const tasks: TurnaroundAction[] = useMemo(() => {
    if (caseRecord.actionPlan && caseRecord.actionPlan.length > 0) {
      return caseRecord.actionPlan;
    }
    if (isDemo) {
      return PRIORITISED_TURNAROUND_PLAN;
    }
    // Derive from case's generated recommendations if available
    if (caseRecord.recommendations?.actionItems?.length) {
      return caseRecord.recommendations.actionItems.map((item, idx) => ({
        id: item.id || `custom-act-${idx + 1}`,
        horizon:
          item.timeframe.toLowerCase().includes('48') || item.timeframe.toLowerCase().includes('7')
            ? 'Horizon 1 (First 7 Days)'
            : item.timeframe.toLowerCase().includes('30')
            ? 'Horizon 2 (Days 8–30)'
            : 'Horizon 3 (Days 31–90)',
        priority: item.priority,
        action: item.action,
        accountableRole: item.ownerRole,
        timeframe: item.timeframe,
        requiredInformationOrResources: ['Owner review & internal records'],
        measurableSuccessIndicator: item.expectedImpact,
        dependencyOrRisk: 'Requires consistent weekly review cadence',
        completed: item.completed,
      }));
    }
    return [];
  }, [caseRecord.actionPlan, caseRecord.recommendations, isDemo]);

  const toggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    onUpdateActionPlan?.(updated);
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
        newTaskHorizon === 'Horizon 1 (First 7 Days)'
          ? 'Days 1–7'
          : newTaskHorizon === 'Horizon 2 (Days 8–30)'
          ? 'Days 8–30'
          : 'Days 31–90',
      requiredInformationOrResources: ['Business records / owner oversight'],
      measurableSuccessIndicator: 'Action verified complete at Monday review',
      dependencyOrRisk: 'Avoid deferring behind daily operational fires',
      completed: false,
    };
    onUpdateActionPlan?.([...tasks, newAction]);
    setNewTaskTitle('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedHorizon !== 'all' && !t.horizon.includes(selectedHorizon)) return false;
    if (selectedPriority !== 'all' && !t.priority.includes(selectedPriority)) return false;
    return true;
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sub-View Switcher (90-Day Plan vs Immediate 7-Day Sprint) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-white border border-[#111113]/15 rounded p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setSubView('roadmap')}
            className={`px-4 py-1.5 rounded text-xs font-bold transition ${
              subView === 'roadmap'
                ? 'bg-[#111113] text-white'
                : 'text-[#52525B] hover:text-[#111113]'
            }`}
          >
            90-Day Turnaround Plan
          </button>
          <button
            type="button"
            onClick={() => setSubView('sprint')}
            className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition ${
              subView === 'sprint'
                ? 'bg-[#D97706] text-white'
                : 'text-[#52525B] hover:text-[#111113]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Next 7 Days Sprint</span>
          </button>
        </div>

        <span className="text-xs text-[#52525B] font-medium">
          Active Business: <strong className="text-[#111113]">{caseRecord.profile.name}</strong>
        </span>
      </div>

      {subView === 'sprint' ? (
        <SevenDaySprint caseRecord={caseRecord} onToggleSprintItem={onToggleSprintItem} />
      ) : (
        <>
          {/* Architectural Charcoal Hero Header */}
          <div className="bizpulse-hero-gradient text-white rounded p-6 sm:p-8 shadow-sm border border-[#111113]/15">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2.5">
                  <span className="bizpulse-label text-[#FBBF24]">
                    Execution Roadmap
                  </span>
                  <span className="text-[#A1A1AA] text-xs font-medium">
                    Three-Horizon Turnaround Plan
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Prioritised Action Plan ({caseRecord.profile.name})
                </h2>
                <p className="text-sm text-[#D4D4D8] max-w-3xl leading-relaxed">
                  Horizon 1 (First 7 Days: Control) &rarr; Horizon 2 (Days 8–30: Fix Root Causes) &rarr; Horizon 3 (Days 31–90: Profitable Growth).
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded p-4 min-w-[210px] text-center shrink-0">
                <span className="text-[11px] font-mono text-[#FBBF24] uppercase tracking-wider font-bold block">
                  Completion
                </span>
                <div className="text-3xl font-bold text-white mt-1 font-mono tabular-nums">
                  {progressPercent}%
                </div>
                <div className="w-full bg-white/15 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-[#D97706] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-[#D4D4D8] mt-1 tabular-nums">
                  {completedCount} of {tasks.length} actions completed
                </div>
              </div>
            </div>

            {/* Horizon & Priority Filters */}
            <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Horizons' },
                  { id: 'First 7 Days', label: 'First 7 Days' },
                  { id: 'Days 8–30', label: 'Days 8–30' },
                  { id: 'Days 31–90', label: 'Days 31–90' },
                ].map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHorizon(h.id)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      selectedHorizon === h.id
                        ? 'bg-[#D97706] text-white'
                        : 'bg-white/10 text-[#D4D4D8] hover:text-white'
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
                        ? 'bg-white text-[#111113]'
                        : 'bg-white/10 text-[#D4D4D8] hover:text-white'
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
            className="bg-white border border-[#111113]/12 rounded p-4 shadow-xs flex flex-wrap items-center gap-2.5 text-xs"
          >
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={`Add custom action item for ${caseRecord.profile.name}...`}
              className="flex-1 min-w-[220px] bg-[#FCFCFC] border border-[#111113]/15 rounded px-3.5 py-2 text-[#111113] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D97706] focus:border-[#D97706]"
            />
            <input
              type="text"
              value={newTaskOwner}
              onChange={(e) => setNewTaskOwner(e.target.value)}
              placeholder="Accountable Role"
              className="w-40 bg-[#FCFCFC] border border-[#111113]/15 rounded px-3 py-2 text-[#111113] focus:bg-white focus:outline-none focus:border-[#D97706]"
            />
            <select
              value={newTaskHorizon}
              onChange={(e) => setNewTaskHorizon(e.target.value as TurnaroundAction['horizon'])}
              className="bg-[#FCFCFC] border border-[#111113]/15 rounded px-3 py-2 text-[#111113] focus:outline-none focus:border-[#D97706]"
            >
              <option value="Horizon 1 (First 7 Days)">First 7 Days</option>
              <option value="Horizon 2 (Days 8–30)">Days 8–30</option>
              <option value="Horizon 3 (Days 31–90)">Days 31–90</option>
            </select>
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as TurnaroundAction['priority'])}
              className="bg-[#FCFCFC] border border-[#111113]/15 rounded px-3 py-2 text-[#111113] focus:outline-none focus:border-[#D97706]"
            >
              <option value="Priority 1 (Urgent)">Urgent</option>
              <option value="Priority 2 (High)">High</option>
              <option value="Priority 3 (Medium)">Medium</option>
            </select>
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="px-4 py-2 rounded bg-[#111113] hover:bg-[#27272A] disabled:opacity-50 text-white font-semibold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Add Action</span>
            </button>
          </form>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white border border-[#111113]/12 rounded p-10 text-center space-y-2">
              <p className="text-sm font-bold text-[#111113]">
                No turnaround actions added for {caseRecord.profile.name} yet.
              </p>
              <p className="text-xs text-[#52525B] max-w-md mx-auto">
                Run Coaching &amp; Actions (Step 4) to populate prioritized actions automatically, or add your own task above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-5 sm:p-6 rounded border transition-all ${
                    task.completed
                      ? 'bg-[#F8F7F4] border-[#A7F3D0] opacity-80'
                      : 'bg-white border-[#111113]/12 hover:border-[#D97706] shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-3.5">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className="mt-0.5 shrink-0"
                        title="Toggle completion"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#A1A1AA] hover:text-[#D97706]" />
                        )}
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#111113] text-[#FBBF24] font-mono">
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
                          <span className="text-[11px] px-2 py-0.5 rounded bg-[#F8F7F4] text-[#111113] border border-[#111113]/15 flex items-center gap-1 font-semibold">
                            <UserCheck className="w-3 h-3 text-[#D97706]" />
                            {task.accountableRole}
                          </span>
                        </div>
                        <h3
                          className={`text-base font-bold mt-2 ${
                            task.completed ? 'line-through text-[#52525B]' : 'text-[#111113]'
                          }`}
                        >
                          {task.action}
                        </h3>
                      </div>
                    </div>

                    <div className="text-xs text-[#52525B] font-mono whitespace-nowrap shrink-0">
                      {task.timeframe}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#111113]/10 text-xs">
                    <div className="p-3 bg-[#F8F7F4] rounded border border-[#111113]/10">
                      <span className="font-bold text-[#52525B] uppercase tracking-wider block mb-1 text-[10px]">
                        Resources Needed
                      </span>
                      <ul className="text-[#111113] list-disc list-inside space-y-0.5 text-[11px]">
                        {task.requiredInformationOrResources.map((res, i) => (
                          <li key={i}>{res}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-[#ECFDF5] rounded border border-[#A7F3D0]">
                      <span className="font-bold text-[#15803D] uppercase tracking-wider block mb-1 text-[10px]">
                        Success Indicator
                      </span>
                      <p className="text-[#111113] leading-relaxed text-[11px]">
                        {task.measurableSuccessIndicator}
                      </p>
                    </div>
                    <div className="p-3 bg-[#FEF2F2] rounded border border-[#FECACA]">
                      <span className="font-bold text-[#B91C1C] uppercase tracking-wider block mb-1 text-[10px]">
                        Dependency / Risk
                      </span>
                      <p className="text-[#111113] leading-relaxed text-[11px]">
                        {task.dependencyOrRisk}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
