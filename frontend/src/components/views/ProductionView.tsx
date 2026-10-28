/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Factory, AlertTriangle, CheckCircle, Sliders, Layers } from 'lucide-react';
import { DatabaseState, ProductionLine } from '../../types.ts';

interface ProductionViewProps {
  state: DatabaseState;
  onRefresh: () => void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({ state, onRefresh }) => {
  const handleThrottleLine = async (line: ProductionLine, rate: number) => {
    const newOutput = Math.round(line.plannedOutput * rate);
    const newStatus = rate < 1.0 ? 'reduced_capacity' : 'operational';

    await fetch('/api/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: state.recoveryPlans[0]?.id || 'manual-line-adjust',
        decision: 'approved',
        managerName: 'Operations Director',
        managerRole: 'Production Manager',
        comments: `Production Throttle: Set ${line.lineName} to ${(rate * 100).toFixed(0)}% output (${newOutput}/day).`,
      }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-600" />
            Advanced Manufacturing & Production Schedules
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assembly line BOM tracking, component availability synchronization, and dynamic capacity throttling.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {state.productionLines.map((line) => {
          const isReduced = line.status === 'reduced_capacity';
          const isHalted = line.status === 'halted';

          return (
            <div
              key={line.id}
              className={`bg-white rounded-xl border p-4 shadow-xs space-y-3 ${
                isReduced ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-900">{line.code}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    line.status === 'operational'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      line.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <span className="capitalize">{line.status.replace('_', ' ')}</span>
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900">{line.lineName}</h3>
                <div className="text-xs text-slate-500">{line.facilityName}</div>
                <div className="text-xs font-semibold text-blue-600 mt-1">{line.productName}</div>
              </div>

              {/* Output Metrics */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Target Output</div>
                  <div className="font-mono font-bold text-slate-800">{line.plannedOutput} units/day</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Current Daily Run</div>
                  <div className="font-mono font-bold text-slate-900">{line.currentDailyOutput} units/day</div>
                </div>
              </div>

              {/* BOM Requirements */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                  Required BOM Materials
                </div>
                <div className="space-y-1">
                  {line.requiredMaterials.map((mat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                    >
                      <span className="font-mono font-medium text-slate-800">{mat.sku}</span>
                      <span className="text-[11px] text-slate-500">{mat.unitsPerProduct} unit / finished product</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottleneck Warning */}
              {line.bottleneckReason && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>{line.bottleneckReason}</div>
                </div>
              )}

              {/* Throttle Controls */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-blue-600" />
                  Shift Throttle Rate
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleThrottleLine(line, 1.0)}
                    className={`py-1 rounded text-[11px] font-medium border cursor-pointer ${
                      line.currentDailyOutput === line.plannedOutput
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    100% Run
                  </button>
                  <button
                    onClick={() => handleThrottleLine(line, 0.75)}
                    className={`py-1 rounded text-[11px] font-medium border cursor-pointer ${
                      line.currentDailyOutput === Math.round(line.plannedOutput * 0.75)
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    75% (Extend)
                  </button>
                  <button
                    onClick={() => handleThrottleLine(line, 0.5)}
                    className={`py-1 rounded text-[11px] font-medium border cursor-pointer ${
                      line.currentDailyOutput === Math.round(line.plannedOutput * 0.5)
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    50% Buffer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
