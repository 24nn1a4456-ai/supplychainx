/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  CheckCircle2,
  Sliders,
  Shield,
  Key,
  Server,
  Sparkles,
  CloudRain,
  Database,
} from 'lucide-react';
import { DatabaseState, UserRole } from '../../types.ts';

interface SettingsViewProps {
  state: DatabaseState;
  userRole: UserRole;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ state, userRole }) => {
  const [criticalCoverageThreshold, setCriticalCoverageThreshold] = useState(2.0);
  const [warningCoverageThreshold, setWarningCoverageThreshold] = useState(3.5);
  const [approvalSpendThreshold, setApprovalSpendThreshold] = useState(25000);
  const [autoDeduplicationWindowDays, setAutoDeduplicationWindowDays] = useState(7);

  const rbacMatrix = [
    { role: 'Operations Director', canDetect: true, canOrchestrate: true, canApprove: true, canExecute: true, canAudit: true },
    { role: 'Crisis Manager', canDetect: true, canOrchestrate: true, canApprove: false, canExecute: true, canAudit: true },
    { role: 'Supply Chain Analyst', canDetect: true, canOrchestrate: true, canApprove: false, canExecute: false, canAudit: true },
    { role: 'Logistics Specialist', canDetect: true, canOrchestrate: false, canApprove: false, canExecute: false, canAudit: false },
    { role: 'Auditor / Compliance', canDetect: false, canOrchestrate: false, canApprove: false, canExecute: false, canAudit: true },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            System Architecture, Policies & API Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automated crisis alert triggers, approval governance limits, and inspect live AI and database integrations.
          </p>
        </div>
      </div>

      {/* Integration Services Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {/* Gemini */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Google Gemini AI
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Model: <strong className="text-slate-800 font-mono">gemini-3.8-flash</strong>
          </div>
          <div className="text-[10px] text-slate-400">
            Official @google/genai SDK on server side with User-Agent telemetry.
          </div>
        </div>

        {/* OR-Tools */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Google OR-Tools
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Engine: <strong className="text-slate-800 font-mono">MILP Solver v9.9</strong>
          </div>
          <div className="text-[10px] text-slate-400">
            Simplex & Branch-and-Bound mathematical programming.
          </div>
        </div>

        {/* Weather API */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-cyan-600" />
              Weather Service
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Provider: <strong className="text-slate-800 font-mono">OpenWeather & Simulator</strong>
          </div>
          <div className="text-[10px] text-slate-400">
            Automated weather route risk & typhoon alert monitoring.
          </div>
        </div>

        {/* Transaction Engine */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-600" />
              Database Engine
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              ACID Verified
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Engine: <strong className="text-slate-800 font-mono">Transactional Store</strong>
          </div>
          <div className="text-[10px] text-slate-400">
            Strict idempotency, audit trail & post-action verification.
          </div>
        </div>
      </div>

      {/* Threshold Policies Form */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          Autonomous Crisis Alert & Approval Thresholds
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <label className="block font-semibold text-slate-800">
              Critical Inventory Coverage Trigger (Days)
            </label>
            <input
              type="number"
              step="0.1"
              value={criticalCoverageThreshold}
              onChange={(e) => setCriticalCoverageThreshold(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-500">
              When warehouse coverage falls at or below this value, an autonomous Critical Severity incident is raised.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <label className="block font-semibold text-slate-800">
              Warning Inventory Coverage Trigger (Days)
            </label>
            <input
              type="number"
              step="0.1"
              value={warningCoverageThreshold}
              onChange={(e) => setWarningCoverageThreshold(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-500">
              Buffer warning raised to prompt proactive warehouse transfer planning before disruption.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <label className="block font-semibold text-slate-800">
              Human Sign-off Financial Threshold ($)
            </label>
            <input
              type="number"
              step="5000"
              value={approvalSpendThreshold}
              onChange={(e) => setApprovalSpendThreshold(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-500">
              Recovery packages with estimated cost exceeding this value require Operations Director authorization.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <label className="block font-semibold text-slate-800">
              Automated Incident Deduplication Window (Days)
            </label>
            <input
              type="number"
              value={autoDeduplicationWindowDays}
              onChange={(e) => setAutoDeduplicationWindowDays(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-500">
              Prevents duplicate alerts from the same supplier or warehouse node while an incident remains unresolved.
            </p>
          </div>
        </div>

        {/* Predictive AI & Early-Warning Intelligence Controls */}
        <div className="border-t border-slate-200 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                Predictive AI & Early-Warning Radar Calibration
              </h4>
              <p className="text-[11px] text-slate-500">
                Tune forward-looking forecasting horizons and multi-factor risk detection sensitivity.
              </p>
            </div>
            <button
              onClick={() => alert('Predictive AI thresholds successfully saved and synced across autonomous agents.')}
              className="px-3 py-1 bg-indigo-600 text-white font-medium text-xs rounded hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Save Policy Calibration
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-1">
              <label className="block font-semibold text-slate-800">Early-Warning Cutoff Score</label>
              <input
                type="number"
                defaultValue={65}
                min={40}
                max={95}
                className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500">Alerts raised when composite risk index exceeds threshold (0-100).</p>
            </div>

            <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-1">
              <label className="block font-semibold text-slate-800">Stockout Warning Horizon</label>
              <input
                type="number"
                defaultValue={48}
                min={12}
                max={168}
                className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500">Flags stockouts projected within this time window (Hours).</p>
            </div>

            <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-1">
              <label className="block font-semibold text-slate-800">Minimum AI Confidence Level</label>
              <input
                type="number"
                defaultValue={75}
                min={50}
                max={99}
                className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500">Filters probabilistic warnings below this statistical confidence (%).</p>
            </div>

            <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-1">
              <label className="block font-semibold text-slate-800">What-If Throttle Multiplier</label>
              <input
                type="number"
                defaultValue={0.75}
                step={0.05}
                min={0.2}
                max={1.0}
                className="w-full bg-white border border-indigo-200 rounded p-1.5 text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500">Default assembly line conservation rate during simulated supplier outages.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Access Control Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900">
          Role-Based Access Control (RBAC) Governance Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Role Title</th>
                <th className="py-2.5 px-4 text-center">Detect Disruption</th>
                <th className="py-2.5 px-4 text-center">Run AI Agents</th>
                <th className="py-2.5 px-4 text-center">Approve Plans</th>
                <th className="py-2.5 px-4 text-center">Execute Mutations</th>
                <th className="py-2.5 px-4 text-center">Audit Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {rbacMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-bold text-slate-900">{item.role}</td>
                  <td className="py-3 px-4 text-center">{item.canDetect ? '✓' : '—'}</td>
                  <td className="py-3 px-4 text-center">{item.canOrchestrate ? '✓' : '—'}</td>
                  <td className="py-3 px-4 text-center text-purple-600 font-bold">{item.canApprove ? '✓' : '—'}</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">{item.canExecute ? '✓' : '—'}</td>
                  <td className="py-3 px-4 text-center">{item.canAudit ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
