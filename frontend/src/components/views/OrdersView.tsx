/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShoppingCart, AlertCircle, CheckCircle, Clock, ShieldAlert, Search } from 'lucide-react';
import { DatabaseState, CustomerOrder } from '../../types.ts';

interface OrdersViewProps {
  state: DatabaseState;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ state }) => {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const filteredOrders = state.customerOrders.filter((o) => {
    const matchesSearch =
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === 'all' || o.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            Customer Demand & SLA Commitment Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor client order backlogs, prioritize Tier 1 critical contracts, and prevent contractual line-down penalties.
          </p>
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
            placeholder="Search order number or customer..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Contract Tier:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-medium"
          >
            <option value="all">All Tiers</option>
            <option value="Tier 1 Critical">Tier 1 Critical</option>
            <option value="Tier 2 Strategic">Tier 2 Strategic</option>
            <option value="Tier 3 Standard">Tier 3 Standard</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Order #</th>
                <th className="py-2.5 px-4">Customer Name & Destination</th>
                <th className="py-2.5 px-4">Tier</th>
                <th className="py-2.5 px-4">Items / Component Needs</th>
                <th className="py-2.5 px-4">Order Value</th>
                <th className="py-2.5 px-4">Delivery Deadline</th>
                <th className="py-2.5 px-4">Progress</th>
                <th className="py-2.5 px-4 text-right">Fulfillment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((ord) => {
                const isAtRisk = ord.fulfillmentStatus === 'at_risk';
                const isFulfilled = ord.fulfillmentStatus === 'fulfilled';

                return (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{ord.orderNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{ord.customerName}</div>
                      <div className="text-[11px] text-slate-400">{ord.destinationCity}, {ord.destinationCountry}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.tier === 'Tier 1 Critical'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : ord.tier === 'Tier 2 Strategic'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {ord.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="font-mono text-[11px]">
                            {item.quantity.toLocaleString()}x {item.sku}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ${ord.totalValue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {new Date(ord.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">17:00 UTC</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full ${
                            isAtRisk ? 'bg-rose-500' : isFulfilled ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${ord.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{ord.progressPercent}% complete</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isAtRisk ? (
                        <div className="inline-block text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                            <ShieldAlert className="w-3 h-3" />
                            At Risk of Penalty
                          </span>
                          {ord.riskReason && (
                            <div className="text-[10px] text-rose-600 max-w-xs mt-0.5 truncate" title={ord.riskReason}>
                              {ord.riskReason}
                            </div>
                          )}
                        </div>
                      ) : isFulfilled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          Fulfilled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" />
                          In Production
                        </span>
                      )}
                    </td>
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
