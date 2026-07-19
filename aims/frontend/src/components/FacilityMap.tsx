import type { MachineTelemetry } from "../lib/api";

interface FacilityMapProps {
  machines: MachineTelemetry[];
}

interface NodeDef {
  id: string;
  label: string;
  sublabel: string;
  col: number; // 1-based grid col
  row: number; // 1-based grid row
  machineId?: string;
  staticStatus?: "nominal" | "warning" | "critical" | "standby";
}

const FACILITY_NODES: NodeDef[] = [
  { id: "inlet", label: "RAW INLET", sublabel: "Feed Gate A", col: 1, row: 1, staticStatus: "nominal" },
  { id: "M1", label: "M1", sublabel: "Press Line", col: 2, row: 1, machineId: "M1" },
  { id: "M2", label: "M2", sublabel: "Mill Station", col: 3, row: 1, machineId: "M2" },
  { id: "M3", label: "M3", sublabel: "Drill Assembly", col: 4, row: 1, machineId: "M3" },
  { id: "M4", label: "M4", sublabel: "Thermal Cell", col: 5, row: 1, machineId: "M4" },
  { id: "qc", label: "QC GATE", sublabel: "Optical Scan", col: 6, row: 1, staticStatus: "nominal" },
  { id: "dispatch", label: "DISPATCH", sublabel: "Loading Bay 3", col: 6, row: 2, staticStatus: "nominal" },
  { id: "coolant", label: "COOLANT", sublabel: "Chiller Loop B", col: 4, row: 2, staticStatus: "standby" },
  { id: "hvac", label: "HVAC", sublabel: "Zone 2 Air", col: 2, row: 2, staticStatus: "nominal" },
  { id: "pwr", label: "POWER BUS", sublabel: "SubStation 1", col: 1, row: 2, staticStatus: "nominal" },
];

function resolveStatus(
  node: NodeDef,
  machines: MachineTelemetry[]
): "nominal" | "warning" | "critical" | "standby" {
  if (node.machineId) {
    const m = machines.find((x) => x.machine_id === node.machineId);
    if (!m) return "standby";
    if (m.status === "CRITICAL") return "critical";
    if (m.status === "WARNING") return "warning";
    return "nominal";
  }
  return node.staticStatus ?? "nominal";
}

const STATUS_STYLES = {
  nominal: {
    border: "border-emerald-500/60",
    bg: "bg-emerald-950/40",
    dot: "bg-emerald-400",
    dotAnim: "animate-pulseSlow",
    label: "text-emerald-400",
    tag: "NOMINAL",
    tagClass: "text-emerald-500",
  },
  warning: {
    border: "border-amber-400/70",
    bg: "bg-amber-950/30",
    dot: "bg-amber-400",
    dotAnim: "animate-pulseSlow",
    label: "text-amber-300",
    tag: "WARN",
    tagClass: "text-amber-400",
  },
  critical: {
    border: "border-red-500/80",
    bg: "bg-red-950/30",
    dot: "bg-red-500",
    dotAnim: "animate-blinkAlert",
    label: "text-red-400",
    tag: "CRIT",
    tagClass: "text-red-400",
  },
  standby: {
    border: "border-slate-600/50",
    bg: "bg-slate-900/40",
    dot: "bg-slate-500",
    dotAnim: "",
    label: "text-slate-400",
    tag: "STBY",
    tagClass: "text-slate-500",
  },
};

// Connector lines between nodes (row1: sequential; row2: back-connectors)
const CONNECTORS = [
  { from: "inlet", to: "M1" },
  { from: "M1", to: "M2" },
  { from: "M2", to: "M3" },
  { from: "M3", to: "M4" },
  { from: "M4", to: "qc" },
  { from: "qc", to: "dispatch" },
  { from: "M3", to: "coolant" },
  { from: "M1", to: "hvac" },
  { from: "pwr", to: "hvac" },
  { from: "pwr", to: "inlet" },
];

