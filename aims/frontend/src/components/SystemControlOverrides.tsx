import { useState } from "react";

type AutoLevel = 0 | 1 | 2; // 0=Manual, 1=Co-Pilot, 2=Fully Autonomous

const AUTONOMY_LABELS: Record<AutoLevel, { label: string; color: string }> = {
  0: { label: "Manual", color: "text-red-400" },
  1: { label: "Co-Pilot", color: "text-amber-400" },
  2: { label: "Fully Autonomous", color: "text-emerald-400" },
};

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  colorOn?: string;
}

function Toggle({ id, checked, onChange, colorOn = "bg-emerald-500" }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-sm border transition-colors duration-200 focus:outline-none ${
        checked ? `${colorOn} border-transparent` : "bg-slate-700 border-slate-600"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-sm bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export default function SystemControlOverrides() {
  const [esdActive, setEsdActive] = useState(false);
  const [coolingManual, setCoolingManual] = useState(false); // false = Auto, true = Manual
  const [autonomyLevel, setAutonomyLevel] = useState<AutoLevel>(2);

  return (
    <div className="border border-slate-700 bg-slate-950/70 flex flex-col">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulseSlow" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
          System Control Overrides
        </span>
        <span className="ml-auto text-[10px] font-mono text-slate-600 border border-slate-700 px-1.5 py-0.5">
          OPS AUTHORITY
        </span>
      </div>

      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">

        {/* ESD Control */}
        <div
          className={`border p-3 transition ${
            esdActive
              ? "border-red-500/80 bg-red-950/30 shadow-[0_0_16px_rgba(239,68,68,0.2)]"
              : "border-slate-700 bg-slate-900/40"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-[9px] font-mono font-bold px-1 py-0.5 tracking-wider ${
                    esdActive ? "bg-red-600 text-white" : "border border-red-500/40 text-red-500"
                  }`}
                >
                  SAFETY
                </span>
                <span className="text-xs font-mono font-semibold text-slate-200">
                  Emergency Line Shutdown
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">ESD · Cuts all assembly line power feeds</p>
              {esdActive && (
                <p className="text-[10px] text-red-400 font-mono font-bold mt-1 animate-blinkAlert">
                  ⚠ ESD ACTIVE — LINE HALTED
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Toggle
                id="esd-toggle"
                checked={esdActive}
                onChange={setEsdActive}
                colorOn="bg-red-600"
              />
              <span className={`text-[9px] font-mono ${esdActive ? "text-red-400" : "text-slate-500"}`}>
                {esdActive ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>

        {/* Cooling Pump Override */}
        <div className="border border-slate-700 bg-slate-900/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-mono px-1 py-0.5 border border-sky-500/40 text-sky-400">
                  COOLANT
                </span>
                <span className="text-xs font-mono font-semibold text-slate-200">
                  Cooling Pump Override
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Chiller Loop B · Zone 2 Intake</p>
              <p className="text-[10px] font-mono mt-1">
                Mode:{" "}
                <span className={coolingManual ? "text-amber-400" : "text-emerald-400"}>
                  {coolingManual ? "Manual" : "Auto"}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Toggle
                id="cooling-toggle"
                checked={coolingManual}
                onChange={setCoolingManual}
                colorOn="bg-amber-500"
              />
              <span className={`text-[9px] font-mono ${coolingManual ? "text-amber-400" : "text-slate-500"}`}>
                {coolingManual ? "MAN" : "AUTO"}
              </span>
            </div>
          </div>
        </div>

        {/* Agent Autonomy Level */}
        <div className="border border-slate-700 bg-slate-900/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono px-1 py-0.5 border border-violet-500/40 text-violet-400">
              AGENT
            </span>
            <span className="text-xs font-mono font-semibold text-slate-200">Agent Autonomy Level</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mb-2.5">
            LangGraph orchestration decision authority
          </p>

          {/* 3-step stepper */}
          <div className="flex gap-0 mb-2">
            {([0, 1, 2] as AutoLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setAutonomyLevel(lvl)}
                className={`flex-1 py-1.5 text-[10px] font-mono border-y border-r first:border-l transition ${
                  autonomyLevel === lvl
                    ? lvl === 0
                      ? "bg-red-900/60 border-red-500/60 text-red-300"
                      : lvl === 1
                        ? "bg-amber-900/60 border-amber-500/60 text-amber-300"
                        : "bg-emerald-900/60 border-emerald-500/60 text-emerald-300"
                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
              >
                {lvl === 0 ? "MANUAL" : lvl === 1 ? "CO-PILOT" : "FULL AUTO"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono mt-1">
            <span className="text-slate-500">Active Mode</span>
            <span className={`font-bold ${AUTONOMY_LABELS[autonomyLevel].color}`}>
              {AUTONOMY_LABELS[autonomyLevel].label}
            </span>
          </div>

          {/* Slider visual indicator */}
          <div className="mt-2 relative h-1.5 w-full bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                autonomyLevel === 0
                  ? "w-1/6 bg-red-500"
                  : autonomyLevel === 1
                    ? "w-3/6 bg-amber-400"
                    : "w-full bg-emerald-400"
              }`}
            />
          </div>
        </div>

        {/* Passive info strip */}
        <div className="border border-slate-800 bg-slate-900/20 p-2.5 space-y-1">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
            Control Audit Trace
          </p>
          <div className="flex justify-between text-[10px] font-mono text-slate-600">
            <span>Last ESD Test</span>
            <span className="text-slate-400">Shift Start</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-600">
            <span>Override Authority</span>
            <span className="text-slate-400">Operator</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-600">
            <span>Interlock Status</span>
            <span className="text-emerald-400">ARMED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
