/**
 * CentralWorkspace — Supervisor Agent Command Console
 *
 * Props contract is unchanged from the original component so OperationsDashboard
 * needs zero edits.  All query state lives here; the parent still owns `feed`,
 * `summary`, `loading`, and `onOrchestrate`.
 *
 * TODO(streaming): Replace onOrchestrate with a streaming variant and render
 * tokens incrementally into the last ChatBubble once the backend supports SSE
 * or WebSocket streaming.  Each AgentStep can arrive as a partial chunk and be
 * appended in-place rather than flushed all at once.
 */

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { AgentStep } from "../../lib/api";

// ─── Props ───────────────────────────────────────────────────────────────────

interface CentralWorkspaceProps {
  feed: AgentStep[];
  summary: string | null;
  loading: boolean;
  onOrchestrate: (query: string) => void;
}

// ─── Suggestion chips — edit this array freely ───────────────────────────────

const SUPERVISOR_SUGGESTIONS: { icon: string; label: string; query: string }[] = [
  {
    icon: "⚠",
    label: "Why is M4 in alarm?",
    query: "Why is Machine M4 in alarm?",
  },
  {
    icon: "⚙",
    label: "Scan M3 health",
    query: "Run a full health scan on Machine M3",
  },
  {
    icon: "📦",
    label: "Inventory risk — Steel",
    query: "Check inventory risk for Steel and suggest reorder actions",
  },
  {
    icon: "📊",
    label: "Plant diagnostic",
    query: "Run overall plant diagnostic and summarise status",
  },
  {
    icon: "⏱",
    label: "Order A102 by Friday?",
    query: "Can we finish Order #A102 by Friday given current production state?",
  },
  {
    icon: "🔋",
    label: "Energy optimisation",
    query: "Identify machines running inefficiently and suggest energy optimisation steps",
  },
];

// ─── Per-agent visual palette ────────────────────────────────────────────────

interface AgentPalette {
  dot: string;
  badge: string;
  badgeBg: string;
  bubble: string;
  border: string;
  timestamp: string;
}

const AGENT_PALETTE: Record<string, AgentPalette> = {
  MachineAgent: {
    dot: "bg-cyan-400",
    badge: "text-cyan-300",
    badgeBg: "bg-cyan-950/40 border-cyan-500/30",
    bubble: "bg-slate-900/80 border-cyan-500/20",
    border: "border-l-cyan-400/60",
    timestamp: "text-cyan-900",
  },
  MaintenanceAgent: {
    dot: "bg-amber-400",
    badge: "text-amber-300",
    badgeBg: "bg-amber-950/40 border-amber-500/30",
    bubble: "bg-slate-900/80 border-amber-500/20",
    border: "border-l-amber-400/60",
    timestamp: "text-amber-900",
  },
  ProductionAgent: {
    dot: "bg-violet-400",
    badge: "text-violet-300",
    badgeBg: "bg-violet-950/40 border-violet-500/30",
    bubble: "bg-slate-900/80 border-violet-500/20",
    border: "border-l-violet-400/60",
    timestamp: "text-violet-900",
  },
  SupervisorAgent: {
    dot: "bg-emerald-400",
    badge: "text-emerald-300",
    badgeBg: "bg-emerald-950/50 border-emerald-500/35",
    bubble: "bg-emerald-950/20 border-emerald-500/25",
    border: "border-l-emerald-400/70",
    timestamp: "text-emerald-900",
  },
  System: {
    dot: "bg-red-400",
    badge: "text-red-300",
    badgeBg: "bg-red-950/40 border-red-500/30",
    bubble: "bg-red-950/20 border-red-500/20",
    border: "border-l-red-400/60",
    timestamp: "text-red-900",
  },
};

function palette(agent: string): AgentPalette {
  return (
    AGENT_PALETTE[agent] ?? {
      dot: "bg-slate-400",
      badge: "text-slate-300",
      badgeBg: "bg-slate-800/60 border-slate-600/30",
      bubble: "bg-slate-900/60 border-slate-700/30",
      border: "border-l-slate-500/50",
      timestamp: "text-slate-700",
    }
  );
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

interface BubbleProps {
  agent: string;
  message: string;
  timestamp: string;
  delay?: number;
  isSummary?: boolean;
}

function ChatBubble({ agent, message, timestamp, delay = 0, isSummary = false }: BubbleProps) {
  const p = palette(agent);
  return (
    <div
      className="animate-fadeInUp opacity-0 flex flex-col gap-1"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Agent badge row */}
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.dot}`} />
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold border ${p.badgeBg} ${p.badge} tracking-widest uppercase`}
        >
          [{agent}]
        </span>
        {isSummary && (
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-500 border border-emerald-500/30 px-1.5 py-0.5 bg-emerald-950/30">
            SUMMARY
          </span>
        )}
        <time
          className={`ml-auto text-[10px] font-mono ${p.timestamp} select-none`}
          title={timestamp}
        >
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </time>
      </div>

      {/* Message body */}
      <div
        className={`border ${p.bubble} border-l-4 ${p.border} px-3 py-2.5 ml-3.5`}
      >
        <p className="text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
          {message}
        </p>
      </div>
    </div>
  );
}

// ─── User query bubble ────────────────────────────────────────────────────────

