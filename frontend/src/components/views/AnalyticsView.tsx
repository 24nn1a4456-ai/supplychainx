/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  ShieldCheck,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { DatabaseState } from '../../types.ts';

interface AnalyticsViewProps {
  state: DatabaseState;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state }) => {
  // Chart 1: MTTR Comparison (Manual Baseline vs Rules-based vs Supply Chain X)
  const mttrComparisonData = [
    { strategy: 'Manual Phone/Email', hours: 48.0, costPenalty: 520000 },
    { strategy: 'Static Rules Engine', hours: 18.5, costPenalty: 210000 },
    { strategy: 'Supply Chain X (Autonomous)', hours: 3.6, costPenalty: 52800 },
  ];

  // Chart 2: Order Fulfillment SLA Distribution by Tier
  const orderSlaData = [
    { tier: 'Tier 1 Critical', baseline: 65, supplyChainX: 100 },
    { tier: 'Tier 2 Strategic', baseline: 78, supplyChainX: 95 },
    { tier: 'Tier 3 Standard', baseline: 82, supplyChainX: 88 },
  ];

  // Chart 3: Weekly Recovery Cost vs Penalty Avoided (Cumulative)
  const roiTrends = [
    { week: 'Wk 1', recoveryCost: 12000, penaltyAverted: 110000 },
    { week: 'Wk 2', recoveryCost: 24000, penaltyAverted: 240000 },
    { week: 'Wk 3', recoveryCost: 38000, penaltyAverted: 390000 },
    { week: 'Wk 4 (Current)', recoveryCost: 52800, penaltyAverted: 520000 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Supply Chain Intelligence, Benchmarks & ROI Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical measurements comparing manual response, legacy rules-based systems, and Supply Chain X autonomous orchestration.
          </p>
        </div>
      </div>

      {/* Benchmark Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 font-medium">Mean Time to Recover (MTTR)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">3.6 Hours</div>
          <div className="text-emerald-600 font-semibold mt-0.5">92.5% faster than manual (48h)</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 font-medium">Contract Penalties Averted</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">$520,000</div>
          <div className="text-blue-600 font-semibold mt-0.5">Across 2 Tier 1 accounts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 font-medium">Net Recovery Investment</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">$52,800</div>
          <div className="text-slate-500 font-medium mt-0.5">Air charter + supplier delta</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 font-medium">Net ROI Multiplier</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">9.85x</div>
          <div className="text-emerald-600 font-semibold mt-0.5">$9.85 saved per $1 invested</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: MTTR Benchmark */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-semibold text-sm text-slate-900">MTTR Resolution Time Benchmark (Hours)</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Lower is better. Comparing detection-to-recovery latency.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mttrComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="strategy" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Hours`, 'Mean Time to Recover']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cumulative ROI */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-semibold text-sm text-slate-900">Financial Impact: Penalty Averted vs Recovery Spend</h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            Demonstrates net positive business case for active crisis management.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={roiTrends} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="penaltyAverted" name="Contract Penalties Averted" stroke="#10b981" strokeWidth={2.5} />
                <Line type="monotone" dataKey="recoveryCost" name="Recovery Budget Spent" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
