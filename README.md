# A-I-M-S: Autonomous Industrial Management Suite

An advanced, full-stack multi-agent Manufacturing Execution System (MES) prototype designed for automated industrial management, predictive analytics, and process control.

A-I-M-S is an enterprise-grade cyber-physical smart factory control center designed to maximize operational efficiency and prevent costly industrial downtime through end-to-end autonomous orchestration. The suite bridges the gap between physical edge hardware environments and cloud intelligence by uniting predictive machine learning models with stateful multi-agent systems.

---

## ✨ Key Features

- **Real-Time Telemetry Processing**  
  Simulates and streams continuous sensor metrics (temperature, vibration, RPM, operating hours) for heavy machinery.

- **Predictive Maintenance (ML Engine)**  
  Utilizes an offline-trained Random Forest Classifier to analyze live machine telemetry and dynamically calculate failure probabilities, hazard tiers, and automated maintenance recommendations.

- **Inventory Forecasting Engine**  
  Anticipates potential storage bottlenecks and material shortages before they impact production workflows, exposing stockout risk and reorder suggestions.

- **Multi-Agent Orchestration Layer (LangGraph)**  
  Powered by LangGraph to manage stateful, cyclical multi-agent workflows under a central Supervisor Agent that coordinates Machine, Inventory, Production, Maintenance, and Reporting agents.

- **High-Density SCADA Operator HUD**  
  A premium dark-mode dashboard tailored for real-time plant tracking, featuring interactive anomaly simulation (“judge-mode” triggers), dynamic time-series visualizations, and an automated HTML-to-WeasyPrint PDF shift incident reporting engine.

---

## 🏗️ Architecture & Data Flow

```text
[ Physical Sensors / Edge Pins ] ──> [ FastAPI Backend (Port 8001) ] ──> [ React/Vite Frontend ]
 (Temp, Vibration, RPM Engine)        (Random Forest / LangGraph)        (High-Density HUD)

Edge Telemetry: Hardware streams or simulated test loops transmit system states to the ingestion layer.
ML Evaluation: Metrics are processed by the predictive classifier to compute failure risk matrices.
Agent Cascades: Specialized agents analyze plant health, execute troubleshooting protocols, and update supervisor context.
HUD Representation: Live dashboards render systemic health indexes, logs, and override arrays seamlessly.
```

---

## 💻 Repository Structure

```text
├── aims/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── agents/          # LangGraph multi-agent orchestration setup
│   │   │   ├── ml/              # Random Forest training & predictive inference engines
│   │   │   └── main.py          # FastAPI application entrypoint and routers
│   │   ├── requirements.txt     # Python backend dependencies
│   │   └── Dockerfile           # Multi-stage production container build script
│   │
│   └── frontend/
│       ├── src/
│       │   ├── components/      # SCADA modules, Live HUD, Sandbox Controls, Supervisor console
│       │   └── App.tsx          # React application base
│       ├── package.json         # Node.js configuration and scripts
│       └── vite.config.ts       # Vite development server settings
└── README.md                    # Core project documentation
```

---

## 🛠️ Tech Stack

### Frontend

- React (TSX) + Vite  
- TypeScript  
- Tailwind CSS  
- Recharts (time-series charts)  
- Lucide Icons  

### Backend

- Python 3.11  
- FastAPI / Uvicorn  
- Pydantic (data validation & schemas)  
- Scikit-learn (Random Forest, auxiliary models)  
- LangGraph (multi-agent orchestration)  
- WeasyPrint (HTML-to-PDF compilation)  

---

## 📋 Core API Endpoints

The FastAPI server exposes the following operational endpoints (local base: `http://127.0.0.1:8001`):

### Health & System

- `GET /health`  
  Monitors API connectivity and operational server status.

### Telemetry & ML

- `GET /api/v1/telemetry`  
  Retrieves aggregate real-time sensor summaries for machines M1–M4.

- `POST /api/v1/telemetry/stream`  
  Ingests or simulates continuous telemetry samples:  

  ```json
  { "machine_id": "M3", "temperature_c": 98.4, "vibration_mm_s": 8.1, "rpm": 1500 }
  ```

  Evaluates data against `machine_failure_model.pkl` and updates active state maps.

### Inventory & Seeding

- `GET /api/v1/inventory`  
  Fetches inventory levels, predictive thresholds, and stockout risk metrics.

- `GET /api/v1/seed`  
  Seeds mock asset records and environmental baselines for local/demo runs.

### Multi-Agent Orchestration

- `POST /api/v1/chat`  
  Entry point for the Supervisor Agent and LangGraph multi-agent routing.  

  Payload example:

  ```json
  { "query": "Why is Machine M4 in alarm?" }
  ```

  Response: structured agentic steps (Machine, Maintenance, Production, Supervisor) plus summary, rendered in the Supervisor console.

- `POST /api/v1/agent/orchestrate`  
  Triggers a multi-agent execution loop for pre-defined orchestration scenarios.

### Reporting & Compliance

- `GET /api/v1/reports/export`  
  Compiles a high-fidelity PDF asset/shift incident report using an inline HTML-to-WeasyPrint engine and streams it as `AIMS_Shift_Incident_Report.pdf`.

---

## 🚀 Getting Started (Local)

### Prerequisites

- Python 3.11+  
- Node.js v18+

### 1. Backend Setup & Model Training

```bash
cd aims/backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Train the machine failure classification model artifacts:

```bash
python app/ml/machine_failure_model.py
```

Start the FastAPI application (local dev):

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Swagger/OpenAPI docs (if configured) will be available at:

```text
http://127.0.0.1:8001/docs
```

### 2. Frontend Setup

```bash
cd aims/frontend
npm install
```

Create a `.env` file inside `aims/frontend/`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8001/api/v1
```

Launch the Vite development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

to view the interactive A-I-M-S dashboard.

---
## 🌐 Cloud Deployment Architecture

The production environment is actively distributed across cloud platforms:

- **API Gateway / Backend**  
  Hosted on a containerized FastAPI + Uvicorn web service (e.g., Render).  
  live base API:  
  ```text
  https://aims-autonomous-industrial-management-nh7f.onrender.com
  ```
  
- **User Interface / Frontend**  
  Continuously deployed via Netlify (or similar), building from `aims/frontend` and injecting production `VITE_API_BASE_URL` at build time.
  Hosted live:- 
  ```text
  https://aimstechai.netlify.app/
  ```

- **Interactive API Documentation:**
  ```text
  https://aims-autonomous-industrial-management-nh7f.onrender.com/docs
  ```

---

## 📌 Project Status & Learning Goals

A-I-M-S is a learning-focused, yet production-style prototype intended to:

- Demonstrate practical use of AI/ML (Random Forest, forecasting, AI health scores) in factory operations.  
- Explore modern multi-agent orchestration with LangGraph in an industrial context.  
- Teach full-stack patterns for connecting edge telemetry, backend intelligence, and high-density SCADA‑inspired UIs.

Future enhancements include:

- Real hardware sensor integration (IoT).  
- More advanced predictive models and RAG for documentation lookup.  
- Role-based access control and audit logging for enterprise environments.
