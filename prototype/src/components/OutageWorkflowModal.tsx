import React, { useState } from 'react';
import type {
  OutageSimulationState,
  RecoveryActionItem,
  AlternativeSupplierOption,
  WarehouseStockOption
} from '../types/supplyChain';
import {
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Clock,
  Info,
  Building,
  Plane,
  XCircle,
  FileText,
  ShieldCheck,
  History,
  Lock,
  UserCheck,
  CloudSun,
  Cpu
} from 'lucide-react';
import { MultiAgentCrisisWorkspace } from './MultiAgentCrisisWorkspace';

interface OutageWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const OutageWorkflowModal: React.FC<OutageWorkflowModalProps> = ({
  isOpen,
  onClose,
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
  onTriggerFailDemo
}) => {
  const [selectedActionDetail, setSelectedActionDetail] = useState<RecoveryActionItem | null>(null);
  const [selectedAltSupplier, setSelectedAltSupplier] = useState<AlternativeSupplierOption | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseStockOption | null>(null);

  // Safe Approval & Confirmation Dialog States
  const [showApprovalConfirm, setShowApprovalConfirm] = useState<boolean>(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState<boolean>(false);
  const [showExecutionConfirm, setShowExecutionConfirm] = useState<boolean>(false);
  const [rejectionInput, setRejectionInput] = useState<string>('Cost exceeds discretionary threshold ($142k). Require secondary vendor bidding.');

  const [activeTab, setActiveTab] = useState<'workspace' | 'overview' | 'affected' | 'alternatives' | 'actions' | 'audit'>('workspace');

  if (!isOpen) return null;

  const {
    stage,
    detectionSeverity,
    affectedInventory,
    affectedProduction,
    affectedOrders,
    alternativeSuppliers,
    warehouseStockOptions,
    proposedPlan,
    currentExecutingActionIndex = 0,
    rejectionReason,
    errorMessage,
    auditTrail
  } = simulationState;

  // Strict Policy Check: Is execution legally allowed right now?
  const isApproved = stage === 'approved';
  const isExecuting = stage === 'executing';
  const isCompleted = stage === 'completed';
  const isRejected = stage === 'rejected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-950/70 border border-red-500/50 shadow-sm">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-mono font-bold tracking-wide text-cyan-300 uppercase">
                  SUPPLIER OUTAGE CRISIS WORKFLOW
                </h2>
                <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/40 text-[10px] font-mono font-medium text-cyan-300">
                  SAFE APPROVAL GATE
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/30 text-[9px] font-mono text-amber-300/90 hidden sm:inline-block">
                  SIMULATION ONLY
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="text-amber-400 font-semibold">[SYNTHETIC SCENARIO]:</span>
                <span>Deterministic evaluation telemetry. Zero real transactions.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onResetDemo}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-all active:scale-95"
              title="Reset Demo to Baseline"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset</span>
            </button>
            <button
              id="modal-close-btn"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-mono transition-all border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>

        {/* Sub-Header Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-4 pt-1.5 gap-1.5 text-xs font-mono overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`py-2 px-3 border-b-2 font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'workspace'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>0. Multi-Agent Workspace (Sections A-F)</span>
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3 border-b-2 font-semibold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Crisis Overview & Gates
          </button>
          <button
            onClick={() => setActiveTab('affected')}
            disabled={stage === 'idle'}
            className={`py-2 px-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              activeTab === 'affected'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : stage === 'idle'
                ? 'border-transparent text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Affected Assets ({affectedProduction.length + affectedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('alternatives')}
            disabled={stage === 'idle' || stage === 'detected'}
            className={`py-2 px-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              activeTab === 'alternatives'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : stage === 'idle' || stage === 'detected'
                ? 'border-transparent text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Sourcing Options ({alternativeSuppliers.length + warehouseStockOptions.length})
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            disabled={!proposedPlan}
            className={`py-2 px-3 border-b-2 font-bold transition-all whitespace-nowrap ${
              activeTab === 'actions'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : !proposedPlan
                ? 'border-transparent text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Recovery Actions ({proposedPlan?.detailedActions.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-3 border-b-2 font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>5. Audit Timeline ({auditTrail.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1 font-mono">
          {/* TAB 0: UNIFIED MULTI-AGENT CRISIS WORKSPACE (SECTIONS A-F) */}
          {activeTab === 'workspace' && (
            <MultiAgentCrisisWorkspace
              simulationState={simulationState}
              isGeneratingPlan={isGeneratingPlan}
              onStartOutage={onStartOutage}
              onProceedToAssessing={onProceedToAssessing}
              onProceedToPlanning={onProceedToPlanning}
              onProceedToAwaitingApproval={onProceedToAwaitingApproval}
              onApprovePlan={onApprovePlan}
              onRejectPlan={onRejectPlan}
              onExecutePlan={onExecutePlan}
              onResetDemo={onResetDemo}
              onTriggerFailDemo={onTriggerFailDemo}
            />
          )}

          {/* TAB 1: OVERVIEW & APPROVAL CONTROLS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Stage Banner */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">WORKFLOW GATE & STATUS</div>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        stage === 'rejected'
                          ? 'bg-amber-400'
                          : stage === 'failed'
                          ? 'bg-red-500'
                          : stage === 'completed'
                          ? 'bg-emerald-400'
                          : 'bg-cyan-400 animate-ping'
                      }`}
                    />
                    <span className="capitalize">{stage.replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 max-w-xl">
                    {stage === 'idle' && 'Baseline operational state. Ready to initiate outage scenario.'}
                    {stage === 'detected' && 'Critical outage detected at Apex Silicon Fab 4 (Shenzhen). Severe disruption alert broadcast.'}
                    {stage === 'assessing' && 'Assessing impact on downstream production lines, component runway, and high-priority customer orders.'}
                    {stage === 'planning' && 'Evaluating alternative pre-qualified suppliers (Tokyo Precision Optics, Dresden Fab) and buffer depots.'}
                    {stage === 'awaiting_approval' && 'Proposed plan requires explicit Command Center approval. Execution is policy-locked.'}
                    {stage === 'approved' && 'Plan authorized. Approval gate passed. Ready for simulated execution.'}
                    {stage === 'rejected' && `Plan rejected by Director: ${rejectionReason || 'Declined'}. Execution remains strictly blocked.`}
                    {stage === 'executing' && 'Executing simulated dispatch of purchase orders, charter flights, line throttle and customer notices.'}
                    {stage === 'completed' && 'Workflow successfully executed. Supply chain stabilized with zero real-world transactions.'}
                    {stage === 'failed' && `Execution halted: ${errorMessage || 'Simulation aborted.'}`}
                  </div>
                </div>

                {/* Progressive Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {stage === 'idle' && (
                    <button
                      onClick={onStartOutage}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all active:scale-95 animate-pulse"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Outage Simulation</span>
                    </button>
                  )}

                  {stage === 'detected' && (
                    <button
                      onClick={onProceedToAssessing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all active:scale-95"
                    >
                      <span>Assess Affected Assets ➔</span>
                    </button>
                  )}

                  {stage === 'assessing' && (
                    <button
                      onClick={onProceedToPlanning}
                      disabled={isGeneratingPlan}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all ${
                        isGeneratingPlan
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(0,240,255,0.3)] active:scale-95'
                      }`}
                    >
                      <span>{isGeneratingPlan ? 'Synthesizing Plan...' : 'Source Alternatives ➔'}</span>
                    </button>
                  )}

                  {stage === 'planning' && (
                    <button
                      onClick={onProceedToAwaitingApproval}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95"
                    >
                      <span>Present for Approval ➔</span>
                    </button>
                  )}

                  {/* APPROVE & REJECT CONTROLS (Requirement 2 & 4) */}
                  {stage === 'awaiting_approval' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRejectConfirm(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950/80 border border-slate-700 hover:border-red-500 text-xs font-bold text-red-300 transition-all active:scale-95"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject Plan</span>
                      </button>

                      <button
                        onClick={() => setShowApprovalConfirm(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95 animate-pulse"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Approve Plan</span>
                      </button>
                    </div>
                  )}

                  {/* REJECTED STATE CONTROLS */}
                  {stage === 'rejected' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onProceedToPlanning}
                        disabled={isGeneratingPlan}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                          isGeneratingPlan
                            ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                        }`}
                      >
                        <span>{isGeneratingPlan ? 'Re-planning...' : 'Re-plan Sourcing Options'}</span>
                      </button>
                      <button
                        onClick={onResetDemo}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                      >
                        Reset Demo
                      </button>
                    </div>
                  )}

                  {/* APPROVED STATE: CONFIRM SIMULATED EXECUTION (Requirement 3 & 5) */}
                  {isApproved && (
                    <button
                      onClick={() => setShowExecutionConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-xs font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all active:scale-95 animate-pulse"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Execute Simulated Actions</span>
                    </button>
                  )}

                  {isCompleted && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>All Actions Verified</span>
                      </span>
                      <button
                        onClick={onResetDemo}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                      >
                        Reset Demo
                      </button>
                    </div>
                  )}

                  {stage !== 'idle' && stage !== 'completed' && stage !== 'failed' && stage !== 'rejected' && (
                    <button
                      onClick={onTriggerFailDemo}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-bold transition-all"
                      title="Simulate Workflow Failure Branch"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Simulate Fail</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SECURITY / POLICY APPROVAL GATE CALLOUT (Requirement 4 & 5) */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                  isApproved
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : isRejected
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="p-2 rounded bg-slate-950 shrink-0">
                  {isApproved ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : isRejected ? (
                    <XCircle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Lock className="w-5 h-5 text-cyan-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>SECURITY & COMPLIANCE APPROVAL POLICY</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      GATE ENFORCED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-relaxed">
                    Execution of supply chain reroutes requires explicit sign-off from Command Operations.
                    Autonomous agents or direct execution calls <strong className="text-white">cannot bypass this approval gate</strong>.
                    Simulations remain strictly sandboxed with zero real-world transactions.
                  </p>
                  {isRejected && (
                    <div className="mt-2 p-2 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 text-[11px]">
                      <strong>REJECTION REASON RECORDED:</strong> {rejectionReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Proposed Plan Overview (Requirement 1) */}
              {proposedPlan && (
                <div className="p-4 rounded-xl bg-cyan-950/25 border border-cyan-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>{proposedPlan.title}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/50">
                      SYNTHETIC CONFIDENCE: {proposedPlan.syntheticConfidenceScore}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">ESTIMATED EXPEDITE</div>
                      <div className="text-base font-bold text-purple-300">{proposedPlan.estimatedTotalCostUSD}</div>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">DELIVERY RECOVERY</div>
                      <div className="text-base font-bold text-blue-300">-{proposedPlan.deliveryTimeRecoveryHours} Hours</div>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SLA RESTORATION</div>
                      <div className="text-base font-bold text-emerald-300">+{proposedPlan.slaRecoveryPercentage}%</div>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">ACTION SEQUENCE</div>
                      <div className="text-base font-bold text-cyan-300">{proposedPlan.detailedActions.length} Actions</div>
                    </div>
                  </div>

                  {/* Multi-Agent Sourcing & Buffer Resolution Callout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Selected Alt Supplier (Agent 3):</span>
                      <span className="font-bold text-emerald-300 truncate max-w-[220px]">{proposedPlan.selectedAltSupplier || 'Not available'}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Selected Depot / Carrier (Agent 4 & 5):</span>
                      <span className="font-bold text-cyan-300 truncate max-w-[220px]">{proposedPlan.selectedWarehouseBuffer || 'Not available'}</span>
                    </div>
                  </div>

                  {/* Meteorological Intelligence & Weather Risk Banner (Requirements 3, 6, 7) */}
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CloudSun className="w-4 h-4 text-amber-300" />
                        <span className="text-xs font-bold text-slate-200">METEOROLOGICAL TRANSIT RISK</span>
                        {proposedPlan.weatherDataSource === 'openweather_forecast' ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[9px] font-mono font-bold">
                            FORECAST-BASED (5-DAY WINDOW)
                          </span>
                        ) : proposedPlan.weatherDataSource === 'openweather_observed' ? (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/50 text-[9px] font-mono font-bold">
                            OBSERVED TELEMETRY
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-mono font-medium">
                            DETERMINISTIC TMS BASELINE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">CORRIDOR RISK SCORE:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            (proposedPlan.weatherRiskScore || 0) > 60
                              ? 'bg-red-950 text-red-300 border border-red-500/60'
                              : (proposedPlan.weatherRiskScore || 0) > 30
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/60'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                          }`}
                        >
                          {proposedPlan.weatherRiskScore !== undefined ? `${proposedPlan.weatherRiskScore.toFixed(0)}/100` : '15/100'} ({proposedPlan.weatherRiskLevel?.toUpperCase() || 'LOW'})
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                      {proposedPlan.weatherExplanation || 'Transit corridor weather verified nominal. Zero adverse meteorological delays anticipated.'}
                    </p>

                    {/* Evaluated Transport Options Comparison */}
                    {proposedPlan.evaluatedTransportOptions && proposedPlan.evaluatedTransportOptions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          ALTERNATIVE TRANSPORT OPTIONS COMPARISON (COST // LEAD TIME // WEATHER RISK):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {proposedPlan.evaluatedTransportOptions.map(opt => (
                            <div
                              key={opt.optionId}
                              className={`p-2 rounded border text-[11px] font-mono ${
                                opt.isRecommended
                                  ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                                  : opt.isFeasible
                                  ? 'bg-slate-900/60 border-slate-800'
                                  : 'bg-red-950/20 border-red-500/40 opacity-75'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-white truncate">{opt.carrierName}</span>
                                {opt.isRecommended && (
                                  <span className="px-1 py-0.2 rounded bg-cyan-500 text-slate-950 text-[9px] font-bold">
                                    SELECTED
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mb-1">{opt.transportMode}</div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Cost:</span>
                                <span className="text-purple-300 font-bold">{opt.freightCostUSD}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Transit:</span>
                                <span className="text-blue-300 font-bold">{opt.transitDays} Days</span>
                              </div>
                              <div className="flex justify-between text-[10px] pt-1 mt-1 border-t border-slate-800/80">
                                <span className="text-slate-400">Weather Risk:</span>
                                <span
                                  className={`font-bold ${
                                    opt.weatherRiskLevel === 'severe'
                                      ? 'text-red-400'
                                      : opt.weatherRiskLevel === 'moderate'
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {opt.weatherRiskScore.toFixed(0)}/100 ({opt.weatherRiskLevel.toUpperCase()})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary of Action Steps */}
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Planned Actions Preview:</div>
                    {proposedPlan.detailedActions.map(action => (
                      <div
                        key={action.id}
                        className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80 text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              action.executionStatus === 'verified'
                                ? 'bg-emerald-500 text-slate-950'
                                : action.executionStatus === 'in_progress'
                                ? 'bg-cyan-500 text-slate-950 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {action.executionStatus === 'verified' ? '✓' : action.sequence}
                          </span>
                          <span className="text-white font-bold">{action.title}</span>
                          <span className="text-[10px] text-slate-400 font-normal">[{action.department}]</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-purple-300">{action.costUSD}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              action.executionStatus === 'verified'
                                ? 'bg-emerald-950 text-emerald-300'
                                : action.executionStatus === 'in_progress'
                                ? 'bg-cyan-950 text-cyan-300 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {action.executionStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Crisis Card */}
              {detectionSeverity !== 'NONE' && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                      <h3 className="text-sm font-bold text-red-300">
                        ACTIVE CRISIS: APEX SILICON FAB 4 SUBSTATION FIRE & EMBARGO
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] animate-pulse">
                      SEVERITY: {detectionSeverity}
                    </span>
                  </div>
                  <p className="text-xs text-red-200 leading-relaxed font-sans">
                    Apex Silicon Fab 4 (Shenzhen) offline. Inbound supply to Austin Giga Factory completely frozen.
                    Runway: 36 hours. Sourcing contingency required.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AFFECTED INVENTORY & PRODUCTION */}
          {activeTab === 'affected' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-cyan-400" />
                  <span>AFFECTED INVENTORY & COMPONENT RUNWAYS</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {affectedInventory.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-red-500/30">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-white">{item.sku}</span>
                        <span className="text-[10px] text-red-400 font-bold bg-red-950 px-1.5 py-0.2 rounded animate-pulse">
                          {item.hoursOfRunwayLeft}h Runway Left
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mb-2">{item.description}</div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800">
                        <span className="text-slate-400">On Hand:</span>
                        <span className="text-white font-bold">{item.onHandUnits.toLocaleString()} units</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Daily Burn:</span>
                        <span className="text-amber-400">{item.dailyBurnRate} units/day</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>AFFECTED FACTORY PRODUCTION LINES</span>
                </h3>
                <div className="space-y-2">
                  {affectedProduction.map(line => (
                    <div
                      key={line.lineId}
                      className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-white">{line.factoryName} — {line.lineId}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              line.impactStatus === 'starved'
                                ? 'bg-red-950 text-red-300 animate-pulse'
                                : 'bg-amber-950 text-amber-300'
                            }`}
                          >
                            {line.impactStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Products: {line.affectedProducts.join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Shutdown in:</div>
                        <div className="text-red-400 font-bold">{line.hoursUntilShutdown} Hours</div>
                        <div className="text-[10px] text-slate-500">Loss: {line.dailyOutputLoss}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>AT-RISK CUSTOMER ORDERS & SLA DEADLINES</span>
                </h3>
                <div className="space-y-2">
                  {affectedOrders.map(order => (
                    <div
                      key={order.orderId}
                      className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{order.orderId}</span>
                          <span className="text-cyan-300">{order.customerName}</span>
                          <span className="text-[10px] text-slate-400">➔ {order.destination}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Volume: {order.volumeUnits.toLocaleString()} units | Contract Value: {order.contractValueUSD}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            order.riskTier === 'CRITICAL'
                              ? 'bg-red-950 text-red-300 animate-pulse'
                              : 'bg-amber-950 text-amber-300'
                          }`}
                        >
                          SLA in {order.slaDeadlineHours}h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALTERNATIVE SUPPLIERS & WAREHOUSES */}
          {activeTab === 'alternatives' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4 text-cyan-400" />
                  <span>PRE-QUALIFIED ALTERNATIVE SUPPLIERS</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {alternativeSuppliers.map(alt => (
                    <div
                      key={alt.supplierId}
                      onClick={() => setSelectedAltSupplier(alt)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedAltSupplier?.supplierId === alt.supplierId || alt.supplierId === 'node-sup-3'
                          ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-bold text-white">{alt.supplierName}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            alt.readinessStatus === 'Immediate'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-amber-950 text-amber-300'
                          }`}
                        >
                          {alt.readinessStatus}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mb-2">{alt.location}</div>
                      <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Available Cap:</span>
                          <span className="text-white font-bold">{alt.availableCapacityUnits} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Lead Time:</span>
                          <span className="text-cyan-300 font-bold">{alt.quotedLeadTimeDays} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Unit Cost:</span>
                          <span className="text-amber-300 font-bold">${alt.unitCostUSD} (+{alt.costDeltaPct}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Reliability:</span>
                          <span className="text-emerald-400 font-bold">{alt.reliabilityScore}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-cyan-400" />
                  <span>EMERGENCY WAREHOUSE BUFFER STOCK OPTIONS</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {warehouseStockOptions.map(wh => (
                    <div
                      key={wh.warehouseId}
                      onClick={() => setSelectedWarehouse(wh)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedWarehouse?.warehouseId === wh.warehouseId || wh.warehouseId === 'node-wh-2'
                          ? 'bg-blue-950/40 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-bold text-white">{wh.warehouseName}</span>
                        <span className="text-[10px] text-blue-300 bg-blue-950 px-1.5 py-0.2 rounded font-bold">
                          {wh.transportMode}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mb-2">{wh.location}</div>
                      <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Available Buffer:</span>
                          <span className="text-white font-bold">{wh.availableBufferUnits.toLocaleString()} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Transit Duration:</span>
                          <span className="text-cyan-300 font-bold">{wh.transitHours} Hours</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Air Charter Cost:</span>
                          <span className="text-purple-300 font-bold">{wh.estimatedTransitCostUSD}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Runway Coverage:</span>
                          <span className="text-emerald-400 font-bold">{wh.sufficientToCoverDays} Days</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECOVERY ACTIONS (Requirement 1 & 6) */}
          {activeTab === 'actions' && proposedPlan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    RECOVERY ACTION SCHEDULE & STATUS
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Inspecting simulated actions. Each step is tracked for audit verification.
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-purple-300 font-bold">TOTAL: {proposedPlan.estimatedTotalCostUSD}</span>
                  <span className="text-[10px] text-emerald-400 block font-bold">+{proposedPlan.slaRecoveryPercentage}% SLA</span>
                </div>
              </div>

              {isExecuting && (
                <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-400 text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-cyan-300 font-bold text-xs">
                    <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>EXECUTING ACTION {currentExecutingActionIndex + 1} OF {proposedPlan.detailedActions.length}...</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {proposedPlan.detailedActions[currentExecutingActionIndex]?.title}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {proposedPlan.detailedActions.map(action => (
                  <div
                    key={action.id}
                    onClick={() => setSelectedActionDetail(selectedActionDetail?.id === action.id ? null : action)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedActionDetail?.id === action.id
                        ? 'bg-cyan-950/40 border-cyan-400'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span
                          className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            action.executionStatus === 'verified'
                              ? 'bg-emerald-500 text-slate-950'
                              : action.executionStatus === 'in_progress'
                              ? 'bg-cyan-500 text-slate-950 animate-pulse'
                              : 'bg-cyan-950 border border-cyan-400/50 text-cyan-300'
                          }`}
                        >
                          {action.executionStatus === 'verified' ? '✓' : action.sequence}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{action.title}</span>
                            <span className="text-[10px] text-cyan-400 font-normal">[{action.department}]</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">{action.description}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-purple-300">{action.costUSD}</div>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase mt-1 ${
                            action.executionStatus === 'verified'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                              : action.executionStatus === 'in_progress'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-400/50 animate-pulse'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {action.executionStatus}
                        </span>
                      </div>
                    </div>

                    {selectedActionDetail?.id === action.id && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-300 space-y-1 bg-slate-950/60 p-2.5 rounded">
                        <div className="text-cyan-400 font-bold text-[10px] uppercase">
                          SYNTHETIC SIMULATION VERIFICATION LOG:
                        </div>
                        <div>{action.syntheticVerificationNote}</div>
                        <div className="text-slate-500 text-[10px]">
                          Action Type: {action.actionType} | Estimated Time: {action.durationMinutes} mins
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TIMELINE (Requirement 6) */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>COMMAND AUDIT TRAIL TIMELINE</span>
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Immutable sequence log of workflow gates, human approvals, and simulated dispatches.
                  </div>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                  {auditTrail.length} AUDIT RECORDS
                </span>
              </div>

              <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {auditTrail.map(entry => (
                  <div key={entry.id} className="relative group">
                    <span
                      className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                        entry.status === 'SUCCESS'
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                          : entry.status === 'REJECTED'
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                          : entry.status === 'SECURITY_BLOCKED'
                          ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : 'bg-cyan-400'
                      }`}
                    />

                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{entry.action}</span>
                          <span className="text-[10px] text-cyan-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
                            {entry.actor}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              entry.status === 'SUCCESS'
                                ? 'bg-emerald-950 text-emerald-300'
                                : entry.status === 'REJECTED'
                                ? 'bg-amber-950 text-amber-300'
                                : 'bg-red-950 text-red-300'
                            }`}
                          >
                            {entry.status}
                          </span>
                          <span className="text-[10px] text-slate-500">{entry.timestamp}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans">{entry.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* =====================================================================
            CONFIRMATION DIALOG 1: APPROVAL CONFIRMATION (Requirement 2 & 3)
            ===================================================================== */}
        {showApprovalConfirm && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md p-5 rounded-2xl bg-slate-950 border border-emerald-400/70 shadow-[0_0_40px_rgba(16,185,129,0.3)] font-mono">
              <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>CONFIRM WORKFLOW PLAN APPROVAL</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
                You are authorizing the multi-tier recovery plan for <strong className="text-white">Apex Silicon Fab 4</strong>.
                This signs off the order diversion to Tokyo Precision Optics and emergency air cargo from Singapore Tuas.
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1 mb-4 text-slate-300">
                <div className="flex justify-between">
                  <span>Authorizer Role:</span>
                  <span className="text-white font-bold">COMMAND_DIRECTOR</span>
                </div>
                <div className="flex justify-between">
                  <span>Authorized Expedite Budget:</span>
                  <span className="text-purple-300 font-bold">$142,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Environment Guardrail:</span>
                  <span className="text-emerald-400 font-bold">SIMULATION ONLY // NO REAL TRANSACTIONS</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowApprovalConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowApprovalConfirm(false);
                    onApprovePlan();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg active:scale-95"
                >
                  Confirm Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            CONFIRMATION DIALOG 2: REJECTION DIALOG (Requirement 2 & 8)
            ===================================================================== */}
        {showRejectConfirm && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md p-5 rounded-2xl bg-slate-950 border border-amber-400/70 shadow-[0_0_40px_rgba(245,158,11,0.3)] font-mono">
              <div className="flex items-center gap-2 text-amber-300 font-bold mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>CONFIRM WORKFLOW REJECTION</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
                Rejecting the plan prevents simulated order dispatch. The workflow will transition to <strong className="text-amber-300">rejected</strong> state and require re-planning.
              </p>
              <div className="mb-4">
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Rejection Rationale (Logged to Audit Trail):
                </label>
                <textarea
                  value={rejectionInput}
                  onChange={e => setRejectionInput(e.target.value)}
                  className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 resize-none h-16 font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowRejectConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setShowRejectConfirm(false);
                    onRejectPlan(rejectionInput);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg active:scale-95"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            CONFIRMATION DIALOG 3: EXECUTION CONFIRMATION (Requirement 3 & 5)
            ===================================================================== */}
        {showExecutionConfirm && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md p-5 rounded-2xl bg-slate-950 border border-cyan-400/70 shadow-[0_0_40px_rgba(0,240,255,0.3)] font-mono">
              <div className="flex items-center gap-2 text-cyan-300 font-bold mb-2">
                <Play className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                <span>CONFIRM SIMULATED DISPATCH</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
                Approval verified. You are about to execute the 5 simulated dispatch actions.
                This will update the 3D network topology and restore delivery SLA.
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1 mb-4 text-slate-300">
                <div className="flex justify-between">
                  <span>Approval Gate:</span>
                  <span className="text-emerald-400 font-bold">VERIFIED (APPROVED)</span>
                </div>
                <div className="flex justify-between">
                  <span>Simulated Actions:</span>
                  <span className="text-white font-bold">5 Actions Ready</span>
                </div>
                <div className="flex justify-between">
                  <span>Real Transaction Block:</span>
                  <span className="text-cyan-400 font-bold">ACTIVE (Zero External Calls)</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowExecutionConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowExecutionConfirm(false);
                    onExecutePlan();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-xs font-bold text-white shadow-lg active:scale-95"
                >
                  Start Execution
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-900/90 border-t border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>Strict approval gate enforced: Execution without prior authorization is blocked.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Back to Command Center
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
