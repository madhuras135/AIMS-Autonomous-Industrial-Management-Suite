"""
machine_failure_model.py — A-I-M-S Random Forest failure classifier
=====================================================================

TRAINING
--------
Run once from the project root (or anywhere) to regenerate artifacts:

    python -m app.ml.machine_failure_model          # from aims/backend/
    # or
    python aims/backend/app/ml/machine_failure_model.py

Artifacts produced
------------------
    artifacts/machine_failure_model.pkl    — trained RandomForestClassifier
    artifacts/machine_failure_scaler.pkl   — fitted StandardScaler

INFERENCE
---------
Import ``predict_failure_risk`` in other modules.  No model is loaded at
import time; the loader is called lazily on first inference so the server
does not crash when artifacts are missing during a fresh checkout.
"""

from __future__ import annotations

import pickle
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# This file lives at:  aims/backend/app/ml/machine_failure_model.py
#   parents[0]  = aims/backend/app/ml/
#   parents[1]  = aims/backend/app/
#   parents[2]  = aims/backend/
#   parents[3]  = aims/
#   parents[4]  = project root  (idb project/)
#_THIS_FILE = Path(__file__).resolve()
import pathlib
_THIS_FILE = pathlib.Path(__file__).resolve()

# Dynamically find the directory named 'backend' or fall back safely
if "backend" in [p.name for p in _THIS_FILE.parents]:
    _PROJECT_ROOT = next(p for p in _THIS_FILE.parents if p.name == "backend")
else:
    # Fallback for the flat Docker container layout
    _PROJECT_ROOT = _THIS_FILE.parents[1]
    
ARTIFACT_DIR = _PROJECT_ROOT / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "machine_failure_model.pkl"
SCALER_PATH = ARTIFACT_DIR / "machine_failure_scaler.pkl"

# Feature columns — must match the training DataFrame and predict_failure_risk()
FEATURE_COLS = ["temperature", "vibration", "rpm", "operating_hours", "past_fault_count"]


# ---------------------------------------------------------------------------
# Dataset generation
# ---------------------------------------------------------------------------

def _generate_synthetic_dataset(n_samples: int = 3000, seed: int = 42) -> pd.DataFrame:
    """
    Build a labelled synthetic telemetry dataset.

    Failure logic (interpretable by design):
    -----------------------------------------
    A machine fails (label=1) when a combination of stress factors
    exceeds a probabilistic threshold:

        score = 0.40 × (temp > 95°C)
              + 0.35 × (vib  > 7.5 mm/s)
              + 0.10 × (rpm  > 2500)
              + 0.10 × (past_faults > 1)
              + 0.05 × (op_hours > 6000)

    The raw score is used as P(failure) with ±5 % Gaussian jitter so the
    boundary is soft, giving the classifier a realistic task.

    Distribution notes
    ------------------
    - Temperature:     N(72, 14²) clipped to [35, 130]
    - Vibration:       N(2.5, 2.8²) clipped to [0, 15]
    - RPM:             N(1750, 450²) clipped to [400, 3500]
    - Operating hours: Uniform [100, 8000]
    - Past fault count: Categorical {0:70%, 1:18%, 2:9%, 3:3%}
    """
    rng = np.random.default_rng(seed)

    temp = np.clip(rng.normal(72.0, 14.0, n_samples), 35.0, 130.0)
    vib  = np.clip(rng.normal(2.5,   2.8, n_samples),  0.0,  15.0)
    rpm  = np.clip(rng.normal(1750, 450.0, n_samples), 400.0, 3500.0)
    op_h = rng.uniform(100.0, 8000.0, n_samples)
    faults = rng.choice([0, 1, 2, 3], size=n_samples, p=[0.70, 0.18, 0.09, 0.03])

    # Soft-boundary failure score → probability → binary label
    score = (
        0.40 * (temp > 95.0).astype(float)
        + 0.35 * (vib  > 7.5).astype(float)
        + 0.10 * (rpm  > 2500).astype(float)
        + 0.10 * (faults > 1).astype(float)
        + 0.05 * (op_h  > 6000).astype(float)
    )
    jitter = rng.normal(0.0, 0.05, n_samples)
    p_fail = np.clip(score + jitter, 0.0, 1.0)
    labels = (rng.uniform(0.0, 1.0, n_samples) < p_fail).astype(int)

    return pd.DataFrame(
        {
            "temperature":      np.round(temp, 2),
            "vibration":        np.round(vib,  3),
            "rpm":              np.round(rpm,  1),
            "operating_hours":  np.round(op_h, 1),
            "past_fault_count": faults.astype(int),
            "failure":          labels,
        }
    )


# ---------------------------------------------------------------------------
# Training entry point
# ---------------------------------------------------------------------------

