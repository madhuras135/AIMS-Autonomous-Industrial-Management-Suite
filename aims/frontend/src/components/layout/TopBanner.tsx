import type { Shift } from "../../App";

interface TopBannerProps {
  shift: Shift;
  oee: number;
  alertCount: number;
  offline: boolean;
  onLogout: () => void;
  onExportReport?: () => void;
  plantHealthScore?: number;
}

const SHIFT_HOURS: Record<Shift, string> = {
  Morning: "06:00–14:00",
  Evening: "14:00–22:00",
  Night: "22:00–06:00",
};

export default function TopBanner({
  shift,
  oee,
  alertCount,
  offline,
  onLogout,
  onExportReport,
  plantHealthScore,
}: TopBannerProps) {
  return (
    <header className="shrink-0 h-14 border-b border-slate-800 bg-slate-900/95 flex items-center px-4 gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5">
          <svg className="h-4 w-4" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect x="8" y="8" width="48" height="48" rx="14" stroke="#34d399" strokeWidth="2" />
            <path d="M20 20h24M20 44h24M20 20v24M44 20v24" stroke="#6ee7b7" strokeWidth="1.5" />
            <circle cx="32" cy="32" r="8" stroke="#34d399" strokeWidth="2" />
            <circle cx="32" cy="32" r="3" fill="#34d399" />
            <circle cx="20" cy="32" r="2.5" fill="#34d399" />
            <circle cx="44" cy="32" r="2.5" fill="#34d399" />
            <circle cx="32" cy="20" r="2.5" fill="#34d399" />
            <circle cx="32" cy="44" r="2.5" fill="#34d399" />
          </svg>
          <span className="text-xs sm:text-sm font-semibold tracking-wider text-slate-50">
            A-I-M-S — Autonomous Industrial Management Suite
          </span>
        </div>
      </div>

      <div className="flex-1 flex justify-center">
        <span className="font-mono text-sm text-slate-300">
          Shift: <span className="text-emerald-400">{shift}</span>{" "}
          <span className="text-slate-500">({SHIFT_HOURS[shift]})</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {offline && (
          <span className="hidden md:inline text-[11px] px-2 py-1 border border-amber-500/50 text-amber-400 bg-amber-950/40 font-mono">
            Backend offline
          </span>
        )}
        <span className="text-xs font-mono px-2.5 py-1 border border-emerald-500/40 text-emerald-400 bg-emerald-950/30">
          OEE: {oee.toFixed(1)}%
        </span>
        <span
          className={`text-xs font-mono px-2.5 py-1 border ${
            alertCount > 0
              ? "border-red-500/50 text-red-400 bg-red-950/40 animate-pulse"
              : "border-slate-600 text-slate-400 bg-slate-800/50"
          }`}
        >
          Alerts: {alertCount}
        </span>
        {plantHealthScore !== undefined && (
          <span
            className={`text-xs font-mono px-2.5 py-1 border rounded-md font-semibold transition-all duration-300 ${
              plantHealthScore >= 80
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/30"
                : plantHealthScore >= 60
                  ? "border-amber-500/40 text-amber-400 bg-amber-950/20"
                  : "border-red-500/50 text-red-400 bg-red-950/35 animate-pulse"
            }`}
          >
            AI Plant Health: {plantHealthScore}/100
          </span>
        )}
        {onExportReport && (
          <button
            type="button"
            onClick={onExportReport}
            className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 px-2.5 py-1 transition font-mono uppercase tracking-wider bg-cyan-950/20"
          >
            Export Report
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-2.5 py-1 transition font-mono"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
