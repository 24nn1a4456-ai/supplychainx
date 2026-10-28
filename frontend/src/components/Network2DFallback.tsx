import React, { useRef, useEffect, useState } from 'react';
import type { SupplyNode, SupplyRoute, NodeType } from '../types/supplyChain';
import { ShieldAlert, RotateCcw, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';

interface Network2DFallbackProps {
  nodes: SupplyNode[];
  routes: SupplyRoute[];
  selectedNodeId: string | null;
  onSelectNode: (node: SupplyNode | null) => void;
}

const NODE_COLORS: Record<NodeType, { base: string; border: string }> = {
  supplier: { base: '#00f0ff', border: '#00a8b5' },
  factory: { base: '#3b82f6', border: '#1d4ed8' },
  warehouse: { base: '#f59e0b', border: '#b45309' },
  distribution_center: { base: '#a855f7', border: '#7e22ce' },
  customer: { base: '#10b981', border: '#059669' }
};

export const Network2DFallback: React.FC<Network2DFallbackProps> = ({
  nodes,
  routes,
  selectedNodeId,
  onSelectNode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: SupplyNode; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Clear Canvas
      ctx.clearRect(0, 0, w, h);

      // Cyber Grid Background
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);

      ctx.strokeStyle = '#0b192e';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = -w; x < w * 2; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -h);
        ctx.lineTo(x, h * 2);
        ctx.stroke();
      }
      for (let y = -h; y < h * 2; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(w * 2, y);
        ctx.stroke();
      }

      // Precompute screen positions from 2D coordinates [pctX, pctY]
      const nodePosMap = new Map<string, { x: number; y: number }>();
      nodes.forEach(node => {
        const x = (node.position2D[0] / 100) * w;
        const y = (node.position2D[1] / 100) * h;
        nodePosMap.set(node.id, { x, y });
      });

      // Draw Routes
      routes.forEach(route => {
        const src = nodePosMap.get(route.sourceId);
        const tgt = nodePosMap.get(route.targetId);
        if (!src || !tgt) return;

        ctx.beginPath();
        const cpX = (src.x + tgt.x) / 2;
        const cpY = (src.y + tgt.y) / 2 - 40; // Curve elevation

        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(cpX, cpY, tgt.x, tgt.y);

        if (route.state === 'disrupted') {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
        } else if (route.state === 'delayed') {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
        } else {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated cargo packet moving along the quadratic curve
        const t = ((tick * 0.008 + (route.transitHours % 10) * 0.1) % 1);
        const px = (1 - t) * (1 - t) * src.x + 2 * (1 - t) * t * cpX + t * t * tgt.x;
        const py = (1 - t) * (1 - t) * src.y + 2 * (1 - t) * t * cpY + t * t * tgt.y;

        ctx.beginPath();
        ctx.arc(px, py, route.state === 'disrupted' ? 3.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = route.state === 'disrupted' ? '#ef4444' : route.state === 'delayed' ? '#f59e0b' : '#38bdf8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Nodes
      nodes.forEach(node => {
        const pos = nodePosMap.get(node.id);
        if (!pos) return;

        const isSelected = node.id === selectedNodeId;
        const isOutage = !!node.isCriticalOutage;
        const colorSpec = NODE_COLORS[node.type] || NODE_COLORS.factory;

        // If Critical Outage: Draw expanding ripple shockwave rings
        if (isOutage) {
          const pulse = (tick % 80) / 80;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 16 + pulse * 32, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 * (1 - pulse)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Selected halo
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Node circle
        const radius = isOutage ? 16 : isSelected ? 14 : 11;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isOutage ? '#dc2626' : colorSpec.base;
        ctx.shadowColor = isOutage ? '#ef4444' : colorSpec.base;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node Name Label
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = isOutage ? '#fca5a5' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, pos.x, pos.y + radius + 15);

        // Status badge
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = isOutage ? '#ef4444' : node.status === 'delayed' ? '#f59e0b' : '#38bdf8';
        ctx.fillText(`[${node.type.toUpperCase()}]`, pos.x, pos.y + radius + 27);
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [nodes, routes, selectedNodeId, zoom, panOffset]);

  // Handle Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Mouse Interactions for 2D Canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      setPanOffset(prev => ({
        x: prev.x + (mouseX - dragStartRef.current.x),
        y: prev.y + (mouseY - dragStartRef.current.y)
      }));
      dragStartRef.current = { x: mouseX, y: mouseY };
      return;
    }

    // Hit test
    const w = canvas.width;
    const h = canvas.height;
    const adjustedX = (mouseX - panOffset.x) / zoom;
    const adjustedY = (mouseY - panOffset.y) / zoom;

    let found: SupplyNode | null = null;
    for (const node of nodes) {
      const nx = (node.position2D[0] / 100) * w;
      const ny = (node.position2D[1] / 100) * h;
      const dist = Math.hypot(adjustedX - nx, adjustedY - ny);
      if (dist <= 24) {
        found = node;
        break;
      }
    }

    if (found) {
      setHoveredNode({ node: found, x: mouseX, y: mouseY });
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredNode(null);
      canvas.style.cursor = 'grab';
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    isDraggingRef.current = true;
    dragStartRef.current = { x: mouseX, y: mouseY };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDraggingRef.current = false;

    // Check click hit
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const w = canvas.width;
    const h = canvas.height;
    const adjustedX = (mouseX - panOffset.x) / zoom;
    const adjustedY = (mouseY - panOffset.y) / zoom;

    for (const node of nodes) {
      const nx = (node.position2D[0] / 100) * w;
      const ny = (node.position2D[1] / 100) * h;
      if (Math.hypot(adjustedX - nx, adjustedY - ny) <= 24) {
        onSelectNode(node);
        return;
      }
    }
  };

  const handleReset = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-950/90 shadow-[0_0_30px_rgba(0,240,255,0.06)]">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="w-full h-full block"
      />

      {/* Floating Tactical Banner */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900/90 border border-cyan-500/30 backdrop-blur-md text-xs font-mono text-cyan-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>2D TACTICAL SCHEMATIC // FALLBACK ENGINE</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-950/80 border border-red-500/50 backdrop-blur-md text-xs font-mono text-red-200">
          <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
          <span>CRITICAL OUTAGE: APEX SILICON FAB 4</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
        <button
          onClick={() => setZoom(prev => Math.min(2.5, prev + 0.2))}
          className="p-2 rounded-md bg-slate-900/90 border border-cyan-500/30 text-cyan-300 hover:text-white backdrop-blur-md transition-all active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
          className="p-2 rounded-md bg-slate-900/90 border border-cyan-500/30 text-cyan-300 hover:text-white backdrop-blur-md transition-all active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-900/90 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:text-white backdrop-blur-md transition-all active:scale-95"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Legend Box */}
      <div className="absolute bottom-4 left-4 z-20 p-3 rounded-lg bg-slate-900/85 border border-cyan-500/30 backdrop-blur-md text-xs font-mono shadow-xl pointer-events-auto">
        <div className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-bold mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>2D TOPOLOGY LEGEND</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff]" /> Supplier
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Factory
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Warehouse
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" /> Distribution
          </span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredNode && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-lg bg-slate-900/95 border border-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-md text-xs font-mono transition-opacity"
          style={{ left: hoveredNode.x, top: hoveredNode.y }}
        >
          <div className="font-bold text-white border-b border-cyan-500/20 pb-1 mb-1 flex items-center gap-2">
            <span>{hoveredNode.node.name}</span>
            {hoveredNode.node.isCriticalOutage && (
              <span className="px-1.5 rounded bg-red-600 text-[10px] text-white font-black animate-pulse">
                OUTAGE
              </span>
            )}
          </div>
          <div className="text-slate-300 text-[11px] space-y-0.5">
            <div>Type: <span className="text-cyan-300 capitalize">{hoveredNode.node.type}</span></div>
            <div>Throughput: <span className="text-cyan-400">{hoveredNode.node.throughputPerDay} units/d</span></div>
            <div>Utilization: <span className="text-emerald-400">{hoveredNode.node.capacityUtilizationPct}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
