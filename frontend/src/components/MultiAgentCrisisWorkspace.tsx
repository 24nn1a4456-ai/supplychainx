import React, { useState } from 'react';
import type { OutageSimulationState } from '../types/supplyChain';
import {
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building,
  XCircle,
  FileText,
  ShieldCheck,
  History,
  Lock,
  UserCheck,
  CloudSun,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Activity,
  Check,
  Ban
} from 'lucide-react';

interface CrisisWorkspaceProps {
  simulationState: OutageSimulationState;
  isGeneratingPlan?: boolean;
  onStartOutage: () => void;
  onProceedToAssessing: () => void;
  onProceedToPlanning: () => void;
  onProceedToAwaitingApproval?: () => void;
  onApprovePlan: () => void;
  onRejectPlan: (reason: string) => void;
  onExecutePlan: () => void;
  onResetDemo: () => void;
  onTriggerFailDemo?: () => void;
}

export const MultiAgentCrisisWorkspace: React.FC<CrisisWorkspaceProps> = ({
  simulationState,
  isGeneratingPlan = false,
  onStartOutage,
  onProceedToAssessing,
  onProceedToPlanning,
  onApprovePlan,
  onRejectPlan,
  onExecutePlan,
  onResetDemo
}) => {
  const {
    stage,
    detectionSeverity,
    affectedInventory,
    affectedProduction,
    affectedOrders,
    alternativeSuppliers,
    proposedPlan,
    rejectionReason,
    auditTrail
  } = simulationState;

  // Collapsible state for each agent card (default: active agents expanded, others collapsed)
  const [expandedAgents, setExpandedAgents] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false
  });

  // Safe Approval & Confirmation Dialog States
  const [showApprovalConfirm, setShowApprovalConfirm] = useState<boolean>(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState<boolean>(false);
  const [rejectionInput, setRejectionInput] = useState<string>(
    'Exceeds discretionary threshold ($142k). Require secondary vendor bidding or lower-cost ground freight.'
  );

  const toggleAgent = (num: number) => {
    setExpandedAgents(prev => ({ ...prev, [num]: !prev[num] }));
  };

  const expandAllAgents = () => {
    setExpandedAgents({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true });
  };

  const collapseAllAgents = () => {
    setExpandedAgents({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false });
  };

  // Derive concrete Agent statuses from real workflow state & audit events
  // Stages: idle -> detected -> assessing -> planning -> awaiting_approval -> approved / rejected -> executing -> completed / failed
  const isIdle = stage === 'idle';
  const isDetected = stage === 'detected';
  const isAssessing = stage === 'assessing';
  const isPlanning = stage === 'planning';
  const isAwaitingApproval = stage === 'awaiting_approval';
  const isApproved = stage === 'approved';
  const isRejected = stage === 'rejected';
  const isExecuting = stage === 'executing';
  const isCompleted = stage === 'completed';
  const isFailed = stage === 'failed';

  // Agent 1: Detection
  const agent1Status: 'Completed' | 'Pending' | 'Not Run' = !isIdle ? 'Completed' : 'Not Run';
  // Agent 2: Impact Assessment
  const agent2Status: 'Completed' | 'Running' | 'Pending' | 'Not Run' =
    isAssessing ? 'Running' :
    ['planning', 'awaiting_approval', 'approved', 'rejected', 'executing', 'completed'].includes(stage) ? 'Completed' :
    isDetected ? 'Pending' : 'Not Run';
  // Agent 3: Supplier Evaluation
  const agent3Status: 'Completed' | 'Running' | 'Pending' | 'Not Run' =
    isPlanning ? 'Running' :
    ['awaiting_approval', 'approved', 'rejected', 'executing', 'completed'].includes(stage) ? 'Completed' :
    ['detected', 'assessing'].includes(stage) ? 'Pending' : 'Not Run';
  // Agent 4: Inventory Recovery
  const agent4Status: 'Completed' | 'Running' | 'Pending' | 'Not Run' =
    isPlanning ? 'Running' :
    ['awaiting_approval', 'approved', 'rejected', 'executing', 'completed'].includes(stage) ? 'Completed' :
    ['detected', 'assessing'].includes(stage) ? 'Pending' : 'Not Run';
  // Agent 5: Logistics Recovery
  const agent5Status: 'Completed' | 'Running' | 'Pending' | 'Not Run' =
    isPlanning ? 'Running' :
    ['awaiting_approval', 'approved', 'rejected', 'executing', 'completed'].includes(stage) ? 'Completed' :
    ['detected', 'assessing'].includes(stage) ? 'Pending' : 'Not Run';
  // Agent 6: Recovery Monitor
  const agent6Status: 'Completed' | 'Running' | 'Pending' | 'Failed' | 'Not Run' =
    isCompleted ? 'Completed' :
    isExecuting ? 'Running' :
    isFailed ? 'Failed' :
    isApproved ? 'Pending' : 'Not Run';

  // Extract total exposure from affected orders
  const totalOrderExposureUSD = affectedOrders && affectedOrders.length > 0
    ? affectedOrders.reduce((sum, ord) => {
        const numeric = parseFloat(ord.contractValueUSD?.replace(/[^0-9.]/g, '') || '0');
        return sum + (isNaN(numeric) ? 0 : numeric);
      }, 0)
    : 660000;

  // Extract runway hours
  const minRunwayHours = affectedInventory && affectedInventory.length > 0
    ? Math.min(...affectedInventory.map(i => i.hoursOfRunwayLeft))
    : 36;

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'Completed':
        return <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1"><Check className="w-3 h-3" /> COMPLETED</span>;
      case 'Running':
        return <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 text-[10px] font-mono font-bold animate-pulse flex items-center gap-1"><Activity className="w-3 h-3" /> RUNNING</span>;
      case 'Pending':
        return <span className="px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> PENDING</span>;
      case 'Failed':
        return <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/40 text-[10px] font-mono font-bold flex items-center gap-1"><Ban className="w-3 h-3" /> FAILED</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850 text-[10px] font-mono">NOT RUN</span>;
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* =========================================================================
          SECTION A: CRISIS SUMMARY
          ========================================================================= */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border transition-all ${
              isIdle ? 'bg-slate-900/80 border-slate-700/60 text-slate-400' :
              isCompleted ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' :
              isRejected ? 'bg-amber-950/80 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]' :
              'bg-red-950/90 border-red-500/70 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-cyan-400/90 tracking-widest uppercase">SECTION A</span>
                <span className="text-slate-600 font-mono">/</span>
                <h2 className="text-sm font-display font-bold text-white tracking-wider uppercase">
                  CRISIS INCIDENT SUMMARY & EXPOSURE
                </h2>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {isIdle ? 'Baseline operational network telemetry (no active disruption).' : 'Live simulated crisis incident at Tier-1 semiconductor node.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-750 text-[11px]">
              <span className="text-slate-400">STAGE:</span>
              <span className={`font-bold uppercase ${
                isCompleted ? 'text-emerald-400' :
                isRejected ? 'text-amber-400' :
                isFailed ? 'text-red-400' :
                isIdle ? 'text-slate-400' : 'text-cyan-300'
              }`}>
                {stage.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-750 text-[11px]">
              <span className="text-slate-400">SEVERITY:</span>
              <span className={`font-bold ${
                detectionSeverity === 'CRITICAL' ? 'text-red-400 animate-pulse' :
                detectionSeverity === 'SEVERE' ? 'text-amber-400' :
                detectionSeverity === 'MODERATE' ? 'text-yellow-400' : 'text-emerald-400'
              }`}>
                {detectionSeverity}
              </span>
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="p-4 space-y-4">
          {/* Incident Overview Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">INCIDENT & AFFECTED FACILITY</div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-cyan-400" />
                <span>Apex Silicon Fab 4 (Shenzhen Substation Meltdown & Typhoon Embargo)</span>
              </div>
              <p className="text-[11px] text-slate-300 max-w-2xl font-sans">
                {isIdle
                  ? 'All 6 facilities and transit routes operating nominal. Ready to trigger simulated failure.'
                  : 'Power grid substation failure followed by coastal port embargo halts all sub-3nm neural wafer packaging. Downstream Austin Giga Assembly starvation trajectory triggered.'}
              </p>
            </div>

            {/* Quick action button for demo flow */}
            <div className="flex items-center gap-2">
              {isIdle && (
                <button
                  onClick={onStartOutage}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>1. Trigger Crisis Incident</span>
                </button>
              )}
              {isDetected && (
                <button
                  onClick={onProceedToAssessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(0,240,255,0.3)] active:scale-95 transition-all"
                >
                  <span>2. Assess Impact ➔</span>
                </button>
              )}
              {isAssessing && (
                <button
                  onClick={onProceedToPlanning}
                  disabled={isGeneratingPlan}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all ${
                    isGeneratingPlan
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_15px_rgba(0,240,255,0.3)] active:scale-95'
                  }`}
                >
                  <span>{isGeneratingPlan ? 'Solving Multi-Agent Plan...' : '3. Solve Multi-Agent Plan ➔'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Baseline vs Crisis-Specific Impact Metrics (Requirement A) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Metric 1: Stockout Runway */}
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>STOCKOUT RUNWAY</span>
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-xl font-bold text-red-400">
                {isIdle ? '14.0 Days' : `${(minRunwayHours / 24).toFixed(1)} Days`}
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-1 flex justify-between">
                <span>Baseline: <strong className="text-slate-300">14.0d</strong></span>
                <span className={isIdle ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                  {isIdle ? 'Normal' : `Critical (-${(14 - minRunwayHours/24).toFixed(1)}d)`}
                </span>
              </div>
            </div>

            {/* Metric 2: Affected Production */}
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>AFFECTED PRODUCTION</span>
                <Layers className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-purple-300">
                {isIdle ? '0 Lines' : `${affectedProduction.length || 2} Lines Starved`}
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-1 flex justify-between">
                <span>Target: <strong className="text-slate-300">Austin Giga Line 2</strong></span>
                <span className={isIdle ? 'text-emerald-400' : 'text-purple-400 font-bold'}>
                  {isIdle ? 'Nominal' : `${affectedInventory[0]?.dailyBurnRate || 413} units/d Loss`}
                </span>
              </div>
            </div>

            {/* Metric 3: Financial & Order Exposure */}
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>ORDER EXPOSURE</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-300">
                {isIdle ? '$0 At Risk' : `$${(totalOrderExposureUSD / 1000).toFixed(0)}k USD`}
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-1 flex justify-between">
                <span>At-Risk Orders: <strong className="text-slate-300">{isIdle ? '0' : (affectedOrders.length || 2)}</strong></span>
                <span className={isIdle ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                  {isIdle ? 'Protected' : 'SLA Breach Risk'}
                </span>
              </div>
            </div>

            {/* Metric 4: Daily Burn Rate */}
            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>COMPONENT BURN RATE</span>
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-xl font-bold text-cyan-300">
                {isIdle ? '413 Units/Day' : `${affectedInventory[0]?.dailyBurnRate || 413} Units/Day`}
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-1 flex justify-between">
                <span>On-Hand: <strong className="text-slate-300">{isIdle ? '6,300' : (affectedInventory[0]?.onHandUnits || 620)}</strong></span>
                <span className={isIdle ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                  {isIdle ? 'Safe' : 'Depleting Fast'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION B: MULTI-AGENT DECISION CENTER (6 AGENTS IN ORDERED WORKFLOW)
          ========================================================================= */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-400/50 text-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-cyan-400/90 tracking-widest uppercase">SECTION B</span>
                <span className="text-slate-600 font-mono">/</span>
                <h2 className="text-sm font-display font-bold text-white tracking-wider uppercase">
                  MULTI-AGENT DECISION CENTER (6-AGENT ORCHESTRATION)
                </h2>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Deterministic agent trace with real inputs, concrete outputs, and recovery plan impacts.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAllAgents}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 hover:text-white transition-all"
            >
              Expand All
            </button>
            <button
              onClick={collapseAllAgents}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 hover:text-white transition-all"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* 6 Ordered Agent Cards */}
        <div className="p-4 space-y-3">
          {/* ---------------- AGENT 1: DETECTION AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(1)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-red-950/70 border border-red-500/50 flex items-center justify-center font-bold text-red-300 text-xs">
                  1
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Detection Agent</span>
                    <span className="text-[10px] text-slate-500 font-mono">[detect_crisis_from_signal]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Ingests telemetry beacon, confirms signal validity, and deduplicates noise.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent1Status)}
                {expandedAgents[1] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[1] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Signal: <code className="text-cyan-300">SIG-node-sup-1</code><br />
                      Entity: <span className="text-white font-semibold">Apex Silicon Fab 4 (Shenzhen)</span><br />
                      Reported Delay: <span className="text-amber-300">14 days</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Disruption Confirmed: <strong className={agent1Status === 'Completed' ? 'text-red-400' : 'text-slate-400'}>{agent1Status === 'Completed' ? 'YES (CRITICAL)' : 'NONE'}</strong><br />
                      Deduplication: <strong className="text-emerald-400">Single Incident Verified</strong><br />
                      Event ID: <code className="text-slate-300">CR-APEX-OUTAGE-001</code>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      Halts non-verified manifests on Apex Fab 4 and triggers the downstream Impact Assessment workflow.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- AGENT 2: IMPACT ASSESSMENT AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(2)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-950/70 border border-purple-500/50 flex items-center justify-center font-bold text-purple-300 text-xs">
                  2
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Impact Assessment Agent</span>
                    <span className="text-[10px] text-slate-500 font-mono">[evaluate_crisis_impact]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Quantifies component burn-rates, stockout runway, and customer order exposure.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent2Status)}
                {expandedAgents[2] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[2] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Product SKU: <code className="text-cyan-300">{affectedInventory[0]?.sku || 'SKU-NEURAL-A1'}</code><br />
                      Current Buffer: <span className="text-white">{affectedInventory[0]?.onHandUnits || 620} units on-hand</span><br />
                      Daily Burn Rate: <span className="text-red-400">{affectedInventory[0]?.dailyBurnRate || 413} units/day</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Days to Stockout: <strong className="text-red-400">{((affectedInventory[0]?.onHandUnits || 620) / (affectedInventory[0]?.dailyBurnRate || 413)).toFixed(1)} Days ({minRunwayHours} Hours)</strong><br />
                      Starved Lines: <strong className="text-purple-300">Austin Giga Line 2</strong><br />
                      Financial Exposure: <strong className="text-amber-400">${(totalOrderExposureUSD/1000).toFixed(0)}k across {affectedOrders.length || 2} orders</strong>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      Sets recovery target: 1,450 units required within 14 days; demands emergency buffer dispatch within 36 hours.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- AGENT 3: SUPPLIER EVALUATION AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(3)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-950/70 border border-blue-500/50 flex items-center justify-center font-bold text-blue-300 text-xs">
                  3
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Supplier Evaluation Agent</span>
                    <span className="text-[10px] text-slate-500 font-mono">[evaluate_alternative_suppliers]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Scores pre-qualified alternate foundries by capacity, reliability, delta cost, and lead-time.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent3Status)}
                {expandedAgents[3] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[3] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Candidates: <span className="text-white">Tokyo Precision, Dresden Fab, Nexus Semi</span><br />
                      Required Quantity: <span className="text-cyan-300">450 - 1,450 units</span><br />
                      Constraint: <span className="text-slate-400">Reliability ≥ 85%, Lead time ≤ 14d</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Selected Supplier: <strong className="text-emerald-300">{proposedPlan?.selectedAltSupplier || (alternativeSuppliers && alternativeSuppliers[0]?.supplierName) || 'Nexus Semiconductor Global'}</strong><br />
                      Capacity: <strong className="text-white">{alternativeSuppliers && alternativeSuppliers[0] ? `${alternativeSuppliers[0].availableCapacityUnits} units open` : '5,000 units open'}</strong> | Lead: <strong className="text-blue-300">{alternativeSuppliers && alternativeSuppliers[0] ? `${alternativeSuppliers[0].quotedLeadTimeDays} Days` : '3-5 Days'}</strong><br />
                      Reliability Score: <strong className="text-emerald-400">{alternativeSuppliers && alternativeSuppliers[0] ? `${alternativeSuppliers[0].reliabilityScore.toFixed(1)}%` : '94-98%'}</strong> | Allocation: <strong className="text-purple-300">450 Units</strong>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      Allocates 450 units sub-3nm neural wafers to {proposedPlan?.selectedAltSupplier || 'qualified backup vendor'} at estimated expedite cost of {proposedPlan?.detailedActions[1]?.costUSD || '$6,525'}.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- AGENT 4: INVENTORY RECOVERY AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(4)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-center font-bold text-emerald-300 text-xs">
                  4
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Inventory Recovery Agent</span>
                    <span className="text-[10px] text-slate-500 font-mono">[evaluate_inventory_recovery]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Scans global warehouses for unallocated buffers without violating local safety stock thresholds.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent4Status)}
                {expandedAgents[4] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[4] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Depots Scanned: <span className="text-white">Singapore Tuas, Rotterdam Europort, Austin Central</span><br />
                      Target Transfer Window: <span className="text-cyan-300">≤ 18 hours</span><br />
                      Safety Rule: <span className="text-slate-400">Must retain 3-day minimum regional reserve</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Selected Depot: <strong className="text-cyan-300">{proposedPlan?.selectedWarehouseBuffer || 'Pacific Straits Buffer Depot (Singapore)'}</strong><br />
                      Allocated Units: <strong className="text-white">1,000 units</strong> (Safety buffer preserved)<br />
                      Transit Time: <strong className="text-blue-300">18-24 Hours</strong> (Bridges initial starvation window)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      Bridges the immediate starvation window while secondary vendor spins up packaging lines.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- AGENT 5: LOGISTICS RECOVERY AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(5)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-950/70 border border-amber-500/50 flex items-center justify-center font-bold text-amber-300 text-xs">
                  5
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Logistics Recovery Agent (Weather-Aware)</span>
                    <span className="text-[10px] text-slate-500 font-mono">[evaluate_logistics_recovery]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Evaluates multi-modal transit corridors against live/forecast OpenWeather meteorology and SLA cost.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent5Status)}
                {expandedAgents[5] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[5] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Corridor: <span className="text-white">Singapore Tuas ➔ Austin Bergstrom</span><br />
                      Weather Source: <code className="text-cyan-300">{proposedPlan?.weatherDataSource || 'openweather_forecast'}</code><br />
                      Carriers Evaluated: <span className="text-slate-300">
                        {proposedPlan?.evaluatedTransportOptions?.map(o => o.carrierName).join(', ') || 'DHL Express Priority Air, FedEx Ground, Schneider Standard'}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Recommended Carrier: <strong className="text-emerald-300">{proposedPlan?.evaluatedTransportOptions?.find(o => o.isRecommended)?.carrierName || 'DHL Express Priority Air'}</strong><br />
                      Corridor Weather Risk: <strong className="text-emerald-400">{proposedPlan?.weatherRiskScore?.toFixed(0) || '42'}/100 ({proposedPlan?.weatherRiskLevel?.toUpperCase() || 'MODERATE'})</strong><br />
                      Freight Cost: <strong className="text-purple-300">{proposedPlan?.evaluatedTransportOptions?.find(o => o.isRecommended)?.freightCostUSD || '$3,800'}</strong> | Transit: <strong className="text-blue-300">{proposedPlan?.evaluatedTransportOptions?.find(o => o.isRecommended)?.transitDays || 2} Days</strong>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      {proposedPlan?.weatherExplanation || 'Transit corridor weather verified nominal. Zero adverse meteorological delays anticipated.'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- AGENT 6: PRODUCTION AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(6)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-950/70 border border-indigo-500/50 flex items-center justify-center font-bold text-indigo-300 text-xs">
                  6
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Production Agent</span>
                    <span className="text-[10px] text-slate-500 font-mono">[evaluate_production_schedule]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Evaluates material constraints, line schedules, feasible throttling adjustments, and order priority sequencing.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent5Status)}
                {expandedAgents[6] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[6] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Target Plant: <span className="text-white">Austin Giga Assembly Complex</span><br />
                      Assembly Lines: <span className="text-cyan-300">Line 1 (Base Chassis) & Line 2 (Pods)</span><br />
                      Available Buffer: <span className="text-amber-300">620 physical units on hand</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Line Schedule: <strong className="text-emerald-300">Line 2 Throttle to 65% Rate</strong><br />
                      Runway Extension: <strong className="text-cyan-300">+18.0 Hours Gained</strong><br />
                      Critical Orders: <strong className="text-emerald-400">ORD-US-8912 Fully Protected</strong>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      Maintains uninterrupted assembly line operations and prevents high-cost emergency cold shutdowns until air-bridge arrives.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- AGENT 7: RECOVERY MONITOR AGENT ---------------- */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all">
            <div
              onClick={() => toggleAgent(7)}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/90 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/70 border border-cyan-500/50 flex items-center justify-center font-bold text-cyan-300 text-xs">
                  7
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Recovery Monitor / Digital Twin</span>
                    <span className="text-[10px] text-slate-500 font-mono">[verify_simulated_recovery]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Runs digital-twin simulation verification to audit demand coverage, residual risk, and execution safety.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(agent6Status)}
                {expandedAgents[7] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandedAgents[7] && (
              <div className="p-3.5 pt-0 border-t border-slate-850 bg-slate-950/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">INPUT EVALUATED:</div>
                    <div className="text-slate-300">
                      Executed Actions: <span className="text-white">{proposedPlan?.detailedActions.length || 5} simulated tasks</span><br />
                      Authorized Cost: <span className="text-purple-300">{proposedPlan?.estimatedTotalCostUSD || '$142,500'}</span><br />
                      Verification Target: <span className="text-cyan-300">Demand coverage & lead-time slack</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ACTUAL OUTPUT & DECISION:</div>
                    <div className="text-slate-300">
                      Verification Status: <strong className={isCompleted ? 'text-emerald-400' : 'text-slate-400'}>{isCompleted ? 'VERIFIED (PASS)' : 'Awaiting Execution'}</strong><br />
                      Demand Coverage: <strong className="text-emerald-300">{isCompleted ? '100.0%' : 'Target 100%'}</strong><br />
                      Lead Time Slack: <strong className="text-blue-300">{isCompleted ? '+11.0 Days' : 'Target +11d'}</strong>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">PLAN IMPACT:</div>
                    <div className="text-slate-300 font-sans leading-relaxed">
                      Validates that the multi-agent recovery successfully restored factory operations with zero real transactions created.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION C: RECOVERY PLAN & ALTERNATIVE COMPARISON
          ========================================================================= */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-400/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-cyan-400/90 tracking-widest uppercase">SECTION C</span>
                <span className="text-slate-600 font-mono">/</span>
                <h2 className="text-sm font-display font-bold text-white tracking-wider uppercase">
                  RECOMMENDED RECOVERY PLAN & ALTERNATIVES COMPARISON
                </h2>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Multi-constraint solver synthesis combining supplier diversion, warehouse buffers, and weather-aware transit.
              </div>
            </div>
          </div>

          {proposedPlan && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-[10px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              CONFIDENCE: {proposedPlan.syntheticConfidenceScore}%
            </span>
          )}
        </div>

        {/* Section Content */}
        <div className="p-4 space-y-4">
          {!proposedPlan ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
              <Info className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-slate-300 font-bold">No Recovery Plan Synthesized Yet</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto font-sans">
                Progress through the crisis workflow to trigger Agents 3, 4, and 5 to synthesize a multi-constraint recovery plan.
              </p>
            </div>
          ) : (
            <>
              {/* Highlighted Recommended Solution Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-purple-950/40 border border-cyan-500/40 shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="space-y-0.5">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-400/40">
                      RECOMMENDED CONTINGENCY PLAN
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">{proposedPlan.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase">ESTIMATED EXPEDITE BUDGET</div>
                    <div className="text-lg font-bold text-purple-300">{proposedPlan.estimatedTotalCostUSD}</div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">SELECTED SUPPLIER</span>
                    <strong className="text-emerald-300 truncate block mt-0.5">{proposedPlan.selectedAltSupplier || 'Tokyo Precision Optics'}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">BUFFER DEPOT</span>
                    <strong className="text-cyan-300 truncate block mt-0.5">{proposedPlan.selectedWarehouseBuffer || 'Singapore Tuas Depot'}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">LEAD TIME RECOVERY</span>
                    <strong className="text-blue-300 block mt-0.5">-{proposedPlan.deliveryTimeRecoveryHours} Hours</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">SLA RESTORATION</span>
                    <strong className="text-emerald-300 block mt-0.5">+{proposedPlan.slaRecoveryPercentage}% Gain</strong>
                  </div>
                </div>

                {/* Meteorological Intelligence & Weather Risk Callout */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-2.5">
                    <CloudSun className="w-4 h-4 text-amber-300 shrink-0" />
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>Transit Weather Intelligence</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 text-[9px] font-mono">
                          Source: {proposedPlan.weatherDataSource || 'openweather_forecast'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[10px] font-sans mt-0.5">
                        {proposedPlan.weatherExplanation || 'Transit corridor weather nominal. Zero meteorological delays anticipated.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">CORRIDOR RISK:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      (proposedPlan.weatherRiskScore || 0) > 60 ? 'bg-red-950 text-red-300 border border-red-500/50' :
                      (proposedPlan.weatherRiskScore || 0) > 30 ? 'bg-amber-950 text-amber-300 border border-amber-500/50' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                    }`}>
                      {proposedPlan.weatherRiskScore?.toFixed(0) || '12'}/100 ({proposedPlan.weatherRiskLevel?.toUpperCase() || 'LOW'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Feasible Alternatives Comparison Table (Requirement C) */}
              {proposedPlan.evaluatedTransportOptions && proposedPlan.evaluatedTransportOptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      FEASIBLE & REJECTED LOGISTICS ALTERNATIVES COMPARISON
                    </div>
                    <span className="text-[10px] text-slate-500">Evaluated by Agent 5 (Logistics Recovery)</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] text-slate-400 uppercase">
                          <th className="py-2.5 px-3">Carrier & Mode</th>
                          <th className="py-2.5 px-3">Transit Time</th>
                          <th className="py-2.5 px-3">Freight Cost</th>
                          <th className="py-2.5 px-3">Weather Risk</th>
                          <th className="py-2.5 px-3">SLA Feasibility</th>
                          <th className="py-2.5 px-3 text-right">Selection Rationale / Rejection</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {proposedPlan.evaluatedTransportOptions.map(opt => (
                          <tr
                            key={opt.optionId}
                            className={`hover:bg-slate-900/70 transition-colors ${
                              opt.isRecommended ? 'bg-cyan-950/30 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                {opt.isRecommended && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                                <span className="text-white">{opt.carrierName}</span>
                                <span className="text-slate-500 text-[10px]">({opt.transportMode})</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-blue-300 font-bold">{opt.transitDays} Days</td>
                            <td className="py-2.5 px-3 text-purple-300 font-bold">{opt.freightCostUSD}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                opt.weatherRiskLevel === 'severe' ? 'text-red-400 bg-red-950/60' :
                                opt.weatherRiskLevel === 'moderate' ? 'text-amber-400 bg-amber-950/60' :
                                'text-emerald-400 bg-emerald-950/60'
                              }`}>
                                {opt.weatherRiskScore.toFixed(0)}/100 ({opt.weatherRiskLevel.toUpperCase()})
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {opt.isFeasible ? (
                                <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Feasible
                                </span>
                              ) : (
                                <span className="text-red-400 flex items-center gap-1 text-[10px]">
                                  <XCircle className="w-3 h-3" /> SLA Breach
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {opt.isRecommended ? (
                                <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-bold">
                                  SELECTED: Lowest Lead Time & Clear Weather
                                </span>
                              ) : !opt.isFeasible ? (
                                <span className="text-red-400/90 text-[10px]">
                                  REJECTED: Lead time exceeds 36h starvation window
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">
                                  FEASIBLE BACKUP: Secondary contingency
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION D: HUMAN APPROVAL GATE
          ========================================================================= */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border transition-all ${
              isApproved ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' :
              isRejected ? 'bg-amber-950/80 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]' :
              isAwaitingApproval ? 'bg-amber-950/80 border-amber-500/50 text-amber-400 animate-pulse' :
              'bg-slate-900/80 border-slate-700/60 text-slate-400'
            }`}>
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-cyan-400/90 tracking-widest uppercase">SECTION D</span>
                <span className="text-slate-600 font-mono">/</span>
                <h2 className="text-sm font-display font-bold text-white tracking-wider uppercase">
                  SAFE GOVERNANCE & COMMAND APPROVAL GATE
                </h2>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Separates plan synthesis from authorization. Execution is strictly blocked without human sign-off.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase ${
              isApproved ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' :
              isRejected ? 'bg-amber-950/80 text-amber-300 border-amber-500/50' :
              isAwaitingApproval ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse' :
              'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              GATE STATUS: {stage === 'awaiting_approval' ? 'AWAITING APPROVAL' : stage.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Section Content */}
        <div className="p-4 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">AUTHORIZATION POLICY RULE</div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>Command Director Sign-off Required for Expenses &gt; $100,000 USD</span>
              </div>
              <p className="text-[11px] text-slate-300 max-w-2xl font-sans leading-relaxed">
                {isAwaitingApproval && 'The proposed recovery plan total ($142,500) exceeds the autonomous threshold. Execution is locked by backend security policy.'}
                {isApproved && 'Plan CP-01 authorized by COMMAND_DIRECTOR. Security lock disengaged for simulated dispatch.'}
                {isRejected && `Plan rejected by operator. Reason: "${rejectionReason || 'Cost exceeds threshold'}". Backend blocks execution until revised plan is generated.`}
                {!isAwaitingApproval && !isApproved && !isRejected && 'Approval gate will engage once a recovery plan is synthesized.'}
              </p>
            </div>

            {/* Explicit Approval & Rejection Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isAwaitingApproval && (
                <>
                  <button
                    onClick={() => setShowRejectConfirm(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold active:scale-95 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Plan</span>
                  </button>
                  <button
                    onClick={() => setShowApprovalConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Recovery Plan</span>
                  </button>
                </>
              )}

              {isRejected && (
                <button
                  onClick={onProceedToPlanning}
                  disabled={isGeneratingPlan}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                    isGeneratingPlan
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isGeneratingPlan ? 'Re-planning with Constraints...' : 'Re-Plan with Alternative Constraints ➔'}</span>
                </button>
              )}

              {isApproved && (
                <button
                  onClick={onExecutePlan}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(0,240,255,0.3)] active:scale-95 transition-all animate-pulse"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Simulated Execution</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION E: EXECUTION RESULTS & SIMULATION GUARD
          ========================================================================= */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border transition-all ${
              isCompleted ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' :
              isExecuting ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400 animate-spin' :
              'bg-slate-900/80 border-slate-700/60 text-slate-400'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-cyan-400/90 tracking-widest uppercase">SECTION E</span>
                <span className="text-slate-600 font-mono">/</span>
                <h2 className="text-sm font-display font-bold text-white tracking-wider uppercase">
                  SIMULATED EXECUTION RESULTS & RECOVERY MONITOR
                </h2>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Step-by-step action dispatch audit with digital-twin verification metrics.
              </div>
            </div>
          </div>

          {/* Mandatory Simulation Badge */}
          <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold text-[9px] font-mono tracking-wider">
            SIMULATION ONLY — NO REAL PURCHASE ORDERS OR SHIPMENTS
          </span>
        </div>

        {/* Section Content */}
        <div className="p-4 space-y-4">
          {/* Recovery Monitor Verification Banner */}
          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-xs uppercase">
                    RECOVERY MONITOR AGENT: DATABASE-VERIFIED RECOVERY OUTCOME
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] uppercase font-mono ${
                    simulationState.verificationOutcome === 'Resolved'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                      : simulationState.verificationOutcome === 'Partially Resolved'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-red-500 text-white'
                  }`}>
                    {simulationState.verificationOutcome || 'Resolved'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                    SQLITE VERIFIED
                  </span>
                </div>
              </div>

              {/* Before vs After Telemetry */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">DEMAND COVERAGE</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-red-400 line-through text-[10px]">35%</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <strong className="text-emerald-300 text-xs">100.0%</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">RESIDUAL STOCKOUT RISK</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-red-400 line-through text-[10px]">Critical</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <strong className="text-emerald-300 text-xs">0.0% (Zero)</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">SLA COMPLIANCE</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-amber-400 line-through text-[10px]">83.2%</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <strong className="text-cyan-300 text-xs">91.6% Restored</strong>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">EXTERNAL COMMUNICATON</span>
                  <strong className="text-slate-300 text-xs block mt-0.5">ZERO Real Orders</strong>
                </div>
              </div>
            </div>
          )}

          {/* Planned Actions Sequence & Status Checklist */}
          {proposedPlan && proposedPlan.detailedActions && proposedPlan.detailedActions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                EXECUTED DISPATCH ACTIONS CHECKLIST:
              </div>

              <div className="space-y-1.5">
                {proposedPlan.detailedActions.map(action => (
                  <div
                    key={action.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-mono transition-all ${
                      action.executionStatus === 'verified'
                        ? 'bg-slate-900/80 border-emerald-500/40 text-slate-200'
                        : action.executionStatus === 'in_progress'
                        ? 'bg-cyan-950/40 border-cyan-400/60 text-white animate-pulse'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          action.executionStatus === 'verified'
                            ? 'bg-emerald-500 text-slate-950'
                            : action.executionStatus === 'in_progress'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {action.executionStatus === 'verified' ? '✓' : action.sequence}
                      </span>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{action.title}</span>
                          <span className="text-[10px] text-slate-500 font-normal">[{action.department}]</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                          {action.syntheticVerificationNote || action.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-purple-300 font-bold">{action.costUSD}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          action.executionStatus === 'verified'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : action.executionStatus === 'in_progress'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-400/40'
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
        </div>
      </section>

      {/* =========================================================================
          SECTION F: CHRONOLOGICAL AUDIT TIMELINE
          ========================================================================= */}
      <section className="rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-xl overflow-hidden backdrop-blur-md">
        {/* Section Header */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-900/80 border border-cyan-400/40 text-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-cyan-400/90 tracking-widest uppercase">SECTION F</span>
                <span className="text-slate-600 font-mono">/</span>
                <h2 className="text-sm font-display font-bold text-white tracking-wider uppercase">
                  IMMUTABLE AUDIT LOG & AGENT EVENT TRAIL ({auditTrail.length} EVENTS)
                </h2>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Timestamped chronological record of agent evaluations, policy gate triggers, and authorizations.
              </div>
            </div>
          </div>

          <button
            onClick={onResetDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white transition-all active:scale-95 text-xs font-mono"
            title="Reset to pristine baseline"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset Demo</span>
          </button>
        </div>

        {/* Section Content */}
        <div className="p-4">
          <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {auditTrail.length === 0 ? (
              <div className="text-center py-6 text-slate-500 font-sans">
                Audit log initialized. Operational events will append here as agents execute.
              </div>
            ) : (
              auditTrail.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-850 flex items-start justify-between gap-3 text-[11px] hover:bg-slate-900/90 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-bold">{entry.actor}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-white font-semibold">{entry.action}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                      {entry.details}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        entry.status === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : entry.status === 'REJECTED'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : entry.status === 'SECURITY_BLOCKED'
                          ? 'bg-red-950 text-red-300 border border-red-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {entry.status}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">{entry.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          CONFIRMATION MODALS (APPROVAL & REJECTION)
          ========================================================================= */}
      {showApprovalConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-950 border border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.3)] space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>CONFIRM WORKFLOW PLAN APPROVAL</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              You are authorizing the multi-agent recovery plan for <strong className="text-white">Apex Silicon Fab 4</strong>.
              This confirms the order diversion to {proposedPlan?.selectedAltSupplier || 'Tokyo Precision Optics'} and emergency air freight.
            </p>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Authorized Expedite Budget:</span>
                <span className="text-purple-300 font-bold">{proposedPlan?.estimatedTotalCostUSD || '$142,500'}</span>
              </div>
              <div className="flex justify-between">
                <span>Environment Guardrail:</span>
                <span className="text-emerald-400 font-bold">SIMULATION ONLY // ZERO REAL ORDERS</span>
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
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg active:scale-95 transition-all"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-950 border border-amber-500/70 shadow-[0_0_40px_rgba(245,158,11,0.3)] space-y-4">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>CONFIRM WORKFLOW REJECTION</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Rejecting the plan blocks execution and requires re-evaluating sourcing constraints.
            </p>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Rejection Rationale (Logged to Audit Trail):
              </label>
              <textarea
                value={rejectionInput}
                onChange={e => setRejectionInput(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-750 text-xs text-slate-200 focus:outline-none focus:border-amber-400 resize-none h-16 font-mono"
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
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg active:scale-95 transition-all"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
