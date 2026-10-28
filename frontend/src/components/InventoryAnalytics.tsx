import React, { useState } from 'react';
import type { InventoryTelemetry } from '../types/supplyChain';
import { Warehouse, AlertTriangle, CheckCircle, BarChart3, TrendingUp } from 'lucide-react';

interface InventoryAnalyticsProps {
  inventory: InventoryTelemetry[];
}

export const InventoryAnalytics: React.FC<InventoryAnalyticsProps> = ({ inventory }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'forecasting'>('inventory');

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden">
      {/* Header Tabs */}
      <div className="p-2.5 px-3.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase text-[11px]">
            REGIONAL INVENTORY & PREDICTIVE BUFFER TELEMETRY
          </h3>
        </div>

        <div className="flex bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-2.5 py-1 rounded transition-all ${
              activeTab === 'inventory'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BUFFER HUBS
          </button>
          <button
            onClick={() => setActiveTab('forecasting')}
            className={`px-2.5 py-1 rounded transition-all ${
              activeTab === 'forecasting'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DEMAND FORECAST
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar">
        {activeTab === 'inventory' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {inventory.map(hub => {
              const pct = Math.round((hub.currentStockUnits / hub.maxStockUnits) * 100);
              const isCrit = hub.healthStatus === 'critical';
              const isWarn = hub.healthStatus === 'warning';

              return (
                <div
                  key={hub.hubId}
                  className={`p-3 rounded-xl border font-mono transition-all ${
                    isCrit
                      ? 'bg-red-950/20 border-red-500/40'
                      : isWarn
                      ? 'bg-amber-950/15 border-amber-500/30'
                      : 'bg-slate-950/40 border-slate-800/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div>
                      <div className="text-[10px] text-cyan-400/90 uppercase tracking-wide">{hub.region}</div>
                      <h4 className="text-xs font-bold text-white leading-tight mt-0.5">{hub.hubName}</h4>
                    </div>
                    {isCrit ? (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-500/50">
                        <AlertTriangle className="w-3 h-3" /> CRITICAL
                      </span>
                    ) : isWarn ? (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/50">
                        WARNING
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/50">
                        <CheckCircle className="w-3 h-3" /> HEALTHY
                      </span>
                    )}
                  </div>

                  {/* Meter */}
                  <div className="space-y-1 my-2.5">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span className="text-slate-400">Reserve Fill:</span>
                      <span className="font-semibold text-white">{pct}% ({hub.currentStockUnits.toLocaleString()} / {hub.maxStockUnits.toLocaleString()})</span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80 mb-2">
                    <span className="text-slate-400">Stockout Runway:</span>
                    <span className={`font-semibold ${isCrit ? 'text-red-400' : 'text-slate-200'}`}>
                      {hub.stockoutRiskDays} Days Supply
                    </span>
                  </div>

                  {/* Top SKUs */}
                  <div className="space-y-1">
                    <div className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">Monitored SKUs</div>
                    {hub.topSKUs.map(s => (
                      <div key={s.sku} className="flex justify-between text-[10px] text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-800/60">
                        <span className="text-slate-400">{s.sku}</span>
                        <span className={s.daysOfSupply < 5 ? 'text-red-400 font-semibold' : 'text-cyan-300'}>
                          {s.units.toLocaleString()}u ({s.daysOfSupply}d)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Demand Forecasting View */
          <div className="space-y-4 font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase">
                    30-DAY PREDICTIVE LEAD TIME VARIANCE & DEMAND VOLATILITY
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                  <TrendingUp className="w-3 h-3" /> AI MODEL CONFIDENCE: 94.6%
                </span>
              </div>

              {/* High-Tech SVG Telemetry Chart */}
              <div className="relative w-full h-36 bg-slate-900/50 rounded-lg border border-slate-800/80 p-2 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="600" y2="30" stroke="#1e293b" strokeDasharray="4 4" />
                  <line x1="0" y1="60" x2="600" y2="60" stroke="#1e293b" strokeDasharray="4 4" />
                  <line x1="0" y1="90" x2="600" y2="90" stroke="#1e293b" strokeDasharray="4 4" />

                  {/* Gradient fill */}
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Shaded Area */}
                  <path
                    d="M 0 80 Q 80 90, 150 65 T 300 45 T 450 85 T 600 35 L 600 120 L 0 120 Z"
                    fill="url(#chartGrad)"
                  />

                  {/* Smooth Forecast Trend Curve */}
                  <path
                    d="M 0 80 Q 80 90, 150 65 T 300 45 T 450 85 T 600 35"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="2.5"
                  />

                  {/* Disruption Spike Anomaly (Red Section) */}
                  <circle cx="300" cy="45" r="4" fill="#ef4444" className="animate-ping" />
                  <circle cx="300" cy="45" r="4" fill="#ef4444" />
                  <text x="310" y="42" fill="#ef4444" fontSize="10" fontFamily="monospace">
                    Apex Outage Spike (+4.2d)
                  </text>
                </svg>

                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                  <span>DAY -14</span>
                  <span>DAY -7</span>
                  <span>TODAY (OUTAGE ANOMALY)</span>
                  <span>DAY +7 (MITIGATION)</span>
                  <span>DAY +14 (STABILIZED)</span>
                </div>
              </div>
            </div>

            {/* Strategic Insights */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Macro Risk Forecast
                </span>
                <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                  Typhoon Typhoon-9 path projected to clear Shenzhen sea routes within 6 days. Activating Tokyo optical reserve mitigates 82% of customer backorders.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Inventory Buffer Health
                </span>
                <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                  Singapore Buffer Depot maintains 48,500 units. Ready to support dual-channel air distribution to North America and Europe.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
