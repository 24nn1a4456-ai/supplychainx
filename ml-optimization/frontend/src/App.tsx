/**
 * App.tsx — Supply Chain X Operations Control Center
 * All data is SYNTHETIC. No real operations.
 */
import { useState, useEffect, useCallback } from 'react';
import * as api from './api';
import './index.css';

// ─── Types ────────────────────────────────────────────────────────
type Tab = 'overview' | 'disruptions' | 'agents' | 'plan' | 'approval' | 'twin' | 'audit';

// ─── Helpers ──────────────────────────────────────────────────────
const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: 'warning', approved: 'success', rejected: 'danger',
    executed: 'info', detected: 'warning', analyzing: 'info',
    analyzed: 'info', resolved: 'success', completed: 'success',
    already_executed: 'info', optimal: 'success', feasible: 'success',
    infeasible: 'danger', fallback: 'warning',
  };
  return <span className={`badge ${map[s] || 'neutral'}`}>{s}</span>;
};

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [disruptions, setDisruptions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [, setSuppliers] = useState<any[]>([]);
  const [, setInventory] = useState<any[]>([]);
  const [, setWarehouses] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis / Plan state
  const [, setSelectedDisruption] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [simResult, setSimResult] = useState<any>(null);

  // Create disruption form
  const [newType, setNewType] = useState('supplier_outage');
  const [newSeverity, setNewSeverity] = useState('HIGH');
  const [newDesc, setNewDesc] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sm, dis, pl, sim, au, sup, inv, wh] = await Promise.all([
        api.getSummary(), api.getDisruptions(), api.getPlans(),
        api.getSimulations(), api.getAudit(), api.getSuppliers(),
        api.getInventory(), api.getWarehouses(),
      ]);
      setSummary(sm); setDisruptions(dis); setPlans(pl);
      setSimulations(sim); setAudit(au); setSuppliers(sup);
      setInventory(inv); setWarehouses(wh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Actions ──
  const handleCreate = async () => {
    setLoading(true);
    try {
      const d = await api.createDisruption({
        type: newType, severity: newSeverity,
        description: newDesc || undefined,
      });
      showFeedback(`Disruption ${d.id} created`);
      setSelectedDisruption(d.id);
      await refreshAll();
      setTab('disruptions');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAnalyze = async (id: string) => {
    setLoading(true);
    setAnalysisResult(null);
    try {
      const r = await api.analyzeDisruption(id);
      setAnalysisResult(r);
      if (r.plan_id) {
        const p = await api.getPlan(r.plan_id);
        setSelectedPlan(p);
      }
      await refreshAll();
      showFeedback('Analysis complete');
      setTab('agents');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleApprove = async (planId: string) => {
    setLoading(true);
    try {
      await api.approvePlan(planId, { reviewer: 'demo_user', comment: 'Approved for simulation' });
      const p = await api.getPlan(planId);
      setSelectedPlan(p);
      await refreshAll();
      showFeedback('Plan approved ✓');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleReject = async (planId: string, comment: string) => {
    setLoading(true);
    try {
      await api.rejectPlan(planId, { reviewer: 'demo_user', comment: comment || 'Rejected' });
      const p = await api.getPlan(planId);
      setSelectedPlan(p);
      await refreshAll();
      showFeedback('Plan rejected');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSimulate = async (planId: string) => {
    setLoading(true);
    try {
      const r = await api.simulatePlan(planId);
      setSimResult(r);
      const p = await api.getPlan(planId);
      setSelectedPlan(p);
      await refreshAll();
      showFeedback('Simulation complete');
      setTab('twin');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Tabs ──
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'disruptions', label: '⚡ Disruptions' },
    { key: 'agents', label: '🤖 Agents' },
    { key: 'plan', label: '📋 Recovery Plan' },
    { key: 'approval', label: '✅ Approval' },
    { key: 'twin', label: '🔬 Digital Twin' },
    { key: 'audit', label: '📝 Audit' },
  ];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <div className="logo">SX</div>
          <div>
            <h1>Supply Chain X — Operations Control</h1>
          </div>
        </div>
        <div className="flex-row">
          <span className="synth-badge">⚠ Synthetic Demo Data</span>
          <button className="btn btn-outline btn-sm" onClick={refreshAll} disabled={loading}>
            {loading ? '⟳ Loading...' : '⟳ Refresh'}
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </nav>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          padding: '0.5rem 1.5rem', background: 'var(--success-bg)',
          borderBottom: '1px solid rgba(16,185,129,0.2)', color: 'var(--accent-green)',
          fontSize: '0.82rem', fontWeight: 600
        }}>
          {feedback}
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.5rem 1.5rem', background: 'var(--danger-bg)',
          borderBottom: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)',
          fontSize: '0.82rem', fontWeight: 600
        }}>
          Error: {error}
          <button className="btn btn-sm btn-outline" style={{ marginLeft: '1rem' }}
            onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <main className="main-content fade-in">
        {loading && !summary ? (
          <div className="loading-container"><div className="spinner" /><span className="text-muted">Loading...</span></div>
        ) : (
          <>
            {tab === 'overview' && <Overview summary={summary} disruptions={disruptions} />}
            {tab === 'disruptions' && (
              <DisruptionsTab disruptions={disruptions} onAnalyze={handleAnalyze}
                newType={newType} setNewType={setNewType} newSeverity={newSeverity}
                setNewSeverity={setNewSeverity} newDesc={newDesc} setNewDesc={setNewDesc}
                onCreate={handleCreate} loading={loading} />
            )}
            {tab === 'agents' && <AgentsTab analysis={analysisResult} />}
            {tab === 'plan' && <PlanTab plan={selectedPlan} plans={plans} onSelect={(p: any) => setSelectedPlan(p)} />}
            {tab === 'approval' && (
              <ApprovalTab plan={selectedPlan} plans={plans} onApprove={handleApprove}
                onReject={handleReject} onSimulate={handleSimulate} loading={loading}
                onSelect={(p: any) => setSelectedPlan(p)} />
            )}
            {tab === 'twin' && <TwinTab sim={simResult} simulations={simulations} plan={selectedPlan} />}
            {tab === 'audit' && <AuditTab events={audit} />}
          </>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════
function Overview({ summary, disruptions }: any) {
  if (!summary) return <div className="empty-state"><div className="icon">📊</div><p className="text-muted">No data loaded yet</p></div>;
  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header">
        <div>
          <h2 className="section-title">Executive Overview</h2>
          <p className="section-subtitle">{summary.data_disclaimer}</p>
        </div>
      </div>
      <div className="kpi-grid">
        <KPICard label="Active Disruptions" value={summary.disruption_count} color="red" />
        <KPICard label="Recovery Plans" value={summary.recovery_plans} color="blue" />
        <KPICard label="Pending Approvals" value={summary.pending_approvals} color="amber" />
        <KPICard label="Executed Plans" value={summary.executed_plans} color="green" />
        <KPICard label="Simulations" value={summary.simulations} color="cyan" />
        <KPICard label="Inventory at Risk" value={summary.inventory_at_risk} unit={`of ${summary.total_inventory_items} items`} color="pink" />
        <KPICard label="Est. Recovery Cost" value={fmt(summary.estimated_recovery_cost)} unit="monetary units" color="purple" />
        <KPICard label="Avg Plan Cost" value={fmt(summary.avg_plan_cost)} unit="monetary units" color="blue" />
      </div>
      {/* Recent disruptions */}
      <div className="card mt-1">
        <div className="card-header"><span className="card-title">Recent Disruptions</span></div>
        {disruptions.length === 0 ? (
          <div className="empty-state"><p className="text-muted">No disruptions yet. Go to Disruptions tab to trigger one.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {disruptions.slice(0, 5).map((d: any) => (
                  <tr key={d.id}>
                    <td className="text-mono truncate">{d.id}</td>
                    <td>{d.type}</td>
                    <td>{statusBadge(d.severity?.toLowerCase())}</td>
                    <td>{statusBadge(d.status)}</td>
                    <td className="text-xs text-muted">{d.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, unit, color }: { label: string; value: any; unit?: string; color: string }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? '—'}</div>
      {unit && <div className="kpi-unit">{unit}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DISRUPTIONS
// ═══════════════════════════════════════════════════════════════════
function DisruptionsTab({ disruptions, onAnalyze, newType, setNewType, newSeverity, setNewSeverity, newDesc, setNewDesc, onCreate, loading }: any) {
  const types = ['supplier_outage', 'shipment_delay', 'warehouse_outage', 'demand_spike', 'low_inventory'];
  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header">
        <div><h2 className="section-title">Disruption Center</h2>
          <p className="section-subtitle">Trigger scenarios or create custom disruptions</p></div>
      </div>
      <div className="panel-grid panel-grid-2">
        {/* Create form */}
        <div className="card">
          <div className="card-header"><span className="card-title">⚡ Trigger Scenario</span></div>
          <div className="form-group">
            <label className="form-label" htmlFor="dtype">Disruption Type</label>
            <select id="dtype" className="form-select" value={newType} onChange={e => setNewType(e.target.value)}>
              {types.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="dsev">Severity</label>
            <select id="dsev" className="form-select" value={newSeverity} onChange={e => setNewSeverity(e.target.value)}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ddesc">Description (optional)</label>
            <textarea id="ddesc" className="form-textarea" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Optional description..." />
          </div>
          <button className="btn btn-primary" onClick={onCreate} disabled={loading}>
            ⚡ Create & Trigger Disruption
          </button>
        </div>
        {/* Scenario presets */}
        <div className="card">
          <div className="card-header"><span className="card-title">📋 Quick Scenarios</span></div>
          <div className="flex-col" style={{ gap: '0.5rem' }}>
            {types.map(t => (
              <button key={t} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}
                onClick={() => { setNewType(t); setNewSeverity('HIGH'); }}>
                {t === 'supplier_outage' && '🏭'}
                {t === 'shipment_delay' && '🚚'}
                {t === 'warehouse_outage' && '🏢'}
                {t === 'demand_spike' && '📈'}
                {t === 'low_inventory' && '📦'}
                {' '}{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Disruption list */}
      <div className="card mt-1">
        <div className="card-header"><span className="card-title">Disruption History</span></div>
        {disruptions.length === 0 ? (
          <div className="empty-state"><div className="icon">⚡</div><p className="text-muted">No disruptions yet</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Material</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {disruptions.map((d: any) => (
                  <tr key={d.id}>
                    <td className="text-mono truncate">{d.id}</td>
                    <td>{d.type}</td>
                    <td>{statusBadge(d.severity?.toLowerCase())}</td>
                    <td>{d.affected_material || '—'}</td>
                    <td>{statusBadge(d.status)}</td>
                    <td>
                      {d.status === 'detected' && (
                        <button className="btn btn-primary btn-sm" onClick={() => onAnalyze(d.id)} disabled={loading}>
                          🔍 Analyze
                        </button>
                      )}
                      {d.status === 'analyzed' && <span className="badge success">✓ Analyzed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════
function AgentsTab({ analysis }: any) {
  if (!analysis) return <div className="empty-state"><div className="icon">🤖</div><p className="text-muted">No analysis yet. Create and analyze a disruption first.</p></div>;
  const agents = analysis.agents || {};
  const agentNames = ['SupplierAgent', 'InventoryAgent', 'LogisticsAgent'];
  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header">
        <div><h2 className="section-title">Agent Analysis Results</h2>
          <p className="section-subtitle">
            {analysis.agents_summary?.succeeded}/{analysis.agents_summary?.total} agents succeeded
          </p>
        </div>
        <div className="flex-row">
          <span className="badge info">Disruption: {analysis.disruption_id?.substring(0, 8)}...</span>
          {analysis.plan_id && <span className="badge success">Plan: {analysis.plan_id?.substring(0, 8)}...</span>}
        </div>
      </div>
      {/* Crisis Manager Summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🎯 Crisis Manager — Consolidated Assessment</span>
          {statusBadge(analysis.engine_error ? 'failed' : 'completed')}
        </div>
        <div className="kpi-grid" style={{ marginBottom: '0.75rem' }}>
          <KPICard label="Agents Run" value={analysis.agents_summary?.total} color="blue" />
          <KPICard label="Succeeded" value={analysis.agents_summary?.succeeded} color="green" />
          <KPICard label="Failed" value={analysis.agents_summary?.failed} color="red" />
          <KPICard label="Plan Status" value={analysis.plan_status || 'N/A'} color="amber" />
        </div>
        {analysis.engine_result && (
          <div className="kpi-grid">
            <KPICard label="Solver" value={analysis.engine_result.plan?.solver_type} color="cyan" />
            <KPICard label="Solver Status" value={analysis.engine_result.plan?.solver_status} color="blue" />
            <KPICard label="Total Cost" value={fmt(analysis.engine_result.plan?.total_cost)} color="purple" />
            <KPICard label="Feasible" value={analysis.engine_result.plan?.is_feasible ? 'Yes' : 'No'} color="green" />
          </div>
        )}
        {analysis.engine_result?.warnings?.length > 0 && (
          <div className="mt-1">
            {analysis.engine_result.warnings.map((w: string, i: number) => (
              <div key={i} className="sim-label mt-05">{w}</div>
            ))}
          </div>
        )}
      </div>
      {/* Individual agents */}
      <div className="panel-grid panel-grid-3">
        {agentNames.map(name => {
          const a = agents[name];
          if (!a) return (
            <div key={name} className="agent-panel">
              <div className="agent-panel-header"><span className="agent-panel-title">{name}</span>{statusBadge('skipped')}</div>
              <div className="agent-panel-body text-muted text-sm">Agent did not run</div>
            </div>
          );
          return (
            <div key={name} className="agent-panel">
              <div className="agent-panel-header">
                <span className="agent-panel-title">
                  {name === 'SupplierAgent' && '🏭 '}{name === 'InventoryAgent' && '📦 '}{name === 'LogisticsAgent' && '🚚 '}{name}
                </span>
                {statusBadge(a.status)}
              </div>
              <div className="agent-panel-body">
                {a.status === 'failed' && <div className="error-state text-sm">{a.error}</div>}
                {a.status === 'success' && (
                  <>
                    {a.findings && Object.entries(a.findings).map(([k, v]) => (
                      <div key={k} className="finding-item">
                        <div className="finding-label">{k.replace(/_/g, ' ')}</div>
                        <div className="finding-value">
                          {typeof v === 'object' ? (
                            Array.isArray(v) ? (
                              v.length === 0 ? <span className="text-muted">None</span> :
                              <span className="text-sm">{v.length} item(s)</span>
                            ) : JSON.stringify(v)
                          ) : String(v)}
                        </div>
                      </div>
                    ))}
                    {a.recommendations?.length > 0 && (
                      <div className="mt-05">
                        <div className="finding-label" style={{ marginBottom: '0.3rem' }}>Recommendations</div>
                        {a.recommendations.map((r: string, i: number) => (
                          <div key={i} className="text-sm" style={{ color: 'var(--accent-green)', padding: '0.2rem 0' }}>✓ {r}</div>
                        ))}
                      </div>
                    )}
                    {a.warnings?.length > 0 && (
                      <div className="mt-05">
                        {a.warnings.map((w: string, i: number) => (
                          <div key={i} className="sim-label mt-05 text-sm">{w}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLAN
// ═══════════════════════════════════════════════════════════════════
function PlanTab({ plan, plans, onSelect }: any) {
  if (!plan && plans.length === 0) return <div className="empty-state"><div className="icon">📋</div><p className="text-muted">No plans yet. Analyze a disruption first.</p></div>;
  if (!plan && plans.length > 0) {
    return (
      <div className="fade-in flex-col gap-1">
        <div className="section-header"><h2 className="section-title">Recovery Plans</h2></div>
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>Plan ID</th><th>Solver</th><th>Status</th><th>Cost</th><th>Feasible</th><th>Action</th></tr></thead>
              <tbody>
                {plans.map((p: any) => (
                  <tr key={p.id}>
                    <td className="text-mono truncate">{p.id}</td>
                    <td>{p.solver_type}</td>
                    <td>{statusBadge(p.status)}</td>
                    <td>{fmt(p.total_cost)}</td>
                    <td>{p.is_feasible ? <span className="badge success">Yes</span> : <span className="badge danger">No</span>}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => onSelect(p)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header">
        <div><h2 className="section-title">Recovery Plan Detail</h2>
          <p className="section-subtitle">Plan {plan.id?.substring(0, 8)}... | {plan.solver_type}</p></div>
        <div className="flex-row">
          {statusBadge(plan.status)}
          {statusBadge(plan.solver_status)}
          {plan.solver_type === 'greedy_fallback' && <span className="badge warning">⚠ Greedy Fallback</span>}
        </div>
      </div>
      <div className="kpi-grid">
        <KPICard label="Solver Type" value={plan.solver_type} color="cyan" />
        <KPICard label="Solver Status" value={plan.solver_status} color="blue" />
        <KPICard label="Total Cost" value={fmt(plan.total_cost)} unit="monetary units" color="purple" />
        <KPICard label="Procurement" value={fmt(plan.procurement_cost)} unit="monetary units" color="blue" />
        <KPICard label="Delay Penalty" value={fmt(plan.delay_penalty)} unit="monetary units" color="amber" />
        <KPICard label="Feasible" value={plan.is_feasible ? 'Yes' : 'No'} color={plan.is_feasible ? 'green' : 'red'} />
      </div>
      {/* KPIs */}
      {plan.kpis && Object.keys(plan.kpis).length > 0 && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">📊 Computed KPIs</span></div>
          <div className="kpi-grid">
            <KPICard label="MTTD" value={fmt(plan.kpis.mttd_days, 1)} unit="days" color="blue" />
            <KPICard label="Mean Arrival" value={plan.kpis.mean_arrival_day != null ? fmt(plan.kpis.mean_arrival_day, 1) : '∞'} unit="days (estimate)" color="cyan" />
            <KPICard label="Last Delivery" value={plan.kpis.last_delivery_day != null ? fmt(plan.kpis.last_delivery_day, 1) : '∞'} unit="days (estimate)" color="amber" />
            <KPICard label="Fulfillment" value={fmt(plan.kpis.fulfillment_rate_pct, 1)} unit="%" color="green" />
            <KPICard label="On-Time Rate" value={fmt(plan.kpis.on_time_rate_pct, 1)} unit="%" color="blue" />
            <KPICard label="Stockout Rate" value={fmt(plan.kpis.stockout_rate_pct, 1)} unit="%" color="red" />
            <KPICard label="Auto-Resolved" value={plan.kpis.is_auto_resolved ? 'Yes' : 'No'} color={plan.kpis.is_auto_resolved ? 'green' : 'amber'} />
            <KPICard label="Recovery Cost" value={fmt(plan.kpis.recovery_cost)} unit="monetary units" color="purple" />
          </div>
          <p className="text-xs text-muted mt-1">
            Note: Mean arrival and last delivery are forward-looking estimates, not measured MTTR.
          </p>
        </div>
      )}
      {/* Actions */}
      {plan.actions?.length > 0 && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">Recovery Actions ({plan.actions.length})</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Source</th><th>Component</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th><th>Arrival</th><th>Delay</th></tr></thead>
              <tbody>
                {plan.actions.map((a: any, i: number) => (
                  <tr key={i}>
                    <td>{a.source_id}</td>
                    <td>{a.component_id}</td>
                    <td>{a.quantity}</td>
                    <td>{fmt(a.unit_cost)}</td>
                    <td>{fmt(a.subtotal_cost || a.subtotal)}</td>
                    <td>{fmt(a.estimated_arrival_days, 1)}d</td>
                    <td>{a.delay_days > 0 ? <span style={{ color: 'var(--accent-red)' }}>{fmt(a.delay_days, 1)}d late</span> : <span style={{ color: 'var(--accent-green)' }}>On time</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Violated constraints */}
      {plan.violated_constraints?.length > 0 && (
        <div className="card mt-1" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="card-header"><span className="card-title" style={{ color: 'var(--accent-red)' }}>⚠ Violated Constraints</span></div>
          {plan.violated_constraints.map((c: string, i: number) => (
            <div key={i} className="text-sm" style={{ padding: '0.3rem 0', color: 'var(--accent-red)' }}>• {c}</div>
          ))}
        </div>
      )}
      {plans.length > 1 && (
        <button className="btn btn-outline mt-1" onClick={() => onSelect(null)}>← View All Plans</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APPROVAL
// ═══════════════════════════════════════════════════════════════════
function ApprovalTab({ plan, plans, onApprove, onReject, onSimulate, loading, onSelect }: any) {
  const [comment, setComment] = useState('');
  const pendingPlans = plans.filter((p: any) => p.status === 'pending');
  const approvedPlans = plans.filter((p: any) => p.status === 'approved');

  if (!plan) {
    return (
      <div className="fade-in flex-col gap-1">
        <div className="section-header"><h2 className="section-title">Approval Center</h2></div>
        {pendingPlans.length === 0 && approvedPlans.length === 0 ? (
          <div className="empty-state"><div className="icon">✅</div><p className="text-muted">No plans awaiting action</p></div>
        ) : (
          <div className="card">
            <div className="card-header"><span className="card-title">Plans Requiring Action</span></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Plan ID</th><th>Solver</th><th>Cost</th><th>Feasible</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {[...pendingPlans, ...approvedPlans].map((p: any) => (
                    <tr key={p.id}>
                      <td className="text-mono truncate">{p.id}</td>
                      <td>{p.solver_type}</td>
                      <td>{fmt(p.total_cost)}</td>
                      <td>{p.is_feasible ? '✓' : '✗'}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td><button className="btn btn-outline btn-sm" onClick={() => onSelect(p)}>Review</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header">
        <div><h2 className="section-title">Plan Review</h2>
          <p className="section-subtitle">{plan.id}</p></div>
        {statusBadge(plan.status)}
      </div>
      <div className="kpi-grid">
        <KPICard label="Status" value={plan.status} color={plan.status === 'pending' ? 'amber' : plan.status === 'approved' ? 'green' : 'red'} />
        <KPICard label="Solver" value={plan.solver_type} color="cyan" />
        <KPICard label="Total Cost" value={fmt(plan.total_cost)} color="purple" />
        <KPICard label="Feasible" value={plan.is_feasible ? 'Yes' : 'No'} color={plan.is_feasible ? 'green' : 'red'} />
      </div>
      {plan.status === 'pending' && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">Take Action</span></div>
          <div className="form-group">
            <label className="form-label" htmlFor="reject-comment">Comment (optional)</label>
            <textarea id="reject-comment" className="form-textarea" value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Optional reason for approval/rejection..." />
          </div>
          <div className="flex-row">
            <button className="btn btn-success" onClick={() => onApprove(plan.id)} disabled={loading || !plan.is_feasible}>
              ✓ Approve Plan
            </button>
            <button className="btn btn-danger" onClick={() => onReject(plan.id, comment)} disabled={loading}>
              ✗ Reject Plan
            </button>
            {!plan.is_feasible && <span className="text-xs text-muted">Cannot approve infeasible plan</span>}
          </div>
        </div>
      )}
      {plan.status === 'approved' && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">Execute Simulation</span></div>
          <div className="sim-label mb-1">⚠ SIMULATION ONLY — NO REAL-WORLD ACTIONS</div>
          <button className="btn btn-primary" onClick={() => onSimulate(plan.id)} disabled={loading}>
            🔬 Execute Digital Twin Simulation
          </button>
        </div>
      )}
      {plan.status === 'rejected' && (
        <div className="card mt-1" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="card-header"><span className="card-title" style={{ color: 'var(--accent-red)' }}>Plan Rejected</span></div>
          <p className="text-sm text-muted">This plan has been rejected. Simulation is not available.</p>
        </div>
      )}
      {plan.status === 'executed' && (
        <div className="card mt-1" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="card-header"><span className="card-title" style={{ color: 'var(--accent-green)' }}>Plan Executed</span></div>
          <p className="text-sm text-muted">This plan has been simulated. View results in the Digital Twin tab.</p>
        </div>
      )}
      <button className="btn btn-outline mt-1" onClick={() => onSelect(null)}>← Back to All Plans</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DIGITAL TWIN
// ═══════════════════════════════════════════════════════════════════
function TwinTab({ sim, simulations, plan }: any) {
  if (!sim && simulations.length === 0) return (
    <div className="empty-state"><div className="icon">🔬</div><p className="text-muted">No simulations yet. Approve and simulate a plan first.</p></div>
  );
  const currentSim = sim || (simulations.length > 0 ? simulations[0] : null);
  if (!currentSim) return null;

  const beforeInv = currentSim.before_state?.inventory || [];
  const afterInv = currentSim.after_state?.inventory || [];

  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header">
        <div><h2 className="section-title">Digital Twin — Simulation Results</h2>
          <p className="section-subtitle">Plan {currentSim.plan_id?.substring(0, 8)}...</p></div>
        {statusBadge(currentSim.status || currentSim.result_status)}
      </div>
      <div className="sim-label">⚠ SIMULATION ONLY — NO REAL-WORLD ACTIONS WERE PERFORMED</div>
      {currentSim.message && <p className="text-sm" style={{ color: 'var(--accent-amber)' }}>{currentSim.message}</p>}

      {/* Before/After Inventory */}
      <div className="panel-grid panel-grid-2 mt-1">
        <div className="card">
          <div className="card-header"><span className="card-title">📦 Before State — Inventory</span></div>
          {beforeInv.length === 0 ? <p className="text-muted text-sm">No inventory data</p> : (
            <div className="table-container">
              <table>
                <thead><tr><th>Material</th><th>Warehouse</th><th>Qty</th><th>Safety</th></tr></thead>
                <tbody>
                  {beforeInv.map((inv: any, i: number) => (
                    <tr key={i}><td>{inv.material_id}</td><td>{inv.warehouse_id}</td><td>{inv.current_qty}</td><td>{inv.safety_stock}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">📦 After State — Inventory</span></div>
          {afterInv.length === 0 ? <p className="text-muted text-sm">No inventory data</p> : (
            <div className="table-container">
              <table>
                <thead><tr><th>Material</th><th>Warehouse</th><th>Qty</th><th>Change</th></tr></thead>
                <tbody>
                  {afterInv.map((inv: any, i: number) => {
                    const before = beforeInv.find((b: any) => b.id === inv.id);
                    const diff = before ? inv.current_qty - before.current_qty : 0;
                    return (
                      <tr key={i} className="diff-row">
                        <td>{inv.material_id}</td><td>{inv.warehouse_id}</td><td>{inv.current_qty}</td>
                        <td className={diff < 0 ? 'decreased' : diff > 0 ? 'increased' : ''}>
                          {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Actions Applied */}
      {currentSim.actions_applied?.length > 0 && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">⚙️ Simulated Actions ({currentSim.actions_applied.length})</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Type</th><th>Source</th><th>Component</th><th>Qty</th><th>Before</th><th>After</th><th>Note</th></tr></thead>
              <tbody>
                {currentSim.actions_applied.map((a: any, i: number) => (
                  <tr key={i}>
                    <td><span className="badge info">{a.type}</span></td>
                    <td>{a.source}</td><td>{a.component}</td><td>{a.quantity}</td>
                    <td>{a.old_qty ?? a.old_capacity ?? '—'}</td>
                    <td>{a.new_qty ?? a.new_capacity ?? '—'}</td>
                    <td className="text-xs text-muted">{a.note || (a.simulated ? 'Simulated' : '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost comparison */}
      {plan && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">💰 Cost Summary</span></div>
          <div className="kpi-grid">
            <KPICard label="Total Cost" value={fmt(plan.total_cost)} unit="monetary units" color="purple" />
            <KPICard label="Procurement" value={fmt(plan.procurement_cost)} unit="monetary units" color="blue" />
            <KPICard label="Delay Penalty" value={fmt(plan.delay_penalty)} unit="monetary units" color="amber" />
          </div>
        </div>
      )}

      {/* History */}
      {simulations.length > 1 && (
        <div className="card mt-1">
          <div className="card-header"><span className="card-title">Simulation History</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>ID</th><th>Plan</th><th>Status</th><th>Actions</th><th>Created</th></tr></thead>
              <tbody>
                {simulations.map((s: any) => (
                  <tr key={s.id}>
                    <td className="text-mono truncate">{s.id}</td>
                    <td className="text-mono truncate">{s.plan_id}</td>
                    <td>{statusBadge(s.result_status)}</td>
                    <td>{s.actions_applied?.length || 0}</td>
                    <td className="text-xs text-muted">{s.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT
// ═══════════════════════════════════════════════════════════════════
function AuditTab({ events }: any) {
  if (!events || events.length === 0) return <div className="empty-state"><div className="icon">📝</div><p className="text-muted">No audit events recorded</p></div>;
  return (
    <div className="fade-in flex-col gap-1">
      <div className="section-header"><h2 className="section-title">Audit Trail</h2>
        <p className="section-subtitle">{events.length} events</p></div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Event</th><th>Entity</th><th>Actor</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              {events.map((e: any) => (
                <tr key={e.id}>
                  <td>{statusBadge(e.event_type)}</td>
                  <td className="text-mono truncate">{e.entity_id}</td>
                  <td>{e.actor}</td>
                  <td className="text-xs truncate" style={{ maxWidth: 300 }}>
                    {e.details ? JSON.stringify(e.details).substring(0, 80) : '—'}
                  </td>
                  <td className="text-xs text-muted">{e.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
