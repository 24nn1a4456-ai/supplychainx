/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Globe2,
  Building2,
  Boxes,
  Factory,
  Truck,
  CloudRain,
  AlertTriangle,
  Info,
  Layers,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { DatabaseState, Supplier, Warehouse, Shipment } from '../../types.ts';

interface SupplyChainMapViewProps {
  state: DatabaseState;
}

interface WeatherHazardItem {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  severity: string;
  detail: string;
}

export const SupplyChainMapView: React.FC<SupplyChainMapViewProps> = ({ state }) => {
  const [selectedNode, setSelectedNode] = useState<{
    type: 'supplier' | 'warehouse' | 'shipment' | 'weather';
    data: any;
  } | null>(null);

  const [activeFilter, setActiveFilter] = useState<'all' | 'suppliers' | 'warehouses' | 'shipments' | 'hazards'>('all');
  const [weatherHazards, setWeatherHazards] = useState<WeatherHazardItem[]>([
    {
      id: 'haz-1',
      title: 'Typhoon Malakas Outer Bands',
      location: 'Taiwan Strait / Western Pacific',
      lat: 22.6,
      lng: 122.5,
      severity: 'critical',
      detail: '12m swells, wind gusts 94 km/h. Sea lane delayed by 30 hours.',
    },
    {
      id: 'haz-2',
      title: 'North Sea Coastal Gales',
      location: 'English Channel & Rotterdam Approach',
      lat: 52.5,
      lng: 3.5,
      severity: 'warning',
      detail: 'Container crane operations throttled to 80% due to wind shear.',
    },
  ]);

  useEffect(() => {
    // Fetch live weather observations from backend
    fetch('/api/weather')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const liveHazards: WeatherHazardItem[] = data.map((item: any, idx: number) => ({
            id: item.nodeId || `weather-${idx}`,
            title: `${item.condition || 'Weather'}: ${item.city || item.facilityName}`,
            location: `${item.city || 'Transit Port'}, ${item.country || ''}`,
            lat: item.lat || (item.city === 'Shenzhen' ? 22.54 : item.city === 'Rotterdam' ? 51.92 : 37.77),
            lng: item.lng || (item.city === 'Shenzhen' ? 114.05 : item.city === 'Rotterdam' ? 4.48 : -122.42),
            severity: item.riskLevel === 'high' || item.riskLevel === 'critical' ? 'critical' : item.riskLevel === 'medium' ? 'warning' : 'info',
            detail: item.riskDetails || `${item.description || item.condition} (${item.tempCelsius || 20}°C, wind: ${item.windSpeedMps || 0} m/s)`,
          }));
          setWeatherHazards(liveHazards);
        }
      })
      .catch((err) => console.warn('Live weather fetch fallback:', err));
  }, []);

  // Convert lat/lng to SVG percentage (Equirectangular projection)
  const projectCoords = (lat: number, lng: number) => {
    // x: -180 to 180 -> 0% to 100%
    const x = ((lng + 180) / 360) * 100;
    // y: 90 to -90 -> 0% to 100%
    const y = ((90 - lat) / 180) * 100;
    return { x: `${x.toFixed(2)}%`, y: `${y.toFixed(2)}%` };
  };

  return (
    <div className="space-y-4">
      {/* Map Control Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-blue-600" />
            Global Supply Chain Network Digital Twin
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time geospatial visualization of suppliers, tier 1-4 hubs, multi-modal freight routes, and meteorological hazards.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
          {(['all', 'suppliers', 'warehouses', 'shipments', 'hazards'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-2.5 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                activeFilter === filter
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-slate-950 rounded-xl border border-slate-800 p-3 relative overflow-hidden shadow-xl min-h-[520px] flex flex-col">
          {/* Map Canvas Background (Abstract World Geo Vector) */}
          <div className="relative w-full flex-1 rounded-lg bg-slate-900/90 border border-slate-800/80 overflow-hidden">
            {/* World Grid Lines */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Simulated Continent Outlines (SVG Path Shapes) */}
            <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 1000 500" fill="none">
              {/* Americas */}
              <path d="M 150 100 Q 220 80 250 140 Q 270 200 220 280 Q 260 320 280 440 Q 230 480 200 400 Q 180 320 150 240 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              {/* Eurasia / Africa */}
              <path d="M 480 80 Q 650 60 820 100 Q 860 180 800 240 Q 720 260 680 340 Q 550 440 500 360 Q 450 260 480 180 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              {/* Australia */}
              <path d="M 800 340 Q 880 330 890 380 Q 850 430 780 400 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
            </svg>

            {/* Transit Route Lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Ocean Route: Taiwan -> Oakland */}
              <path
                d="M 830 220 Q 950 180 999 180"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
              <path
                d="M 0 180 Q 100 180 160 170"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animate-pulse"
              />

              {/* Air Cargo Route: Singapore -> SFO */}
              <path
                d="M 788 250 Q 880 180 999 160"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />
              <path
                d="M 0 160 Q 80 160 160 170"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />

              {/* Road Route: Chicago -> Oakland */}
              <line
                x1="256"
                y1="160"
                x2="160"
                y2="170"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="5 3"
              />
            </svg>

            {/* Weather Alert Storm Discs */}
            {(activeFilter === 'all' || activeFilter === 'hazards') &&
              weatherHazards.map((haz) => {
                const pos = projectCoords(haz.lat, haz.lng);
                return (
                  <div
                    key={haz.id}
                    onClick={() => setSelectedNode({ type: 'weather', data: haz })}
                    style={{ left: pos.x, top: pos.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/60 animate-ping absolute" />
                    <div className="w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg border border-white">
                      <CloudRain className="w-3.5 h-3.5" />
                    </div>
                    <div className="hidden group-hover:block absolute left-7 top-0 bg-slate-900 border border-rose-500 text-white text-[11px] p-2 rounded shadow-xl whitespace-nowrap z-30">
                      <div className="font-bold text-rose-400">{haz.title}</div>
                      <div className="text-slate-300">{haz.detail}</div>
                    </div>
                  </div>
                );
              })}

            {/* Supplier Pins */}
            {(activeFilter === 'all' || activeFilter === 'suppliers') &&
              state.suppliers.map((sup) => {
                const pos = projectCoords(sup.coordinates.lat, sup.coordinates.lng);
                const isDisrupted = sup.operationalStatus === 'disrupted';
                return (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedNode({ type: 'supplier', data: sup })}
                    style={{ left: pos.x, top: pos.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    {isDisrupted && (
                      <div className="w-9 h-9 rounded-full bg-rose-500/40 animate-ping absolute -top-1.5 -left-1.5" />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform group-hover:scale-125 ${
                        isDisrupted
                          ? 'bg-rose-600 text-white animate-bounce'
                          : sup.code === 'APEX-SG'
                          ? 'bg-emerald-500 text-white ring-2 ring-emerald-400'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      <Building2 className="w-3 h-3" />
                    </div>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-slate-200 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                      {sup.code}
                    </span>
                  </div>
                );
              })}

            {/* Warehouse Pins */}
            {(activeFilter === 'all' || activeFilter === 'warehouses') &&
              state.warehouses.map((wh) => {
                const pos = projectCoords(wh.coordinates.lat, wh.coordinates.lng);
                const isOakland = wh.code === 'WH-OAK';
                return (
                  <div
                    key={wh.id}
                    onClick={() => setSelectedNode({ type: 'warehouse', data: wh })}
                    style={{ left: pos.x, top: pos.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-md border-2 border-white transition-transform group-hover:scale-125 ${
                        isOakland
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <Boxes className="w-3 h-3" />
                    </div>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-slate-200 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                      {wh.code}
                    </span>
                  </div>
                );
              })}

            {/* Active Shipments Icons on Routes */}
            {(activeFilter === 'all' || activeFilter === 'shipments') &&
              state.shipments.map((ship, idx) => {
                // approximate midpoint
                const midLat = (ship.originCoords.lat + ship.destCoords.lat) / 2;
                const midLng = (ship.originCoords.lng + ship.destCoords.lng) / 2;
                const pos = projectCoords(midLat, midLng);

                return (
                  <div
                    key={ship.id}
                    onClick={() => setSelectedNode({ type: 'shipment', data: ship })}
                    style={{ left: pos.x, top: pos.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    <div
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 shadow-lg border ${
                        ship.delayHours > 0
                          ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
                          : 'bg-cyan-600 text-white border-cyan-400'
                      }`}
                    >
                      <Truck className="w-3 h-3" />
                      <span>{ship.trackingNumber.split('-')[1]}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Map Legend Bar */}
          <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Primary Supplier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Disrupted Supplier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Emergency Backup Supplier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Logistics Hub / Warehouse
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 animate-ping"></span> Meteorological Hazard
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">Equirectangular Proj. WGS84</span>
          </div>
        </div>

        {/* Selected Entity Inspector Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                Node Inspector
              </h3>
              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {selectedNode ? selectedNode.type : 'Select Node'}
              </span>
            </div>

            {selectedNode ? (
              <div className="space-y-3 text-xs">
                {selectedNode.type === 'supplier' && (
                  <>
                    <div>
                      <div className="text-[11px] text-slate-500">Supplier Name</div>
                      <div className="font-bold text-sm text-slate-900">{selectedNode.data.name}</div>
                      <div className="text-slate-600">{selectedNode.data.city}, {selectedNode.data.country}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div className="bg-slate-50 p-2 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">Status</div>
                        <div className={`font-bold capitalize ${
                          selectedNode.data.operationalStatus === 'disrupted' ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {selectedNode.data.operationalStatus}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">Reliability</div>
                        <div className="font-bold text-slate-900">{selectedNode.data.reliabilityScore}%</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">Lead Time</div>
                        <div className="font-bold text-slate-900">{selectedNode.data.leadTimeDays} Days</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <div className="text-[10px] text-slate-500 uppercase">Unit Cost</div>
                        <div className="font-bold text-slate-900">${selectedNode.data.costPerUnit}</div>
                      </div>
                    </div>
                    {selectedNode.data.outageReason && (
                      <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                        <div className="font-bold">Active Outage Alert:</div>
                        <div>{selectedNode.data.outageReason}</div>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'warehouse' && (
                  <>
                    <div>
                      <div className="text-[11px] text-slate-500">Warehouse Hub</div>
                      <div className="font-bold text-sm text-slate-900">{selectedNode.data.name}</div>
                      <div className="text-slate-600">{selectedNode.data.city}, {selectedNode.data.country}</div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Capacity:</span>
                        <span className="font-semibold text-slate-900">{selectedNode.data.capacityUnits.toLocaleString()} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Utilized:</span>
                        <span className="font-semibold text-slate-900">{selectedNode.data.utilizedUnits.toLocaleString()} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dock Doors:</span>
                        <span className="font-semibold text-slate-900">{selectedNode.data.dockDoors}</span>
                      </div>
                    </div>
                  </>
                )}

                {selectedNode.type === 'shipment' && (
                  <>
                    <div>
                      <div className="text-[11px] text-slate-500">Shipment Route</div>
                      <div className="font-bold text-sm text-slate-900">{selectedNode.data.trackingNumber}</div>
                      <div className="text-slate-600">{selectedNode.data.carrier}</div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Transport Mode:</span>
                        <span className="font-semibold text-slate-900">{selectedNode.data.transportMode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cargo Value:</span>
                        <span className="font-semibold text-slate-900">${selectedNode.data.cargoValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Delay Status:</span>
                        <span className={`font-semibold ${selectedNode.data.delayHours > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {selectedNode.data.delayHours > 0 ? `+${selectedNode.data.delayHours}h Delay` : 'On Schedule'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {selectedNode.type === 'weather' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-2">
                    <div className="font-bold flex items-center gap-1 text-sm text-rose-700">
                      <AlertTriangle className="w-4 h-4" />
                      {selectedNode.data.title}
                    </div>
                    <div className="text-xs text-slate-700">{selectedNode.data.detail}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Click any node, supplier, warehouse, or shipment route on the map to inspect live telemetry.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Synchronized telemetry</span>
            <span className="font-mono text-emerald-600 font-semibold">● LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
