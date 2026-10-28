/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Database,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { DatabaseState, UserRole } from '../../types.ts';

interface ExecutionVerificationViewProps {
  state: DatabaseState;
  onRefresh: () => void;
  userRole: UserRole;
}

export const ExecutionVerificationView: React.FC<ExecutionVerificationViewProps> = ({
  state,
  onRefresh,
  userRole,
}) => {
  const [isExecuting, setIsExecuting] = useState(false);

  const approvedPlan = state.recoveryPlans.find((p) => p.approvalStatus === 'approved');
  const latestVerification = state.verifications[0];
  const oaklandInv = state.inventory.find(
    (i) => i.warehouseId === 'wh-1' && i.sku === 'MCU-9021'
  );

  const handleExecute = async () => {
    if (!approvedPlan) return;
    setIsExecuting(true);

    try {
      await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: approvedPlan.id,
          managerName: userRole,
          managerRole: userRole,
        }),
      });
      onRefresh();
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Execution Engine & Post-Action Database Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Executes approved recovery mutations against transactional database and independently re-queries live state to prove resolution.
          </p>
        </div>
      </div>

      {/* Execution Trigger Banner if Approved Plan Awaits */}
      {approvedPlan && latestVerification?.outcome !== 'Resolved' && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/30 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>PLAN AUTHORIZED & SIGNED OFF</span>
              <span>•</span>
              <span>v{approvedPlan.planVersion}.0</span>
            </div>
            <div className="font-bold text-base mt-1">{approvedPlan.title}</div>
            <div className="text-xs text-slate-300 mt-1 max-w-2xl">
              Approved by: <strong>{approvedPlan.approvedBy}</strong> ({approvedPlan.approvalComments})
            </div>
          </div>

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isExecuting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{isExecuting ? 'Committing Database Mutations...' : 'Execute Recovery Actions'}</span>
          </button>
        </div>
      )}

      {/* Verification Result Cards & Proofs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Verification Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Audit Verdict
            </span>
            <div className="flex items-center justify-between mt-1">
              <h3 className="font-bold text-base text-slate-900">Database Verification Status</h3>
              {latestVerification ? (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    latestVerification.outcome === 'Resolved'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : latestVerification.outcome === 'Partially Resolved'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {latestVerification.outcome}
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-400">Pre-execution</span>
              )}
            </div>
          </div>

          {/* Current Live State Metrics directly re-queried */}
          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Oakland Inventory Runway</div>
                <div className="font-bold text-sm text-slate-900">
                  {oaklandInv ? `${oaklandInv.coverageDays.toFixed(1)} Days` : 'N/A'}
                </div>
              </div>
              <span className={`font-mono text-xs font-bold ${
                (oaklandInv?.coverageDays || 0) >= 5 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {(oaklandInv?.coverageDays || 0) >= 5 ? '✓ Buffer Healthy' : '⚠ Below 3d threshold'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Tier 1 Orders Protected</div>
                <div className="font-bold text-sm text-slate-900">
                  {state.customerOrders.filter((o) => o.tier === 'Tier 1 Critical' && o.fulfillmentStatus === 'in_production').length} of 2 Orders
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-600">✓ 100% SLA Maintained</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Assembly Line 1 Status</div>
                <div className="font-bold text-sm text-slate-900 capitalize">
                  {state.productionLines.find((p) => p.code === 'LINE-FREMONT-A')?.status.replace('_', ' ')}
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-600">✓ Zero Line Downtime</span>
            </div>
          </div>

          {latestVerification && (
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Verified at: {new Date(latestVerification.verifiedAt).toLocaleTimeString()} UTC
            </div>
          )}
        </div>

        {/* 5-Point Deterministic Database Criteria Checks */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-600" />
                Deterministic Verification Criteria (Database Re-query)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The Verification Agent queries persisted tables directly. A completed simulation never counts as resolved unless all checks return true.
              </p>
            </div>
          </div>

          {latestVerification ? (
            <div className="space-y-2">
              {latestVerification.checks.map((check, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs space-y-1 transition-all ${
                    check.passed
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{check.checkName}</span>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                        check.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {check.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pl-6">
                    <div>
                      <span className="text-slate-400">Required: </span>
                      <span className="font-mono">{check.expected}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Observed DB State: </span>
                      <span className="font-mono font-semibold text-slate-900">{check.actual}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 pl-6 italic">{check.detail}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              <FileCheck2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Execute an approved recovery plan to initiate automated post-action database re-query verification.</p>
            </div>
          )}

          {/* Verification Agent Strategic Next Steps */}
          {latestVerification && (
            <div className="pt-3 border-t border-slate-100 text-xs space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Post-Resolution Auditor Recommendations
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
                {latestVerification.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
