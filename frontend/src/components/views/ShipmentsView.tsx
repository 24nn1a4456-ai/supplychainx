/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Truck, CloudRain, AlertTriangle, CheckCircle, Clock, Plane, Ship } from 'lucide-react';
import { DatabaseState, Shipment } from '../../types.ts';

interface ShipmentsViewProps {
  state: DatabaseState;
}

export const ShipmentsView: React.FC<ShipmentsViewProps> = ({ state }) => {
  const [modeFilter, setModeFilter] = useState('all');

  const filteredShipments = state.shipments.filter(
    (s) => modeFilter === 'all' || s.transportMode === modeFilter
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-600" />
            Global Shipments & Multi-Modal Freight Operations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active tracking for international ocean vessels, priority air charters, and interstate dedicated freight teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Mode:</span>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 font-medium"
          >
            <option value="all">All Modes</option>
            <option value="Ocean Cargo">Ocean Cargo</option>
            <option value="Air Freight">Air Freight</option>
            <option value="Express Road">Express Road</option>
          </select>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Tracking #</th>
                <th className="py-2.5 px-4">Carrier & Mode</th>
                <th className="py-2.5 px-4">Origin & Destination</th>
                <th className="py-2.5 px-4">Cargo Contents</th>
                <th className="py-2.5 px-4">Departed</th>
                <th className="py-2.5 px-4">Expected Arrival (ETA)</th>
                <th className="py-2.5 px-4">Delay Status</th>
                <th className="py-2.5 px-4 text-right">Weather Advisory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShipments.map((ship) => {
                const isDelayed = ship.delayHours > 0;

                return (
                  <tr key={ship.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{ship.trackingNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        {ship.transportMode === 'Air Freight' ? (
                          <Plane className="w-3.5 h-3.5 text-blue-600" />
                        ) : ship.transportMode === 'Ocean Cargo' ? (
                          <Ship className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{ship.transportMode}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{ship.carrier}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{ship.originName}</div>
                      <div className="text-[11px] text-slate-400">→ {ship.destName}</div>
                    </td>
                    <td className="py-3 px-4">
                      {ship.items.map((it, idx) => (
                        <div key={idx} className="font-mono text-[11px] text-slate-800">
                          {it.quantity.toLocaleString()}x {it.sku}
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Value: ${ship.cargoValue.toLocaleString()} | Freight: ${ship.transportCost.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(ship.departedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {new Date(ship.estimatedArrival).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {isDelayed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                          <Clock className="w-3 h-3" />
                          +{ship.delayHours}h Delayed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          On Schedule
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ship.weatherRiskAlert ? (
                        <div className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 max-w-xs text-left">
                          <CloudRain className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{ship.weatherRiskAlert}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Clear Routing</span>
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
