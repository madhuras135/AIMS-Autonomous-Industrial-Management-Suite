import type { AgentStep } from "../lib/api";

export interface LogEntry {
  id: string;
  timestamp: string;
  agent: string;
  summary: string;
}

interface MultiAgentLogsProps {
  logs: LogEntry[];
}

const AGENT_COLOR: Record<string, string> = {
  MachineAgent: "text-cyan-400",
  Machine: "text-cyan-400",
  MaintenanceAgent: "text-amber-400",
  Maintenance: "text-amber-400",
  ProductionAgent: "text-purple-400",
  Production: "text-purple-400",
  SupervisorAgent: "text-emerald-400",
  Supervisor: "text-emerald-400",
};

const AGENT_BORDER: Record<string, string> = {
  MachineAgent: "border-cyan-500/30",
  Machine: "border-cyan-500/30",
  MaintenanceAgent: "border-amber-500/30",
  Maintenance: "border-amber-500/30",
  ProductionAgent: "border-purple-500/30",
  Production: "border-purple-500/30",
  SupervisorAgent: "border-emerald-500/30",
  Supervisor: "border-emerald-500/30",
};

export function stepsToLogEntries(steps: AgentStep[], runId: string): LogEntry[] {
  return steps.map((s, i) => ({
    id: `${runId}-${i}`,
    timestamp: s.timestamp ?? new Date().toISOString(),
    agent: s.agent.replace(/Agent$/, "") || s.agent,
    summary: s.message,
  }));
}

export default function MultiAgentLogs({ logs }: MultiAgentLogsProps) {
  const chronological = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="flex-1 flex flex-col bg-black/90 p-6 overflow-hidden font-mono border-t border-slate-900">
      {/* Terminal Header HUD */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-slate-100 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
            AUTONOMOUS AGENT CORE DEEP THINKING LOGS
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
            Sub-processor telemetry sequence · Real-time pipeline events
          </p>
        </div>

        {/* Pulsing Status Pill */}
        <div className="flex items-center gap-2 px-2.5 py-1 border border-emerald-500/30 bg-emerald-950/20 rounded-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
            AGENT STATUS: ORCHESTRATING ACTIONS
          </span>
        </div>
      </div>

      {/* Terminal Screen Body */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {chronological.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
            <p className="border border-dashed border-slate-800 p-4 bg-slate-950/50 uppercase tracking-wider text-center">
              &gt;_ System Idle<br />
              No log telemetry recorded. Execute an orchestration from Ops View.
            </p>
          </div>
        ) : (
          chronological.map((entry) => {
            const agentKey = entry.agent.endsWith("Agent") ? entry.agent : `${entry.agent}Agent`;
            const colorClass = AGENT_COLOR[entry.agent] || AGENT_COLOR[agentKey] || "text-slate-300";
            const borderClass = AGENT_BORDER[entry.agent] || AGENT_BORDER[agentKey] || "border-slate-800";

            return (
              <div
                key={entry.id}
                className={`border bg-slate-950/70 p-3 shadow-md transition-all duration-300 hover:bg-slate-900/60 hover:border-slate-700/50 ${borderClass}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-slate-900 pb-1.5 mb-2 text-[10px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">&gt; [INGEST]</span>
                    <time className="font-mono">
                      {new Date(entry.timestamp).toISOString()}
                    </time>
                  </div>
                  <span className={`font-bold tracking-widest uppercase ${colorClass}`}>
                    // {entry.agent}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono pl-2 border-l-2 border-slate-800">
                  {entry.summary}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
