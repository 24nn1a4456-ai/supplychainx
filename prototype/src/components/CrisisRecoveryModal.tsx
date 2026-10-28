import React, { useState } from 'react';
import type { CrisisPlaybook, SupplyNode } from '../types/supplyChain';
import { ShieldAlert, CheckCircle2, Play, ArrowRight, Zap, X, ShieldCheck } from 'lucide-react';

interface CrisisRecoveryModalProps {
  playbooks: CrisisPlaybook[];
  nodes: SupplyNode[];
  selectedPlaybookId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onExecutePlaybook: (playbookId: string) => void;
}

export const CrisisRecoveryModal: React.FC<CrisisRecoveryModalProps> = ({
  playbooks,
  nodes,
  selectedPlaybookId,
  isOpen,
  onClose,
  onExecutePlaybook
}) => {
  const [activeId, setActiveId] = useState<string>(selectedPlaybookId || playbooks[0]?.id || '');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionSuccess, setExecutionSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPlaybook = playbooks.find(p => p.id === activeId) || playbooks[0];
  const nodeMap = new Map<string, SupplyNode>(nodes.map(n => [n.id, n]));
  const targetNode = nodeMap.get(currentPlaybook?.targetNodeId);
  const altNode = nodeMap.get(currentPlaybook?.alternateNodeId);

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setExecutionSuccess(true);
      onExecutePlaybook(currentPlaybook.id);
      setTimeout(() => {
        setExecutionSuccess(false);
      }, 3500);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 bg-slate-900/90 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-mono font-bold tracking-wider text-cyan-300 uppercase">
                CRISIS RECOVERY ACTION PROTOCOL
              </h2>
              <div className="text-[10px] font-mono text-slate-400">
                DYNAMIC CONTINGENCY PLAYBOOKS // SIMULATION TESTBED
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-[10px] font-mono text-emerald-300">
              SAFE SANDBOX
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1 font-mono">
          {/* Playbook Selector Tabs */}
          <div className="flex gap-2">
            {playbooks.map(pb => (
              <button
                key={pb.id}
                onClick={() => {
                  setActiveId(pb.id);
                  setExecutionSuccess(false);
                }}
                className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                  activeId === pb.id
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1">
                  {pb.id === 'playbook-apex-divert' ? 'CRITICAL PRIORITY' : 'REGIONAL BYPASS'}
                </div>
                <div className="text-xs font-bold text-white leading-tight">{pb.title}</div>
                {pb.executed && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> EXECUTED
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active Playbook Overview */}
          {currentPlaybook && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Trigger Anomaly</div>
                <div className="text-sm font-bold text-red-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{currentPlaybook.triggerCondition}</span>
                </div>
              </div>

              {/* Reroute Node Path Visualization */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-cyan-500/30 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">Disrupted Node:</div>
                  <div className="text-red-300 font-bold">{targetNode?.name || 'Target Node'}</div>
                  <div className="text-[10px] text-slate-500">{targetNode?.location}</div>
                </div>

                <div className="flex flex-col items-center px-4">
                  <span className="text-[10px] text-cyan-400 font-bold animate-pulse">AUTONOMOUS DIVERSION</span>
                  <div className="flex items-center text-cyan-400 my-1">
                    <span className="w-8 h-0.5 bg-cyan-400 inline-block" />
                    <ArrowRight className="w-4 h-4 ml-[-2px]" />
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">+{currentPlaybook.impactMetrics.reroutedTEU} TEU</span>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 mb-0.5">Contingency Backup:</div>
                  <div className="text-emerald-300 font-bold">{altNode?.name || 'Alternate Node'}</div>
                  <div className="text-[10px] text-slate-500">{altNode?.location}</div>
                </div>
              </div>

              {/* Simulation Impact Metrics */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  SIMULATED RECOVERY IMPACT
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-center">
                    <div className="text-[10px] text-slate-400 mb-1">SLA RECOVERY</div>
                    <div className="text-base font-bold text-emerald-400">
                      +{currentPlaybook.impactMetrics.slaRecoveryPct}%
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/30 text-center">
                    <div className="text-[10px] text-slate-400 mb-1">LATENCY REDUCTION</div>
                    <div className="text-base font-bold text-blue-400">
                      -{currentPlaybook.impactMetrics.delayReductionHours} Hours
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-500/30 text-center">
                    <div className="text-[10px] text-slate-400 mb-1">ESTIMATED EXPEDITE</div>
                    <div className="text-base font-bold text-purple-300">
                      {currentPlaybook.impactMetrics.costImpactUSD}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Steps */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  MITIGATION EXECUTION STEPS
                </h4>
                <div className="space-y-2">
                  {currentPlaybook.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300"
                    >
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-400/50 text-[10px] font-bold text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Success Notification */}
          {executionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-400/80 text-emerald-200 text-xs flex items-center gap-2 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold">Playbook Executed Successfully!</div>
                <div className="text-[11px] text-emerald-300/80">
                  Supply routes diverted. Resiliency Index updated to 86.2%. Zero real-world transactions performed.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900/90 border-t border-cyan-500/30 flex items-center justify-between font-mono">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Telemetry will automatically recalculate downstream SLA.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all"
            >
              Dismiss
            </button>
            <button
              onClick={handleExecute}
              disabled={isExecuting || currentPlaybook?.executed}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-lg active:scale-95 ${
                currentPlaybook?.executed
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : isExecuting
                  ? 'bg-cyan-700 cursor-wait'
                  : 'bg-gradient-to-r from-red-600 to-cyan-600 hover:from-red-500 hover:to-cyan-500 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
              }`}
            >
              {isExecuting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Transmitting Playbook...</span>
                </>
              ) : currentPlaybook?.executed ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Playbook Already Active</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Execute Crisis Playbook</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
