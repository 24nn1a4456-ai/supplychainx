/**
 * api.ts — API client for Supply Chain X backend.
 * All data is SYNTHETIC. No real operations.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── System ──────────────────────────────────────────────────────
export const getHealth = () => request<any>('/api/health');
export const getSummary = () => request<any>('/api/summary');

// ─── Reference Data ──────────────────────────────────────────────
export const getSuppliers = () => request<any[]>('/api/suppliers');
export const getInventory = () => request<any[]>('/api/inventory');
export const getWarehouses = () => request<any[]>('/api/warehouses');

// ─── Disruptions ─────────────────────────────────────────────────
export const getDisruptions = () => request<any[]>('/api/disruptions');
export const getDisruption = (id: string) => request<any>(`/api/disruptions/${id}`);
export const createDisruption = (data: any) =>
  request<any>('/api/disruptions', { method: 'POST', body: JSON.stringify(data) });
export const analyzeDisruption = (id: string) =>
  request<any>(`/api/disruptions/${id}/analyze`, { method: 'POST' });

// ─── Plans ───────────────────────────────────────────────────────
export const getPlans = () => request<any[]>('/api/plans');
export const getPlan = (id: string) => request<any>(`/api/plans/${id}`);
export const approvePlan = (id: string, data: any) =>
  request<any>(`/api/plans/${id}/approve`, { method: 'POST', body: JSON.stringify(data) });
export const rejectPlan = (id: string, data: any) =>
  request<any>(`/api/plans/${id}/reject`, { method: 'POST', body: JSON.stringify(data) });
export const simulatePlan = (id: string) =>
  request<any>(`/api/plans/${id}/simulate`, { method: 'POST' });

// ─── Simulations & Audit ─────────────────────────────────────────
export const getSimulations = () => request<any[]>('/api/simulations');
export const getSimulation = (id: string) => request<any>(`/api/simulations/${id}`);
export const getAudit = () => request<any[]>('/api/audit');
