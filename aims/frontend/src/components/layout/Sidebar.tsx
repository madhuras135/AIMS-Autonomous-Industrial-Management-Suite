import type { MachineTelemetry } from "../../lib/api";

interface SidebarProps {
  machines: MachineTelemetry[];
  ready: boolean;
}

function statusChipClass(status: MachineTelemetry["status"]) {
  switch (status) {
    case "CRITICAL":
      return "bg-red-600 text-white";
    case "WARNING":
      return "bg-amber-500 text-slate-950";
    default:
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
  }
}

function gaugePercent(m: MachineTelemetry): number {
  // Normalise temperature to a 0–100% fill of the gauge bar (safe zone ≤75, warn ≤90, crit >90)
  return Math.min(100, Math.round((m.temperature_c / 110) * 100));
}

function gaugeColor(status: MachineTelemetry["status"]): string {
  switch (status) {
    case "CRITICAL":
      return "bg-red-500";
    case "WARNING":
      return "bg-amber-400";
    default:
      return "bg-emerald-400";
  }
}

function modelConfidence(m: MachineTelemetry): string {
  // Mock confidence derived from operating hours and status
  if (m.status === "CRITICAL") return "71.3%";
  if (m.status === "WARNING") return "85.6%";
  const base = 90 + ((m.operating_hours * 7) % 9);
  return `${base.toFixed(1)}%`;
}

export default function Sidebar({ machines, ready }: SidebarProps) {
  return (
    <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/60 overflow-y-auto flex flex-col">
      {/* Section header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseSlow" />
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
            Line Assets · Live Telemetry
          </h2>
        </div>
        <p className="text-[10px] font-mono text-slate-600 mt-0.5 pl-3.5">Random Forest sensor stream active</p>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {machines.map((m, i) => {
          const isCritical = m.status === "CRITICAL";
          const isWarning = m.status === "WARNING";
          const pct = gaugePercent(m);
          const conf = modelConfidence(m);
          const borderClass = isCritical
            ? "border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.22)]"
            : isWarning
              ? "border-amber-500/70 shadow-[0_0_8px_rgba(245,158,11,0.12)]"
              : "border-slate-700";

          return (
            <div
              key={m.machine_id}
              className={`border bg-slate-950/80 transition ${
                ready ? "animate-fadeInUp opacity-0" : "opacity-0"
              } ${isCritical ? "animate-pulse" : ""} ${borderClass}`}
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-sm ${
                      isCritical
                        ? "bg-red-500 animate-blinkAlert"
                        : isWarning
                          ? "bg-amber-400 animate-pulseSlow"
                          : "bg-emerald-400"
                    }`}
                  />
                  <span className="font-mono font-bold text-slate-100 text-sm tracking-wider">
                    {m.machine_id}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isCritical && (
                    <span className="text-[9px] font-bold tracking-wider text-red-400 uppercase animate-blinkAlert">
                      FAULT
                    </span>
                  )}
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 ${statusChipClass(m.status)}`}>
                    {m.status}
                  </span>
                </div>
              </div>

              {/* Telemetry values */}
              <div className="px-3 pt-2 pb-1 grid grid-cols-2 gap-y-1 text-xs text-slate-400">
                <span>Temp</span>
                <span
                  className={`text-right font-mono font-medium ${
                    isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  {m.temperature_c.toFixed(1)}°C
                </span>
                <span>Vibration</span>
                <span className={`text-right font-mono ${isWarning || isCritical ? "text-amber-300" : "text-slate-200"}`}>
                  {m.vibration_mm_s.toFixed(1)} mm/s
                </span>
                <span>RPM</span>
                <span className="text-right font-mono text-slate-200">{m.rpm.toLocaleString()}</span>
                <span>Op Hours</span>
                <span className="text-right font-mono text-slate-400">{m.operating_hours.toFixed(0)} h</span>
              </div>

              {/* Safety threshold gauge bar */}
              <div className="px-3 pt-1.5 pb-0.5">
                <div className="flex justify-between text-[9px] font-mono text-slate-600 mb-0.5">
                  <span>SAFE</span>
                  <span>WARN</span>
                  <span>CRIT</span>
                </div>
                <div className="relative h-2 w-full bg-slate-800 overflow-hidden">
                  {/* Zone ticks */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 bottom-0 left-[68%] w-px bg-amber-500/50" />
                    <div className="absolute top-0 bottom-0 left-[82%] w-px bg-red-500/50" />
                  </div>
                  {/* Fill bar */}
                  <div
                    className={`h-full transition-all duration-700 ${gaugeColor(m.status)}`}
                    style={{ width: `${pct}%` }}
                  />
                  {/* Scanline shimmer */}
                  <div className="absolute inset-0 w-full overflow-hidden pointer-events-none">
                    <div className="h-full w-6 bg-white/10 animate-scanline" />
                  </div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-0.5">
                  <span>0°</span>
                  <span>75°</span>
                  <span>90°</span>
                  <span>110°</span>
                </div>
              </div>

              {/* Model metrics sub-row */}
              <div className="mx-3 mb-2.5 mt-1 border border-slate-800 bg-slate-900/60 px-2 py-1.5 space-y-1">
                {m.failure_probability !== undefined && m.failure_probability !== null ? (
                  <>
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500">Failure Risk</span>
                      <span
                        className={`font-semibold ${
                          m.status_tier === "Critical"
                            ? "text-red-450 font-bold"
                            : m.status_tier === "Warning"
                              ? "text-amber-400 font-bold"
                              : "text-emerald-400 font-semibold"
                        }`}
                      >
                        {Math.round(m.failure_probability * 100)}% — {m.status_tier}
                      </span>
                    </div>
                    {m.recommended_action && (
                      <div className="text-[9px] font-mono text-slate-400 leading-tight">
                        Action: {m.recommended_action}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500">Model Confidence</span>
                      <span
                        className={`font-semibold ${
                          isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {conf}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center text-[10px] font-mono border-t border-slate-800/40 pt-1 mt-0.5">
                  <span className="text-slate-500">Inference Mode</span>
                  <span className="text-[9px] text-slate-400 truncate max-w-[120px]" title={m.engine_status || "Model Loaded Successfully"}>
                    {m.engine_status || "ML Engine Active"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