export default function FacilityMap({ machines }: FacilityMapProps) {
  const nodeMap = Object.fromEntries(FACILITY_NODES.map((n) => [n.id, n]));
  const statuses = Object.fromEntries(
    FACILITY_NODES.map((n) => [n.id, resolveStatus(n, machines)])
  );

  const nominalCount = Object.values(statuses).filter((s) => s === "nominal").length;
  const warnCount = Object.values(statuses).filter((s) => s === "warning").length;
  const critCount = Object.values(statuses).filter((s) => s === "critical").length;

  return (
    <div className="border border-slate-700 bg-slate-950/70">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseSlow" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
            Facility Ancillary Grid
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-emerald-400">{nominalCount} Nominal</span>
          {warnCount > 0 && <span className="text-amber-400">{warnCount} Warn</span>}
          {critCount > 0 && <span className="text-red-400 animate-blinkAlert">{critCount} Critical</span>}
        </div>
      </div>

      {/* Grid canvas with neon guide lines */}
      <div
        className="relative p-3 overflow-x-auto"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        {/* SVG connector lines */}
        <svg
          className="absolute inset-3 pointer-events-none"
          style={{ width: "calc(100% - 1.5rem)", height: "calc(100% - 1.5rem)" }}
          overflow="visible"
          aria-hidden="true"
        >
          {CONNECTORS.map(({ from, to }) => {
            const fNode = nodeMap[from];
            const tNode = nodeMap[to];
            if (!fNode || !tNode) return null;
            const colW = 100 / 6; // 6 cols
            const fx = (fNode.col - 0.5) * colW;
            const fy = fNode.row === 1 ? 25 : 75;
            const tx = (tNode.col - 0.5) * colW;
            const ty = tNode.row === 1 ? 25 : 75;
            const fromStatus = statuses[from];
            const stroke =
              fromStatus === "critical"
                ? "rgba(239,68,68,0.5)"
                : fromStatus === "warning"
                  ? "rgba(245,158,11,0.4)"
                  : "rgba(52,211,153,0.2)";
            return (
              <line
                key={`${from}-${to}`}
                x1={`${fx}%`}
                y1={`${fy}%`}
                x2={`${tx}%`}
                y2={`${ty}%`}
                stroke={stroke}
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>

        {/* Node grid — 6 cols × 2 rows */}
        <div className="relative grid grid-cols-6 gap-2 min-w-[640px]" style={{ minHeight: "110px" }}>
          {/* Row spacer for 2-row layout */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const col = (idx % 6) + 1;
            const row = Math.floor(idx / 6) + 1;
            const node = FACILITY_NODES.find((n) => n.col === col && n.row === row);
            if (!node) {
              return <div key={`empty-${idx}`} className="h-14" />;
            }
            const s = statuses[node.id];
            const style = STATUS_STYLES[s];
            return (
              <div
                key={node.id}
                className={`relative border ${style.border} ${style.bg} px-2 py-1.5 h-14 flex flex-col justify-between`}
              >
                {/* Glowing status dot */}
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-mono uppercase tracking-wider ${style.label}`}>
                    {node.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${style.dot} ${style.dotAnim}`}
                    title={s}
                  />
                </div>
                <div>
                  <p className="text-[9px] text-slate-600 font-mono truncate">{node.sublabel}</p>
                  <p className={`text-[9px] font-mono font-bold ${style.tagClass}`}>{style.tag}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend strip */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-slate-800/70 bg-slate-900/30">
        {(["nominal", "warning", "critical", "standby"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[s].dot}`} />
            <span className={`text-[9px] font-mono uppercase ${STATUS_STYLES[s].tagClass}`}>{s}</span>
          </div>
        ))}
        <span className="ml-auto text-[9px] font-mono text-slate-600">Live · Refresh every 15s</span>
      </div>
    </div>
  );
}
