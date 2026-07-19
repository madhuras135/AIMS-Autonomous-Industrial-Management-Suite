"""
A-I-M-S FastAPI entrypoint — Autonomous Industrial Management Suite.

Run: uvicorn app.main:app --reload --port 8001
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .data_simulation import generate_inventory, generate_telemetry, run_orchestration, seed_mock_data
from .ml_inference import ARTIFACT_STATUS
from .models import (
    InventoryItem,
    MachineTelemetry,
    OrchestrateRequest,
    OrchestrateResponse,
    TelemetryStreamPayload,
)
from .telemetry_store import ingest_hardware_sample

app = FastAPI(
    title="A-I-M-S API",
    description="Autonomous Industrial Management Suite — multi-agent MES prototype",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "A-I-M-S", "artifact_status": ARTIFACT_STATUS}


@app.get("/api/v1/telemetry", response_model=list[MachineTelemetry])
def get_telemetry() -> list[MachineTelemetry]:
    """Latest evaluated machine telemetry (M1–M4) from the live hardware store."""
    return generate_telemetry()


@app.post("/api/v1/telemetry/stream", response_model=MachineTelemetry)
def stream_telemetry(payload: TelemetryStreamPayload) -> MachineTelemetry:
    """
    Ingest a physical hardware sensor sample from an edge device (Raspberry Pi / ESP32).

    The sample is scored by the pre-loaded Random Forest scaler + classifier and
    persisted so ``GET /api/v1/telemetry`` (and the frontend poll loop) see it.
    """
    try:
        return ingest_hardware_sample(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/inventory", response_model=list[InventoryItem])
def get_inventory() -> list[InventoryItem]:
    """Material stock levels with days-left status."""
    return generate_inventory()


@app.get("/api/v1/seed")
def get_seed() -> dict:
    """Deterministic snapshot for demos / frontend fallback alignment."""
    machines, inventory = seed_mock_data()
    return {"machines": machines, "inventory": inventory}


@app.post("/api/v1/agent/orchestrate", response_model=OrchestrateResponse)
def orchestrate(body: OrchestrateRequest) -> OrchestrateResponse:
    """
    Supervisor agent orchestrator — rule-based multi-agent pipeline.

    TODO: replace rule-based agents with LangGraph graph / real LLM nodes.
    """
    return run_orchestration(body.query)
