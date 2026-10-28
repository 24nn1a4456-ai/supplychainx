/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bot,
  Building2,
  Boxes,
  Truck,
  Factory,
  ShoppingCart,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { DatabaseState, AgentRun } from '../../types.ts';

interface AIAgentsViewProps {
  state: DatabaseState;
}

export const AIAgentsView: React.FC<AIAgentsViewProps> = ({ state }) => {
  const [selectedAgentName, setSelectedAgentName] = useState<string>('Central Orchestrator');

  const agentsList = [
    {
      name: 'Central Orchestrator',
      role: 'Workflow State Machine & Agent Synchronization',
      icon: Cpu,
      color: 'bg-indigo-600',
      badge: 'Orchestrator',
      description: 'Coordinates sequential and parallel execution of all 8 specialized agents, aggregates structured findings, triggers OR-Tools, and requests Gemini summaries.',
    },
    {
      name: 'Supplier Agent',
      role: 'Multi-Sourcing & Sourcing Reliability',
      icon: Building2,
      color: 'bg-blue-600',
      badge: 'Specialist',
      description: 'Finds alternative suppliers, checks real capacity, unit pricing differential, lead time, and ISO/automotive component compatibility.',
    },
    {
      name: 'Inventory Agent',
      role: 'Global Multi-Echelon Stock Velocity',
      icon: Boxes,
      color: 'bg-amber-600',
      badge: 'Specialist',
      description: 'Scans all distribution centers, calculates days of coverage, and identifies feasible cross-dock transfers.',
    },
    {
      name: 'Logistics Agent',
      role: 'Freight Carrier Routing & Weather Defense',
      icon: Truck,
      color: 'bg-cyan-600',
      badge: 'Specialist',
      description: 'Compares air charter, ocean cargo, and dedicated road express. Evaluates transit times and weather routing hazards.',
    },
    {
      name: 'Production Agent',
      role: 'Manufacturing BOM & Capacity Balancing',
      icon: Factory,
      color: 'bg-emerald-600',
      badge: 'Specialist',
      description: 'Calculates factory line run-rates, shifts bottlenecks, and formulates shift throttling to preserve raw material buffer.',
    },
    {
      name: 'Demand & Order Agent',
      role: 'Customer Priority & SLA Allocation',
      icon: ShoppingCart,
      color: 'bg-purple-600',
      badge: 'Specialist',
      description: 'Protects Tier 1 contract SLAs (AeroDrive, MedPulse) and defers non-critical orders to prevent contractual default penalties.',
    },
    {
      name: 'Risk Analysis Agent',
      role: 'Financial & Operational Exposure Modeling',
      icon: ShieldAlert,
      color: 'bg-rose-600',
      badge: 'Specialist',
      description: 'Evaluates financial exposure of inaction ($520k) vs recovery spend ($52.8k), providing ROI validation for executives.',
    },
    {
      name: 'Recovery Planning Agent',
      role: 'Strategy Synthesis & Action Formulation',
      icon: Sliders,
      color: 'bg-indigo-500',
      badge: 'Specialist',
      description: 'Combines specialist findings into candidate recovery strategies for the OR-Tools optimization engine.',
    },
    {
      name: 'Verification Agent',
      role: 'Database State Proof & Criteria Auditing',
      icon: CheckCircle2,
      color: 'bg-teal-600',
      badge: 'Specialist',
      description: 'Formulates explicit criteria checks and re-queries the persistent database post-execution to declare true resolution.',
    },
  ];

  const selectedRuns = state.agentRuns.filter((r) => r.agentName === selectedAgentName);
  const activeRun = selectedRuns[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            Specialized Multi-Agent AI System Architecture
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Decentralized domain agents operating against real application database state with full reasoning traceability.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-slate-500">
            Total Agent Runs Logged: <strong className="text-slate-900">{state.agentRuns.length}</strong>
          </span>
        </div>
      </div>

      {/* Grid: 8 Agents Cards + Agent Trace Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Agents Roster */}
        <div className="lg:col-span-1 space-y-2">
          {agentsList.map((agent) => {
            const Icon = agent.icon;
            const isSelected = selectedAgentName === agent.name;
            const run = state.agentRuns.find((r) => r.agentName === agent.name);

            return (
              <div
                key={agent.name}
                onClick={() => setSelectedAgentName(agent.name)}
                className={`bg-white p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs flex items-center justify-between ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg ${agent.color} text-white flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                      <span>{agent.name}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                        {agent.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{agent.role}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {run ? (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {run.executionTimeMs}ms
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">Idle</span>
                  )}
                  <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Agent Trace & Structured Reasoning Inspector */}
        <div className="lg:col-span-2">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            {/* Agent Header */}
            <div className="border-b border-slate-100 pb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-900">{selectedAgentName}</h3>
                  <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                    Verified Execution
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {agentsList.find((a) => a.name === selectedAgentName)?.description}
                </p>
              </div>

              {activeRun && (
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-slate-900">
                    Execution Time: {activeRun.executionTimeMs} ms
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {new Date(activeRun.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              )}
            </div>

            {activeRun ? (
              <div className="space-y-4 text-xs">
                {/* Agent Reasoning */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Autonomous Reasoning Trace
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-sans whitespace-pre-line">
                    {activeRun.reasoning}
                  </div>
                </div>

                {/* Structured Findings JSON */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Structured Domain Findings
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto max-h-56 scrollbar-thin">
                    {JSON.stringify(activeRun.findings, null, 2)}
                  </pre>
                </div>

                {/* Recommendations */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Agent Action Recommendations
                  </div>
                  <div className="space-y-1.5">
                    {activeRun.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-lg text-indigo-950 font-medium text-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <div>{rec}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No execution trace logged for this agent yet.</p>
                <p className="mt-1">
                  Run "Launch Demo Crisis" or trigger "Run Detection Cycle" in Crisis Monitoring to activate multi-agent orchestration.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
