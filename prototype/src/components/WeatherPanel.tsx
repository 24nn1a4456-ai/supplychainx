import React, { useState, useEffect } from 'react';
import type { WeatherSummaryResponse } from '../types/supplyChain';
import { apiClient } from '../services/apiClient';
import {
  CloudSun,
  CloudRain,
  CloudLightning,
  Wind,
  Droplets,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Radio,
  Filter
} from 'lucide-react';

interface WeatherPanelProps {
  onFocusNode?: (nodeId: string) => void;
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({ onFocusNode }) => {
  const [data, setData] = useState<WeatherSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchWeatherData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getWeatherDisruptions();
      setData(response);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve meteorological telemetry';
      setError(message);
      // Auto-fallback: populate deterministic synthetic weather if external API drops
      setData(prev => prev || {
        status: 'success',
        source: 'fallback_telemetry',
        totalMonitored: 9,
        severeRisksCount: 1,
        moderateRisksCount: 2,
        reports: [
          {
            nodeId: 'node-sup-1',
            facilityName: 'Apex Silicon Fab 4',
            city: 'Shenzhen',
            country: 'CN',
            region: 'Asia-Pacific',
            tempCelsius: 28.5,
            condition: 'Typhoon',
            description: 'Cat-4 Typhoon Harbor Embargo',
            windSpeedMps: 29.4,
            humidityPct: 94,
            pressureHpa: 965,
            riskLevel: 'severe',
            riskDetails: 'Harbor embargo active. Feeder sea routes grounded in Shenzhen corridor.',
            source: 'fallback_telemetry'
          },
          {
            nodeId: 'node-sup-3',
            facilityName: 'Tokyo Precision Optics',
            city: 'Yokohama',
            country: 'JP',
            region: 'Asia-Pacific',
            tempCelsius: 21.0,
            condition: 'Clear',
            description: 'Clear sky (simulated telemetry)',
            windSpeedMps: 3.2,
            humidityPct: 60,
            pressureHpa: 1014,
            riskLevel: 'low',
            riskDetails: 'Optimal meteorological conditions for cargo transport and flight schedules.',
            source: 'fallback_telemetry'
          },
          {
            nodeId: 'node-fac-1',
            facilityName: 'Giga Assembly Complex',
            city: 'Austin',
            country: 'US',
            region: 'North America',
            tempCelsius: 22.4,
            condition: 'Clear',
            description: 'Clear sky (simulated telemetry)',
            windSpeedMps: 2.8,
            humidityPct: 52,
            pressureHpa: 1018,
            riskLevel: 'low',
            riskDetails: 'Optimal meteorological conditions for cargo transport and flight schedules.',
            source: 'fallback_telemetry'
          },
          {
            nodeId: 'node-wh-2',
            facilityName: 'Singapore Air Cargo Hub',
            city: 'Singapore',
            country: 'SG',
            region: 'Asia-Pacific',
            tempCelsius: 30.1,
            condition: 'Clouds',
            description: 'Scattered clouds (simulated telemetry)',
            windSpeedMps: 4.1,
            humidityPct: 78,
            pressureHpa: 1010,
            riskLevel: 'low',
            riskDetails: 'Optimal flight operations for express air charter dispatch.',
            source: 'fallback_telemetry'
          }
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(interval);
  }, []);

  const filteredReports = (data?.reports || []).filter(report => {
    if (filterRisk === 'all') return true;
    return report.riskLevel.toLowerCase() === filterRisk.toLowerCase();
  });

  const getRiskBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'severe':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/80 text-red-300 border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
            SEVERE
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.25)] flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            HIGH
          </span>
        );
      case 'moderate':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-900/30 text-amber-200/90 border border-amber-500/30">
            MODERATE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/50 text-emerald-300/90 border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
            NOMINAL
          </span>
        );
    }
  };

  const getWeatherIcon = (condition: string) => {
    const cond = condition.toLowerCase();
    if (cond.includes('thunder') || cond.includes('storm') || cond.includes('lightning')) {
      return <CloudLightning className="w-4 h-4 text-amber-400" />;
    }
    if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
      return <CloudRain className="w-4 h-4 text-cyan-400" />;
    }
    if (cond.includes('wind') || cond.includes('gale') || cond.includes('typhoon')) {
      return <Wind className="w-4 h-4 text-indigo-400" />;
    }
    return <CloudSun className="w-4 h-4 text-amber-300" />;
  };

  return (
    <div className="glass-panel flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
            <CloudSun className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
                GLOBAL METEOROLOGICAL DISRUPTIONS
              </h3>
              {data?.source === 'openweather_live' ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-[9px] font-mono text-emerald-300 flex items-center gap-1 shadow-[0_0_6px_rgba(16,185,129,0.3)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE OPENWEATHER
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[9px] font-mono text-slate-300 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 text-slate-400" />
                  TELEMETRY SIM
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
              Live weather impact monitoring across key production facilities, gateways, and logistics nodes
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Risk Filter */}
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
            <Filter className="w-3 h-3 text-slate-400 ml-1.5" />
            <select
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value)}
              className="bg-transparent text-slate-200 text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">ALL RISKS ({data?.totalMonitored || 9})</option>
              <option value="severe" className="bg-slate-900 text-red-300">SEVERE ({data?.severeRisksCount || 0})</option>
              <option value="moderate" className="bg-slate-900 text-amber-300">MODERATE ({data?.moderateRisksCount || 0})</option>
              <option value="low" className="bg-slate-900 text-emerald-300">NOMINAL</option>
            </select>
          </div>

          <button
            onClick={fetchWeatherData}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/70 text-[10px] font-mono text-slate-300 hover:text-cyan-300 transition-colors disabled:opacity-50"
            title="Refresh weather telemetry"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">SYNC</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3">
        {isLoading && !data ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-xs">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <span>CONNECTING TO OPENWEATHER API TELEMETRY...</span>
          </div>
        ) : error && !data ? (
          <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 font-mono text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">METEOROLOGICAL DATA STREAM OFFLINE</div>
              <div className="text-[11px] text-red-300/80 mt-0.5">{error}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2.5">
            {filteredReports.map(report => (
              <div
                key={report.nodeId}
                onClick={() => onFocusNode?.(report.nodeId)}
                className={`group relative p-2.5 rounded-lg border transition-all cursor-pointer ${
                  report.riskLevel === 'severe'
                    ? 'bg-red-950/20 border-red-500/40 hover:border-red-400 hover:bg-red-950/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                    : report.riskLevel === 'high' || report.riskLevel === 'moderate'
                    ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-950/25'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-900/60'
                }`}
              >
                {/* Node Top Row */}
                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                        {report.city}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({report.country})
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {report.facilityName}
                    </div>
                  </div>
                  <div>{getRiskBadge(report.riskLevel)}</div>
                </div>

                {/* Weather Metrics */}
                <div className="flex items-center justify-between text-xs font-mono pt-1.5 border-t border-slate-800/60">
                  <div className="flex items-center gap-1 text-slate-200">
                    {getWeatherIcon(report.condition)}
                    <span className="font-medium">
                      {report.tempCelsius !== null ? `${report.tempCelsius}°C` : '--'}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {report.condition}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    {report.windSpeedMps !== null && (
                      <span className="flex items-center gap-0.5" title="Wind Speed">
                        <Wind className="w-3 h-3 text-slate-400" />
                        {report.windSpeedMps}m/s
                      </span>
                    )}
                    {report.humidityPct !== null && (
                      <span className="flex items-center gap-0.5" title="Humidity">
                        <Droplets className="w-3 h-3 text-slate-400" />
                        {report.humidityPct}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Risk Details Note if present */}
                {report.riskDetails && (
                  <div className="mt-1.5 text-[9px] font-mono text-amber-300/90 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20 truncate">
                    {report.riskDetails}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 px-1">
          <div className="flex items-center gap-3">
            <span>
              TOTAL MONITORED: <strong className="text-cyan-300">{data?.totalMonitored || 9} HUBS</strong>
            </span>
            <span>
              CRITICAL/SEVERE: <strong className={data?.severeRisksCount ? 'text-red-400' : 'text-emerald-400'}>{data?.severeRisksCount || 0}</strong>
            </span>
            <span>
              MODERATE: <strong className={data?.moderateRisksCount ? 'text-amber-300' : 'text-slate-300'}>{data?.moderateRisksCount || 0}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>UPDATED: {lastUpdated || 'SYNCING...'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
