import React from 'react';
import type { SupplyNode, SupplyRoute } from '../types/supplyChain';
import { X, ShieldAlert, Activity, Package, Clock, Truck, Zap, MapPin, User } from 'lucide-react';

interface NodeInspectorModalProps {
  node: SupplyNode | null;
  routes: SupplyRoute[];
  nodes: SupplyNode[];
  onClose: () => void;
  onOpenCrisisModal: (playbookId?: string) => void;
}

export const NodeInspectorModal: React.FC<NodeInspectorModalProps> = ({
  node,
  routes,
  nodes,
  onClose,
  onOpenCrisisModal
}) => {
  if (!node) return null;

  const nodeMap = new Map<string, SupplyNode>(nodes.map(n => [n.id, n]));
  const connectedRoutes = routes.filter(r => r.sourceId === node.id || r.targetId === node.id);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col p-5 overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-300">
      {/* Top Header */}
      <div className="flex items-start justify-between pb-3.5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 text-[10px] font-mono text-cyan-300 uppercase">
              {node.type.replace('_', ' ')}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                node.status === 'disrupted'
                  ? 'bg-red-950/80 border border-red-500/80 text-red-300'
                  : node.status === 'delayed'
                  ? 'bg-amber-950/80 border border-amber-500/80 text-amber-300'
                  : 'bg-emerald-950/80 border border-emerald-500/80 text-emerald-300'
              }`}
            >
              {node.status}
            </span>
          </div>
          <h2 className="text-base font-mono font-bold text-white tracking-tight">{node.name}</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>{node.location} ({node.region})</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Critical Outage Alert Banner if applicable */}
      {node.isCriticalOutage && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-950/60 border border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="flex items-center gap-2 text-red-300 font-mono text-xs font-bold mb-1">
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            <span>CRITICAL OUTAGE DECLARED</span>
          </div>
          <p className="text-xs text-red-200 leading-relaxed font-sans mb-3">
            {node.disruptionCause}
          </p>
          <div className="flex items-center justify-between text-[11px] font-mono text-red-300/90 mb-3 bg-red-900/40 p-2 rounded">
            <span>Estimated Outage Recovery:</span>
            <span className="font-bold text-white">{node.estimatedRecoveryHours} Hours</span>
          </div>
          <button
            onClick={() => onOpenCrisisModal('playbook-apex-divert')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-mono text-white font-bold transition-all shadow-lg active:scale-95"
          >
            <Zap className="w-4 h-4" />
            <span>Trigger Crisis Recovery Playbook</span>
          </button>
        </div>
      )}

      {/* Core Telemetry Metrics */}
      <div className="mt-4 space-y-2.5">
        <h3 className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-wide">
          FACILITY TELEMETRY
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>DAILY THROUGHPUT</span>
            </div>
            <div className="text-sm font-bold font-mono text-white">
              {node.throughputPerDay} <span className="text-[10px] text-slate-400 font-normal">units/d</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
              <Package className="w-3.5 h-3.5 text-blue-400" />
              <span>CAPACITY UTILIZATION</span>
            </div>
            <div className="text-sm font-bold font-mono text-white">
              {node.capacityUtilizationPct}%
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  node.capacityUtilizationPct > 90
                    ? 'bg-red-500'
                    : node.capacityUtilizationPct > 75
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${node.capacityUtilizationPct}%` }}
              />
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>SUPPLIER LEAD TIME</span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {node.leadTimeDays} <span className="text-[10px] text-slate-400 font-normal">days</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
              <Truck className="w-3.5 h-3.5 text-purple-400" />
              <span>ACTIVE SHIPMENTS</span>
            </div>
            <div className="text-base font-bold font-mono text-white">
              {node.activeShipmentsCount} <span className="text-[10px] text-slate-400 font-normal">convoys</span>
            </div>
          </div>
        </div>

        {/* Product & Contact */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Primary Product:</span>
            <span className="text-cyan-300 font-semibold">{node.primaryProduct}</span>
          </div>
          {node.contactLead && (
            <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>Contact Lead:</span>
              </span>
              <span className="text-slate-200">{node.contactLead}</span>
            </div>
          )}
        </div>
      </div>

      {/* Connected Network Links */}
      <div className="mt-5 space-y-2.5">
        <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
          CONNECTED SUPPLY ROUTES ({connectedRoutes.length})
        </h3>

        <div className="space-y-2">
          {connectedRoutes.map(route => {
            const isOrigin = route.sourceId === node.id;
            const otherNode = isOrigin ? nodeMap.get(route.targetId) : nodeMap.get(route.sourceId);

            return (
              <div
                key={route.id}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <span className="text-cyan-400">{isOrigin ? 'Outbound ➔' : 'Inbound ⬅'}</span>
                    <span>{otherNode?.name || 'Unknown Node'}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                      route.state === 'disrupted'
                        ? 'bg-red-950 text-red-300'
                        : route.state === 'delayed'
                        ? 'bg-amber-950 text-amber-300'
                        : 'bg-cyan-950 text-cyan-300'
                    }`}
                  >
                    {route.state}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{route.cargoType}</span>
                  <span className="text-slate-200 font-semibold">{route.volumeTEU} TEU</span>
                </div>
                {route.congestedReason && (
                  <div className="mt-1 text-[10px] text-red-300 font-sans">
                    ⚠️ {route.congestedReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
