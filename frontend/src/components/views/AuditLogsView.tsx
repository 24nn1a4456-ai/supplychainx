/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ScrollText, Search, Filter, ShieldCheck, Download } from 'lucide-react';
import { DatabaseState, AuditLog } from '../../types.ts';

interface AuditLogsViewProps {
  state: DatabaseState;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ state }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredLogs = state.auditLogs.filter((log) => {
    const matchesSearch =
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-slate-700" />
            Immutable Audit Trail & Compliance Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically timestamped operational trace of all crisis detections, multi-agent decisions, manager sign-offs, and database mutations.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Total Audit Records: </span>
          <strong className="text-slate-900">{state.auditLogs.length}</strong>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 text-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by actor, action, or keyword..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-medium"
          >
            <option value="all">All Categories</option>
            <option value="crisis">Crisis Detection</option>
            <option value="agent">Agent Orchestration</option>
            <option value="optimization">Optimization</option>
            <option value="approval">Human Approval</option>
            <option value="execution">Execution</option>
            <option value="verification">Verification</option>
            <option value="data_mutation">Data Mutation</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Action Code</th>
                <th className="py-2.5 px-4">Event Details & State Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredLogs.map((log) => {
                const isApproval = log.category === 'approval';
                const isExecution = log.category === 'execution';
                const isCrisis = log.category === 'crisis';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{log.actor}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{log.role}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isApproval
                            ? 'bg-purple-100 text-purple-700'
                            : isExecution
                            ? 'bg-emerald-100 text-emerald-700'
                            : isCrisis
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">{log.action}</td>
                    <td className="py-3 px-4 font-sans text-xs text-slate-700 max-w-md">{log.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
