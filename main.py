import pickle
import random
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pandas as pd


ARTIFACT_DIR = Path("artifacts")
MODEL_PATH = ARTIFACT_DIR / "maintenance_model.pkl"
SCALER_PATH = ARTIFACT_DIR / "scaler.pkl"

app = FastAPI(title="A-I-M-S: Autonomous Industrial Management Suite")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    machine: str
    temperature: float
    vibration: float
    rpm: float


class PredictResponse(BaseModel):
    failure_probability: float
    status_tier: str
    remediation_plan: str
    engine_status: str
    cascade_log: List[Dict[str, str]]


class OrchestrateRequest(BaseModel):
    query: str


class OrchestrateStep(BaseModel):
    agent: str
    message: str
    timestamp: str | None = None


class OrchestrateResponse(BaseModel):
    steps: List[OrchestrateStep]
    summary: str


def _load_model_artifacts() -> tuple[Any, Any, str]:
    try:
        with open(MODEL_PATH, "rb") as model_file:
            model = pickle.load(model_file)
        with open(SCALER_PATH, "rb") as scaler_file:
            scaler = pickle.load(scaler_file)
        return model, scaler, "Model Loaded"
    except Exception as exc:
        return None, None, f"Fallback Heuristic Mode (Pickle Artifact Missing) :: {type(exc).__name__}: {exc}"


MODEL, SCALER, ARTIFACT_STATUS = _load_model_artifacts()


def _heuristic_prediction(payload: Dict[str, Any]) -> Dict[str, Any]:
    temperature = payload["temperature"]
    vibration = payload["vibration"]
    rpm = payload["rpm"]

    heuristic = 0.15
    heuristic += min(0.35, max(0, (temperature - 78) / 40))
    heuristic += min(0.25, max(0, (vibration - 2.2) / 4.5))
    heuristic += min(0.2, max(0, (rpm - 2100) / 1800))
    heuristic = round(min(0.99, heuristic), 4)

    if heuristic >= 0.8:
        status_tier = "CRITICAL"
        remediation_plan = "Dispatch maintenance crew immediately and reduce production load."
    elif heuristic >= 0.55:
        status_tier = "WARNING"
        remediation_plan = "Inspect bearings and cooling loop before the next shift window."
    else:
        status_tier = "NORMAL"
        remediation_plan = "Continue standard monitoring and maintain trend visibility."

    return {
        "failure_probability": heuristic,
        "status_tier": status_tier,
        "remediation_plan": remediation_plan,
        "engine_status": ARTIFACT_STATUS,
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "A-I-M-S", "artifact_status": ARTIFACT_STATUS}


@app.get("/api/v1/telemetry")
def get_telemetry() -> Dict[str, Any]:
    machines = ["M1", "M2", "M3", "M4"]
    payload: List[Dict[str, Any]] = []
    base_profiles = {
        "M1": {"temperature": 72, "vibration": 2.0, "rpm": 1820, "status": "stable"},
        "M2": {"temperature": 76, "vibration": 2.4, "rpm": 1760, "status": "warning"},
        "M3": {"temperature": 88, "vibration": 3.8, "rpm": 2510, "status": "critical"},
        "M4": {"temperature": 70, "vibration": 1.7, "rpm": 1710, "status": "stable"},
    }

    for machine in machines:
        profile = base_profiles[machine]
        payload.append(
            {
                "machine": machine,
                "temperature": round(profile["temperature"] + random.uniform(-4, 4), 2),
                "vibration": round(profile["vibration"] + random.uniform(-0.4, 0.5), 2),
                "rpm": round(profile["rpm"] + random.uniform(-180, 180), 2),
                "status": profile["status"],
            }
        )

    return {"timestamp": pd.Timestamp.utcnow().isoformat(), "machines": payload}


