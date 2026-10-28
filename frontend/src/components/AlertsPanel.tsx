import React, { useState } from 'react';
import type { DisruptionAlert } from '../types/supplyChain';
import { AlertCircle, AlertTriangle, Info, Crosshair, Zap, CheckCircle2 } from 'lucide-react';

interface AlertsPanelProps {
  alerts: DisruptionAlert[];
  onFocusNode: (nodeId: string) => void;
  onOpenCrisisModal: (playbookId?: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onFocusNode,
  onOpenCrisisModal
}) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'critical') return a.severity === 'critical';
    if (filter === 'warning') return a.severity === 'warning';
    return true;
  });

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-2.5 px-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase text-[11px]">
            DISRUPTION ALERTS
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] font-mono text-cyan-300">
          {alerts.length} ALERTS
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1 text-[10px] font-mono">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1 rounded text-center transition-all ${
            filter === 'all'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ALL ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`flex-1 py-1 rounded text-center transition-all ${
            filter === 'critical'
              ? 'bg-red-500/15 text-red-300 border border-red-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          CRITICAL
        </button>
        <button
          onClick={() => setFilter('warning')}
          className={`flex-1 py-1 rounded text-center transition-all ${
            filter === 'warning'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          WARNINGS
        </button>
      </div>

      {/* Alert Feed */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {filteredAlerts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500 py-6">
            NO ACTIVE ALERTS IN QUEUE
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  isCritical
                    ? 'bg-red-950/30 border-red-500/40 hover:border-red-500/60'
                    : isWarning
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    {isCritical ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : isWarning ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                    <h4
                      className={`text-xs font-mono font-semibold leading-tight ${
                        isCritical ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      {alert.title}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{alert.timestamp}</span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed mb-2 font-sans pl-5">
                  {alert.impactSummary}
                </p>

                {alert.recommendedAction && (
                  <div className="text-[10px] font-mono text-cyan-300/80 pl-5 mb-2 flex items-start gap-1">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{alert.recommendedAction}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pl-5">
                  {alert.nodeId && (
                    <button
                      onClick={() => onFocusNode(alert.nodeId!)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-cyan-300 hover:text-white transition-all active:scale-95"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Focus 3D</span>
                    </button>
                  )}

                  {alert.playbookId && (
                    <button
                      onClick={() => onOpenCrisisModal(alert.playbookId)}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600/90 hover:bg-red-500 text-[10px] font-mono text-white font-semibold transition-all shadow-sm active:scale-95"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Deploy Playbook</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