def train_machine_failure_model(
    n_samples: int = 3000,
    n_estimators: int = 150,
    max_depth: int | None = 12,
    seed: int = 42,
    verbose: bool = True,
) -> None:
    """
    Generate a synthetic telemetry dataset, train a RandomForestClassifier,
    evaluate it on a held-out test split, and persist the model + scaler.

    Parameters
    ----------
    n_samples    : rows in the synthetic dataset (default 3 000)
    n_estimators : trees in the Random Forest (default 150)
    max_depth    : maximum tree depth — None = unlimited (default 12)
    seed         : numpy / sklearn random seed for reproducibility
    verbose      : print progress and evaluation metrics
    """
    def _log(msg: str) -> None:
        if verbose:
            print(msg, flush=True)

    _log("\n══════════════════════════════════════════════")
    _log("  A-I-M-S  ·  Machine Failure Model Training ")
    _log("══════════════════════════════════════════════")

    # ── 1. Dataset ─────────────────────────────────────────────────────────
    _log(f"\n[1/5] Generating synthetic dataset  ({n_samples:,} samples) …")
    df = _generate_synthetic_dataset(n_samples=n_samples, seed=seed)
    failure_rate = df["failure"].mean()
    _log(f"      Failure prevalence : {failure_rate:.1%}  "
         f"({int(df['failure'].sum())} failures / {n_samples} samples)")

    # ── 2. Split ────────────────────────────────────────────────────────────
    _log("\n[2/5] Splitting 80 / 20 train-test …")
    X = df[FEATURE_COLS]
    y = df["failure"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=seed, stratify=y
    )

    # ── 3. Scale ─────────────────────────────────────────────────────────────
    _log("\n[3/5] Fitting StandardScaler on training split …")
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)

    # ── 4. Train ─────────────────────────────────────────────────────────────
    _log(f"\n[4/5] Training RandomForestClassifier  "
         f"(n_estimators={n_estimators}, max_depth={max_depth}) …")
    clf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=4,
        class_weight="balanced",   # handles minority failure class
        random_state=seed,
        n_jobs=-1,
    )
    clf.fit(X_train_sc, y_train)

    # ── 5. Evaluate ──────────────────────────────────────────────────────────
    _log("\n[5/5] Evaluation on held-out test split …")
    y_pred  = clf.predict(X_test_sc)
    y_proba = clf.predict_proba(X_test_sc)[:, 1]

    _log("\n" + classification_report(y_test, y_pred, target_names=["Normal", "Failure"]))
    try:
        auc = roc_auc_score(y_test, y_proba)
        _log(f"  ROC-AUC : {auc:.4f}")
    except Exception:
        pass

    importances = dict(zip(FEATURE_COLS, clf.feature_importances_.round(4)))
    _log(f"\n  Feature importances : {importances}")

    # ── Persist ───────────────────────────────────────────────────────────────
    try:
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as fh:
            pickle.dump(clf, fh)
        _log(f"\n  ✓  Model  saved → {MODEL_PATH}")
        with open(SCALER_PATH, "wb") as fh:
            pickle.dump(scaler, fh)
        _log(f"  ✓  Scaler saved → {SCALER_PATH}")
    except OSError as exc:
        print(f"\n  ✗  Failed to write artifacts: {exc}", file=sys.stderr)
        raise

    _log("\n  Training complete.\n")


# ---------------------------------------------------------------------------
# Lazy-loaded inference globals (loaded on first call, NOT at import time)
# ---------------------------------------------------------------------------

_model:  Any | None = None
_scaler: Any | None = None
_engine_status: str = "not_loaded"


def _ensure_loaded() -> None:
    """Load pickles the first time inference is requested."""
    global _model, _scaler, _engine_status
    if _engine_status != "not_loaded":
        return  # already attempted (success or failure)

    try:
        with open(MODEL_PATH, "rb") as fh:
            _model = pickle.load(fh)
        with open(SCALER_PATH, "rb") as fh:
            _scaler = pickle.load(fh)
        _engine_status = "Model Loaded Successfully"
    except FileNotFoundError:
        _model = _scaler = None
        _engine_status = "Fallback Heuristic Mode (artifacts not found — run training script)"
    except Exception as exc:
        _model = _scaler = None
        _engine_status = f"Fallback Heuristic Mode ({type(exc).__name__}: {exc})"


def _heuristic_prob(temp: float, vib: float, rpm: float, faults: int) -> float:
    """Rule-based failure probability used when the pickle is unavailable."""
    score = 0.10
    score += min(0.40, max(0.0, (temp  - 78.0) / 40.0))
    score += min(0.35, max(0.0, (vib   -  2.5) /  8.0))
    score += min(0.10, max(0.0, (rpm   - 2100) / 1500))
    score += min(0.10, faults * 0.05)
    return round(min(0.99, score), 4)


def predict_failure_risk(features_dict: dict[str, float]) -> dict[str, Any]:
    """
    Score a single machine telemetry reading.

    Parameters
    ----------
    features_dict : dict with keys matching FEATURE_COLS
        {temperature, vibration, rpm, operating_hours, past_fault_count}

    Returns
    -------
    dict with keys:
        failure_probability   float  0–1
        status_tier           str    "Normal" | "Warning" | "Critical"
        recommended_action    str
        engine_status         str
    """
    _ensure_loaded()

    temp    = float(features_dict.get("temperature",      70.0))
    vib     = float(features_dict.get("vibration",         2.0))
    rpm     = float(features_dict.get("rpm",             1500.0))
    op_h    = float(features_dict.get("operating_hours", 4000.0))
    faults  = int(  features_dict.get("past_fault_count",    0))

    if _model is not None and _scaler is not None:
        try:
            row = pd.DataFrame([{
                "temperature":      temp,
                "vibration":        vib,
                "rpm":              rpm,
                "operating_hours":  op_h,
                "past_fault_count": faults,
            }])
            scaled = _scaler.transform(row[FEATURE_COLS])
            prob   = float(_model.predict_proba(scaled)[0][1])
        except Exception:
            prob = _heuristic_prob(temp, vib, rpm, faults)
    else:
        prob = _heuristic_prob(temp, vib, rpm, faults)

    if prob >= 0.80:
        tier   = "Critical"
        action = "Initiate emergency maintenance trip"
    elif prob >= 0.55:
        tier   = "Warning"
        action = "Schedule calibration checks within 24 h"
    else:
        tier   = "Normal"
        action = "Maintain baseline monitoring"

    return {
        "failure_probability": round(prob, 4),
        "status_tier":         tier,
        "recommended_action":  action,
        "engine_status":       _engine_status,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    train_machine_failure_model()
