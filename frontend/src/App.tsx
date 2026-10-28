/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavigationTab } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { GeminiAssistantModal } from './components/GeminiAssistantModal.tsx';
import { DatabaseState, UserRole } from './types.ts';

// View Components
import { OverviewView } from './components/views/OverviewView.tsx';
import { SupplyChainMapView } from './components/views/SupplyChainMapView.tsx';
import { SuppliersView } from './components/views/SuppliersView.tsx';
import { InventoryView } from './components/views/InventoryView.tsx';
import { OrdersView } from './components/views/OrdersView.tsx';
import { ProductionView } from './components/views/ProductionView.tsx';
import { ShipmentsView } from './components/views/ShipmentsView.tsx';
import { CrisisMonitoringView } from './components/views/CrisisMonitoringView.tsx';
import { PredictiveIntelligenceView } from './components/views/PredictiveIntelligenceView.tsx';
import { AIAgentsView } from './components/views/AIAgentsView.tsx';
import { OptimizationView } from './components/views/OptimizationView.tsx';
import { ApprovalCenterView } from './components/views/ApprovalCenterView.tsx';
import { ExecutionVerificationView } from './components/views/ExecutionVerificationView.tsx';
import { AnalyticsView } from './components/views/AnalyticsView.tsx';
import { AuditLogsView } from './components/views/AuditLogsView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { HelpDocView } from './components/views/HelpDocView.tsx';

export default function App() {
  const [state, setState] = useState<DatabaseState | null>(null);
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [userRole, setUserRole] = useState<UserRole>('Operations Director');
  const [isGeminiOpen, setIsGeminiOpen] = useState(false);
  const [isTriggeringDemo, setIsTriggeringDemo] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.warn('Initial state fetch error (server starting up):', err);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15000); // Polling telemetry sync
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleTriggerDemo = async () => {
    setIsTriggeringDemo(true);
    try {
      const res = await fetch('/api/demo/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
      } else {
        await fetchState();
      }
      showToast('Master Outage Injected: NanoSilicon Taiwan fab offline. Coverage dropped to 2 days.');
      setCurrentTab('crisis_monitoring');
    } catch (err) {
      console.error(err);
      showToast('Error launching demo crisis.');
    } finally {
      setIsTriggeringDemo(false);
    }
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
      } else {
        await fetchState();
      }
      showToast('Database reset to clean baseline initial state.');
      setCurrentTab('overview');
    } catch (err) {
      console.error(err);
      showToast('Error resetting dataset.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleOrchestrate = async (crisisId: string) => {
    try {
      showToast('Central AI Orchestrator running 8 specialized agents & OR-Tools solver...');
      const res = await fetch(`/api/crises/${crisisId}/orchestrate`, { method: 'POST' });
      if (res.ok) {
        await fetchState();
        showToast('Multi-Agent Analysis complete! Top plan synthesized and awaiting approval.');
        setCurrentTab('optimization');
      }
    } catch (err) {
      console.error(err);
      showToast('Error executing multi-agent orchestration.');
    }
  };

  if (!state) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white space-y-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse shadow-xl shadow-blue-500/30">
          <span className="font-bold text-lg">SX</span>
        </div>
        <div className="text-sm font-semibold tracking-wide">Initializing Supply Chain X Engine...</div>
        <div className="text-xs text-slate-400 font-mono">Connecting transactional database & AI agents</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-50 font-sans antialiased text-slate-900">
      {/* Left Compact 16-Tab Operations Sidebar */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} state={state} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Bar with Global Telemetry & Fast Actions */}
        <TopBar
          state={state}
          userRole={userRole}
          onChangeRole={setUserRole}
          onTriggerDemo={handleTriggerDemo}
          onResetDemo={handleResetDemo}
          onOpenGeminiAssistant={() => setIsGeminiOpen(true)}
          isTriggeringDemo={isTriggeringDemo}
          isResetting={isResetting}
        />

        {/* Dynamic View Body Container */}
        <main className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-300">
          {currentTab === 'overview' && (
            <OverviewView
              state={state}
              onNavigate={setCurrentTab}
              onOrchestrate={handleOrchestrate}
              userRole={userRole}
            />
          )}

          {currentTab === 'map' && <SupplyChainMapView state={state} />}

          {currentTab === 'suppliers' && (
            <SuppliersView state={state} onRefresh={fetchState} />
          )}

          {currentTab === 'inventory' && (
            <InventoryView state={state} onRefresh={fetchState} />
          )}

          {currentTab === 'orders' && <OrdersView state={state} />}

          {currentTab === 'production' && (
            <ProductionView state={state} onRefresh={fetchState} />
          )}

          {currentTab === 'shipments' && <ShipmentsView state={state} />}

          {currentTab === 'crisis_monitoring' && (
            <CrisisMonitoringView
              state={state}
              onRefresh={fetchState}
              onOrchestrate={handleOrchestrate}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'predictive_intelligence' && (
            <PredictiveIntelligenceView
              state={state}
              onRefresh={fetchState}
              userRole={userRole}
            />
          )}

          {currentTab === 'ai_agents' && <AIAgentsView state={state} />}

          {currentTab === 'optimization' && (
            <OptimizationView
              state={state}
              onRefresh={fetchState}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'approval_center' && (
            <ApprovalCenterView
              state={state}
              onRefresh={fetchState}
              onNavigate={setCurrentTab}
              userRole={userRole}
            />
          )}

          {currentTab === 'execution_verification' && (
            <ExecutionVerificationView
              state={state}
              onRefresh={fetchState}
              userRole={userRole}
            />
          )}

          {currentTab === 'analytics' && <AnalyticsView state={state} />}

          {currentTab === 'audit_logs' && <AuditLogsView state={state} />}

          {currentTab === 'settings' && (
            <SettingsView state={state} userRole={userRole} />
          )}

          {currentTab === 'help_docs' && <HelpDocView />}
        </main>
      </div>

      {/* Gemini AI Co-Pilot Slide-over Drawer */}
      <GeminiAssistantModal
        isOpen={isGeminiOpen}
        onClose={() => setIsGeminiOpen(false)}
        state={state}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
