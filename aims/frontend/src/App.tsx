import { useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import OperationsDashboard from "./components/OperationsDashboard";

export type AppView = "AUTH" | "DASHBOARD";
export type DashboardTab = "OPS_VIEW" | "AGENT_LOGS";
export type Shift = "Morning" | "Evening" | "Night";

export interface UserSession {
  operatorId: string;
  shift: Shift;
}

const SESSION_KEY = "aims_session_token";
const USER_KEY = "aims_user_session";

function loadSession(): UserSession | null {
  try {
    const token = localStorage.getItem(SESSION_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export default function App() {
  const [view, setView] = useState<AppView>("AUTH");
  const [user, setUser] = useState<UserSession | null>(null);
  const [tab, setTab] = useState<DashboardTab>("OPS_VIEW");
  const [fading, setFading] = useState(false);

  useEffect(() => {
    document.title = "A-I-M-S — Autonomous Industrial Management Suite";

    const existing = loadSession();
    if (existing) {
      setUser(existing);
      setView("DASHBOARD");
    }
  }, []);

  function handleLoginSuccess(session: UserSession) {
    const fakeJwt = btoa(
      JSON.stringify({
        sub: session.operatorId,
        shift: session.shift,
        iat: Date.now(),
      })
    );
    localStorage.setItem(SESSION_KEY, fakeJwt);
    localStorage.setItem(USER_KEY, JSON.stringify(session));
    setUser(session);
    setFading(true);
    window.setTimeout(() => {
      setView("DASHBOARD");
      setFading(false);
    }, 400);
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setTab("OPS_VIEW");
    setView("AUTH");
  }

  return (
    <div
      className={`h-screen w-screen bg-slate-950 text-slate-100 flex flex-col transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {view === "AUTH" || !user ? (
        <AuthScreen onSuccess={handleLoginSuccess} />
      ) : (
        <OperationsDashboard
          user={user}
          tab={tab}
          onTabChange={setTab}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
