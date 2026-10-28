import React from 'react';
import type { KPIData, OutageSimulationState } from '../types/supplyChain';
import { ShieldAlert, Clock, AlertTriangle, DollarSign } from 'lucide-react';

interface KPICardsProps {
  kpis: KPIData;
  simulationState: OutageSimulationState;
}

export const KPICards: React.FC<KPICardsProps> = ({ simulationState }) => {
  const { stage, detectionSeverity, affectedInventory, affectedOrders, proposedPlan } = simulationState;
  const isIdle = stage === 'idle';

  // 1. Crisis Severity
  const severityLabel = isIdle ? 'NOMINAL' : detectionSeverity || 'CRITICAL';
  const severityColor = isIdle
    ? 'text-emerald-400'
    : severityLabel === 'CRITICAL'
    ? 'text-red-400'
    : 'text-amber-400';
  const severitySubtext = isIdle ? 'All 10 nodes operational' : 'Apex Silicon Fab 4 (Shenzhen)';

  // 2. Inventory Runway
  const minRunwayHours = affectedInventory && affectedInventory.length > 0
    ? Math.min(...affectedInventory.map(i => i.hoursOfRunwayLeft))
    : 36;
  const runwayDisplay = isIdle ? '14.0 Days' : `${(minRunwayHours / 24).toFixed(1)} Days`;
  const runwaySubtext = isIdle ? 'Normal baseline reserve' : `~${minRunwayHours}h until Austin Line 2 starves`;

  // 3. Customer Orders at Risk
  const ordersCount = isIdle ? 0 : affectedOrders?.length || 2;
  const totalExposureUSD = affectedOrders && affectedOrders.length > 0
    ? affectedOrders.reduce((sum, ord) => {
        const numeric = parseFloat(ord.contractValueUSD?.replace(/[^0-9.]/g, '') || '0');
        return sum + (isNaN(numeric) ? 0 : numeric);
      }, 0)
    : 2830000;
  const ordersDisplay = isIdle ? '0 Orders' : `${ordersCount} Orders`;
  const ordersSubtext = isIdle ? 'Zero SLA exposure' : `$${(totalExposureUSD / 1000).toFixed(0)}k at risk across Tier-1 clients`;

  // 4. Estimated Recovery Cost
  const costDisplay = proposedPlan?.estimatedTotalCostUSD || (isIdle ? 'N/A' : 'Pending Synthesis');
  const costSubtext = proposedPlan
    ? `Expedite air & backup supplier`
    : isIdle
    ? 'No active crisis plan'
    : 'Awaiting planning solver';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Crisis Severity */}
      <div className="glass-panel p-4 flex flex-col justify-between transition-all hover:border-slate-600">
        <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] tracking-wider uppercase">CRISIS SEVERITY</span>
          </span>
          <span className={`w-2 h-2 rounded-full ${isIdle ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
        </div>
        <div>
          <div className={`text-2xl font-bold font-display tracking-tight ${severityColor}`}>
            {severityLabel}
          </div>
          <div className="text-[11px] text-slate-400 font-sans mt-1">
            {severitySubtext}
          </div>
        </div>
      </div>

      {/* 2. Inventory Runway */}
      <div className="glass-panel p-4 flex flex-col justify-between transition-all hover:border-slate-600">
        <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] tracking-wider uppercase">INVENTORY RUNWAY</span>
          </span>
        </div>
        <div>
          <div className={`text-2xl font-bold font-display tracking-tight ${isIdle ? 'text-white' : 'text-amber-400'}`}>
            {runwayDisplay}
          </div>
          <div className="text-[11px] text-slate-400 font-sans mt-1">
            {runwaySubtext}
          </div>
        </div>
      </div>

      {/* 3. Customer Orders at Risk */}
      <div className="glass-panel p-4 flex flex-col justify-between transition-all hover:border-slate-600">
        <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] tracking-wider uppercase">ORDERS AT RISK</span>
          </span>
        </div>
        <div>
          <div className={`text-2xl font-bold font-display tracking-tight ${isIdle ? 'text-white' : 'text-red-400'}`}>
            {ordersDisplay}
          </div>
          <div className="text-[11px] text-slate-400 font-sans mt-1">
            {ordersSubtext}
          </div>
        </div>
      </div>

      {/* 4. Estimated Recovery Cost */}
      <div className="glass-panel p-4 flex flex-col justify-between transition-all hover:border-slate-600">
        <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] tracking-wider uppercase">EST. RECOVERY COST</span>
          </span>
        </div>
        <div>
          <div className={`text-2xl font-bold font-display tracking-tight ${proposedPlan ? 'text-emerald-400' : 'text-slate-300'}`}>
            {costDisplay}
          </div>
          <div className="text-[11px] text-slate-400 font-sans mt-1">
            {costSubtext}
          </div>
        </div>
      </div>
    </div>
  );
};
