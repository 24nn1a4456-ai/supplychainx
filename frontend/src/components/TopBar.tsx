/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Flame,
  RotateCcw,
  Sparkles,
  UserCheck,
  Clock,
  Layers,
  Radar,
} from 'lucide-react';
import { DatabaseState, UserRole } from '../types.ts';

interface TopBarProps {
  state: DatabaseState;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onTriggerDemo: () => void;
  onResetDemo: () => void;
  onOpenGeminiAssistant: () => void;
  isTriggeringDemo: boolean;
  isResetting: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  state,
  userRole,
  onChangeRole,
  onTriggerDemo,
  onResetDemo,
  onOpenGeminiAssistant,
  isTriggeringDemo,
  isResetting,
}) => {
  const activeCrises = state.crises.filter((c) => c.status !== 'verified_resolved');
  const criticalCount = activeCrises.filter((c) => c.severity === 'Critical').length;
  const delayedShipments = state.shipments.filter((s) => s.delayHours > 0).length;
  const pendingApprovals = state.recoveryPlans.filter((p) => p.approvalStatus === 'pending').length;

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 shadow-xs z-10">
      {/* Left: Global Operational Telemetry Pills */}
      <div className="flex items-center gap-3">
        {/* Active Crises Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
            criticalCount > 0
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : activeCrises.length > 0
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              criticalCount > 0
                ? 'bg-rose-500 animate-ping'
                : activeCrises.length > 0
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          <span className="font-semibold">
            {activeCrises.length === 0
              ? 'Supply Chain Nominal'
              : `${activeCrises.length} Active Crisis (${criticalCount} Critical)`}
          </span>
        </div>

        {/* Delayed Shipments Pill */}
        {delayedShipments > 0 && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700">
            <span className="font-mono font-bold">{delayedShipments}</span> Delayed Shipments
          </div>
        )}

        {/* Pending Approvals Alert Pill */}
        {pendingApprovals > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 border border-purple-200 text-purple-700 animate-pulse">
            <span className="font-mono font-bold">{pendingApprovals}</span> Plan Sign-offs Awaiting
          </div>
        )}

        {/* Early-Warning Radar Pill */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700">
          <Radar className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>Early-Warning Radar: <strong className="font-mono">4 Risks</strong></span>
        </div>
      </div>

      {/* Right Controls: Demo Triggers, Role, AI Assistant */}
      <div className="flex items-center gap-2.5">
        {/* Launch Demo Crisis Button */}
        <button
          onClick={onTriggerDemo}
          disabled={isTriggeringDemo}
          title="Simulate 5-day NanoSilicon chip supplier outage with 2-day inventory coverage"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{isTriggeringDemo ? 'Injecting Disruption...' : 'Launch Demo Crisis'}</span>
        </button>

        {/* Reset Dataset Button */}
        <button
          onClick={onResetDemo}
          disabled={isResetting}
          title="Reset all database records to clean baseline state"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Reset State</span>
        </button>

        {/* Role Switcher */}
        <div className="relative flex items-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium hidden sm:inline text-slate-500">Role:</span>
            <select
              value={userRole}
              onChange={(e) => onChangeRole(e.target.value as UserRole)}
              className="bg-transparent font-semibold text-slate-900 border-none outline-hidden cursor-pointer"
            >
              <option value="Operations Director">Operations Director (Sign-off Auth)</option>
              <option value="Crisis Manager">Crisis Manager</option>
              <option value="Supply Chain Analyst">Supply Chain Analyst</option>
              <option value="Logistics Specialist">Logistics Specialist</option>
              <option value="Auditor / Compliance">Auditor / Compliance</option>
            </select>
          </div>
        </div>

        {/* Gemini AI Assistant Drawer Button */}
        <button
          onClick={onOpenGeminiAssistant}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
          <span>Gemini AI Co-Pilot</span>
        </button>
      </div>
    </header>
  );
};