function UserQueryBubble({ query, timestamp }: { query: string; timestamp: string }) {
  return (
    <div className="flex flex-col items-end gap-1 animate-fadeIn opacity-0" style={{ animationFillMode: "forwards" }}>
      <div className="flex items-center gap-2">
        <time className="text-[10px] font-mono text-slate-700 select-none">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </time>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border border-slate-700 px-2 py-0.5 bg-slate-800/60">
          [OPERATOR]
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      </div>
      <div className="max-w-[85%] border border-slate-700/60 bg-slate-800/50 border-r-4 border-r-slate-500/50 px-3 py-2.5 mr-3.5">
        <p className="text-sm text-slate-300 font-mono leading-relaxed">{query}</p>
      </div>
    </div>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-2 animate-fadeIn opacity-0" style={{ animationFillMode: "forwards" }}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
      <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest animate-pulse">
        Supervisor · Orchestrating agent pipeline…
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CentralWorkspace({
  feed,
  summary,
  loading,
  onOrchestrate,
}: CentralWorkspaceProps) {
  const [supervisorQuery, setSupervisorQuery] = useState("");
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  // Track the query text and timestamp of the last submitted run so we can
  // render the [OPERATOR] bubble above the agent responses.
  const [lastQuery, setLastQuery] = useState<{ text: string; ts: string } | null>(null);

  const feedBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever the feed, summary, or loading state changes.
  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed, summary, loading]);

  function submit() {
    const q = supervisorQuery.trim();
    if (!q) {
      setValidationMsg("Enter a query before sending to the Supervisor.");
      return;
    }
    setValidationMsg(null);
    setLastQuery({ text: q, ts: new Date().toISOString() });
    onOrchestrate(q);
    setSupervisorQuery("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    // Clear validation hint on any keystroke
    if (validationMsg) setValidationMsg(null);
  }

  function handleChipClick(query: string) {
    setSupervisorQuery(query);
    setValidationMsg(null);
    // Focus the input so the user can refine before sending
    document.getElementById("supervisor-query-input")?.focus();
  }

  const hasFeedContent = feed.length > 0 || summary !== null;

  return (
    <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">

      {/* ── Console header bar ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulseSlow" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
          Supervisor Agent · Command Console
        </span>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            Orchestrating…
          </span>
        )}
        {!loading && hasFeedContent && (
          <span className="ml-auto text-[10px] font-mono text-slate-600">
            {feed.length} step{feed.length !== 1 ? "s" : ""}
            {summary ? " · summary ready" : ""}
          </span>
        )}
      </div>

      {/* ── Feed area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Empty state */}
        {!hasFeedContent && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
            <div className="border border-dashed border-slate-800 bg-slate-900/30 px-6 py-8 max-w-sm">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">
                &gt;_ Supervisor idle
              </p>
              <p className="text-sm text-slate-500 font-mono leading-relaxed">
                Use the console below to dispatch a query to the multi-agent pipeline.
                Agent reasoning steps will stream here in real-time.
              </p>
            </div>
          </div>
        )}

        {/* Operator query bubble — shown above the agent responses it triggered */}
        {lastQuery && hasFeedContent && (
          <UserQueryBubble query={lastQuery.text} timestamp={lastQuery.ts} />
        )}

        {/* Agent step bubbles */}
        {feed.map((step, idx) => (
          <ChatBubble
            key={`${step.agent}-${idx}-${step.timestamp ?? idx}`}
            agent={step.agent}
            message={step.message}
            timestamp={step.timestamp ?? new Date().toISOString()}
            delay={(idx % 6) * 110}
          />
        ))}

        {/* Supervisor summary block — rendered last and accented */}
        {summary && (
          <ChatBubble
            agent="SupervisorAgent"
            message={summary}
            timestamp={new Date().toISOString()}
            delay={feed.length * 110}
            isSummary
          />
        )}

        {/* Thinking indicator */}
        {loading && <ThinkingIndicator />}

        {/* Invisible scroll anchor */}
        <div ref={feedBottomRef} />
      </div>

      {/* ── Input console ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900/80 px-4 pt-3 pb-4 space-y-2.5">

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1.5">
          {SUPERVISOR_SUGGESTIONS.map((s) => (
            <button
              key={s.query}
              type="button"
              onClick={() => handleChipClick(s.query)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600/70 hover:border-slate-500 text-[11px] text-slate-300 font-mono cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed select-none"
            >
              <span className="text-[11px]">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Validation message */}
        {validationMsg && (
          <p className="text-[11px] font-mono text-amber-400 animate-fadeIn opacity-0" style={{ animationFillMode: "forwards" }}>
            ⚠ {validationMsg}
          </p>
        )}

        {/* Main input + send button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              id="supervisor-query-input"
              type="text"
              value={supervisorQuery}
              onChange={(e) => {
                setSupervisorQuery(e.target.value);
                if (validationMsg) setValidationMsg(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask the Supervisor Agent about factory operations…"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/50 text-sm text-slate-100 font-mono placeholder-slate-600 px-4 py-2.5 outline-none transition disabled:opacity-50 pr-12"
            />
            {/* Keyboard shortcut hint */}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-700 pointer-events-none select-none">
              ↵
            </span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold font-mono uppercase tracking-wider bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                Running
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
