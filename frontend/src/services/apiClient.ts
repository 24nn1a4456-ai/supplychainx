/**
 * Centralized Typed API Client for Supply Chain X
 * Connects to FastAPI backend at VITE_API_BASE_URL.
 * Includes timeout handling, typed responses, error normalization, and fallback detection.
 */

import type {
  SupplyNode,
  SupplyRoute,
  KPIData,
  InventoryTelemetry,
  CustomerOrder,
  AuditLogEntry,
  OutageSimulationState,
  WeatherSummaryResponse
} from '../types/supplyChain';

export interface BackendHealthResponse {
  status: string;
  version: string;
  database: string;
  mode: string;
  simulation_only: boolean;
}

// Normalize base URL to ensure clean /api routing without duplicate slashes
const rawBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
// Strip trailing slash and trailing /api if provided by user
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
export const API_BASE_URL = `${cleanBaseUrl}/api`;

const DEFAULT_TIMEOUT_MS = 6000;

class ApiClientError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function fetchWithTimeout<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorDetail = errorJson.detail;
        }
      } catch {
        // Fall back to HTTP status
      }
      throw new ApiClientError(errorDetail, response.status);
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError(`Request timeout after ${DEFAULT_TIMEOUT_MS}ms connecting to ${endpoint}`);
    }
    if (err instanceof ApiClientError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new ApiClientError(`Failed to reach backend at ${url}: ${message}`);
  }
}

export const apiClient = {
  /**
   * Health check
   */
  async getHealth(): Promise<BackendHealthResponse> {
    return fetchWithTimeout<BackendHealthResponse>('/health');
  },

  /**
   * Fetch all 10 supply chain network nodes
   */
  async getNodes(): Promise<SupplyNode[]> {
    return fetchWithTimeout<SupplyNode[]>('/network/nodes');
  },

  /**
   * Fetch supplier tier nodes
   */
  async getSuppliers(): Promise<SupplyNode[]> {
    return fetchWithTimeout<SupplyNode[]>('/network/suppliers');
  },

  /**
   * Fetch all active transit routes
   */
  async getRoutes(): Promise<SupplyRoute[]> {
    return fetchWithTimeout<SupplyRoute[]>('/network/routes');
  },

  /**
   * Fetch global KPI telemetry
   */
  async getKpis(): Promise<KPIData> {
    return fetchWithTimeout<KPIData>('/kpis');
  },

  /**
   * Fetch regional inventory buffer data
   */
  async getInventory(): Promise<InventoryTelemetry[]> {
    return fetchWithTimeout<InventoryTelemetry[]>('/inventory');
  },

  /**
   * Fetch customer orders and SLA tiers
   */
  async getOrders(): Promise<CustomerOrder[]> {
    return fetchWithTimeout<CustomerOrder[]>('/orders');
  },

  /**
   * Fetch chronological governance audit log events
   */
  async getAuditLog(): Promise<AuditLogEntry[]> {
    return fetchWithTimeout<AuditLogEntry[]>('/crisis/audit');
  },

  /**
   * Fetch current persisted crisis simulation state from backend
   */
  async getCrisisState(): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/state');
  },

  /**
   * 1. Start a deterministic synthetic supplier outage
   */
  async startOutage(payload: { supplierId?: string; cause?: string } = {}): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/outage/start', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * 2. Assess affected nodes, inventory, production and orders
   */
  async assessOutage(): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/outage/assess', {
      method: 'POST'
    });
  },

  /**
   * 3. Generate transparent rule-based recovery plan
   */
  async planRecovery(): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/outage/plan', {
      method: 'POST'
    });
  },

  /**
   * 4. Authorize recovery plan (awaiting_approval -> approved)
   */
  async approvePlan(): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/outage/approve', {
      method: 'POST'
    });
  },

  /**
   * 5. Reject recovery plan with mandatory recorded reason
   */
  async rejectPlan(reason: string): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/outage/reject', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  /**
   * 6. Execute recovery actions in simulation mode
   * Security Gate: Backend enforces that plan must be approved first.
   */
  async executePlan(): Promise<OutageSimulationState> {
    return fetchWithTimeout<OutageSimulationState>('/crisis/outage/execute', {
      method: 'POST'
    });
  },

  /**
   * 7. Reset demo to pristine baseline operational state
   */
  async resetDemo(): Promise<{ status: string; message: string; simulation_state: OutageSimulationState }> {
    return fetchWithTimeout<{ status: string; message: string; simulation_state: OutageSimulationState }>('/demo/reset', {
      method: 'POST'
    });
  },

  /**
   * 8. Fetch real-time weather disruption telemetry across supply chain nodes
   */
  async getWeatherDisruptions(): Promise<WeatherSummaryResponse> {
    return fetchWithTimeout<WeatherSummaryResponse>('/disruptions/weather');
  }
};
