/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Globe2,
  Building2,
  Boxes,
  ShoppingCart,
  Factory,
  Truck,
  AlertTriangle,
  Bot,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  ScrollText,
  Settings,
  HelpCircle,
  Radio,
  Radar,
} from 'lucide-react';
import { DatabaseState } from '../types.ts';

export type NavigationTab =
  | 'overview'
  | 'map'
  | 'suppliers'
  | 'inventory'
  | 'orders'
  | 'production'
  | 'shipments'
  | 'crisis_monitoring'
  | 'predictive_intelligence'
  | 'ai_agents'
  | 'optimization'
  | 'approval_center'
  | 'execution_verification'
  | 'analytics'
  | 'audit_logs'
  | 'settings'
  | 'help_docs';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  state: DatabaseState;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, state }) => {
  const activeCrisesCount = state.crises.filter((c) => c.status !== 'verified_resolved').length;
  const criticalCrisesCount = state.crises.filter(
    (c) => c.status !== 'verified_resolved' && c.severity === 'Critical'
  ).length;
  const pendingApprovalsCount = state.recoveryPlans.filter(
    (p) => p.approvalStatus === 'pending'
  ).length;
  const delayedShipmentsCount = state.shipments.filter((s) => s.delayHours > 0).length;
  const criticalStockouts = state.inventory.filter((i) => i.coverageDays <= 2.5).length;

  const sections: {
    category: string;
    items: {
      id: NavigationTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
      badgeVariant?: 'red' | 'amber' | 'blue' | 'purple';
    }[];
  }[] = [
    {
      category: 'CORE OPERATIONS',
      items: [
        { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
        { id: 'map', label: '2. Supply Chain Map', icon: Globe2 },
        { id: 'suppliers', label: '3. Suppliers', icon: Building2 },
        {
          id: 'inventory',
          label: '4. Inventory & Warehouses',
          icon: Boxes,
          badge: criticalStockouts > 0 ? criticalStockouts : undefined,
          badgeVariant: 'amber',
        },
        { id: 'orders', label: '5. Customer Orders', icon: ShoppingCart },
        { id: 'production', label: '6. Production', icon: Factory },
        {
          id: 'shipments',
          label: '7. Shipments & Logistics',
          icon: Truck,
          badge: delayedShipmentsCount > 0 ? delayedShipmentsCount : undefined,
          badgeVariant: 'blue',
        },
      ],
    },
    {
      category: 'AUTONOMOUS CRISIS WORKFLOW',
      items: [
        {
          id: 'crisis_monitoring',
          label: '8. Crisis Monitoring',
          icon: AlertTriangle,
          badge: activeCrisesCount > 0 ? activeCrisesCount : undefined,
          badgeVariant: criticalCrisesCount > 0 ? 'red' : 'amber',
        },
        {
          id: 'predictive_intelligence',
          label: '★ Predictive Radar & What-If',
          icon: Radar,
          badge: 4,
          badgeVariant: 'purple',
        },
        { id: 'ai_agents', label: '9. AI Agents', icon: Bot },
        { id: 'optimization', label: '10. Recovery Optimization', icon: Sliders },
        {
          id: 'approval_center',
          label: '11. Approval Center',
          icon: ShieldCheck,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          badgeVariant: 'purple',
        },
        {
          id: 'execution_verification',
          label: '12. Execution & Verification',
          icon: CheckCircle2,
        },
      ],
    },
    {
      category: 'INTELLIGENCE & GOVERNANCE',
      items: [
        { id: 'analytics', label: '13. Analytics & KPIs', icon: BarChart3 },
        { id: 'audit_logs', label: '14. Audit Logs', icon: ScrollText },
        { id: 'settings', label: '15. Settings & API', icon: Settings },
        { id: 'help_docs', label: '16. Help & Docs', icon: HelpCircle },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-white tracking-wide text-sm flex items-center gap-1.5">
              SUPPLY CHAIN <span className="text-blue-400">X</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">
              Autonomous Crisis Manager
            </div>
          </div>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          v2.4 LIVE
        </span>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
        {sections.map((sec) => (
          <div key={sec.category}>
            <div className="px-2.5 mb-1.5 text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold">
              {sec.category}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold leading-none shrink-0 ${
                          item.badgeVariant === 'red'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : item.badgeVariant === 'amber'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : item.badgeVariant === 'purple'
                            ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Engine Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[11px]">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            OR-TOOLS & GEMINI
          </span>
          <span className="font-mono text-[10px] text-slate-400">MILP Active</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Workflow: Detect → Optimize → Verify
        </div>
      </div>
    </aside>
  );
};
