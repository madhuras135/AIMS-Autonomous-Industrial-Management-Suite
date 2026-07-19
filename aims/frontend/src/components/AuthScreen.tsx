import { FormEvent, useMemo, useState } from "react";
import type { Shift, UserSession } from "../App";

interface AuthScreenProps {
  onSuccess: (session: UserSession) => void;
}

const SHIFTS: Shift[] = ["Morning", "Evening", "Night"];

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [operatorId, setOperatorId] = useState("");
  const [password, setPassword] = useState("");
  const [shift, setShift] = useState<Shift | "">("");
  const [touched, setTouched] = useState({ id: false, password: false, shift: false });
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => {
    return {
      id: !operatorId.trim() ? "Employee / Operator ID is required." : "",
      password:
        !password
          ? "Password is required."
          : password.length < 6
            ? "Password must be at least 6 characters."
            : "",
      shift: !shift ? "Select an active shift assignment." : "",
    };
  }, [operatorId, password, shift]);

  const isValid = !errors.id && !errors.password && !errors.shift;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ id: true, password: true, shift: true });
    if (!isValid || !shift) return;

    setLoading(true);
    const delay = 1000 + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, delay));
    setLoading(false);
    onSuccess({ operatorId: operatorId.trim(), shift });
  }

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
      {/* Subtle industrial grid atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-transparent to-slate-950" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md mx-4 border border-slate-700/80 bg-slate-900/90 backdrop-blur-sm p-8 shadow-2xl shadow-black/40"
      >
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.35em] text-emerald-400 uppercase mb-2">
            Secure Terminal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            A‑I‑M‑S
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Autonomous Industrial Management Suite
          </p>
        </div>

        <label className="block mb-5">
          <span className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
            Employee / Operator ID
          </span>
          <input
            type="text"
            autoComplete="username"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, id: true }))}
            className={`w-full bg-slate-950 border px-3 py-2.5 text-sm text-slate-100 font-mono outline-none transition
              focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500
              ${touched.id && errors.id ? "border-red-500" : "border-slate-600"}`}
            placeholder="OP-1042"
          />
          {touched.id && errors.id && (
            <span className="mt-1 block text-xs text-red-400">{errors.id}</span>
          )}
        </label>

        <label className="block mb-5">
          <span className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            className={`w-full bg-slate-950 border px-3 py-2.5 text-sm text-slate-100 outline-none transition
              focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500
              ${touched.password && errors.password ? "border-red-500" : "border-slate-600"}`}
            placeholder="••••••••"
          />
          {touched.password && errors.password && (
            <span className="mt-1 block text-xs text-red-400">{errors.password}</span>
          )}
        </label>

        <label className="block mb-8">
          <span className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
            Active Shift Assignment
          </span>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as Shift)}
            onBlur={() => setTouched((t) => ({ ...t, shift: true }))}
            className={`w-full bg-slate-950 border px-3 py-2.5 text-sm text-slate-100 outline-none transition
              focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500
              ${touched.shift && errors.shift ? "border-red-500" : "border-slate-600"}`}
          >
            <option value="">Select shift…</option>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {touched.shift && errors.shift && (
            <span className="mt-1 block text-xs text-red-400">{errors.shift}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={!isValid || loading}
          className={`w-full py-3 text-sm font-semibold uppercase tracking-wider transition
            ${
              isValid && !loading
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <span className="h-4 w-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              Authenticating…
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        <p className="mt-6 text-center text-[11px] text-slate-500 font-mono">
          Demo mode — any ID + password (≥6 chars) unlocks the control room.
        </p>
      </form>
    </div>
  );
}
