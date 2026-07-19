"""
Load the pre-trained Random Forest maintenance classifier + StandardScaler.

Artifacts live at the project-root ``artifacts/`` directory
(``maintenance_model.pkl``, ``scaler.pkl``). This module does not retrain or
modify those pickles — it only loads and runs inference.
"""

from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any, Literal

import pandas as pd

StatusTier = Literal["NORMAL", "WARNING", "CRITICAL"]

# aims/backend/app/ml_inference.py → parents[3] = project root ("idb project")
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
ARTIFACT_DIR = _PROJECT_ROOT / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "maintenance_model.pkl"
SCALER_PATH = ARTIFACT_DIR / "scaler.pkl"

MACHINE_CODES = {"M1": 1, "M2": 2, "M3": 3, "M4": 4}


def _load_model_artifacts() -> tuple[Any, Any, str]:
    try:
        with open(MODEL_PATH, "rb") as model_file:
            model = pickle.load(model_file)
        with open(SCALER_PATH, "rb") as scaler_file:
            scaler = pickle.load(scaler_file)
        return model, scaler, "Model Loaded"
    except Exception as exc:
        return (
            None,
            None,
            f"Fallback Heuristic Mode (Pickle Artifact Missing) :: {type(exc).__name__}: {exc}",
        )


MODEL, SCALER, ARTIFACT_STATUS = _load_model_artifacts()


def _tier_from_probability(prob: float) -> StatusTier:
    if prob >= 0.8:
        return "CRITICAL"
    if prob >= 0.55:
        return "WARNING"
    return "NORMAL"


def _heuristic_probability(temperature_c: float, vibration_mm_s: float, rpm: float) -> float:
    """Same fallback scoring used by the root ML gateway when pickles are unavailable."""
    heuristic = 0.15
    heuristic += min(0.35, max(0.0, (temperature_c - 78) / 40))
    heuristic += min(0.25, max(0.0, (vibration_mm_s - 2.2) / 4.5))
    heuristic += min(0.2, max(0.0, (rpm - 2100) / 1800))
    return round(min(0.99, heuristic), 4)


def evaluate_hardware_sample(
    machine_id: str,
    temperature_c: float,
    vibration_mm_s: float,
    rpm: int,
) -> tuple[float, StatusTier]:
    """
    Run hardware sensor values through the pre-loaded scaler + Random Forest.

    Returns ``(failure_probability, status_tier)``.
    """
    mid = machine_id.strip().upper()
    if MODEL is None or SCALER is None:
        prob = _heuristic_probability(temperature_c, vibration_mm_s, float(rpm))
        return prob, _tier_from_probability(prob)

    code = MACHINE_CODES.get(mid, 0)
    try:
        features_df = pd.DataFrame(
            [
                {
                    "machine_code": code,
                    "temperature": temperature_c,
                    "vibration": vibration_mm_s,
                    "rpm": float(rpm),
                }
            ]
        )
        scaled = SCALER.transform(
            features_df[["machine_code", "temperature", "vibration", "rpm"]]
        )
        prob = float(MODEL.predict_proba(scaled)[0][1])
        return round(prob, 4), _tier_from_probability(prob)
    except Exception:
        prob = _heuristic_probability(temperature_c, vibration_mm_s, float(rpm))
        return prob, _tier_from_probability(prob)
