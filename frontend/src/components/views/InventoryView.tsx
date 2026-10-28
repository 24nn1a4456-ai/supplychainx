/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Boxes,
  ArrowRightLeft,
  AlertTriangle,
  Search,
  CheckCircle2,
  TrendingDown,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import { DatabaseState, InventoryItem, Warehouse } from '../../types.ts';

interface InventoryViewProps {
  state: DatabaseState;
  onRefresh: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ state, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Transfer form state
  const [transferSku, setTransferSku] = useState('MCU-9021');
  const [sourceWhId, setSourceWhId] = useState('wh-2'); // Chicago
  const [destWhId, setDestWhId] = useState('wh-1'); // Oakland
  const [transferQuantity, setTransferQuantity] = useState(1500);

  const filteredInventory = state.inventory.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      item.warehouseName.toLowerCase().includes(search.toLowerCase());

    const matchesWh = selectedWarehouse === 'all' || item.warehouseId === selectedWarehouse;
    return matchesSearch && matchesWh;
  });

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate or post transfer
    const sourceInv = state.inventory.find((i) => i.warehouseId === sourceWhId && i.sku === transferSku);
    if (!sourceInv || sourceInv.availableQuantity < transferQuantity) {
      alert(`Insufficient available stock in source warehouse (${sourceInv?.availableQuantity || 0} available).`);
      return;
    }

    // Call execution or mutate via API
    await fetch('/api/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: state.recoveryPlans[0]?.id || 'manual-transfer',
        decision: 'approved',
        managerName: 'Operations Director',
        managerRole: 'Crisis Manager',
        comments: `Manual Transfer Authorization: ${transferQuantity}x ${transferSku} from ${sourceWhId} to ${destWhId}`,
      }),
    });

    setIsTransferModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-600" />
            Global Warehouse Inventory & Velocity Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-echelon stock levels, dynamic burn rate calculation, and automated coverage buffer warnings.
          </p>
        </div>

        <button
          onClick={() => setIsTransferModalOpen(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Inter-Warehouse Transfer</span>
        </button>
      </div>

      {/* Warehouse Utilization Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {state.warehouses.map((wh) => {
          const utilPct = Math.round((wh.utilizedUnits / wh.capacityUnits) * 100);
          const hasCriticalItem = state.inventory.some(
            (i) => i.warehouseId === wh.id && i.coverageDays <= 2.5
          );

          return (
            <div
              key={wh.id}
              onClick={() => setSelectedWarehouse(selectedWarehouse === wh.id ? 'all' : wh.id)}
              className={`bg-white p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedWarehouse === wh.id
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-bold text-slate-900">{wh.code}</span>
                {hasCriticalItem ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    Stockout Risk
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Nominal
                  </span>
                )}
              </div>
              <div className="font-semibold text-xs text-slate-800 truncate">{wh.name}</div>
              <div className="text-[11px] text-slate-400">{wh.city}, {wh.country}</div>

              {/* Capacity Progress Bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Capacity: {wh.utilizedUnits.toLocaleString()} / {wh.capacityUnits.toLocaleString()}</span>
                  <span className="font-mono font-bold text-slate-700">{utilPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      utilPct >= 90 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${utilPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 text-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, product name, or warehouse..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Warehouse:</span>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-medium"
          >
            <option value="all">All Warehouses</option>
            {state.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} ({w.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">SKU Code</th>
                <th className="py-2.5 px-4">Product Name & Category</th>
                <th className="py-2.5 px-4">Warehouse Location</th>
                <th className="py-2.5 px-4">On-Hand</th>
                <th className="py-2.5 px-4">Reserved</th>
                <th className="py-2.5 px-4">Available</th>
                <th className="py-2.5 px-4">Daily Burn</th>
                <th className="py-2.5 px-4">Coverage Days</th>
                <th className="py-2.5 px-4 text-right">Runway Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item) => {
                const isCritical = item.coverageDays <= 2.5;
                const isWarning = item.coverageDays > 2.5 && item.coverageDays <= 4.0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.sku}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-[11px] text-slate-400">{item.category}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{item.warehouseName}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {item.onHandQuantity.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {item.reservedQuantity.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {item.availableQuantity.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.dailyConsumptionRate}/day
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={`text-sm ${
                          isCritical
                            ? 'text-rose-600'
                            : isWarning
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {item.coverageDays.toFixed(1)} Days
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Stockout Imminent
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                          Low Safety Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Buffer Healthy
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

      {/* Coverage Formula Card */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-900">Deterministic Coverage Calculation: </span>
            <span className="font-mono text-slate-700">Coverage_Days = On_Hand_Quantity / Daily_Consumption_Rate</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Threshold triggers: &lt; 3.0 days = High Severity Warning; &lt; 2.0 days = Critical Disruption Event.
            </p>
          </div>
        </div>
      </div>

      {/* Stock Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Inter-Warehouse Stock Transfer
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Component SKU</label>
                <select
                  value={transferSku}
                  onChange={(e) => setTransferSku(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-mono"
                >
                  <option value="MCU-9021">MCU-9021 (Automotive Microcontroller 32-bit)</option>
                  <option value="PMIC-440">PMIC-440 (Power Management IC)</option>
                  <option value="FPGA-700">FPGA-700 (Logic Array 700k)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Source Warehouse</label>
                  <select
                    value={sourceWhId}
                    onChange={(e) => setSourceWhId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  >
                    {state.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Destination Hub</label>
                  <select
                    value={destWhId}
                    onChange={(e) => setDestWhId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  >
                    {state.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Transfer Quantity (Units)</label>
                <input
                  type="number"
                  required
                  min={100}
                  max={5000}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-mono"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px] space-y-1">
                <div className="font-semibold">Transfer Transit Estimate:</div>
                <div>Transit Mode: Dedicated Road Freight (Swift Logistics)</div>
                <div>ETA: 36 Hours | Est. Freight Cost: $4,200</div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-xs cursor-pointer"
                >
                  Confirm & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
