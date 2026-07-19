# A‑I‑M‑S: Autonomous Industrial Management Suite

Production-style full-stack prototype of an industrial MES control room with a rule-based multi-agent orchestration pipeline.

## Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind   |
| Backend  | Python FastAPI + Pydantic (in-memory mock)|

No real database — all telemetry and inventory are simulated on each request.

## Project layout

```
aims/
  backend/
    app/
      main.py              # FastAPI app + CORS + endpoints
      models.py            # Pydantic models
      data_simulation.py   # Mock data + rule-based agents
    requirements.txt
  frontend/
    src/
      App.tsx              # State-based AUTH / DASHBOARD router
      lib/api.ts           # API helpers + offline fallbacks
      components/
        AuthScreen.tsx
        OperationsDashboard.tsx
        MultiAgentLogs.tsx
        layout/
          TopBanner.tsx
          Sidebar.tsx
          CentralWorkspace.tsx
```

## Quick start

### 1. Backend

```bash
cd aims/backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

API docs: http://127.0.0.1:8001/docs

> On Windows, prefer `127.0.0.1` over `localhost` if another process is bound to `:8001` on IPv6 / `0.0.0.0`.

### 2. Frontend

```bash
cd aims/frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` → `http://localhost:8001`.

### Demo login

Any Operator ID + password (≥ 6 characters) + a shift selection unlocks the dashboard. A fake JWT is stored in `localStorage` as `aims_session_token`.

## API endpoints

| Method | Path                         | Description                          |
|--------|------------------------------|--------------------------------------|
| GET    | `/api/v1/telemetry`          | Machines M1–M4 live mock telemetry   |
| GET    | `/api/v1/inventory`          | Steel / Aluminum stock + days left   |
| POST   | `/api/v1/agent/orchestrate`  | Multi-agent supervisor pipeline      |
| GET    | `/api/v1/seed`               | Deterministic demo snapshot          |
| GET    | `/health`                    | Liveness                             |

### Orchestrate example

```bash
curl -X POST http://127.0.0.1:8001/api/v1/agent/orchestrate \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"Why is Machine M4 in alarm?\"}"
```

Agents (rule-based today):

1. **MachineAgent** — thermal / vibration anomalies  
2. **MaintenanceAgent** — spare parts + Shift B work order  
3. **ProductionAgent** — reroutes Order #A102 away from CRITICAL machines  
4. **SupervisorAgent** — final control-room summary  

`# TODO: replace rule-based agents with LangGraph graph / real LLM nodes.`

## Offline / demo-ready behavior

If FastAPI is unreachable, the frontend shows an amber banner and falls back to `seedMockData()` so the control room still looks populated.

## Extending with LangGraph / LLMs

In `backend/app/data_simulation.py`, replace the four `*_agent` functions and `run_orchestration` with a LangGraph graph that keeps the same `OrchestrateResponse` shape (`steps` + `summary`). The frontend does not need to change.

---

## WORKSPACE HEALTH CHECK & DIAGNOSIS REPORT

### 1. What was broken?
- **Port Mismatch**: The frontend development server config (Vite proxy config in `vite.config.ts`) was targeting port `8000` while the production instructions/configuration targeted port `8001`.
- **CORS Config Restrictions**: If the FastAPI backend were started on port `8001` without updating origins, browser requests from Vite (`localhost:5173`) could be blocked or rejected unless explicitly listed in CORS origins.
- **Title & UI Branding**: Branding was not fully integrated into the header navigation component, leaving the layout out of sync with the main global `<title>`.
- **Environment Variable Hardcoding**: The API base URL was static, making it harder to configure dynamically in containerized or custom staging environments.

### 2. What was changed to fix it?
- **[vite.config.ts](file:///d:/Documents/New%20folder/Coding/webdev/idb%20project/aims/frontend/vite.config.ts)**: Configured proxy settings to correctly route `/api` and `/health` to `http://127.0.0.1:8001`.
- **[api.ts](file:///d:/Documents/New%20folder/Coding/webdev/idb%20project/aims/frontend/src/lib/api.ts)**: Integrated `import.meta.env.VITE_API_BASE_URL` with a fallback to `http://127.0.0.1:8001/api/v1` to allow dynamic environment wiring.
- **[TopBanner.tsx](file:///d:/Documents/New%20folder/Coding/webdev/idb%20project/aims/frontend/src/components/layout/TopBanner.tsx)**: Updated the navigation UI to read `"A-I-M-S — Autonomous Industrial Management Suite"` alongside the inline SVG automation icon.
- **Graceful Failbacks**: Verified that the React UI calls `fetchTelemetryWithFallback` and `orchestrateWithFallback` via wrapper methods, rendering with deterministic mock data if the FastAPI server is offline.

### 3. Exact terminal commands to run the project locally
- **Backend (FastAPI)**:
  ```powershell
  cd aims/backend
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
  ```
- **Frontend (Vite + React)**:
  ```powershell
  cd aims/frontend
  npm install
  npm run dev
  ```
