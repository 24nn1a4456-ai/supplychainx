import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SupplyNode, SupplyRoute, NodeType } from '../../types/supplyChain';
import { RotateCcw, Compass, Eye, ShieldAlert, Sparkles } from 'lucide-react';

interface Network3DProps {
  nodes: SupplyNode[];
  routes: SupplyRoute[];
  selectedNodeId: string | null;
  onSelectNode: (node: SupplyNode | null) => void;
  onWebGLError?: () => void;
}

const NODE_COLORS: Record<NodeType, { base: number; emissive: number; hex: string }> = {
  supplier: { base: 0x00f0ff, emissive: 0x00a8b5, hex: '#00f0ff' },
  factory: { base: 0x3b82f6, emissive: 0x1d4ed8, hex: '#3b82f6' },
  warehouse: { base: 0xf59e0b, emissive: 0xb45309, hex: '#f59e0b' },
  distribution_center: { base: 0xa855f7, emissive: 0x7e22ce, hex: '#a855f7' },
  customer: { base: 0x10b981, emissive: 0x059669, hex: '#10b981' }
};

export const Network3D: React.FC<Network3DProps> = ({
  nodes,
  routes,
  selectedNodeId,
  onSelectNode,
  onWebGLError
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: SupplyNode; x: number; y: number } | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const defaultCameraPos = new THREE.Vector3(0, 9, 15);
  const defaultTarget = new THREE.Vector3(0, 1.5, 0);

  // Reset Camera Handler
  const handleResetCamera = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(defaultCameraPos);
      controlsRef.current.target.copy(defaultTarget);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Verify WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        onWebGLError?.();
        return;
      }
    } catch {
      onWebGLError?.();
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.025);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    camera.position.copy(defaultCameraPos);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 35;
    controls.minDistance = 4;
    controls.maxPolarAngle = Math.PI / 2 + 0.08; // Allow slight under-view
    controls.target.copy(defaultTarget);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x223355, 1.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight1.position.set(10, 20, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 1.5);
    dirLight2.position.set(-10, -10, -10);
    scene.add(dirLight2);

    // 6. Holographic Ground Grid & Circular Range Ring
    const gridHelper = new THREE.GridHelper(30, 30, 0x00f0ff, 0x112244);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    const ringGeo = new THREE.RingGeometry(12, 12.08, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
    const floorRing = new THREE.Mesh(ringGeo, ringMat);
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = -1.98;
    scene.add(floorRing);

    // 7. Node Meshes & Mapping
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeMeshMap = new Map<string, THREE.Mesh>();
    const nodeMap = new Map<string, SupplyNode>(nodes.map(n => [n.id, n]));

    // Critical Outage beacons storage
    const outageRings: { mesh: THREE.Mesh; scale: number; speed: number; maxScale: number }[] = [];
    const hazardDiamonds: THREE.Mesh[] = [];

    // Particle convoys traveling along routes
    interface RouteParticle {
      mesh: THREE.Mesh;
      curve: THREE.CatmullRomCurve3;
      progress: number;
      speed: number;
    }
    const routeParticles: RouteParticle[] = [];

    // Create Nodes
    nodes.forEach(node => {
      const isSelected = node.id === selectedNodeId;
      const isOutage = !!node.isCriticalOutage;
      const colorSpec = NODE_COLORS[node.type] || NODE_COLORS.factory;

      // Base radius
      const radius = isOutage ? 0.65 : isSelected ? 0.58 : 0.44;

      // Primary Sphere
      const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: isOutage ? 0xef4444 : colorSpec.base,
        emissive: isOutage ? 0xff2222 : colorSpec.emissive,
        emissiveIntensity: isOutage ? 1.4 : isSelected ? 1.0 : 0.6,
        roughness: 0.2,
        metalness: 0.8
      });

      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(node.position3D[0], node.position3D[1], node.position3D[2]);
      sphere.userData = { nodeId: node.id };
      scene.add(sphere);
      nodeMeshes.push(sphere);
      nodeMeshMap.set(node.id, sphere);

      // Orbital wireframe ring for high-tech aesthetic
      const orbitRingGeo = new THREE.TorusGeometry(radius * 1.5, 0.02, 8, 32);
      const orbitRingMat = new THREE.MeshBasicMaterial({
        color: isOutage ? 0xff3b30 : colorSpec.base,
        transparent: true,
        opacity: 0.5
      });
      const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
      orbitRing.rotation.x = Math.PI / 3;
      sphere.add(orbitRing);

      // Selected Reticle Ring
      if (isSelected) {
        const selRingGeo = new THREE.RingGeometry(radius * 1.8, radius * 1.92, 32);
        const selRingMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.position.set(0, 0, 0);
        sphere.add(selRing);
      }

      // If Critical Outage, create expanding shockwave hazard rings & spinning diamond
      if (isOutage) {
        for (let i = 0; i < 3; i++) {
          const outRingGeo = new THREE.RingGeometry(0.7, 0.82, 32);
          const outRingMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
          });
          const outMesh = new THREE.Mesh(outRingGeo, outRingMat);
          outMesh.position.set(node.position3D[0], node.position3D[1], node.position3D[2]);
          outMesh.rotation.x = Math.PI / 2;
          scene.add(outMesh);
          outageRings.push({
            mesh: outMesh,
            scale: 1 + i * 0.8,
            speed: 0.018 + i * 0.005,
            maxScale: 3.8
          });
        }

        // Floating hazard diamond
        const diamondGeo = new THREE.OctahedronGeometry(0.3, 0);
        const diamondMat = new THREE.MeshBasicMaterial({ color: 0xff0044, wireframe: true });
        const diamond = new THREE.Mesh(diamondGeo, diamondMat);
        diamond.position.set(node.position3D[0], node.position3D[1] + 1.2, node.position3D[2]);
        scene.add(diamond);
        hazardDiamonds.push(diamond);
      }
    });

    // 8. Curved Bezier Route Lines
    routes.forEach(route => {
      const srcNode = nodeMap.get(route.sourceId);
      const tgtNode = nodeMap.get(route.targetId);
      if (!srcNode || !tgtNode) return;

      const p1 = new THREE.Vector3(...srcNode.position3D);
      const p2 = new THREE.Vector3(...tgtNode.position3D);

      // Midpoint arched upward for 3D flight/freight curve
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      mid.y += Math.max(1.2, dist * 0.28);

      const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
      const points = curve.getPoints(36);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);

      // Route state colors: normal = cyan/green, delayed = amber, disrupted = red
      let routeColor = 0x00f0ff;
      let lineOpacity = 0.6;
      if (route.state === 'disrupted') {
        routeColor = 0xef4444;
        lineOpacity = 0.9;
      } else if (route.state === 'delayed') {
        routeColor = 0xf59e0b;
        lineOpacity = 0.7;
      }

      const curveMat = new THREE.LineBasicMaterial({
        color: routeColor,
        transparent: true,
        opacity: lineOpacity,
        linewidth: route.state === 'disrupted' ? 2 : 1
      });

      const line = new THREE.Line(curveGeo, curveMat);
      scene.add(line);

      // Add animated cargo packet particle traveling along curve
      const particleGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const particleMat = new THREE.MeshBasicMaterial({
        color: route.state === 'disrupted' ? 0xff2222 : route.state === 'delayed' ? 0xffaa00 : 0x00ffff
      });
      const particleMesh = new THREE.Mesh(particleGeo, particleMat);
      scene.add(particleMesh);

      routeParticles.push({
        mesh: particleMesh,
        curve,
        progress: Math.random(),
        speed: route.state === 'disrupted' ? 0.001 : route.state === 'delayed' ? 0.003 : 0.006
      });
    });

    // 9. Raycasting for Click & Hover Tooltips
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const nodeId = hit.object.userData?.nodeId;
        const targetNode = nodeMap.get(nodeId);
        if (targetNode) {
          setHoveredNode({
            node: targetNode,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          });
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredNode(null);
      container.style.cursor = 'grab';
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes, false);

      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData?.nodeId;
        const targetNode = nodeMap.get(nodeId);
        if (targetNode) {
          onSelectNode(targetNode);
          return;
        }
      }
    };

    container.addEventListener('mousemove', onPointerMove);
    container.addEventListener('click', onClick);

    // 10. Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // 11. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Controls update
      controls.autoRotate = isRotating;
      controls.autoRotateSpeed = 0.65;
      controls.update();

      // Animate outage rings
      outageRings.forEach(ring => {
        ring.scale += ring.speed;
        if (ring.scale > ring.maxScale) {
          ring.scale = 1;
        }
        ring.mesh.scale.set(ring.scale, ring.scale, 1);
        const mat = ring.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.85 * (1 - ring.scale / ring.maxScale));
      });

      // Animate hazard diamonds
      hazardDiamonds.forEach(diamond => {
        diamond.rotation.y += 0.04;
        diamond.rotation.x = Math.sin(elapsed * 2) * 0.2;
      });

      // Animate Route Cargo Convoys
      routeParticles.forEach(rp => {
        rp.progress = (rp.progress + rp.speed) % 1;
        const pos = rp.curve.getPoint(rp.progress);
        rp.mesh.position.copy(pos);
      });

      // Gently pulse selected reticles or node meshes
      nodeMeshes.forEach(mesh => {
        const ring = mesh.children[0];
        if (ring) {
          ring.rotation.z += 0.015;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // 12. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('click', onClick);

      // Dispose Three objects
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [nodes, routes, selectedNodeId, onSelectNode, isRotating, onWebGLError, defaultCameraPos, defaultTarget]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/80 shadow-md">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full min-h-[500px]" />

      {/* Floating Tactical HUD Overlay */}
      <div className="absolute top-3.5 left-3.5 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/85 border border-slate-700/80 backdrop-blur-md text-xs font-mono text-cyan-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="font-medium tracking-wide">3D TOPOLOGY // LIVE STREAM</span>
          <span className="text-[10px] text-slate-400 ml-1">({nodes.length} NODES)</span>
        </div>

        {/* Critical Outage Beacon Alert HUD (only if critical outage exists) */}
        {nodes.some(n => n.isCriticalOutage) && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-950/70 border border-red-500/60 backdrop-blur-md text-xs font-mono text-red-200 shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span className="font-semibold tracking-wide">OUTAGE: APEX FAB 4</span>
          </div>
        )}
      </div>

      {/* Floating Controls Bar */}
      <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
        <button
          onClick={handleResetCamera}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/85 border border-slate-700/80 hover:border-cyan-400/50 text-xs font-mono text-slate-300 hover:text-white backdrop-blur-md transition-all shadow-sm active:scale-95"
          title="Reset Camera to Global View"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Reset View</span>
        </button>

        <button
          onClick={() => setIsRotating(prev => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono backdrop-blur-md transition-all shadow-sm active:scale-95 ${
            isRotating
              ? 'bg-cyan-950/60 border-cyan-400/50 text-cyan-200'
              : 'bg-slate-900/85 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Auto Rotation"
        >
          <Compass className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-cyan-300' : ''}`} />
          <span>{isRotating ? 'Orbiting' : 'Paused'}</span>
        </button>
      </div>

      {/* Interactive Legend Box */}
      <div className="absolute bottom-3.5 left-3.5 z-20 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 backdrop-blur-md text-xs font-mono shadow-md pointer-events-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>TOPOLOGY LEGEND</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
            <span>Supplier</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_6px_#3b82f6]" />
            <span>Factory</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_6px_#f59e0b]" />
            <span>Warehouse</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shadow-[0_0_6px_#a855f7]" />
            <span>Distribution</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
            <span>Customer Demand Node</span>
          </div>
        </div>

        <div className="border-t border-slate-700/60 my-2 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Route Status</div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Normal
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Delayed
            </span>
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <span className="w-3 h-0.5 bg-red-500 inline-block animate-pulse" /> Disrupted
            </span>
          </div>
        </div>
      </div>

      {/* Hover Tooltip Overlay */}
      {hoveredNode && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-lg bg-slate-900/95 border border-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-md text-xs font-mono transition-opacity"
          style={{ left: hoveredNode.x, top: hoveredNode.y }}
        >
          <div className="flex items-center gap-2 font-bold text-white border-b border-cyan-500/20 pb-1 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: NODE_COLORS[hoveredNode.node.type]?.hex || '#00f0ff' }}
            />
            <span>{hoveredNode.node.name}</span>
            {hoveredNode.node.isCriticalOutage && (
              <span className="px-1.5 py-0.2 rounded bg-red-600 text-[10px] text-white font-black animate-pulse">
                OUTAGE
              </span>
            )}
          </div>
          <div className="space-y-0.5 text-slate-300 text-[11px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Type:</span>
              <span className="text-cyan-300 capitalize">{hoveredNode.node.type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Location:</span>
              <span className="text-slate-200">{hoveredNode.node.location}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Throughput:</span>
              <span className="text-cyan-400">{hoveredNode.node.throughputPerDay} units/day</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Capacity:</span>
              <span className={hoveredNode.node.capacityUtilizationPct > 90 ? 'text-amber-400' : 'text-emerald-400'}>
                {hoveredNode.node.capacityUtilizationPct}%
              </span>
            </div>
            {hoveredNode.node.disruptionCause && (
              <div className="mt-1 pt-1 border-t border-red-500/30 text-red-300 text-[10px] leading-tight">
                ⚠️ {hoveredNode.node.disruptionCause}
              </div>
            )}
          </div>
          <div className="mt-1.5 text-[9px] text-cyan-400/70 text-right flex items-center justify-end gap-1">
            <Eye className="w-2.5 h-2.5" />
            <span>Click to inspect telemetry</span>
          </div>
        </div>
      )}
    </div>
  );
};
