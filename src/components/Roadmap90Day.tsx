import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  Filter,
  Check,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { PRIORITISED_TURNAROUND_PLAN } from '../data/coachingBriefing';
import { TurnaroundAction, CaseRecord } from '../types/bizpulse';

interface Roadmap90DayProps {
  caseRecord?: CaseRecord;
}

export const Roadmap90Day: React.FC<Roadmap90DayProps> = ({ caseRecord }) => {
  const [tasks, setTasks] = useState<TurnaroundAction[]>(PRIORITISED_TURNAROUND_PLAN);
  const [selectedHorizon, setSelectedHorizon] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const filteredTasks = tasks.filter(t => {
    if (selectedHorizon !== 'all' && !t.horizon.includes(selectedHorizon)) return false;
    if (selectedPriority !== 'all' && !t.priority.includes(selectedPriority)) return false;
    return true;
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner Context */}
      <div className="bg-white border border-[#E5EBEF] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                Section 6 Execution Framework
              </span>
              <span className="text-[#64748B] text-xs font-medium">Structured Turnaround Plan</span>
            </div>
            <h2 className="text-2xl font-bold text-[#14283F] tracking-tight">
              Prioritised Turnaround Plan across Three Horizons
            </h2>
            <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
              Horizon 1 (First 7 Days: Establish Control) → Horizon 2 (Days 8–30: Correct Causes) → Horizon 3 (Days 31–90: Build Sustainable Growth). Each action defines an accountable role, required resources, success KPI, and key dependency.
            </p>
          </div>

          {/* Progress Gauge */}
          <div className="bg-[#F8FAFC] border border-[#E5EBEF] rounded-xl p-4 min-w-[220px] text-center shadow-sm">
            <span className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Turnaround Milestones</span>
            <div className="text-3xl font-extrabold text-[#2563EB] mt-1 font-mono">
              {progressPercent}%
            </div>
            <div className="w-full bg-[#E2E8F0] rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className="bg-[#2563EB] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              {completedCount} of {tasks.length} actions completed
            </div>
          </div>
        </div>

        {/* Horizon & Priority Filters */}
        <div className="mt-6 pt-5 border-t border-[#E5EBEF] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Horizon:</span>
            <button
              onClick={() => setSelectedHorizon('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                selectedHorizon === 'all' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1]'
              }`}
            >
              All Horizons
            </button>
            <button
              onClick={() => setSelectedHorizon('First 7 Days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                selectedHorizon === 'First 7 Days' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1]'
              }`}
            >
              Horizon 1 (First 7 Days)
            </button>
            <button
              onClick={() => setSelectedHorizon('Days 8–30')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                selectedHorizon === 'Days 8–30' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1]'
              }`}
            >
              Horizon 2 (Days 8–30)
            </button>
            <button
              onClick={() => setSelectedHorizon('Days 31–90')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                selectedHorizon === 'Days 31–90' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#14283F] border border-[#CBD5E1]'
              }`}
            >
              Horizon 3 (Days 31–90)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Priority:</span>
            {['all', 'Urgent', 'High', 'Medium'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPriority(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedPriority === p ? 'bg-[#14283F] text-white' : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                }`}
              >
                {p === 'all' ? 'All Priorities' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task Cards */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`p-6 rounded-2xl border transition-all ${
              task.completed
                ? 'bg-[#F8FAFC] border-emerald-300 opacity-80 shadow-none'
                : 'bg-white border-[#E5EBEF] hover:border-[#CBD5E1] shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <button
                  onClick={() => toggleTask(task.id)}
                  className="mt-0.5 text-[#64748B] hover:text-[#2563EB] transition"
                  title="Toggle action status"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-[#CBD5E1] hover:text-[#2563EB]" />
                  )}
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F1F5F9] text-[#14283F] font-mono border border-[#CBD5E1]">
                      {task.horizon}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      task.priority.includes('Urgent') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#EAF1FF] text-[#2563EB] border border-[#2563EB]/30 flex items-center gap-1 font-medium">
                      <UserCheck className="w-3 h-3" />
                      {task.accountableRole}
                    </span>
                  </div>
                  <h3 className={`text-base font-bold mt-2 ${task.completed ? 'line-through text-[#64748B]' : 'text-[#14283F]'}`}>
                    {task.action}
                  </h3>
                </div>
              </div>

              <div className="text-xs text-[#64748B] font-mono whitespace-nowrap">
                Timeframe: <span className="text-[#14283F] font-medium">{task.timeframe}</span>
              </div>
            </div>

            {/* Structured 3-Part Operational Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#E5EBEF] text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EBEF]">
                <span className="font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                  1. Required Information / Resources
                </span>
                <ul className="text-[#14283F] list-disc list-inside space-y-0.5 text-[11px]">
                  {task.requiredInformationOrResources.map((res, i) => (
                    <li key={i}>{res}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EBEF]">
                <span className="font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  2. Measurable Success Indicator
                </span>
                <p className="text-emerald-900 leading-relaxed text-[11px]">
                  {task.measurableSuccessIndicator}
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EBEF]">
                <span className="font-bold text-rose-800 uppercase tracking-wider block mb-1">
                  3. Key Dependency / Risk
                </span>
                <p className="text-rose-900 leading-relaxed text-[11px]">
                  {task.dependencyOrRisk}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
