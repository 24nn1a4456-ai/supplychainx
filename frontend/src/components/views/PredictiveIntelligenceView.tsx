/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Radar,
  AlertTriangle,
  TrendingDown,
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Zap,
  Sparkles,
  Sliders,
  DollarSign,
  Building2,
  Boxes,
  Truck,
  ArrowRight,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  DatabaseState,
  UserRole,
  EarlyWarningAlert,
  PredictiveAnalysisResult,
  WhatIfSimulationOutput,
} from '../../types.ts';

interface PredictiveIntelligenceViewProps {
  state: DatabaseState;
  onRefresh: () => void;
  userRole: UserRole;
}

export const PredictiveIntelligenceView: React.FC<PredictiveIntelligenceViewProps> = ({
  state,
  onRefresh,
  userRole,
}) => {
  const [analysis, setAnalysis] = useState<PredictiveAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'early_warnings' | 'stockout_forecast' | 'supplier_risk' | 'what_if_sandbox' | 'ml_studio'>('early_warnings');
  const [preventingAlertId, setPreventingAlertId] = useState<string | null>(null);

  // Live ML Models Interactive Studio State
  const [mlDelayLoading, setMlDelayLoading] = useState(false);
  const [mlDelayResult, setMlDelayResult] = useState<any>(null);
  const [mlDelayLeadTime, setMlDelayLeadTime] = useState(14);
  const [mlDelaySupplierRisk, setMlDelaySupplierRisk] = useState(0.45);
  const [mlDelayWeatherFlag, setMlDelayWeatherFlag] = useState(1);
  const [mlDelayPortCongestion, setMlDelayPortCongestion] = useState(1);

  const [mlCrisisLoading, setMlCrisisLoading] = useState(false);
  const [mlCrisisResult, setMlCrisisResult] = useState<any>(null);
  const [mlCrisisInventory, setMlCrisisInventory] = useState(1200);
  const [mlCrisisCapacity, setMlCrisisCapacity] = useState(2500);

  const [mlDemandLoading, setMlDemandLoading] = useState(false);
  const [mlDemandResult, setMlDemandResult] = useState<any>(null);
  const [mlDemandPromo, setMlDemandPromo] = useState(1);
  const [mlDemandTransportCost, setMlDemandTransportCost] = useState(48.5);

  // What-If Simulation State
  const [simOutageDays, setSimOutageDays] = useState(5);
  const [simFreightDelay, setSimFreightDelay] = useState(30);
  const [simDemandSurge, setSimDemandSurge] = useState(0);
  const [simThrottleRate, setSimThrottleRate] = useState(1.0);
  const [simulationOutput, setSimulationOutput] = useState<WhatIfSimulationOutput | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleTestDeliveryDelay = async () => {
    setMlDelayLoading(true);
    try {
      const res = await fetch('/api/predictions/delivery-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_time_days: Number(mlDelayLeadTime),
          supplier_risk_score: Number(mlDelaySupplierRisk),
          weather_disruption_flag: Number(mlDelayWeatherFlag),
          port_congestion_flag: Number(mlDelayPortCongestion),
          transport_cost: 45.0,
          supplier_capacity_units: 3000.0,
          day_of_week: 2,
          month: 10,
          region: 'Asia-Pacific',
          supplier_id: 'sup-1',
        }),
      });
      if (res.ok) {
        setMlDelayResult(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMlDelayLoading(false);
    }
  };

  const handleTestCrisisRisk = async () => {
    setMlCrisisLoading(true);
    try {
      const res = await fetch('/api/predictions/crisis-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_units: Number(mlCrisisInventory),
          supplier_capacity_units: Number(mlCrisisCapacity),
          lead_time_days: 10,
          supplier_risk_score: 0.55,
          weather_disruption_flag: 1,
          port_congestion_flag: 0,
          transport_cost: 35.0,
          day_of_week: 1,
          month: 10,
          promotion_flag: 0,
          region: 'Taiwan',
          supplier_id: 'sup-1',
          product_id: 'MCU-9021',
        }),
      });
      if (res.ok) {
        setMlCrisisResult(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMlCrisisLoading(false);
    }
  };

  const handleTestDemandForecast = async () => {
    setMlDemandLoading(true);
    try {
      const res = await fetch('/api/predictions/demand-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: 3,
          month: 11,
          promotion_flag: Number(mlDemandPromo),
          lead_time_days: 7,
          supplier_risk_score: 0.3,
          transport_cost: Number(mlDemandTransportCost),
          region: 'Americas',
          product_id: 'MCU-9021',
          supplier_id: 'sup-1',
        }),
      });
      if (res.ok) {
        setMlDemandResult(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMlDemandLoading(false);
    }
  };

  const fetchPredictions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/predictions');
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (err) {
      console.warn('Failed to fetch predictions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulation/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioName: `Stress Test: ${simOutageDays}d Fab Outage + ${simFreightDelay}h Sea Delay + ${simDemandSurge}% Demand Surge`,
          outageDays: simOutageDays,
          oceanFreightDelayHours: simFreightDelay,
          demandSurgePercent: simDemandSurge,
          assemblyLineThrottleRate: simThrottleRate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationOutput(data);
      }
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    handleRunSimulation();
  }, [simOutageDays, simFreightDelay, simDemandSurge, simThrottleRate]);

  const handleExecutePreventiveAction = async (alert: EarlyWarningAlert) => {
    setPreventingAlertId(alert.id);
    try {
      await fetch('/api/predictions/prevent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          actionType: alert.preventiveActionPayload?.actionType || 'preemptive_inter_warehouse_transfer',
          managerName: userRole,
        }),
      });
      await fetchPredictions();
      onRefresh();
    } finally {
      setPreventingAlertId(null);
    }
  };

  // Trajectory chart data for MCU-9021 at Oakland
  const mcuForecast = analysis?.stockoutForecasts.find(
    (f) => f.sku === 'MCU-9021' && f.warehouseId === 'wh-1'
  );

  const chartData = mcuForecast?.projectedStockTrajectory30Days.slice(0, 18).map((point) => {
    // calculate with preemptive transfer (+1800 units at day 2)
    const withMitigation = point.day <= 1 ? point.onHandUnits : Math.min(10000, point.onHandUnits + 1800);
    return {
      date: `Day ${point.day} (${point.date.slice(5)})`,
      unmitigatedStock: point.onHandUnits,
      mitigatedStock: withMitigation,
      safetyBuffer: 4000,
      stockoutThreshold: 0,
    };
  }) || [];

  return (
    <div className="space-y-4">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <Radar className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-2">
              <span>PREDICTIVE AI & EARLY-WARNING RADAR</span>
              <span>•</span>
              <span>PROACTIVE RISK INTELLIGENCE</span>
            </div>
            <h2 className="font-bold text-lg mt-0.5">
              Forward-Looking Disruption Horizon & Stress Simulation
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Anticipate stockout cliffs, supplier solvency bottlenecks, maritime storm delays, and contractual line-down penalties before disruptions trigger a critical incident.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
              Resilience Score
            </div>
            <div className="text-xl font-mono font-bold text-cyan-300">
              {analysis?.overallNetworkResilienceIndex || 78}/100
            </div>
          </div>

          <button
            onClick={fetchPredictions}
            disabled={isLoading}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Recalibrate Model</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
        <button
          onClick={() => setActiveTab('early_warnings')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'early_warnings'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Early-Warning Radar</span>
          {analysis && analysis.earlyWarningAlerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
              {analysis.earlyWarningAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('stockout_forecast')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'stockout_forecast'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>30-Day Stockout Forecast</span>
        </button>

        <button
          onClick={() => setActiveTab('supplier_risk')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'supplier_risk'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Supplier Failure Risk Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('what_if_sandbox')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'what_if_sandbox'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>What-If Scenario Sandbox</span>
        </button>

        <button
          onClick={() => setActiveTab('ml_studio')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'ml_studio'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>ML Models Studio</span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-500/20 text-indigo-700 font-bold border border-indigo-300">
            3 Models
          </span>
        </button>
      </div>

      {/* Tab 1: Early-Warning Alerts Radar */}
      {activeTab === 'early_warnings' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis?.earlyWarningAlerts.map((alert) => {
              const isCrit = alert.severity === 'Critical';
              const isHigh = alert.severity === 'High';

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl border p-4 shadow-xs space-y-3 transition-all ${
                    isCrit
                      ? 'border-rose-400 ring-2 ring-rose-400/10'
                      : isHigh
                      ? 'border-amber-300'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Alert Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isCrit
                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                              : isHigh
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {alert.severity} RISK ({alert.riskScore}/100)
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {alert.predictedTimeWindow}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">{alert.title}</h3>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        ${(alert.estimatedAvertedLoss / 1000).toFixed(0)}k Exposure
                      </div>
                      <div className="text-[10px] font-mono text-emerald-600 font-semibold">
                        {(alert.confidence * 100).toFixed(0)}% Confidence
                      </div>
                    </div>
                  </div>

                  {/* Contributing Factors */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Attributed Contributing Factors
                    </div>
                    <div className="space-y-1 text-xs">
                      {alert.contributingFactors.map((fact, idx) => (
                        <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded">
                          <span className="font-mono font-bold text-slate-700 text-[11px] shrink-0">
                            {fact.weightPct}%
                          </span>
                          <div className="text-slate-700">
                            <strong>{fact.factor}:</strong> {fact.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Affected Entities Pills */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Affected Downstream Nodes
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {alert.affectedEntities.map((ent, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700"
                        >
                          {ent.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Preventive Action Button */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="text-[11px] text-slate-600 italic max-w-sm">
                      💡 {alert.recommendedPreventiveAction}
                    </div>

                    {alert.preventiveActionPayload && (
                      <button
                        onClick={() => handleExecutePreventiveAction(alert)}
                        disabled={preventingAlertId === alert.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          {preventingAlertId === alert.id ? 'Deploying...' : 'Deploy Preventive Transfer'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: 30-Day Forward Stockout Trajectory */}
      {activeTab === 'stockout_forecast' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Forward 30-Day Stockout Trajectory Simulation (MCU-9021 at Pacific Hub)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic burn-rate trajectory modeling based on 1,500 units/day assembly consumption vs scheduled arrivals.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Unmitigated Cliff (Runout Day 2.0)
              </span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> With Preemptive Mitigation
              </span>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v.toLocaleString()}`} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} units`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                />
                <ReferenceLine y={4000} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Safety Buffer Threshold (4,000u)', fill: '#f59e0b', fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} label={{ value: 'STOCKOUT CLIFF (0u)', fill: '#ef4444', fontSize: 10 }} />
                <Line type="monotone" dataKey="unmitigatedStock" name="Without Preventive Action" stroke="#f43f5e" strokeWidth={2.5} />
                <Line type="monotone" dataKey="mitigatedStock" name="With Preemptive Transfer" stroke="#10b981" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Runway Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs">
              <div className="text-[10px] text-rose-700 uppercase font-semibold">Unmitigated Runout Horizon</div>
              <div className="font-bold text-lg text-rose-950 mt-0.5">
                {mcuForecast?.hoursUntilRunout} Hours (2.0 Days)
              </div>
              <div className="text-[11px] text-rose-800 mt-1">Assembly Line 1 shuts down without action.</div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
              <div className="text-[10px] text-emerald-700 uppercase font-semibold">Mitigated Safety Buffer</div>
              <div className="font-bold text-lg text-emerald-950 mt-0.5">
                5.2 Days Coverage
              </div>
              <div className="text-[11px] text-emerald-800 mt-1">1,800-unit transfer from Chicago bridges disruption gap.</div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
              <div className="text-[10px] text-blue-700 uppercase font-semibold">Recommended Replenishment Order</div>
              <div className="font-bold text-lg text-blue-950 mt-0.5">
                {mcuForecast?.suggestedReorderQuantity.toLocaleString()} Units
              </div>
              <div className="text-[11px] text-blue-800 mt-1">Establishes 14-day supply hedge for upcoming Q4 demand.</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Supplier Failure Risk Matrix */}
      {activeTab === 'supplier_risk' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-base text-slate-900">
              Multi-Factor Supplier Vulnerability & Solvency Scoring
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Predictive risk index combining single-source concentration, geopolitical exposure, historical yield, and capacity stress.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {analysis?.supplierRiskScores.map((sup) => (
              <div
                key={sup.supplierId}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-slate-500">{sup.supplierCode}</span>
                    <h4 className="font-bold text-xs text-slate-900">{sup.supplierName}</h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sup.riskTier === 'Critical'
                        ? 'bg-rose-100 text-rose-700'
                        : sup.riskTier === 'Elevated'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {sup.riskTier} ({sup.compositeRiskScore}/100)
                  </span>
                </div>

                {/* Risk Sub-factors */}
                <div className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Single-Source Concentration:</span>
                    <span className="font-mono font-bold text-slate-800">{sup.factors.singleSourceConcentration}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Geopolitical Risk Exposure:</span>
                    <span className="font-mono font-bold text-slate-800">{sup.factors.geopoliticalRisk}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>7-Day Failure Probability:</span>
                    <span className="font-mono font-bold text-rose-600">{(sup.failureProbabilityNext7Days * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-900">Recommended Hedge: </span>
                  {sup.recommendedHedge}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Interactive What-If Scenario Sandbox */}
      {activeTab === 'what_if_sandbox' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Autonomous What-If Scenario Stress Testing
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate severe supplier outages, maritime typhoons, demand surges, and production throttles to test resilience before crisis strikes.
              </p>
            </div>

            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
              Deterministic Cascade Engine
            </span>
          </div>

          {/* Sandbox Parameter Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            {/* Control 1: Supplier Outage */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Supplier Outage Duration</span>
                <span className="font-mono text-indigo-600">{simOutageDays} Days</span>
              </div>
              <input
                type="range"
                min="1"
                max="14"
                value={simOutageDays}
                onChange={(e) => setSimOutageDays(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">Halts 2,500 daily units from Taiwan fab</div>
            </div>

            {/* Control 2: Ocean Freight Storm Delay */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Maritime Storm Delay</span>
                <span className="font-mono text-indigo-600">+{simFreightDelay}h</span>
              </div>
              <input
                type="range"
                min="0"
                max="72"
                step="6"
                value={simFreightDelay}
                onChange={(e) => setSimFreightDelay(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">Delays Ever Glory container vessel arrival</div>
            </div>

            {/* Control 3: Demand Surge */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Customer Demand Surge</span>
                <span className="font-mono text-indigo-600">+{simDemandSurge}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={simDemandSurge}
                onChange={(e) => setSimDemandSurge(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">Accelerates daily warehouse burn rate</div>
            </div>

            {/* Control 4: Factory Throttle */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Assembly Line Throttle</span>
                <span className="font-mono text-indigo-600">{(simThrottleRate * 100).toFixed(0)}%</span>
              </div>
              <select
                value={simThrottleRate}
                onChange={(e) => setSimThrottleRate(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-medium cursor-pointer"
              >
                <option value="1.0">100% Run (Normal)</option>
                <option value="0.75">75% Throttle (Preserve Buffer)</option>
                <option value="0.5">50% Throttle (Emergency Freeze)</option>
              </select>
              <div className="text-[10px] text-slate-500">Stretches stock by 1.8 to 3.0 days</div>
            </div>
          </div>

          {/* Simulation Output Comparison */}
          {simulationOutput && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-slate-500">Simulated Runway</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {simulationOutput.simulatedMetrics.oaklandMcuRunwayDays} Days
                  </div>
                  <div className="text-[10px] text-slate-400">At Pacific Hub Oakland</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-slate-500">At-Risk Orders</div>
                  <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">
                    {simulationOutput.simulatedMetrics.atRiskOrdersCount} Orders
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ${(simulationOutput.simulatedMetrics.atRiskFinancialExposure / 1000).toFixed(0)}k Value Exposure
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-slate-500">Factory Idle Loss</div>
                  <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">
                    ${(simulationOutput.simulatedMetrics.projectedLineIdleLoss / 1000).toFixed(0)}k
                  </div>
                  <div className="text-[10px] text-slate-400">Line 1 labor & overhead penalty</div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-emerald-700 font-semibold">Autonomous Recovery Net Savings</div>
                  <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
                    ${(simulationOutput.recoveryMitigationImpact.netSavings / 1000).toFixed(0)}k
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium">9.85x Return on Investment</div>
                </div>
              </div>

              {/* 5-Step Cascade Ripple Trace */}
              <div>
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Cascading Ripple Effect Across Network Echelons
                </h4>
                <div className="space-y-1.5">
                  {simulationOutput.cascadeTrace.map((tr, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-900 text-xs">{tr.step}</span>
                        <span className="text-slate-500">({tr.entity}):</span>
                        <span className="text-slate-800 font-medium">{tr.impactDescription}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          tr.severity === 'critical'
                            ? 'bg-rose-100 text-rose-700'
                            : tr.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {tr.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Live ML Inference Studio */}
      {activeTab === 'ml_studio' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Live ML Model Inference Studio (Phase 5 & 6 Integration)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct evaluation against trained Scikit-Learn pipelines running on FastAPI backend. Outputs are derived from synthetic training data and should not be used as guaranteed real-world advice.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200 font-semibold self-start md:self-auto">
                Trained on Chronological Synthetic Baseline
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 text-xs">
              {/* Model 1: Delivery Delay Classifier */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Delivery Delay Classifier</span>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                      RandomForest
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Predicts probability of shipment arrival delay given lead time, supplier risk, and transit flags.
                  </p>

                  <div className="space-y-2 pt-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Lead Time (Days): {mlDelayLeadTime}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={mlDelayLeadTime}
                        onChange={(e) => setMlDelayLeadTime(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Supplier Risk Score: {mlDelaySupplierRisk}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={mlDelaySupplierRisk}
                        onChange={(e) => setMlDelaySupplierRisk(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={mlDelayWeatherFlag === 1}
                          onChange={(e) => setMlDelayWeatherFlag(e.target.checked ? 1 : 0)}
                          className="rounded text-blue-600"
                        />
                        <span>Weather Alert</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={mlDelayPortCongestion === 1}
                          onChange={(e) => setMlDelayPortCongestion(e.target.checked ? 1 : 0)}
                          className="rounded text-blue-600"
                        />
                        <span>Port Congested</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <button
                    onClick={handleTestDeliveryDelay}
                    disabled={mlDelayLoading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{mlDelayLoading ? 'Predicting...' : 'Predict Delay'}</span>
                  </button>

                  {mlDelayResult && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Delay Predicted:</span>
                        <span
                          className={`font-bold font-mono px-1.5 py-0.5 rounded text-[10px] ${
                            mlDelayResult.is_delayed
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {mlDelayResult.is_delayed ? 'DELAYED' : 'ON-TIME'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Probability:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {(mlDelayResult.delay_probability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Risk Category:</span>
                        <span className="font-semibold text-slate-800">{mlDelayResult.risk_category}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Model 2: Crisis Risk Classifier */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Crisis Disruption Classifier</span>
                    <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                      GradientBoosting
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Calculates likelihood of an escalation into a critical supply shortage crisis (F1 ~0.76).
                  </p>

                  <div className="space-y-2 pt-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Current Inventory Units: {mlCrisisInventory.toLocaleString()}
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="5000"
                        step="100"
                        value={mlCrisisInventory}
                        onChange={(e) => setMlCrisisInventory(Number(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Supplier Daily Capacity: {mlCrisisCapacity.toLocaleString()}
                      </label>
                      <input
                        type="range"
                        min="500"
                        max="6000"
                        step="250"
                        value={mlCrisisCapacity}
                        onChange={(e) => setMlCrisisCapacity(Number(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <button
                    onClick={handleTestCrisisRisk}
                    disabled={mlCrisisLoading}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{mlCrisisLoading ? 'Scoring...' : 'Score Disruption Risk'}</span>
                  </button>

                  {mlCrisisResult && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Risk Tier:</span>
                        <span
                          className={`font-bold font-mono px-1.5 py-0.5 rounded text-[10px] ${
                            mlCrisisResult.risk_tier === 'Critical'
                              ? 'bg-rose-100 text-rose-700'
                              : mlCrisisResult.risk_tier === 'Elevated'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {mlCrisisResult.risk_tier}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Crisis Probability:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {(mlCrisisResult.crisis_probability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Confidence:</span>
                        <span className="font-mono font-semibold text-slate-700">
                          {(mlCrisisResult.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Model 3: Demand Forecaster (EXPERIMENTAL) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Demand Forecaster</span>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                      EXPERIMENTAL
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded border border-amber-200">
                    <strong>Experimental Status:</strong> Weak validation signal (R² ≈ 0.106) on synthetic data. Not suitable for production purchasing decisions.
                  </p>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Transport Unit Cost ($): ${mlDemandTransportCost}
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="2.5"
                        value={mlDemandTransportCost}
                        onChange={(e) => setMlDemandTransportCost(Number(e.target.value))}
                        className="w-full accent-amber-600 cursor-pointer"
                      />
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={mlDemandPromo === 1}
                          onChange={(e) => setMlDemandPromo(e.target.checked ? 1 : 0)}
                          className="rounded text-amber-600"
                        />
                        <span>Promotion / Seasonal Event Active</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <button
                    onClick={handleTestDemandForecast}
                    disabled={mlDemandLoading}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{mlDemandLoading ? 'Forecasting...' : 'Run Demand Forecast (Exp.)'}</span>
                  </button>

                  {mlDemandResult && (
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Forecasted Demand:</span>
                        <span className="font-bold font-mono text-xs text-slate-900">
                          {Math.round(mlDemandResult.forecasted_demand_units).toLocaleString()} units
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">90% Range:</span>
                        <span className="font-mono text-slate-700">
                          [{Math.round(mlDemandResult.lower_bound_units)}, {Math.round(mlDemandResult.upper_bound_units)}]
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-700 font-mono mt-1 pt-1 border-t border-slate-100">
                        {mlDemandResult.caveat}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