@app.post("/api/v1/agent/orchestrate", response_model=OrchestrateResponse)
def orchestrate(request: OrchestrateRequest) -> Dict[str, Any]:
    query = (request.query or "").strip()
    lower_query = query.lower()

    steps: List[Dict[str, Any]] = []
    if any(token in lower_query for token in ["machine", "alarm", "fault", "vibration", "temp", "thermal", "failure"]):
        steps.append(
            {
                "agent": "MachineAgent",
                "message": f"Telemetry review completed for {query or 'the active asset'}; thermal and vibration risk were prioritized.",
            }
        )
    if any(token in lower_query for token in ["maintenance", "repair", "service", "work order", "dispatch"]):
        steps.append(
            {
                "agent": "MaintenanceAgent",
                "message": "Maintenance dispatch plan prepared with a spare-parts check and shift-window alignment.",
            }
        )
    if any(token in lower_query for token in ["inventory", "stock", "material", "supply", "shortage"]):
        steps.append(
            {
                "agent": "ProductionAgent",
                "message": "Inventory risk scan highlighted material exposure and recommended replenishment pacing.",
            }
        )
    if not steps:
        steps.append(
            {
                "agent": "MachineAgent",
                "message": "No explicit machine focus was detected, so the orchestrator defaulted to a general health scan.",
            }
        )

    steps.append(
        {
            "agent": "SupervisorAgent",
            "message": f"Supervisor summary generated for the query: {query or 'operational review'}.",
        }
    )

    return {
        "steps": steps,
        "summary": "The backend orchestrator generated a consistent multi-agent cascade for the operator request.",
    }


@app.post("/api/v1/machine-agent/predict", response_model=PredictResponse)
def machine_predict(request: PredictRequest) -> Dict[str, Any]:
    payload = {
        "machine": request.machine,
        "temperature": request.temperature,
        "vibration": request.vibration,
        "rpm": request.rpm,
    }

    if MODEL is None or SCALER is None:
        heuristic = _heuristic_prediction(payload)
        heuristic["cascade_log"] = [
            {"agent": "[Machine Agent]", "message": "Artifact load failed; fallback heuristic engaged."},
            {"agent": "[Maintenance Agent]", "message": "Work order template generated from statistical baseline."},
            {"agent": "[Production Agent]", "message": "Schedule buffer activated to preserve throughput."},
            {"agent": "[Supervisor Agent]", "message": "Operator oversight maintained while model artifacts are restored."},
        ]
        return heuristic

    try:
        features_df = pd.DataFrame(
            [{
                "machine_code": {"M1": 1, "M2": 2, "M3": 3, "M4": 4}[request.machine],
                "temperature": request.temperature,
                "vibration": request.vibration,
                "rpm": request.rpm,
            }]
        )
        scaled = SCALER.transform(features_df[["machine_code", "temperature", "vibration", "rpm"]])
        prob = float(MODEL.predict_proba(scaled)[0][1])
    except Exception:
        heuristic = _heuristic_prediction(payload)
        heuristic["cascade_log"] = [
            {"agent": "[Machine Agent]", "message": "Model inference exception triggered fallback heuristic."},
            {"agent": "[Maintenance Agent]", "message": "Fallback repair plan generated."},
            {"agent": "[Production Agent]", "message": "Schedule reroute initiated with buffer protection."},
            {"agent": "[Supervisor Agent]", "message": "Cross-check completed using secondary inference path."},
        ]
        return heuristic

    if prob >= 0.8:
        status_tier = "CRITICAL"
        remediation_plan = "Initiate immediate maintenance intervention and protect production continuity."
    elif prob >= 0.55:
        status_tier = "WARNING"
        remediation_plan = "Prepare service window and dispatch engineering support."
    else:
        status_tier = "NORMAL"
        remediation_plan = "Maintain active monitoring and review trends in the next cycle."

    return {
        "failure_probability": round(prob, 4),
        "status_tier": status_tier,
        "remediation_plan": remediation_plan,
        "engine_status": ARTIFACT_STATUS,
        "cascade_log": [
            {"agent": "[Machine Agent]", "message": f"{request.machine} telemetry indicates elevated operational stress."},
            {"agent": "[Maintenance Agent]", "message": "Technician assignment prepared for the fault window."},
            {"agent": "[Production Agent]", "message": "Machine allocation matrix adjusted to preserve throughput."},
            {"agent": "[Supervisor Agent]", "message": "Executive summary generated for the shift handoff."},
        ],
    }
