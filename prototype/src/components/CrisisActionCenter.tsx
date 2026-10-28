import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Play,
  ShieldCheck,
  Building,
  Plane,
  XCircle,
  Eye,
  Lock,
  UserCheck
} from 'lucide-react';
import type {
  OutageSimulationState,
  RecoveryActionItem
} from '../types/supplyChain';

interface CrisisActionCenterProps {
  simulationState: OutageSimulationState;
  isGeneratingPlan?: boolean;
  onStartOutage: () => void;
  onProceedToAssessing: () => void;
  onProceedToPlanning: () => void;
  onProceedToAwaitingApproval: () => void;
  onApprovePlan: () => void;
  onRejectPlan: (reason: string) => void;
  onExecutePlan: () => void;
  onResetDemo: () => void;
  onTriggerFailDemo: () => void;
  onOpenFullModal: () => void;
}

export const CrisisActionCenter: React.FC<CrisisActionCenterProps> = ({
  simulationState,
  isGeneratingPlan = false,
  onStartOutage,
  onProceedToAssessing,
  onProceedToPlanning,
  onProceedToAwaitingApproval,
  onApprovePlan,
  onRejectPlan,
  onExecutePlan,
  onResetDemo,
  onTriggerFailDemo,
  onOpenFullModal
}) => {
  const {
    stage,
    detectionSeverity,
    proposedPlan,
    errorMessage,
    rejectionReason,
    currentExecutingActionIndex = 0
  } = simulationState;

  const [showApprovalPrompt, setShowApprovalPrompt] = useState<boolean>(false);
  const [showRejectPrompt, setShowRejectPrompt] = useState<boolean>(false);
  const [showExecutionPrompt, setShowExecutionPrompt] = useState<boolean>(false);
  const [rejectReasonText, setRejectReasonText] = useState<string>('Exceeds budget allowance; renegotiate air charter fee.');
  const [selectedActionItem, setSelectedActionItem] = useState<RecoveryActionItem | null>(null);

  const isApproved = stage === 'approved';
  const isExecuting = stage === 'executing';
  const isCompleted = stage === 'completed';
  const isRejected = stage === 'rejected';

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
          <h3 className="font-mono font-bold tracking-wider text-cyan-300 uppercase text-[11px]">
            OUTAGE CRISIS WORKFLOW
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-[9px] text-amber-300 font-semibold">
            SAFE GATE
          </span>
          <button
            onClick={onResetDemo}
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
            title="Reset to Baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 custom-scrollbar">
        {/* Current State Indicator */}
        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-850 flex items-center justify-between">
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wide">ACTIVE STAGE</div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRejected
                    ? 'bg-amber-400'
                    : stage === 'failed'
                    ? 'bg-red-500'
                    : isCompleted
                    ? 'bg-emerald-400'
                    : 'bg-cyan-400'
                }`}
              />
              <span className="capitalize">{stage.replace('_', ' ')}</span>
            </div>
          </div>
          <button
            onClick={onOpenFullModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-[11px] text-cyan-300 hover:text-white border border-slate-750 transition-all"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workflow Modal</span>
          </button>
        </div>

        {/* Dynamic Stage Actions */}
        {stage === 'idle' && (
          <div className="p-3 rounded-lg bg-slate-950/30 border border-slate-800 text-center space-y-2.5">
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Supply chain is operating in normal baseline state. Click below to simulate a sudden Tier-1 supplier crisis at Apex Silicon Fab 4.
            </p>
            <button
              onClick={onStartOutage}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>1. Start Supplier Outage Simulation</span>
            </button>
          </div>
        )}

        {stage === 'detected' && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 space-y-2">
            <div className="flex items-center justify-between text-red-300 font-semibold text-[11px]">
              <span>CRISIS DETECTED // SEVERITY: {detectionSeverity}</span>
              <span className="text-[9px] bg-red-600/80 px-1.5 py-0.2 rounded text-white font-bold">ALARM</span>
            </div>
            <p className="text-red-200/90 text-[11px] font-sans">
              Substation blackout in Shenzhen corridor. Outbound wafers frozen. Austin factory assembly starving within 36 hours.
            </p>
            <button
              onClick={onProceedToAssessing}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md active:scale-95"
            >
              <span>2. Proceed to Assess Impact ➔</span>
            </button>
          </div>
        )}

        {stage === 'assessing' && (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-cyan-500/30 space-y-2">
            <div className="text-cyan-300 font-bold">ASSESSMENT IN PROGRESS</div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">AFFECTED LINES:</span>
                <span className="text-red-400 font-bold">Austin Line 2 (Starved)</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block">AT-RISK ORDERS:</span>
                <span className="text-amber-400 font-bold">2 Orders (2,270 Units / $2.83M)</span>
              </div>
            </div>
            <button
              onClick={onProceedToPlanning}
              disabled={isGeneratingPlan}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs shadow-md transition-all ${
                isGeneratingPlan
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95'
              }`}
            >
              <span>{isGeneratingPlan ? 'Synthesizing Multi-Constraint Plan...' : '3. Evaluate Alternative Suppliers ➔'}</span>
            </button>
          </div>
        )}

        {stage === 'planning' && (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-cyan-500/30 space-y-2">
            <div className="text-cyan-300 font-bold">ALTERNATIVE SOURCING SOURCED</div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between p-1.5 rounded bg-slate-900">
                <span className="flex items-center gap-1"><Building className="w-3 h-3 text-cyan-400" /> Tokyo Optics:</span>
                <span className="text-emerald-300 font-bold">650 units (Immediate)</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-slate-900">
                <span className="flex items-center gap-1"><Plane className="w-3 h-3 text-blue-400" /> Singapore Buffer:</span>
                <span className="text-purple-300 font-bold">12,500 units (Air Bridge)</span>
              </div>
            </div>
            <button
              onClick={onProceedToAwaitingApproval}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md active:scale-95"
            >
              <span>4. Synthesize Plan & Submit for Approval ➔</span>
            </button>
          </div>
        )}

        {/* APPROVE & REJECT CONTROLS (Requirement 2 & 4) */}
        {stage === 'awaiting_approval' && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/60 space-y-2.5">
            <div className="flex items-center justify-between text-amber-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>APPROVAL GATE: DECISION REQUIRED</span>
              </span>
              <span className="text-[10px] bg-amber-600 px-1.5 py-0.2 rounded text-slate-950 font-bold">LOCKED</span>
            </div>
            <p className="text-slate-300 text-[11px] font-sans">
              {proposedPlan ? proposedPlan.title : 'Playbook CP-01 synthesized'}. Expedite cost: <strong>{proposedPlan?.estimatedTotalCostUSD || '$10,325'}</strong>. SLA recovery: <strong>+{proposedPlan?.slaRecoveryPercentage ?? 8.4}%</strong>.
              Execution cannot proceed without human authorization.
            </p>

            {/* Decision Controls */}
            {!showApprovalPrompt && !showRejectPrompt && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectPrompt(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-red-950/80 border border-slate-700 hover:border-red-500 text-red-300 font-bold text-xs transition-all active:scale-95"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Plan</span>
                </button>
                <button
                  onClick={() => setShowApprovalPrompt(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all active:scale-95 animate-pulse"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Approve Plan</span>
                </button>
              </div>
            )}

            {/* Approval Confirmation Prompt */}
            {showApprovalPrompt && (
              <div className="p-2.5 rounded bg-slate-950 border border-emerald-400/80 space-y-2">
                <div className="text-[11px] text-emerald-300 font-bold">Confirm Plan Authorization?</div>
                <div className="text-[10px] text-slate-400 font-sans">
                  By confirming, you authorize order diversion to {proposedPlan?.selectedAltSupplier || 'Qualified Alternative Supplier'} and {proposedPlan?.selectedWarehouseBuffer || 'Regional Buffer Hub'} ({proposedPlan?.estimatedTotalCostUSD || '$10,325'}).
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowApprovalPrompt(false)}
                    className="flex-1 py-1 rounded bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowApprovalPrompt(false);
                      onApprovePlan();
                    }}
                    className="flex-1 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Confirm (Approve)
                  </button>
                </div>
              </div>
            )}

            {/* Rejection Prompt */}
            {showRejectPrompt && (
              <div className="p-2.5 rounded bg-slate-950 border border-amber-400/80 space-y-2">
                <div className="text-[11px] text-amber-300 font-bold">Confirm Rejection of Plan?</div>
                <input
                  type="text"
                  value={rejectReasonText}
                  onChange={e => setRejectReasonText(e.target.value)}
                  className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono"
                  placeholder="Enter rejection reason..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectPrompt(false)}
                    className="flex-1 py-1 rounded bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectPrompt(false);
                      onRejectPlan(rejectReasonText);
                    }}
                    className="flex-1 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
                  >
                    Confirm (Reject)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REJECTED STATE NOTIFICATION (Requirement 2 & 8) */}
        {isRejected && (
          <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/70 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <XCircle className="w-4 h-4 text-amber-400" />
              <span>PLAN REJECTED BY COMMAND DIRECTOR</span>
            </div>
            <p className="text-slate-300 text-[11px] font-sans">
              Reason: <em>{rejectionReason || 'Cost ceiling exceeded.'}</em> Execution remains strictly blocked.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onProceedToPlanning}
                disabled={isGeneratingPlan}
                className={`flex-1 py-1.5 rounded font-bold border transition-all ${
                  isGeneratingPlan
                    ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                }`}
              >
                {isGeneratingPlan ? 'Re-evaluating...' : 'Re-evaluate Sourcing'}
              </button>
              <button
                onClick={onResetDemo}
                className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                Reset Demo
              </button>
            </div>
          </div>
        )}

        {/* APPROVED STATE: REQUIRE EXPLICIT EXECUTION CONFIRMATION (Requirement 3 & 5) */}
        {isApproved && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/60 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>PLAN AUTHORIZED (APPROVAL GATE PASSED)</span>
            </div>
            <p className="text-slate-300 text-[11px] font-sans">
              All 5 actions verified and ready for simulated dispatch. Confirmation required before execution begins.
            </p>

            {!showExecutionPrompt ? (
              <button
                onClick={() => setShowExecutionPrompt(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg active:scale-95 animate-pulse"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Execute Simulated Actions</span>
              </button>
            ) : (
              <div className="p-2.5 rounded bg-slate-950 border border-cyan-400/80 space-y-2">
                <div className="text-[11px] text-cyan-300 font-bold">Confirm Simulated Dispatch?</div>
                <div className="text-[10px] text-slate-400 font-sans">
                  This will dispatch 5 simulated action steps and update the 3D topology. No external network requests will be made.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowExecutionPrompt(false)}
                    className="flex-1 py-1 rounded bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowExecutionPrompt(false);
                      onExecutePlan();
                    }}
                    className="flex-1 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                  >
                    Confirm & Dispatch
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXECUTING STATE (Requirement 6) */}
        {isExecuting && (
          <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-400/60 space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-cyan-300 font-bold">
              <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>DISPATCHING ACTION {currentExecutingActionIndex + 1} OF {proposedPlan?.detailedActions.length || 5}...</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              {proposedPlan?.detailedActions[currentExecutingActionIndex]?.title || 'Dispatching simulated purchase orders & air charter manifest...'}
            </p>
          </div>
        )}

        {/* COMPLETED STATE */}
        {isCompleted && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/70 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>OUTAGE WORKFLOW COMPLETED</span>
            </div>
            <p className="text-emerald-200 text-[11px] font-sans">
              All 5 actions executed and verified. Disrupted routes cleared. Resiliency Index raised to 86.8%. Zero real transactions performed.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onResetDemo}
                className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Reset Demo
              </button>
              <button
                onClick={onOpenFullModal}
                className="flex-1 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold"
              >
                Audit Trail
              </button>
            </div>
          </div>
        )}

        {/* FAILED STATE */}
        {stage === 'failed' && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/70 space-y-2">
            <div className="flex items-center gap-2 text-red-300 font-bold">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>WORKFLOW EXECUTION FAILED</span>
            </div>
            <p className="text-red-200 text-[11px] font-sans">
              {errorMessage || 'Simulated failure: Carrier charter slot rejected or communication timeout.'}
            </p>
            <button
              onClick={onResetDemo}
              className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              Reset Workflow
            </button>
          </div>
        )}

        {stage !== 'idle' && stage !== 'completed' && stage !== 'failed' && stage !== 'rejected' && (
          <div className="flex justify-end pt-1">
            <button
              onClick={onTriggerFailDemo}
              className="text-[10px] text-red-400/80 hover:text-red-300 flex items-center gap-1 font-mono transition-all"
            >
              <XCircle className="w-3 h-3 text-red-400" />
              <span>Simulate Carrier Failure (Test Error Branch)</span>
            </button>
          </div>
        )}

        {/* Action Inspector Quick List (Requirement 1 & 6) */}
        {proposedPlan && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span className="uppercase font-bold">Recovery Actions ({proposedPlan.detailedActions.length})</span>
              <span className="text-purple-300">{proposedPlan.estimatedTotalCostUSD} Total</span>
            </div>

            {proposedPlan.detailedActions.slice(0, 3).map(action => (
              <div
                key={action.id}
                onClick={() => setSelectedActionItem(selectedActionItem?.id === action.id ? null : action)}
                className="p-2 rounded bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all"
              >
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-white font-bold truncate max-w-[200px]">{action.sequence}. {action.title}</span>
                  <span className="text-purple-300 shrink-0">{action.costUSD}</span>
                </div>
                {selectedActionItem?.id === action.id && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-cyan-300">
                    {action.syntheticVerificationNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer notice */}
      <div className="p-2 bg-slate-950/90 border-t border-slate-800 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
        <ShieldCheck className="w-3 h-3 text-cyan-400" />
        <span>Pre-programmed deterministic demo engine. No real API charges.</span>
      </div>
    </div>
  );
};
