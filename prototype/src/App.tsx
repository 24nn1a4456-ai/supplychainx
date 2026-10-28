import React, { useState, useEffect } from 'react';
import type {
  SupplyNode,
  SupplyRoute,
  KPIData,
  DisruptionAlert,
  CrisisPlaybook,
  OutageSimulationState,
  AuditLogEntry
} from './types/supplyChain';
import {
  INITIAL_NODES,
  INITIAL_ROUTES,
  INITIAL_KPIS,
  INITIAL_ALERTS,
  INITIAL_INVENTORY,
  CRISIS_PLAYBOOKS,
  BASELINE_NODES,
  BASELINE_ROUTES,
  BASELINE_KPIS,
  DEMO_ALTERNATIVE_SUPPLIERS,
  DEMO_WAREHOUSE_OPTIONS,
  DEMO_PROPOSED_PLAN,
  INITIAL_OUTAGE_SIMULATION_STATE
} from './services/api';
import { Network3D } from './components/Network3D';
import { Network2DFallback } from './components/Network2DFallback';
import { KPICards } from './components/KPICards';
import { AlertsPanel } from './components/AlertsPanel';
import { NodeInspectorModal } from './components/NodeInspectorModal';
import { CrisisRecoveryModal } from './components/CrisisRecoveryModal';
import { InventoryAnalytics } from './components/InventoryAnalytics';
import { OutageWorkflowStepper } from './components/OutageWorkflowStepper';
import { OutageWorkflowModal } from './components/OutageWorkflowModal';
import { CrisisActionCenter } from './components/CrisisActionCenter';
import { WeatherPanel } from './components/WeatherPanel';
import { MultiAgentCrisisWorkspace } from './components/MultiAgentCrisisWorkspace';
import { apiClient } from './services/apiClient';
import {
  Globe,
  Box,
  Layers,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  LayoutDashboard,
  Activity,
  CloudSun,
  Database
} from 'lucide-react';

