import React from 'react';
import type { WorkflowStage } from '../types/supplyChain';
import {
  Power,
  ShieldAlert,
  Search,
  Brain,
  FileCheck,
  CheckCircle,
  Play,
  CheckCircle2,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';

interface OutageWorkflowStepperProps {
  currentStage: WorkflowStage;
  onStageClick?: (stage: WorkflowStage) => void;
}

interface StageMeta {
  key: WorkflowStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const STAGES: StageMeta[] = [
  { key: 'idle', label: '1. Idle', icon: Power, description: 'Baseline Operational State' },
  { key: 'detected', label: '2. Detected', icon: ShieldAlert, description: 'Outage Anomaly Identified' },
  { key: 'assessing', label: '3. Assessing', icon: Search, description: 'Impact on Inventory & Lines' },
  { key: 'planning', label: '4. Planning', icon: Brain, description: 'Alternative Supplier Sourcing' },
  { key: 'awaiting_approval', label: '5. Awaiting Approval', icon: FileCheck, description: 'Review Recovery Plan' },
  { key: 'approved', label: '6. Approved', icon: CheckCircle, description: 'Authorization Confirmed' },
  { key: 'executing', label: '7. Executing', icon: Play, description: 'Dispatching Actions' },
  { key: 'completed', label: '8. Completed', icon: CheckCircle2, description: 'Supply Chain Stabilized' }
];

export const OutageWorkflowStepper: React.FC<OutageWorkflowStepperProps> = ({ currentStage }) => {
  const isFailed = currentStage === 'failed';
  const stageIndex = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="w-full p-2 rounded-xl bg-slate-900/50 border border-slate-800/70 backdrop-blur-md shadow-sm overflow-x-auto custom-scrollbar">
      <div className="flex items-center justify-between min-w-[760px] gap-1.5">
        {STAGES.map((s, idx) => {
          const Icon = s.icon;
          const isCurrent = s.key === currentStage;
          const isPassed = !isFailed && stageIndex > idx;
          const isUpcoming = !isFailed && stageIndex < idx;

          return (
            <React.Fragment key={s.key}>
              <div
                className={`flex-1 flex flex-col items-center py-2 px-1.5 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-cyan-950/60 border-cyan-400/80 text-cyan-200 shadow-[0_0_16px_rgba(0,240,255,0.2)]'
                    : isPassed
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : isUpcoming
                    ? 'bg-slate-950/25 border-slate-800/40 text-slate-500 opacity-60'
                    : 'bg-slate-950/25 border-slate-800/40 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold ${
                      isCurrent
                        ? 'bg-cyan-400 text-slate-950'
                        : isPassed
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPassed ? '✓' : idx + 1}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-cyan-300' : ''}`} />
                </div>

                <div className="text-[11px] font-mono font-semibold tracking-tight text-center whitespace-nowrap">
                  {s.label}
                </div>
                <div className="text-[9px] text-slate-400/90 font-sans text-center truncate max-w-[95px]">
                  {s.description}
                </div>
              </div>

              {idx < STAGES.length - 1 && (
                <div className="shrink-0 flex items-center text-slate-700">
                  <ArrowRight
                    className={`w-3 h-3 ${isPassed ? 'text-emerald-500/60' : isCurrent ? 'text-cyan-400/70' : 'text-slate-800'}`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}

        {isFailed && (
          <div className="flex-1 flex flex-col items-center py-2 px-1.5 rounded-lg border border-red-500/80 bg-red-950/50 text-red-300 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-[11px] font-mono font-bold text-center">Failed</div>
            <div className="text-[9px] text-red-400/80 font-sans text-center">Execution Aborted</div>
          </div>
        )}

        {currentStage === 'rejected' && (
          <div className="flex-1 flex flex-col items-center py-2 px-1.5 rounded-lg border border-amber-500/80 bg-amber-950/50 text-amber-300 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-[11px] font-mono font-bold text-center">Rejected</div>
            <div className="text-[9px] text-amber-400/80 font-sans text-center">Approval Declined</div>
          </div>
        )}
      </div>
    </div>
  );
};
