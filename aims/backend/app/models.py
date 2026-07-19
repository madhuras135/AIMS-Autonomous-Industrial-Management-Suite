"""Pydantic models for A-I-M-S telemetry, inventory, and agent orchestration."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MachineTelemetry(BaseModel):
    machine_id: str
    timestamp: str
    temperature_c: float
    vibration_mm_s: float
    rpm: int
    operating_hours: float
    status: Literal["NORMAL", "WARNING", "CRITICAL"]
    failure_probability: float | None = None
    status_tier: str | None = None
    recommended_action: str | None = None
    engine_status: str | None = None


class InventoryItem(BaseModel):
    material: str
    current_stock_kg: float
    daily_usage_kg: float
    days_left: float
    status: Literal["HEALTHY", "LOW", "CRITICAL"]
    days_to_stockout: float | None = None
    stockout_probability: float | None = None
    reorder_quantity_suggestion: float | None = None


class OrchestrateRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Operator or supervisor natural-language query")


class AgentStep(BaseModel):
    agent: str
    message: str
    timestamp: str | None = None


class OrchestrateResponse(BaseModel):
    steps: list[AgentStep]
    summary: str
    plant_health_score: float | None = None
    plant_health_label: str | None = None


class TelemetryStreamPayload(BaseModel):
    """Physical hardware sensor sample posted by an edge device (Pi / ESP32)."""

    machine_id: str = Field(..., min_length=1, description="Asset id, e.g. M1–M4")
    temperature_c: float
    vibration_mm_s: float
    rpm: int