export const App: React.FC = () => {
  // Supply Chain Baseline State (Starts pristine in 'idle' stage)
  const [nodes, setNodes] = useState<SupplyNode[]>(BASELINE_NODES);
  const [routes, setRoutes] = useState<SupplyRoute[]>(BASELINE_ROUTES);
  const [kpis, setKpis] = useState<KPIData>(BASELINE_KPIS);
  const [alerts, setAlerts] = useState<DisruptionAlert[]>([]);
  const [playbooks, setPlaybooks] = useState<CrisisPlaybook[]>(CRISIS_PLAYBOOKS);

  // Workflow Demo State
  const [outageState, setOutageState] = useState<OutageSimulationState>(INITIAL_OUTAGE_SIMULATION_STATE);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState<boolean>(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  // General UI States
  const [selectedNode, setSelectedNode] = useState<SupplyNode | null>(null);
  const [isCrisisModalOpen, setIsCrisisModalOpen] = useState<boolean>(false);
  const [activePlaybookId, setActivePlaybookId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [webGLError, setWebGLError] = useState<boolean>(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'all' | 'agents' | 'weather' | 'inventory'>('all');

  // Backend Connectivity and Live Telemetry State
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Fetch Live Telemetry from FastAPI Backend
  const loadBackendData = async (isManualRefresh = false) => {
    try {
      // 1. Verify health
      await apiClient.getHealth();
      setBackendStatus('connected');

      // 2. Fetch network topology, KPIs, audit, and active crisis workflow state
      const [liveNodes, liveRoutes, liveKpis, liveCrisisState] = await Promise.all([
        apiClient.getNodes(),
        apiClient.getRoutes(),
        apiClient.getKpis(),
        apiClient.getCrisisState()
      ]);

      if (liveCrisisState) {
        setOutageState(liveCrisisState);
      }
      if (liveNodes && liveNodes.length > 0) setNodes(liveNodes);
      if (liveRoutes && liveRoutes.length > 0) setRoutes(liveRoutes);
      if (liveKpis) setKpis(liveKpis);

      if (isManualRefresh) {
        setNotification({
          message: 'SYNC COMPLETE: Live telemetry synced from FastAPI backend.',
          type: 'success'
        });
      }
    } catch (err: unknown) {
      setBackendStatus('disconnected');
      const msg = err instanceof Error ? err.message : 'Backend unreachable';
      console.warn('[SupplyChainX] Backend connection notice:', msg);

      if (isManualRefresh) {
        setNotification({
          message: `BACKEND OFFLINE: Using offline demo telemetry adapter. (${msg})`,
          type: 'warning'
        });
      }
    }
  };

  // Initial backend check on mount
  useEffect(() => {
    loadBackendData();
  }, []);

  // Temporary Notification Auto-Dismiss
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleWebGLError = () => {
    setWebGLError(true);
    setViewMode('2d');
  };

  const handleFocusNode = (nodeId: string) => {
    const target = nodes.find(n => n.id === nodeId);
    if (target) {
      setSelectedNode(target);
    }
  };

  const handleOpenCrisisModal = (playbookId?: string) => {
    setActivePlaybookId(playbookId || 'playbook-apex-divert');
    setIsCrisisModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // SUPPLIER OUTAGE WORKFLOW DEMO CONTROLLER (FastAPI Backend Integration)
  // --------------------------------------------------------------------------

  // Sync state and telemetry from live backend state
  const syncFromBackendState = (newState: OutageSimulationState) => {
    setOutageState(newState);

    // Sync node/route states if returned from backend
    if (newState.stage === 'detected') {
      setNodes(INITIAL_NODES);
      setRoutes(INITIAL_ROUTES);
      setKpis(INITIAL_KPIS);
      setAlerts(INITIAL_ALERTS);
    } else if (newState.stage === 'completed') {
      setRoutes(prev =>
        prev.map(r => {
          if (r.id === 'route-sup1-fac1' || r.id === 'route-sup1-wh2') {
            return {
              ...r,
              state: 'normal',
              isRerouted: true,
              congestedReason: 'Diverted via Tokyo Optics Line 2 & Singapore Air-Bridge'
            };
          }
          if (r.id === 'route-fac1-wh1' || r.id === 'route-dc1-cust1') {
            return { ...r, state: 'normal', congestedReason: undefined };
          }
          return r;
        })
      );

      setNodes(prev =>
        prev.map(n => {
          if (n.id === 'node-sup-1') {
            return {
              ...n,
              disruptionCause: 'Mitigation Active: Diverted to Tokyo Precision Optics Fab 2'
            };
          }
          if (n.id === 'node-fac-1' || n.id === 'node-cust-1') {
            return { ...n, status: 'operational', disruptionCause: undefined };
          }
          return n;
        })
      );

      setKpis(prev => ({
        ...prev,
        resiliencyIndex: 86.8,
        resiliencyDelta: 4.2,
        onTimeDeliveryRate: 94.1,
        deliveryRateDelta: 1.5,
        criticalAlertsCount: 0,
        activeMitigationsCount: prev.activeMitigationsCount + 1
      }));

      setAlerts(prev => [
        {
          id: `alt-exec-${Date.now()}`,
          title: 'RESOLVED: Apex Silicon Outage Contingency Deployed',
          severity: 'info',
          timestamp: 'Just now',
          nodeId: 'node-sup-3',
          nodeName: 'Tokyo Precision Optics',
          impactSummary: 'Air-bridge priority established from Singapore Buffer Depot. 450 TEU neural wafers in accelerated transit.',
          recommendedAction: 'Austin Giga Assembly Line 2 returning to operational schedule within 18 hours.'
        },
        ...prev.filter(a => a.id !== 'alt-01')
      ]);

      setPlaybooks(prev =>
        prev.map(p => (p.id === 'playbook-apex-divert' ? { ...p, executed: true } : p))
      );
    }
  };

  // 1. Start Outage Simulation: idle -> detected
  const handleStartOutage = async () => {
    try {
      if (backendStatus === 'connected') {
        // If already in a progressed state, auto-reset first so demo is continuous and never errors
        if (outageState.stage !== 'idle') {
          await apiClient.resetDemo();
        }
        const backendState = await apiClient.startOutage({
          supplierId: 'node-sup-1',
          cause: 'Regional Substation Meltdown & Cat-4 Typhoon Harbor Embargo'
        });
        syncFromBackendState(backendState);
      } else {
        // Offline demo fallback
        setNodes(INITIAL_NODES);
        setRoutes(INITIAL_ROUTES);
        setKpis(INITIAL_KPIS);
        setAlerts(INITIAL_ALERTS);

        const nowStr = new Date().toLocaleTimeString();
        const outageEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-1`,
          timestamp: nowStr,
          stage: 'detected',
          actor: 'AI_TELEMETRY_ENGINE',
          action: 'Crisis Detected',
          details: 'Substation failure detected at Apex Silicon Fab 4 (Shenzhen). Automated alert dispatched.',
          status: 'WARNING'
        };

        setOutageState(prev => ({
          ...prev,
          stage: 'detected',
          timestamp: new Date().toISOString(),
          detectionSeverity: 'CRITICAL',
          selectedSupplierId: 'node-sup-1',
          auditTrail: [outageEntry, ...prev.auditTrail]
        }));
      }

      setNotification({
        message: 'CRITICAL CRISIS DETECTED: Apex Silicon Fab 4 power substation failure in Shenzhen Tech Corridor.',
        type: 'error'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start crisis outage';
      setNotification({ message: `API ERROR: ${msg}`, type: 'error' });
    }
  };

  // 2. Proceed to Assessing: detected -> assessing
  const handleProceedToAssessing = async () => {
    if (outageState.stage !== 'detected') return;

    try {
      if (backendStatus === 'connected') {
        const backendState = await apiClient.assessOutage();
        syncFromBackendState(backendState);
      } else {
        // Offline demo fallback
        const nowStr = new Date().toLocaleTimeString();
        const assessEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-2`,
          timestamp: nowStr,
          stage: 'assessing',
          actor: 'AGENT_2_IMPACT_ASSESSMENT',
          action: 'Blast Radius & Run-Rate Evaluated',
          details: 'Calculated 1.5d stockout buffer (413 units/day). Exposure: $2,830,000 across 1 line(s).',
          status: 'SUCCESS'
        };

        setOutageState(prev => ({
          ...prev,
          stage: 'assessing',
          auditTrail: [assessEntry, ...prev.auditTrail],
          affectedInventory: [
            {
              sku: 'SKU-NEURAL-A1 (Apex Sub-3nm)',
              description: 'High-speed AI Neural Accelerator Wafers',
              onHandUnits: 620,
              dailyBurnRate: 413,
              hoursOfRunwayLeft: 36
            },
            {
              sku: 'SKU-LOGIC-CORE-8',
              description: 'Micro-Logic Controller Assemblies',
              onHandUnits: 1400,
              dailyBurnRate: 250,
              hoursOfRunwayLeft: 48
            },
            {
              sku: 'SKU-POWER-CONV-X',
              description: 'Power Conversion Modules',
              onHandUnits: 4200,
              dailyBurnRate: 220,
              hoursOfRunwayLeft: 384
            }
          ],
          affectedProduction: [
            {
              lineId: 'Line 2 (Autonomous Pods)',
              factoryName: 'Giga Assembly Complex (Austin)',
              impactStatus: 'starved',
              hoursUntilShutdown: 36,
              affectedProducts: ['Autonomous Robotics Pods', 'Enterprise AI Racks'],
              dailyOutputLoss: '$420,000 / day'
            },
            {
              lineId: 'Line 1 (Base Chassis)',
              factoryName: 'Giga Assembly Complex (Austin)',
              impactStatus: 'throttled',
              hoursUntilShutdown: 72,
              affectedProducts: ['Standard Chassis Units'],
              dailyOutputLoss: '$150,000 / day'
            }
          ],
          affectedOrders: [
            {
              orderId: 'ORD-US-8912',
              customerName: 'North America Retail Grid',
              destination: 'US Coastal Tier-1',
              volumeUnits: 1450,
              contractValueUSD: '$1,850,000',
              slaDeadlineHours: 48,
              riskTier: 'CRITICAL'
            },
            {
              orderId: 'ORD-EU-4409',
              customerName: 'EMEA Enterprise Network',
              destination: 'Frankfurt Gateway',
              volumeUnits: 820,
              contractValueUSD: '$980,000',
              slaDeadlineHours: 72,
              riskTier: 'HIGH'
            }
          ]
        }));
      }

      setNotification({
        message: 'Impact Assessment completed: Giga Factory Line 2 starved within 36 hours. 2 customer SLAs at risk.',
        type: 'warning'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assess impact';
      setNotification({ message: `API ERROR: ${msg}`, type: 'error' });
    }
  };

  // 3. Proceed to Planning: assessing -> planning / awaiting_approval
  const handleProceedToPlanning = async () => {
    // If plan is already generated and awaiting approval, view existing plan without regenerating
    if (outageState.stage === 'awaiting_approval' && outageState.proposedPlan) {
      setNotification({
        message: 'Viewing existing synthesized Recovery Plan CP-01. Human command authorization required.',
        type: 'info'
      });
      return;
    }

    // Only allow plan generation from valid workflow states (assessing or rejected)
    if (outageState.stage !== 'assessing' && outageState.stage !== 'rejected') return;

    // Prevent duplicate concurrent plan generation requests
    if (isGeneratingPlan) return;

    setIsGeneratingPlan(true);
    try {
      if (backendStatus === 'connected') {
        const backendState = await apiClient.planRecovery();
        syncFromBackendState(backendState);
        setNotification({
          message: 'Recovery Plan CP-01 synthesized by backend. Human command authorization required.',
          type: 'warning'
        });
      } else {
        // Offline demo fallback
        const nowStr = new Date().toLocaleTimeString();
        const planEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-3`,
          timestamp: nowStr,
          stage: 'planning',
          actor: 'AI_AGENT_EVALUATOR',
          action: 'Alternative Sourcing Evaluated',
          details: 'Identified Tokyo Precision Optics Fab 2 and Singapore Buffer Depot as primary mitigators.',
          status: 'SUCCESS'
        };

        setOutageState(prev => ({
          ...prev,
          stage: 'planning',
          rejectionReason: undefined,
          auditTrail: [planEntry, ...prev.auditTrail],
          alternativeSuppliers: DEMO_ALTERNATIVE_SUPPLIERS,
          warehouseStockOptions: DEMO_WAREHOUSE_OPTIONS
        }));

        setNotification({
          message: 'Sourcing options identified: Tokyo Precision Optics (650u available) & Singapore Buffer (12.5k units).',
          type: 'info'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate recovery plan';
      setNotification({ message: `API ERROR: ${msg}`, type: 'error' });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // 4. Proceed to Awaiting Approval (frontend step from planning stage)
  const handleProceedToAwaitingApproval = async () => {
    if (outageState.stage !== 'planning') return;

    if (backendStatus === 'connected') {
      try {
        const backendState = await apiClient.getCrisisState();
        syncFromBackendState(backendState);
      } catch {
        // Fall back to local update
      }
    }

    const nowStr = new Date().toLocaleTimeString();
    const awaitEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-4`,
      timestamp: nowStr,
      stage: 'awaiting_approval',
      actor: 'GOVERNANCE_POLICY_ENGINE',
      action: 'Approval Gate Enforced',
      details: 'Recovery Plan CP-01 exceeds $100k authorization threshold ($142,500). Mandating human sign-off.',
      status: 'WARNING'
    };

    setOutageState(prev => ({
      ...prev,
      stage: 'awaiting_approval',
      proposedPlan: prev.proposedPlan || DEMO_PROPOSED_PLAN,
      auditTrail: [awaitEntry, ...prev.auditTrail]
    }));

    setNotification({
      message: 'Recovery Plan CP-01 synthesized. Human command authorization required.',
      type: 'warning'
    });
  };

  // 5. Approve Plan: awaiting_approval -> approved
  const handleApprovePlan = async () => {
    if (outageState.stage !== 'awaiting_approval') {
      setNotification({
        message: 'APPROVAL BLOCKED: Plan can only be approved while in awaiting_approval stage.',
        type: 'error'
      });
      return;
    }

    try {
      if (backendStatus === 'connected') {
        const backendState = await apiClient.approvePlan();
        syncFromBackendState(backendState);
      } else {
        const nowStr = new Date().toLocaleTimeString();
        const approveEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-5`,
          timestamp: nowStr,
          stage: 'approved',
          actor: 'COMMAND_DIRECTOR',
          action: 'Plan CP-01 Authorized',
          details: 'Director approved proposed sourcing mitigation. Safety gate satisfied for simulated dispatch.',
          status: 'SUCCESS'
        };

        setOutageState(prev => ({
          ...prev,
          stage: 'approved',
          auditTrail: [approveEntry, ...prev.auditTrail]
        }));
      }

      setNotification({
        message: 'Plan CP-01 AUTHORIZED. Command approval logged with zero real transactions.',
        type: 'success'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve plan';
      setNotification({ message: `API ERROR: ${msg}`, type: 'error' });
    }
  };

  // Reject Plan: awaiting_approval -> rejected
  const handleRejectPlan = async (reason: string) => {
    if (outageState.stage !== 'awaiting_approval') {
      setNotification({
        message: 'REJECTION BLOCKED: Plan can only be rejected when awaiting approval.',
        type: 'error'
      });
      return;
    }

    try {
      const rejectRationale = reason || 'Plan parameters rejected by command authority';
      if (backendStatus === 'connected') {
        const backendState = await apiClient.rejectPlan(rejectRationale);
        syncFromBackendState(backendState);
      } else {
        const nowStr = new Date().toLocaleTimeString();
        const rejectEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-reject`,
          timestamp: nowStr,
          stage: 'rejected',
          actor: 'COMMAND_DIRECTOR',
          action: 'Plan CP-01 Rejected',
          details: `Execution denied by operator. Rationale: ${rejectRationale}.`,
          status: 'REJECTED'
        };

        setOutageState(prev => ({
          ...prev,
          stage: 'rejected',
          rejectionReason: rejectRationale,
          auditTrail: [rejectEntry, ...prev.auditTrail]
        }));
      }

      setNotification({
        message: 'RECOVERY PLAN REJECTED. Execution blocked. Operator may re-evaluate options or reset.',
        type: 'warning'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject plan';
      setNotification({ message: `API ERROR: ${msg}`, type: 'error' });
    }
  };

  // 6. Execute Plan: approved -> executing -> completed (STRICT GATE ENFORCED)
  const handleExecutePlan = async () => {
    // STRICT GATE: Never allow execution to bypass required approval!
    if (outageState.stage !== 'approved') {
      const nowStr = new Date().toLocaleTimeString();
      const blockedEntry: AuditLogEntry = {
        id: `audit-${Date.now()}-blocked`,
        timestamp: nowStr,
        stage: outageState.stage,
        actor: 'SECURITY_GATEWAY',
        action: 'Execution Blocked: Approval Missing',
        details: `Attempted simulated execution while in stage '${outageState.stage}'. Policy mandates explicit approval.`,
        status: 'SECURITY_BLOCKED'
      };

      setOutageState(prev => ({
        ...prev,
        auditTrail: [blockedEntry, ...prev.auditTrail]
      }));

      setNotification({
        message: 'CRITICAL SECURITY GATE: Execution denied. Plan must be explicitly approved before execution.',
        type: 'error'
      });
      return;
    }

    // Prevent duplicate executions
    if (outageState.isExecuting) {
      setNotification({
        message: 'Execution already in progress.',
        type: 'warning'
      });
      return;
    }

    const nowStr = new Date().toLocaleTimeString();
    const execEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-6`,
      timestamp: nowStr,
      stage: 'executing',
      actor: 'SYSTEM_AUTONOMOUS',
      action: 'Simulated Execution Dispatched',
      details: 'Safety constraints validated. Commencing 5-step simulated dispatch across telemetry nodes.',
      status: 'SUCCESS'
    };

    setOutageState(prev => ({
      ...prev,
      stage: 'executing',
      isExecuting: true,
      currentExecutingActionIndex: 0,
      auditTrail: [execEntry, ...prev.auditTrail]
    }));

    setNotification({
      message: 'Dispatching 5 simulated recovery actions across Procurement, Logistics, and Plant Ops...',
      type: 'info'
    });

    // Step-by-step simulated action advancement (actions 0, 1, 2, 3, 4)
    const actionTimers = [400, 900, 1400, 1900, 2400];
    actionTimers.forEach((delay, idx) => {
      setTimeout(() => {
        setOutageState(prev => {
          if (prev.stage !== 'executing') return prev;
          const updatedPlan = prev.proposedPlan
            ? {
                ...prev.proposedPlan,
                detailedActions: prev.proposedPlan.detailedActions.map((act, i) => {
                  if (i === idx) return { ...act, executionStatus: 'verified' as const };
                  if (i === idx + 1) return { ...act, executionStatus: 'in_progress' as const };
                  return act;
                })
              }
            : null;

          return {
            ...prev,
            currentExecutingActionIndex: idx,
            proposedPlan: updatedPlan
          };
        });
      }, delay);
    });

    // Final completion callback after simulated actions
    setTimeout(async () => {
      try {
        if (backendStatus === 'connected') {
          const backendState = await apiClient.executePlan();
          syncFromBackendState(backendState);
        } else {
          // Offline fallback
          syncFromBackendState({
            ...outageState,
            stage: 'completed',
            isExecuting: false,
            detectionSeverity: 'NONE',
            currentExecutingActionIndex: undefined,
            proposedPlan: outageState.proposedPlan
              ? {
                  ...outageState.proposedPlan,
                  detailedActions: outageState.proposedPlan.detailedActions.map(a => ({
                    ...a,
                    executionStatus: 'verified'
                  }))
                }
              : null
          });
        }

        setNotification({
          message: 'WORKFLOW COMPLETED: Supply chain stabilized. Resiliency recovered to 86.8%. Synthetic data verified.',
          type: 'success'
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to finalize execution';
        setNotification({ message: `API ERROR: ${msg}`, type: 'error' });
      }
    }, 2800);
  };

  // Trigger Simulated Failure State
  const handleTriggerFailDemo = () => {
    const failTime = new Date().toLocaleTimeString();
    const failEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-failed`,
      timestamp: failTime,
      stage: 'failed',
      actor: 'SYSTEM_AUTONOMOUS',
      action: 'Simulated Execution Failure',
      details: 'Carrier charter slot rejected by airport ground control. Air-bridge dispatch timed out.',
      status: 'REJECTED'
    };

    setOutageState(prev => ({
      ...prev,
      stage: 'failed',
      isExecuting: false,
      errorMessage: 'Carrier charter slot rejected by airport ground control. Air-bridge dispatch timed out.',
      auditTrail: [failEntry, ...prev.auditTrail]
    }));

    setNotification({
      message: 'SIMULATION FAILED: Air cargo carrier slot unavailable. Please reset demo.',
      type: 'error'
    });
  };

  // 9. Reset Demo to Pristine Baseline
  const handleResetDemo = async () => {
    try {
      if (backendStatus === 'connected') {
        const resetRes = await apiClient.resetDemo();
        if (resetRes.simulation_state) {
          setOutageState(resetRes.simulation_state);
        } else {
          setOutageState(INITIAL_OUTAGE_SIMULATION_STATE);
        }
        await loadBackendData(false);
      } else {
        setNodes(BASELINE_NODES);
        setRoutes(BASELINE_ROUTES);
        setKpis(BASELINE_KPIS);
        setAlerts([]);
        setPlaybooks(CRISIS_PLAYBOOKS.map(p => ({ ...p, executed: false })));
        setOutageState(INITIAL_OUTAGE_SIMULATION_STATE);
      }
      setSelectedNode(null);

      setNotification({
        message: 'DEMO RESET: Restored supply chain to pristine baseline operational state.',
        type: 'info'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset demo';
      setNotification({ message: `RESET ERROR: ${msg}`, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col scanline-bg hud-grid-bg">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-md p-3 rounded-xl border shadow-xl backdrop-blur-xl font-mono text-xs flex items-start gap-2.5 animate-in slide-in-from-bottom-4 duration-200 ${
            notification.type === 'error'
              ? 'bg-red-950/95 border-red-500/80 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
              : notification.type === 'warning'
              ? 'bg-amber-950/95 border-amber-500/80 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
              : notification.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'bg-cyan-950/95 border-cyan-500/80 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.25)]'
          }`}
        >
          {notification.type === 'error' ? (
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          ) : notification.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-snug">{notification.message}</div>
        </div>
      )}

      {/* =========================================================================
          COMMAND CENTER HEADER HUD
          ========================================================================= */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/90 backdrop-blur-xl px-4 lg:px-6 py-3 shadow-lg">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & System Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              <Globe className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-display font-black tracking-wider text-white uppercase">
                  SUPPLY CHAIN X
                </h1>
                <span className="text-slate-500 font-mono text-xs">/</span>
                <span className="text-xs font-mono font-medium text-cyan-400">
                  Autonomous Crisis Manager
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-[9px] font-mono text-amber-300/90 hidden sm:inline-block">
                  SIMULATION
                </span>
              </div>
            </div>
          </div>

          {/* Central Crisis Status Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${outageState.stage === 'idle' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
              <span className="text-slate-400 text-[11px]">STATUS:</span>
              <span className={`font-semibold uppercase ${
                outageState.detectionSeverity === 'CRITICAL' ? 'text-red-400' :
                outageState.stage === 'completed' ? 'text-emerald-400' :
                outageState.stage === 'idle' ? 'text-slate-300' : 'text-amber-400'
              }`}>
                {outageState.stage === 'idle' ? 'NOMINAL' : outageState.stage.replace('_', ' ')}
              </span>
              {outageState.detectionSeverity === 'CRITICAL' && (
                <span className="text-[10px] text-red-400/90 font-sans border-l border-slate-800 pl-2">
                  Apex Fab 4 Outage
                </span>
              )}
            </div>

            {/* Live Backend Connection Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] font-mono text-slate-400">
              <Server className={`w-3 h-3 ${backendStatus === 'connected' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className={backendStatus === 'connected' ? 'text-emerald-400' : 'text-slate-400'}>
                {backendStatus === 'connected' ? 'BACKEND LIVE' : 'DEMO MODE'}
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Reset Demo Button */}
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-750 hover:border-slate-600 text-xs font-mono text-slate-300 hover:text-white transition-all active:scale-95"
              title="Reset Demo to Baseline"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Demo</span>
            </button>

            {/* View Mode Toggle: 3D WebGL vs 2D Fallback */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setViewMode('3d')}
                disabled={webGLError}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  viewMode === '3d'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Three.js 3D WebGL Visualization"
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D SCENE</span>
              </button>

              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  viewMode === '2d'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tactical 2D Canvas Fallback"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2D SCHEMATIC</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          WORKFLOW TIMELINE STEPPER
          ========================================================================= */}
      <div className="max-w-[1720px] w-full mx-auto px-4 lg:px-6 pt-3.5">
        <OutageWorkflowStepper
          currentStage={outageState.stage}
          onStageClick={() => setIsWorkflowModalOpen(true)}
        />
      </div>

      {/* =========================================================================
          MAIN COMMAND CENTER CONTENT
          ========================================================================= */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 lg:px-6 py-3 space-y-3">
        {/* Top KPI Telemetry Cards: Exactly 4 High-Value Cards */}
        <section>
          <KPICards kpis={kpis} simulationState={outageState} />
        </section>

        {/* Central Stage: 3D/2D Network Visualization + Crisis Action Center */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 min-h-[460px]">
          {/* Main Visualizer (3D WebGL or 2D Fallback) */}
          <div className="lg:col-span-2 relative flex flex-col h-[460px]">
            {viewMode === '3d' ? (
              <Network3D
                nodes={nodes}
                routes={routes}
                selectedNodeId={selectedNode?.id || null}
                onSelectNode={setSelectedNode}
                onWebGLError={handleWebGLError}
              />
            ) : (
              <Network2DFallback
                nodes={nodes}
                routes={routes}
                selectedNodeId={selectedNode?.id || null}
                onSelectNode={setSelectedNode}
              />
            )}
          </div>

          {/* Right Rail: Embedded Crisis Workflow Controller & Live Alerts */}
          <div className="flex flex-col gap-3 h-[460px]">
            {/* Embedded Crisis Action Center */}
            <div className="flex-1 min-h-[250px]">
              <CrisisActionCenter
                simulationState={outageState}
                isGeneratingPlan={isGeneratingPlan}
                onStartOutage={handleStartOutage}
                onProceedToAssessing={handleProceedToAssessing}
                onProceedToPlanning={handleProceedToPlanning}
                onProceedToAwaitingApproval={handleProceedToAwaitingApproval}
                onApprovePlan={handleApprovePlan}
                onRejectPlan={handleRejectPlan}
                onExecutePlan={handleExecutePlan}
                onResetDemo={handleResetDemo}
                onTriggerFailDemo={handleTriggerFailDemo}
                onOpenFullModal={() => setIsWorkflowModalOpen(true)}
              />
            </div>

            {/* Compact Disruption Alert Feed */}
            <div className="h-[195px]">
              <AlertsPanel
                alerts={alerts}
                onFocusNode={handleFocusNode}
                onOpenCrisisModal={handleOpenCrisisModal}
              />
            </div>
          </div>
        </section>

        {/* Workspace Quick-Navigation & View Selector */}
        <section className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-sm font-mono text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              TACTICAL OPERATIONS CONSOLE
            </span>
          </div>

          <div className="flex items-center p-1 rounded-lg bg-slate-950/70 border border-slate-800 gap-1 text-[11px]">
            <button
              onClick={() => setActiveWorkspaceTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeWorkspaceTab === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>UNIFIED VIEW</span>
            </button>

            <button
              onClick={() => setActiveWorkspaceTab('agents')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeWorkspaceTab === 'agents'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>MULTI-AGENT RECOVERY</span>
            </button>

            <button
              onClick={() => setActiveWorkspaceTab('weather')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeWorkspaceTab === 'weather'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CloudSun className="w-3.5 h-3.5" />
              <span>METEOROLOGICAL RADAR</span>
            </button>

            <button
              onClick={() => setActiveWorkspaceTab('inventory')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeWorkspaceTab === 'inventory'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>REGIONAL BUFFERS</span>
            </button>
          </div>
        </section>

        {/* Main Multi-Agent Crisis Workspace (Sections A through F) */}
        {(activeWorkspaceTab === 'all' || activeWorkspaceTab === 'agents') && (
          <section id="multi-agent-crisis-workspace" className="animate-in fade-in duration-200">
            <MultiAgentCrisisWorkspace
              simulationState={outageState}
              isGeneratingPlan={isGeneratingPlan}
              onStartOutage={handleStartOutage}
              onProceedToAssessing={handleProceedToAssessing}
              onProceedToPlanning={handleProceedToPlanning}
              onProceedToAwaitingApproval={handleProceedToAwaitingApproval}
              onApprovePlan={handleApprovePlan}
              onRejectPlan={handleRejectPlan}
              onExecutePlan={handleExecutePlan}
              onResetDemo={handleResetDemo}
              onTriggerFailDemo={handleTriggerFailDemo}
            />
          </section>
        )}

        {/* Global Weather Disruption Telemetry (OpenWeather Integration) */}
        {(activeWorkspaceTab === 'all' || activeWorkspaceTab === 'weather') && (
          <section className="animate-in fade-in duration-200">
            <WeatherPanel onFocusNode={handleFocusNode} />
          </section>
        )}

        {/* Bottom Tier: Regional Buffer Telemetry & Predictive Analytics */}
        {(activeWorkspaceTab === 'all' || activeWorkspaceTab === 'inventory') && (
          <section className="min-h-[210px] animate-in fade-in duration-200">
            <InventoryAnalytics inventory={INITIAL_INVENTORY} />
          </section>
        )}
      </main>

      {/* =========================================================================
          INTERACTIVE OVERLAYS & MODALS
          ========================================================================= */}
      {/* Complete Outage Workflow Demo Modal (Items 1-9) */}
      <OutageWorkflowModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        simulationState={outageState}
        isGeneratingPlan={isGeneratingPlan}
        onStartOutage={handleStartOutage}
        onProceedToAssessing={handleProceedToAssessing}
        onProceedToPlanning={handleProceedToPlanning}
        onProceedToAwaitingApproval={handleProceedToAwaitingApproval}
        onApprovePlan={handleApprovePlan}
        onRejectPlan={handleRejectPlan}
        onExecutePlan={handleExecutePlan}
        onResetDemo={handleResetDemo}
        onTriggerFailDemo={handleTriggerFailDemo}
      />

      {/* Node Inspector Drawer */}
      <NodeInspectorModal
        node={selectedNode}
        routes={routes}
        nodes={nodes}
        onClose={() => setSelectedNode(null)}
        onOpenCrisisModal={handleOpenCrisisModal}
      />

      {/* Crisis Recovery Playbook Modal */}
      <CrisisRecoveryModal
        playbooks={playbooks}
        nodes={nodes}
        selectedPlaybookId={activePlaybookId}
        isOpen={isCrisisModalOpen}
        onClose={() => setIsCrisisModalOpen(false)}
        onExecutePlaybook={handleApprovePlan}
      />

      {/* Command Center Footer HUD */}
      <footer className="border-t border-cyan-500/20 bg-slate-950/80 px-4 py-2.5 text-center text-xs font-mono text-slate-500">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SUPPLY CHAIN X // MEMBER 3 FRONTEND COMMAND CONSOLE</span>
          <span className="text-cyan-400/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            SYNTHETIC DEMO SIMULATION // ZERO REAL TRANSACTIONS // DETERMINISTIC RUNTIME
          </span>
          <span>AUTONOMOUS NETWORK ENGINE READY</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
