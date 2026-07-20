/**
 * A-I-M-S API helpers — talk directly to the FastAPI gateway on port 8001.
 */

/** const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001/api/v1"; **/
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://aims-autonomous-industrial-management-nh7f.onrender.com/api/v1";

export type MachineStatus = "NORMAL" | "WARNING" | "CRITICAL";
export type InventoryStatus = "HEALTHY" | "LOW" | "CRITICAL";

export interface MachineTelemetry {
  machine_id: string;
  timestamp: string;
  temperature_c: number;
  vibration_mm_s: number;
  rpm: number;
  operating_hours: number;
  status: MachineStatus;
  failure_probability?: number | null;
  status_tier?: string | null;
  recommended_action?: string | null;
  engine_status?: string | null;
}

export interface InventoryItem {
  material: string;
  current_stock_kg: number;
  daily_usage_kg: number;
  days_left: number;
  status: InventoryStatus;
  days_to_stockout?: number | null;
  stockout_probability?: number | null;
  reorder_quantity_suggestion?: number | null;
}

export interface AgentStep {
  agent: string;
  message: string;
  timestamp?: string | null;
}

export interface OrchestrateResponse {
  steps: AgentStep[];
  summary: string;
  plant_health_score?: number | null;
  plant_health_label?: string | null;
}

/** Deterministic fallback when backend is unreachable. */
export function seedMockData(): {
  machines: MachineTelemetry[];
  inventory: InventoryItem[];
  agentSteps: AgentStep[];
} {
  const ts = new Date().toISOString();
  return {
    machines: [
      {
        machine_id: "M1",
        timestamp: ts,
        temperature_c: 68.2,
        vibration_mm_s: 2.1,
        rpm: 1450,
        operating_hours: 4120.5,
        status: "NORMAL",
      },
      {
        machine_id: "M2",
        timestamp: ts,
        temperature_c: 74.8,
        vibration_mm_s: 3.4,
        rpm: 1380,
        operating_hours: 3890.0,
        status: "NORMAL",
      },
      {
        machine_id: "M3",
        timestamp: ts,
        temperature_c: 82.1,
        vibration_mm_s: 4.8,
        rpm: 1520,
        operating_hours: 5012.3,
        status: "WARNING",
      },
      {
        machine_id: "M4",
        timestamp: ts,
        temperature_c: 98.6,
        vibration_mm_s: 7.9,
        rpm: 980,
        operating_hours: 6234.7,
        status: "CRITICAL",
      },
    ],
    inventory: [
      {
        material: "Steel",
        current_stock_kg: 4200,
        daily_usage_kg: 580,
        days_left: 7.24,
        status: "HEALTHY",
      },
      {
        material: "Aluminum",
        current_stock_kg: 1100,
        daily_usage_kg: 420,
        days_left: 2.62,
        status: "CRITICAL",
      },
    ],
    agentSteps: [
      {
        agent: "MachineAgent",
        message:
          "Detected critical thermal threshold on Machine M4 (98.6 C). High failure probability (92%). Pushing alert to Maintenance.",
        timestamp: ts,
      },
      {
        agent: "MaintenanceAgent",
        message:
          "Verified spare parts availability in inventory. Scheduled preventive maintenance work order for Shift B.",
        timestamp: ts,
      },
      {
        agent: "ProductionAgent",
        message:
          "Shifted ongoing batch queue for Order #A102 from Machine M4 to Machine M2 to prevent downtime delays.",
        timestamp: ts,
      },
      {
        agent: "SupervisorAgent",
        message: "Action fully executed. Production line adjusted. Maintenance dispatch logged.",
        timestamp: ts,
      },
    ],
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTelemetry(): Promise<MachineTelemetry[]> {
  return fetchJson<MachineTelemetry[]>('/telemetry');
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  return fetchJson<InventoryItem[]>('/inventory');
}

export async function orchestrate(query: string): Promise<OrchestrateResponse> {
  return fetchJson<OrchestrateResponse>('/agent/orchestrate', {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

/** Offline-safe orchestrate: uses live API or seeded mock steps. */
export async function orchestrateWithFallback(
  query: string
): Promise<{ data: OrchestrateResponse; offline: boolean }> {
  try {
    const data = await orchestrate(query);
    return { data, offline: false };
  } catch {
    const mock = seedMockData();
    return {
      data: {
        steps: mock.agentSteps,
        summary: `Backend offline – mock orchestration for \"${query}\". Production line adjusted; maintenance dispatch logged.`,
      },
      offline: true,
    };
  }
}

export async function fetchTelemetryWithFallback(): Promise<{
  machines: MachineTelemetry[];
  inventory: InventoryItem[];
  offline: boolean;
}> {
  try {
    const [machines, inventory] = await Promise.all([fetchTelemetry(), fetchInventory()]);
    return { machines, inventory, offline: false };
  } catch {
    const mock = seedMockData();
    return { machines: mock.machines, inventory: mock.inventory, offline: true };
  }
}
