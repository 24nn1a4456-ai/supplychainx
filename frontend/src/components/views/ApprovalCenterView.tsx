/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Lock,
  Clock,
  UserCheck,
  DollarSign,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { DatabaseState, RecoveryPlan, UserRole } from '../../types.ts';
import { NavigationTab } from '../Sidebar.tsx';

interface ApprovalCenterViewProps {
  state: DatabaseState;
  onRefresh: () => void;
  onNavigate: (tab: NavigationTab) => void;
  userRole: UserRole;
}

export const ApprovalCenterView: React.FC<ApprovalCenterViewProps> = ({
  state,
  onRefresh,
  onNavigate,
  userRole,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    state.recoveryPlans[0]?.id || ''
  );
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plans = state.recoveryPlans;
  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const relatedCrisis = state.crises.find((c) => c.id === currentPlan?.incidentId);

  const isDirector = userRole === 'Operations Director';

  const handleDecision = async (decision: 'approved' | 'rejected' | 'changes_requested') => {
    if (!currentPlan) return;
    setIsSubmitting(true);

    try {
      await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.id,
          decision,
          managerName: userRole,
          managerRole: userRole,
          comments: comments || `Action marked as ${decision} by ${userRole}.`,
        }),
      });
      onRefresh();
      if (decision === 'approved') {
        onNavigate('execution_verification');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Human Approval Center & Governance Gate
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict human-in-the-loop authorization for high-impact financial commitments (&gt;$25,000) and production schedule shifts.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Active Sign-off Role:</span>
          <span className={`font-bold px-2 py-1 rounded border ${
            isDirector ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {userRole} {isDirector ? '(Sign-off Authorized)' : '(Review Only)'}
          </span>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-slate-800">No Recovery Plans Awaiting Approval</h3>
          <p className="mt-1">
            Trigger "Launch Demo Crisis" in the top bar to run multi-agent coordination and generate recovery plans.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Plan Selector Queue */}
          <div className="lg:col-span-1 space-y-2">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold text-slate-700">
              Pending Governance Reviews ({plans.length})
            </div>

            {plans.map((p) => {
              const isSelected = p.id === currentPlan?.id;
              const isApproved = p.approvalStatus === 'approved';
              const isRejected = p.approvalStatus === 'rejected';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`bg-white p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'border-purple-600 ring-2 ring-purple-600/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      VERSION v{p.planVersion}.0
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isRejected
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200 animate-pulse'
                      }`}
                    >
                      {p.approvalStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs text-slate-900 line-clamp-2">{p.title}</h4>
                  <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-600">
                    <span>${p.objectiveScores.totalRecoveryCost.toLocaleString()}</span>
                    <span>{p.objectiveScores.estimatedLeadTimeDays}d lead time</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Deep Plan Review & Decision Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              {/* Plan Header */}
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Plan Version v{currentPlan.planVersion}.0
                    </span>
                    <h3 className="font-bold text-base text-slate-900">{currentPlan.title}</h3>
                  </div>
                  {relatedCrisis && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Target Disruption: <strong>{relatedCrisis.incidentCode}</strong> ({relatedCrisis.title})
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-slate-900">
                    Est. Spend: ${currentPlan.objectiveScores.totalRecoveryCost.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">Policy Threshold: &gt;$25,000 Requires Sign-off</div>
                </div>
              </div>

              {/* Trade-Off Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold text-slate-900">Executive Summary: </span>
                {currentPlan.tradeOffSummary}
              </div>

              {/* Proposed Actions Checklist */}
              <div>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Action Package to Authorize
                </h4>
                <div className="space-y-1.5">
                  {currentPlan.proposedActions.map((act, idx) => (
                    <div
                      key={act.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">{act.description}</div>
                          <div className="text-[10px] text-slate-400">Target: {act.targetEntity}</div>
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-slate-800 text-xs shrink-0">
                        {act.estimatedCost > 0 ? `+$${act.estimatedCost.toLocaleString()}` : 'Buffer Throttle'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approval Decision Section */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Manager Review Comments & Compliance Audit Note
                  </label>
                  <textarea
                    rows={2}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Enter audit rationale for approval, risk sign-off, or requested modifications..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-purple-500 focus:bg-white"
                  />
                </div>

                {/* Audit Warning */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-purple-50/50 p-2.5 rounded-lg border border-purple-200">
                  <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    Backend Security Enforcement: Executions without active approved status and valid plan version lock are strictly rejected by the database transaction manager.
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecision('changes_requested')}
                      disabled={isSubmitting}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Request Changes</span>
                    </button>
                    <button
                      onClick={() => handleDecision('rejected')}
                      disabled={isSubmitting}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Plan</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDecision('approved')}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve & Authorize Execution</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
