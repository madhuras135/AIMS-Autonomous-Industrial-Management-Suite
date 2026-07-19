"""
In-memory plant telemetry state for live hardware ingestion.

Edge devices POST sensor samples to ``/api/v1/telemetry/stream``; the evaluated
records are stored here so the frontend can keep polling ``GET /api/v1/telemetry``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock

from .ml_inference import evaluate_hardware_sample
from .models import MachineTelemetry, TelemetryStreamPayload

MACHINE_IDS = ("M1", "M2", "M3", "M4")

# Seed operating hours preserved across hardware updates (payload has no hours field).
_DEFAULT_HOURS: dict[str, float] = {
    "M1": 4120.5,
    "M2": 3890.0,
    "M3": 5012.3,
    "M4": 6234.7,
}

_lock = Lock()
_latest: dict[str, MachineTelemetry] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_baseline() -> None:
    """Populate store with a deterministic baseline until the first hardware posts arrive."""
    ts = _now_iso()
    baselines = [
        ("M1", 68.2, 2.1, 1450, "NORMAL"),
        ("M2", 74.8, 3.4, 1380, "NORMAL"),
        ("M3", 82.1, 4.8, 1520, "WARNING"),
        ("M4", 98.6, 7.9, 980, "CRITICAL"),
    ]
    for mid, temp, vib, rpm, status in baselines:
        _latest[mid] = MachineTelemetry(
            machine_id=mid,
            timestamp=ts,
            temperature_c=temp,
            vibration_mm_s=vib,
            rpm=rpm,
            operating_hours=_DEFAULT_HOURS[mid],
            status=status,  # type: ignore[arg-type]
            failure_probability=None,
        )


_seed_baseline()


def get_latest_telemetry() -> list[MachineTelemetry]:
    """Return M1–M4 in stable order for dashboard polling."""
    with _lock:
        return [_latest[mid] for mid in MACHINE_IDS if mid in _latest]


def ingest_hardware_sample(payload: TelemetryStreamPayload) -> MachineTelemetry:
    """
    Accept a physical sensor reading, score it with the RF pipeline, and persist it.
    """
    mid = payload.machine_id.strip().upper()
    if mid not in MACHINE_IDS:
        raise ValueError(f"Unknown machine_id '{payload.machine_id}'. Expected one of {MACHINE_IDS}.")

    failure_probability, status = evaluate_hardware_sample(
        machine_id=mid,
        temperature_c=payload.temperature_c,
        vibration_mm_s=payload.vibration_mm_s,
        rpm=payload.rpm,
    )

    with _lock:
        previous = _latest.get(mid)
        hours = previous.operating_hours if previous else _DEFAULT_HOURS.get(mid, 0.0)
        record = MachineTelemetry(
            machine_id=mid,
            timestamp=_now_iso(),
            temperature_c=payload.temperature_c,
            vibration_mm_s=payload.vibration_mm_s,
            rpm=payload.rpm,
            operating_hours=hours,
            status=status,
            failure_probability=failure_probability,
        )
        _latest[mid] = record
        return record
