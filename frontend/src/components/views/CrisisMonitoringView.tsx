/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Search,
  Scan,
  Bot,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { DatabaseState, CrisisIncident } from '../../types.ts';
import { NavigationTab } from '../Sidebar.tsx';

interface CrisisMonitoringViewProps {
  state: DatabaseState;
  onRefresh: () => void;
  onOrchestrate: (crisisId: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const CrisisMonitoringView: React.FC<CrisisMonitoringViewProps> = ({
  state,
  onRefresh,
  onOrchestrate,
  onNavigate,
}) => {
  const [selectedCrisis, setSelectedCrisis] = useState<CrisisIncident | null>(
    state.crises[0] || null
  );
  const [isScanning, setIsScanning] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('all');

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await fetch('/api/crises/detect', { method: 'POST' });
      onRefresh();
    } finally {
      setIsScanning(false);
    }
  };

  const filteredCrises = state.crises.filter(
    (c) => severityFilter === 'all' || c.severity === severityFilter
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Autonomous Crisis Detection & Telemetry Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous automated telemetry scans across supplier statuses, warehouse coverage runways, weather alerts, and customer SLAs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Scan className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Network...' : 'Run Detection Cycle'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Incident List + Incident Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">
              Disruption Queue ({filteredCrises.length} incidents)
            </span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-800 font-medium"
              >
                <option value="all">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {filteredCrises.length === 0 ? (
              <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No disruptions detected matching filter.
              </div>
            ) : (
              filteredCrises.map((c) => {
                const isSelected = selectedCrisis?.id === c.id;
                const isCritical = c.severity === 'Critical';

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCrisis(c)}
                    className={`bg-white p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{c.incidentCode}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCritical
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {c.severity}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(c.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        ${c.estimatedFinancialImpact.toLocaleString()} Impact
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 mt-2">{c.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.evidence}</p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 capitalize flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Status: {c.status.replace('_', ' ')}
                      </span>

                      {c.status === 'detected' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOrchestrate(c.id);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Run Multi-Agent Recovery</span>
                        </button>
                      )}
                      {c.status === 'pending_approval' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('approval_center');
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Review Plan</span>
                        </button>
                      )}
                      {c.status === 'verified_resolved' && (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Resolved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Incident Deep Inspection Card */}
        <div>
          {selectedCrisis ? (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 sticky top-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900">{selectedCrisis.incidentCode}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Confidence: {(selectedCrisis.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 mt-1">{selectedCrisis.title}</h3>
                <div className="text-xs text-slate-500 mt-0.5">Source: {selectedCrisis.source}</div>
              </div>

              {/* Evidence */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Telemetry Evidence
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed font-mono">
                  {selectedCrisis.evidence}
                </div>
              </div>

              {/* Affected Entities */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Affected Supply Chain Nodes
                </div>
                <div className="space-y-1">
                  {selectedCrisis.affectedEntities.map((ent, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                    >
                      <span className="font-medium text-slate-800">{ent.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{ent.entityType}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gemini / Orchestrator Root Cause Briefing */}
              {selectedCrisis.rootCauseSummary && (
                <div>
                  <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">
                    AI Root Cause & Resolution Briefing
                  </div>
                  <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    {selectedCrisis.rootCauseSummary}
                  </div>
                </div>
              )}

              {/* Primary Action Button */}
              <div className="pt-2">
                {selectedCrisis.status === 'detected' && (
                  <button
                    onClick={() => onOrchestrate(selectedCrisis.id)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Run Multi-Agent AI Workflow</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {selectedCrisis.status === 'pending_approval' && (
                  <button
                    onClick={() => onNavigate('approval_center')}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Go to Approval Center</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {selectedCrisis.status === 'verified_resolved' && (
                  <button
                    onClick={() => onNavigate('execution_verification')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>View Verification Audit Trail</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
              Select an incident from the queue to view telemetry evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
