import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardTab, UserSession } from "../App";
import {
  AgentStep,
  fetchTelemetryWithFallback,
  InventoryItem,
  MachineTelemetry,
  orchestrateWithFallback,
  seedMockData,
} from "../lib/api";
import CentralWorkspace from "./layout/CentralWorkspace";
import Sidebar from "./layout/Sidebar";
import TopBanner from "./layout/TopBanner";
import MultiAgentLogs, { LogEntry, stepsToLogEntries } from "./MultiAgentLogs";

interface OperationsDashboardProps {
  user: UserSession;
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
}

interface ChartDataPoint {
  temperature: number;
  vibration: number;
  timestamp: string;
}

interface AnomalyLog {
  machine_id: string;
  timestamp: string;
  temperature: number;
  vibration: number;
  status: "WARNING" | "CRITICAL";
  source: "SYSTEM" | "JUDGE_SANDBOX";
}

// Lightweight glowing SVG trend chart for real-time SCADA visualisation
function IndustrialTelemetryChart({
  machineId,
  data,
}: {
  machineId: string;
  data: ChartDataPoint[];
}) {
  if (!data || data.length < 2) {
    return (
      <div className="h-28 flex items-center justify-center border border-slate-800 bg-slate-950/40 rounded-lg">
        <span className="text-[10px] text-slate-500 font-mono animate-pulse uppercase tracking-wider">
          Awaiting telemetry sequence...
        </span>
      </div>
    );
  }

  const width = 280;
  const height = 90;
  const padding = 15;

  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const minTemp = 40;
  const maxTemp = 130;
  const minVib = 0;
  const maxVib = 12;

  const getPoints = (vals: number[], min: number, max: number) => {
    return vals
      .map((val, idx) => {
        const x = padding + (idx / (vals.length - 1)) * chartW;
        const pct = (val - min) / (max - min || 1);
        const y = padding + chartH - pct * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const temps = data.map((d) => d.temperature);
  const vibs = data.map((d) => d.vibration);

  const tempPath = `M ${getPoints(temps, minTemp, maxTemp)}`;
  const vibPath = `M ${getPoints(vibs, minVib, maxVib)}`;

  return (
    <div className="border border-slate-800/80 bg-slate-950/70 p-2.5 rounded shadow-inner">
      <div className="flex justify-between items-center mb-1.5">
        <h4 className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
          Telemetry Trend: {machineId}
        </h4>
        <div className="flex gap-2 text-[8px] font-mono">
          <span className="text-cyan-400">● Temp</span>
          <span className="text-emerald-400">● Vib</span>
        </div>
      </div>

      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1={padding} y1={padding + chartH / 2} x2={width - padding} y2={padding + chartH / 2} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1={padding} y1={padding + chartH} x2={width - padding} y2={padding + chartH} stroke="#1e293b" strokeDasharray="3,3" />

          {/* Verticals */}
          <line x1={padding} y1={padding} x2={padding} y2={padding + chartH} stroke="#1e293b" />
          <line x1={width - padding} y1={padding} x2={width - padding} y2={padding + chartH} stroke="#1e293b" />

          {/* Temp Line (Cyan) */}
          <path d={tempPath} fill="none" stroke="#22d3ee" strokeWidth="1.25" filter="url(#glow-cyan)" />

          {/* Vibration Line (Emerald) */}
          <path d={vibPath} fill="none" stroke="#34d399" strokeWidth="1.25" filter="url(#glow-emerald)" />

          {/* Labels */}
          <text x={padding - 4} y={padding + 3} textAnchor="end" fill="#475569" className="text-[7px] font-mono">
            Max
          </text>
          <text x={padding - 4} y={padding + chartH + 3} textAnchor="end" fill="#475569" className="text-[7px] font-mono">
            Min
          </text>
        </svg>
      </div>
    </div>
  );
}

export default function OperationsDashboard({
  user,
  tab,
  onTabChange,
  onLogout,
}: OperationsDashboardProps) {
  const seed = useMemo(() => seedMockData(), []);
  
  // States
  const [machines, setMachines] = useState<MachineTelemetry[]>(seed.machines);
  const [inventory, setInventory] = useState<InventoryItem[]>(seed.inventory);
  const [feed, setFeed] = useState<AgentStep[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [offline, setOffline] = useState(false);
  const [cardsReady, setCardsReady] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);

  // Uptime, Incidents, and Telemetry Trends States
  const [sessionStart] = useState(() => Date.now());
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [judgeAnomalyM3, setJudgeAnomalyM3] = useState(false);
  const [selectedChartMachine, setSelectedChartMachine] = useState<string>("M3");
  const [historyData, setHistoryData] = useState<Record<string, ChartDataPoint[]>>({});

  const alertCount = useMemo(
    () => machines.filter((m) => m.status === "CRITICAL" || m.status === "WARNING").length,
    [machines]
  );

  const oee = useMemo(() => {
    const critical = machines.filter((m) => m.status === "CRITICAL").length;
    const warning = machines.filter((m) => m.status === "WARNING").length;
    return Math.max(70, 98 - critical * 4.5 - warning * 1.8);
  }, [machines]);

  const plantHealthScore = useMemo(() => {
    const warningCriticalCount = machines.filter(
      (m) => m.status === "CRITICAL" || m.status === "WARNING"
    ).length;
    const f_machines_pct = machines.length ? 1.0 - (warningCriticalCount / machines.length) : 1.0;
    const avg_fail_prob = machines.length
      ? machines.reduce((acc, m) => acc + (m.failure_probability ?? 0.15), 0) / machines.length
      : 0.15;
    const avg_stockout_prob = inventory.length
      ? inventory.reduce((acc, i) => acc + (i.stockout_probability ?? 0.15), 0) / inventory.length
      : 0.15;

    const score = 100 * (0.4 * f_machines_pct + 0.3 * (1.0 - avg_fail_prob) + 0.3 * (1.0 - avg_stockout_prob));
    return Math.max(0.0, Math.min(100.0, Math.round(score * 10) / 10));
  }, [machines, inventory]);

  // Refresh logic with Judge Mode Anomaly Injection integration
  const refreshTelemetry = useCallback(async () => {
    const result = await fetchTelemetryWithFallback();
    setOffline(result.offline);
    setInventory(result.inventory);
    
    setMachines(() => {
      const base = result.machines;
      if (judgeAnomalyM3) {
        return base.map((m) =>
          m.machine_id === "M3"
            ? {
                ...m,
                temperature_c: 115.4,
                vibration_mm_s: 9.2,
                status: "CRITICAL" as const,
                failure_probability: 0.95,
                status_tier: "Critical",
                recommended_action: "Initiate emergency maintenance trip"
              }
            : m
        );
      }
      return base;
    });
    
    setCardsReady(true);
  }, [judgeAnomalyM3]);

  // Periodic polling loop
  useEffect(() => {
    void refreshTelemetry();
    const id = window.setInterval(() => void refreshTelemetry(), 15000);
    return () => window.clearInterval(id);
  }, [refreshTelemetry]);

  // Record rolling telemetry history ticks
  useEffect(() => {
    if (machines.length === 0) return;
    setHistoryData((prev) => {
      const next = { ...prev };
      machines.forEach((m) => {
        const list = next[m.machine_id] || [];
        const newPoint: ChartDataPoint = {
          temperature: m.temperature_c,
          vibration: m.vibration_mm_s,
          timestamp: new Date().toLocaleTimeString(),
        };
        next[m.machine_id] = [...list, newPoint].slice(-15);
      });
      return next;
    });
  }, [machines]);

  // Scan telemetry updates and log anomalies/warnings
  useEffect(() => {
    machines.forEach((m) => {
      if (m.status === "CRITICAL" || m.status === "WARNING") {
        setAnomalies((prev) => {
          const alreadyLogged = prev.some(
            (a) => a.machine_id === m.machine_id && a.status === m.status
          );
          if (alreadyLogged) return prev;
          return [
            ...prev,
            {
              machine_id: m.machine_id,
              timestamp: new Date().toISOString(),
              temperature: m.temperature_c,
              vibration: m.vibration_mm_s,
              status: m.status as "WARNING" | "CRITICAL",
              source: "SYSTEM",
            },
          ];
        });
      }
    });
  }, [machines]);

  // Trigger Judge Presentation Sandbox Anomaly
  function handleTriggerJudgeAnomaly() {
    setJudgeAnomalyM3(true);
    setAnomalies((prev) => [
      ...prev,
      {
        machine_id: "M3",
        timestamp: new Date().toISOString(),
        temperature: 115.4,
        vibration: 9.2,
        status: "CRITICAL",
        source: "JUDGE_SANDBOX",
      },
    ]);
    setMachines((prev) =>
      prev.map((m) =>
        m.machine_id === "M3"
          ? {
              ...m,
              temperature_c: 115.4,
              vibration_mm_s: 9.2,
              status: "CRITICAL" as const,
              failure_probability: 0.95,
              status_tier: "Critical",
              recommended_action: "Initiate emergency maintenance trip"
            }
          : m
      )
    );
  }

  // Reset Sandbox Simulation
  function handleResetSimulation() {
    setJudgeAnomalyM3(false);
    void refreshTelemetry();
  }

  // Export Shift Incident Report Client-side CSV/text generation
  const handleExportReport = () => {
    const elapsedSecs = Math.floor((Date.now() - sessionStart) / 1000);
    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;
    const uptimeStr = `${mins}m ${secs}s`;

    let report = "";
    report += "==================================================\n";
    report += "      A-I-M-S SHIFT INCIDENT LOG REPORT           \n";
    report += "==================================================\n";
    report += `Exported At: ${new Date().toISOString()}\n`;
    report += `Operator ID: ${user.operatorId}\n`;
    report += `Shift Frame: ${user.shift}\n`;
    report += `Session Active Time: ${uptimeStr}\n`;
    report += `Operational State (OEE): ${oee.toFixed(1)}%\n`;
    report += `Alerts At Time of Export: ${alertCount}\n`;
    report += "==================================================\n\n";

    report += "--- IN-SESSION CRITICAL INCIDENTS & ANOMALIES ---\n";
    report += "Timestamp,Machine ID,Temp (°C),Vib (mm/s),Severity,Origin\n";

    if (anomalies.length === 0) {
      report += "No anomalous events flagged during this monitoring frame.\n";
    } else {
      anomalies.forEach((a) => {
        report += `${a.timestamp},${a.machine_id},${a.temperature},${a.vibration},${a.status},${a.source}\n`;
      });
    }

    report += "\n==================================================\n";
    report += "END OF CONTROL ROOM EXPORT TELEMETRY.\n";

    const blob = new Blob([report], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AIMS_ShiftReport_${user.operatorId}_${user.shift}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function handleOrchestrate(query: string) {
    setOrchestrating(true);
    setSummary(null);
    try {
      const { data, offline: isOffline } = await orchestrateWithFallback(query);
      if (isOffline) setOffline(true);
      setFeed(data.steps);
      setSummary(data.summary);
      const runId = `run-${Date.now()}`;
      setLogs((prev) => [...prev, ...stepsToLogEntries(data.steps, runId)]);
    } finally {
      setOrchestrating(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-fadeIn">
      <TopBanner
        shift={user.shift}
        oee={oee}
        alertCount={alertCount}
        offline={offline}
        onLogout={onLogout}
        onExportReport={handleExportReport}
        plantHealthScore={plantHealthScore}
      />

      {offline && (
        <div className="shrink-0 px-4 py-2 bg-amber-950/50 border-b border-amber-500/30 text-amber-300 text-xs font-mono">
          Backend offline – showing last known mock snapshot.
        </div>
      )}

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-3 pt-2 border-b border-slate-800 bg-slate-950">
        <button
          type="button"
          onClick={() => onTabChange("OPS_VIEW")}
          className={`px-3 py-2 text-xs font-mono uppercase tracking-wider transition border-b-2 -mb-px ${
            tab === "OPS_VIEW"
              ? "border-emerald-400 text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Ops View
        </button>
        <button
          type="button"
          onClick={() => onTabChange("AGENT_LOGS")}
          className={`px-3 py-2 text-xs font-mono uppercase tracking-wider transition border-b-2 -mb-px ${
            tab === "AGENT_LOGS"
              ? "border-emerald-400 text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Agent Logs
        </button>
        <span className="ml-auto text-[11px] text-slate-500 font-mono pr-2">
          Operator {user.operatorId}
        </span>
      </div>

      <div className="flex flex-row flex-1 overflow-hidden">
        <Sidebar machines={machines} ready={cardsReady} />

        {tab === "OPS_VIEW" ? (
          <>
            <CentralWorkspace
              feed={feed}
              summary={summary}
              loading={orchestrating}
              onOrchestrate={handleOrchestrate}
            />
            {/* Right KPI & Hardware Telemetry Panel */}
            <aside className="hidden lg:flex w-72 shrink-0 border-l border-slate-800 bg-slate-900/40 flex-col p-3 overflow-y-auto space-y-4">
              
              {/* Judge Presentation Sandbox */}
              <div className="border border-slate-700 bg-slate-950/80 p-3 rounded shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2.5">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Judge Presentation Sandbox
                  </h3>
                  <span className={`h-2 w-2 rounded-full ${judgeAnomalyM3 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                </div>
                <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">
                  SIMULATE SCADA ANOMALY IN PRESENTATION
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerJudgeAnomaly}
                    className="w-full text-center text-xs font-mono font-semibold py-2 bg-red-650/80 hover:bg-red-650 border border-red-500/40 text-red-100 rounded transition duration-200"
                  >
                    ⚠️ TRIGGER FAULT (M3)
                  </button>
                  {judgeAnomalyM3 && (
                    <button
                      type="button"
                      onClick={handleResetSimulation}
                      className="w-full text-center text-xs font-mono py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-650/50 text-slate-300 rounded transition duration-200"
                    >
                      RESET SIMULATOR
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Telemetry Trends Widget */}
              <div className="border border-slate-700 bg-slate-950/80 p-3 rounded shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2.5">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Trend Visualisation
                  </h3>
                  <select
                    value={selectedChartMachine}
                    onChange={(e) => setSelectedChartMachine(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-[10px] px-1.5 py-0.5 outline-none font-mono focus:border-cyan-400"
                  >
                    <option value="M1">Asset M1</option>
                    <option value="M2">Asset M2</option>
                    <option value="M3">Asset M3</option>
                    <option value="M4">Asset M4</option>
                  </select>
                </div>
                <IndustrialTelemetryChart
                  machineId={selectedChartMachine}
                  data={historyData[selectedChartMachine] || []}
                />
              </div>

              {/* Inventory */}
              <div>
                <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-2.5">
                  Inventory Forecast Engine
                </h3>
                {inventory.map((item) => {
                  const hasForecast = item.days_to_stockout !== undefined && item.days_to_stockout !== null;
                  const riskProb = item.stockout_probability ?? 0.0;
                  const riskColor =
                    riskProb >= 0.8
                      ? "text-red-400 border-red-500/30 bg-red-950/20"
                      : riskProb >= 0.5
                        ? "text-amber-400 border-amber-500/30 bg-amber-950/20"
                        : "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";

                  return (
                    <div key={item.material} className="mb-3 border border-slate-800 bg-slate-950/60 p-2.5 rounded shadow-sm">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm text-slate-200 font-mono font-medium">{item.material}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            item.status === "CRITICAL"
                              ? "bg-red-600 text-white animate-pulse"
                              : item.status === "LOW"
                                ? "bg-amber-500 text-slate-950 font-bold"
                                : "text-emerald-400 border border-emerald-500/40 bg-emerald-950/20"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono space-y-1">
                        <div className="flex justify-between">
                          <span>Current Stock</span>
                          <span className="text-slate-200 font-semibold">{item.current_stock_kg.toFixed(0)} kg</span>
                        </div>
                        {hasForecast ? (
                          <div className="pt-1.5 mt-1.5 border-t border-slate-900 space-y-1">
                            <div className="flex justify-between">
                              <span>Days to Stockout</span>
                              <span className="text-slate-200 font-semibold">{item.days_to_stockout?.toFixed(1)}d</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Stockout Risk</span>
                              <span className={`px-1 rounded border text-[9px] font-semibold ${riskColor}`}>
                                {Math.round(riskProb * 100)}%
                              </span>
                            </div>
                            {item.reorder_quantity_suggestion !== undefined && item.reorder_quantity_suggestion !== null && item.reorder_quantity_suggestion > 0 && (
                              <div className="text-[10px] text-cyan-400 bg-cyan-950/30 border border-cyan-800/30 px-1.5 py-0.5 mt-1 rounded font-bold">
                                Reorder Suggestion: {item.reorder_quantity_suggestion} kg
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-between">
                            <span>Time Left</span>
                            <span className="text-slate-200">{item.days_left.toFixed(1)}d</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent Runs status */}
              <div className="border-t border-slate-800 pt-3">
                <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
                  Recent runs
                </h3>
                <p className="text-xs text-slate-400 font-mono uppercase">
                  {logs.length === 0
                    ? "—"
                    : `${Math.ceil(logs.length / 4)} orchestration(s) · ${logs.length} events`}
                </p>
              </div>

            </aside>
          </>
        ) : (
          <MultiAgentLogs logs={logs} />
        )}
      </div>
    </div>
  );
}
