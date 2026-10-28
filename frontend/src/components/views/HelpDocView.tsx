/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  HelpCircle,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Terminal,
  FileCode,
} from 'lucide-react';

export const HelpDocView: React.FC = () => {
  const steps = [
    { num: '1', title: 'Detect', desc: 'Autonomous telemetry monitors scan inventory burn rates, supplier EDI messages, weather alerts, and freight tracking to catch disruptions before line stoppage.' },
    { num: '2', title: 'Analyze', desc: 'Calculates operational and financial impact: exact inventory coverage runway, at-risk customer orders, and contract SLA line-down penalties.' },
    { num: '3', title: 'Coordinate', desc: 'Central Orchestrator dispatches 8 specialized domain agents (Supplier, Inventory, Logistics, Production, Order, Risk, Planning, Verification) to formulate feasible alternatives.' },
    { num: '4', title: 'Optimize', desc: 'Google OR-Tools Mixed-Integer Linear Programming (MILP) solver computes Pareto-optimal trade-offs across cost, lead time, and customer SLA priority.' },
    { num: '5', title: 'Approve', desc: 'Human Approval Center requires Operations Director authorization for high-impact plans (&gt;$25,000 spend) with immutable version-locked audit trails.' },
    { num: '6', title: 'Execute', desc: 'Commits transactional state changes: creates emergency supplier POs, books dedicated air/road freight, reallocates stock, and throttles lines.' },
    { num: '7', title: 'Verify', desc: 'Verification Agent directly re-queries live database records (inventory runway &gt;= 5d, 0 Tier 1 risks, assembly operational) to prove actual crisis resolution.' },
    { num: '8', title: 'Learn', desc: 'Records execution latency, supplier resilience delta, and updates dual-sourcing quotas to eliminate single-point-of-failure vulnerabilities.' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          Supply Chain X – Architecture & Operational Manual
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Complete engineering specification, multi-agent protocol, optimization mechanics, and end-to-end demo guide.
        </p>
      </div>

      {/* 8-Step Autonomous Workflow Breakdown */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          The 8-Stage Autonomous Recovery Lifecycle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {steps.map((st) => (
            <div key={st.num} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                  {st.num}
                </span>
                <span className="font-bold text-slate-900 text-sm">{st.title}</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed pt-1">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demonstration Scenario Guide */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-rose-600" />
          End-to-End Master Demonstration Scenario Walkthrough
        </h3>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 text-slate-700 leading-relaxed">
          <p>
            <strong>Disruption Setup:</strong> Critical semiconductor supplier <em>NanoSilicon Microelectronics (Taiwan)</em> experiences an abrupt 5-day nitrogen pipeline outage. Existing microcontroller MCU-9021 inventory at the Pacific Hub covers only <strong>2.0 days</strong> of assembly production (3,000 on hand vs 1,500 daily consumption).
          </p>
          <p>
            Two Tier 1 customer orders—<strong>AeroDrive Autonomous Systems ($300,000)</strong> and <strong>MedPulse Critical Care Robotics ($180,000)</strong>—face immediate line-down breach with severe contractual delay penalties ($50,000/day).
          </p>
          <div className="p-3 bg-blue-50/50 border border-blue-200 rounded text-blue-950 font-medium">
            <strong>Autonomous Recovery Execution:</strong>
            <ol className="list-decimal list-inside space-y-1 mt-1 text-[11px]">
              <li>Click <strong>"Launch Demo Crisis"</strong> in the top bar to inject the outage.</li>
              <li>Navigate to <strong>Crisis Monitoring</strong> and click <strong>"Run Multi-Agent AI Workflow"</strong>.</li>
              <li>Inspect findings from all 8 specialist agents in <strong>AI Agents</strong>.</li>
              <li>View Pareto trade-off curves and weight sliders in <strong>Recovery Optimization</strong>.</li>
              <li>Go to <strong>Approval Center</strong> to review the $52,800 package and authorize as Operations Director.</li>
              <li>In <strong>Execution & Verification</strong>, click <strong>"Execute Recovery Actions"</strong> to commit state changes.</li>
              <li>Review the <strong>5/5 passed verification proof checks</strong> directly re-queried from the database.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Predictive AI Intelligence & Simulation Sandbox Guide */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-600" />
          Proactive Predictive AI & What-If Stress Testing Engine
        </h3>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 text-slate-700 leading-relaxed">
          <p>
            <strong>Predictive Risk Architecture:</strong> Unlike reactive crisis management which waits for plant stoppages or stockouts, Supply Chain X employs forward-looking deterministic mathematical models combined with real-time operational feeds:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
            <li><strong>Supplier Vulnerability Matrix:</strong> Scores single-source concentration (40%), geopolitical straits exposure (20%), capacity stress (20%), historical lead time drift (10%), and maritime typhoons (10%).</li>
            <li><strong>30-Day Inventory Runway Forecasting:</strong> Models daily consumption trajectories, safety buffer breaches, and computes the exact hour-of-runout before stockouts occur.</li>
            <li><strong>Preemptive Inter-Warehouse Transfers:</strong> Automatically generates and executes reallocations (e.g. 1,800 units from Midwest to Pacific Hub) to prevent stockouts 48 hours in advance.</li>
            <li><strong>Autonomous What-If Sandbox:</strong> Allows operators to stress-test 1–14 day supplier outages, 0–72h maritime delays, demand surges, and assembly line throttles with real-time cascade ripple traces.</li>
          </ul>
        </div>
      </div>

      {/* REST API & Testing Reference */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-600" />
          REST API & Backend Verification Endpoints
        </h3>

        <div className="space-y-1 font-mono text-[11px]">
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-blue-600">GET /api/state</span>
            <span className="text-slate-500">Retrieves full transactional database state</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-indigo-600">GET /api/predictions</span>
            <span className="text-slate-500">Retrieves forward early warnings, supplier risk scores & stockout forecasts</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-indigo-600">POST /api/simulation/what-if</span>
            <span className="text-slate-500">Computes deterministic ripple cascade across 4 sandbox parameters</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-indigo-600">POST /api/predictions/prevent</span>
            <span className="text-slate-500">Executes preemptive inter-warehouse transfer before stockout breach</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-emerald-600">POST /api/demo/trigger</span>
            <span className="text-slate-500">Launches master Taiwan 5-day supplier outage scenario</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-emerald-600">POST /api/crises/:id/orchestrate</span>
            <span className="text-slate-500">Dispatches 8 agents, solves OR-Tools, generates Gemini summary</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-purple-600">POST /api/approval</span>
            <span className="text-slate-500">Authorizes recovery plan with version locking & manager sign-off</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-emerald-600">POST /api/execute</span>
            <span className="text-slate-500">Executes plan against database & runs post-action verification</span>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
            <span className="font-bold text-blue-600">POST /api/gemini/chat</span>
            <span className="text-slate-500">Authorized Q&A with Gemini 3.8 Flash using live database context</span>
          </div>
        </div>
      </div>
    </div>
  );
};
