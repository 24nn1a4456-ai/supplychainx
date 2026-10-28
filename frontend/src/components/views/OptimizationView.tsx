/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Info,
} from 'lucide-react';
import { DatabaseState, RecoveryPlan } from '../../types.ts';
import { NavigationTab } from '../Sidebar.tsx';

interface OptimizationViewProps {
  state: DatabaseState;
  onRefresh: () => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const OptimizationView: React.FC<OptimizationViewProps> = ({
  state,
  onRefresh,
  onNavigate,
}) => {
  const [costWeight, setCostWeight] = useState(0.35);
  const [speedWeight, setSpeedWeight] = useState(0.4);
  const [serviceWeight, setServiceWeight] = useState(0.25);
  const [isSolving, setIsSolving] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    state.recoveryPlans[0]?.id || 'plan-hybrid-optimal'
  );

  const plans = state.recoveryPlans.length > 0 ? state.recoveryPlans : [];

  const handleReSolve = async () => {
    setIsSolving(true);
    try {
      const activeCrisis = state.crises.find((c) => c.status !== 'verified_resolved') || state.crises[0];
      await fetch('/api/optimizer/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: activeCrisis?.id,
          weights: { costWeight, speedWeight, serviceWeight },
        }),
      });
      onRefresh();
    } finally {
      setIsSolving(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Google OR-Tools Multi-Criteria Optimization Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mixed-Integer Linear Programming (MILP) solver balancing total recovery cost, time-to-relief, and customer SLA fulfillment.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg">
          <Zap className="w-3.5 h-3.5 text-indigo-600" />
          <span>Solver: OR-Tools MILP v9.9 (Simplex + Branch-and-Bound)</span>
        </div>
      </div>

      {/* Solver Weights Configuration Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            Objective Weight Configuration (Sum = {(costWeight + speedWeight + serviceWeight).toFixed(2)})
          </h3>

          <button
            onClick={handleReSolve}
            disabled={isSolving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSolving ? 'animate-spin' : ''}`} />
            <span>{isSolving ? 'Solving MILP Formulation...' : 'Re-Solve Pareto Frontier'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Slider 1: Cost Weight */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-medium">
              <span className="text-slate-700 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Cost Minimization Weight
              </span>
              <span className="font-mono font-bold text-slate-900">{costWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={costWeight}
              onChange={(e) => setCostWeight(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Penalizes expensive air freight charters & vendor premiums</div>
          </div>

          {/* Slider 2: Speed / Lead Time Weight */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-medium">
              <span className="text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Speed / Lead Time Weight
              </span>
              <span className="font-mono font-bold text-slate-900">{speedWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={speedWeight}
              onChange={(e) => setSpeedWeight(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Favors rapid 36-hour relief over slower surface rail routes</div>
          </div>

          {/* Slider 3: Service Priority Weight */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex justify-between font-medium">
              <span className="text-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                Customer SLA Priority Weight
              </span>
              <span className="font-mono font-bold text-slate-900">{serviceWeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={serviceWeight}
              onChange={(e) => setServiceWeight(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400">Hard guarantees Tier 1 customer fulfillment & zero downtime</div>
          </div>
        </div>
      </div>

      {/* Candidate Recovery Plans Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p, idx) => {
          const isSelected = selectedPlan?.id === p.id;
          const isTopOptimal = idx === 0;

          return (
            <div
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">
                    Option {String.fromCharCode(65 + idx)}
                  </span>
                  {isTopOptimal && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Highest Pareto
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-xs text-slate-900 line-clamp-2">{p.title}</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{p.tradeOffSummary}</p>

                {/* Score Indicators */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Recovery Cost</div>
                    <div className="font-mono font-bold text-slate-900">
                      ${p.objectiveScores.totalRecoveryCost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Lead Time</div>
                    <div className="font-mono font-bold text-slate-900">
                      {p.objectiveScores.estimatedLeadTimeDays} Days
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Service Level</div>
                    <div className="font-mono font-bold text-emerald-600">
                      {p.objectiveScores.serviceLevelScore}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Feasibility</div>
                    <div className="font-mono font-bold text-blue-600">
                      {p.objectiveScores.feasibilityIndex}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{p.proposedActions.length} Actions</span>
                <span className="font-semibold text-indigo-600">Inspect Plan →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Plan Deep-Dive Breakdown */}
      {selectedPlan && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {selectedPlan.strategyType.replace('_', ' ').toUpperCase()}
                </span>
                <h3 className="font-bold text-base text-slate-900">{selectedPlan.title}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">{selectedPlan.tradeOffSummary}</p>
            </div>

            <button
              onClick={() => onNavigate('approval_center')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-2 cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Forward to Approval Center</span>
            </button>
          </div>

          {/* Gemini AI Plan Assessment */}
          {selectedPlan.geminiExplanation && (
            <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs text-slate-800 space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Gemini AI Optimization Reasoning & Trade-Off Synthesis
              </div>
              <div className="whitespace-pre-line leading-relaxed text-slate-700">
                {selectedPlan.geminiExplanation}
              </div>
            </div>
          )}

          {/* Action List Grid */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
              Proposed Autonomous Action Package ({selectedPlan.proposedActions.length} Actions)
            </h4>
            <div className="space-y-2">
              {selectedPlan.proposedActions.map((act, idx) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-900">{act.description}</div>
                      <div className="text-[11px] text-slate-500">Target Entity: {act.targetEntity}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {act.estimatedCost > 0 ? `+$${act.estimatedCost.toLocaleString()}` : 'No Direct Cost'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono capitalize bg-white border border-slate-300 text-slate-700">
                      {act.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pros vs Cons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg text-xs space-y-1.5">
              <div className="font-bold text-emerald-900 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Key Strategic Advantages (Pros)
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                {selectedPlan.pros.map((pro, idx) => (
                  <li key={idx}>{pro}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-rose-50/40 border border-rose-200 rounded-lg text-xs space-y-1.5">
              <div className="font-bold text-rose-900 flex items-center gap-1">
                <XCircle className="w-4 h-4 text-rose-600" />
                Operational Trade-Offs (Cons)
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                {selectedPlan.cons.map((con, idx) => (
                  <li key={idx}>{con}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
