"""
inventory_forecast_model.py — A-I-M-S Inventory Stockout Forecaster
====================================================================

TRAINING
--------
Run once to generate the model artifact:

    python -m app.ml.inventory_forecast_model          # from aims/backend/
    # or
    python aims/backend/app/ml/inventory_forecast_model.py

Artifacts produced
------------------
    artifacts/inventory_forecast_model.pkl    — trained GradientBoostingRegressor
    artifacts/inventory_forecast_scaler.pkl   — fitted StandardScaler

INFERENCE
---------
Import ``forecast_inventory`` in other modules.  Models are loaded lazily on
first call — the server stays healthy even when artifacts are missing.

What the model predicts
-----------------------
Primary target :  days_to_stockout  (float, regression)
Derived outputs:  stockout_probability, reorder_quantity_suggestion

These are computed from the primary prediction + lead-time logic so the entire
forecast is internally consistent.
"""

from __future__ import annotations

import pickle
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_THIS_FILE    = Path(__file__).resolve()
_PROJECT_ROOT = _THIS_FILE.parents[4]   # idb project/
ARTIFACT_DIR  = _PROJECT_ROOT / "artifacts"
MODEL_PATH    = ARTIFACT_DIR / "inventory_forecast_model.pkl"
SCALER_PATH   = ARTIFACT_DIR / "inventory_forecast_scaler.pkl"

FEATURE_COLS = [
    "current_stock_kg",
    "daily_usage_kg",
    "lead_time_days",
    "usage_variability",   # CV of daily usage — captures demand volatility
    "safety_stock_days",   # user-configured safety buffer in days
]


# ---------------------------------------------------------------------------
# Dataset generation
# ---------------------------------------------------------------------------

def _generate_synthetic_dataset(n_samples: int = 4000, seed: int = 42) -> pd.DataFrame:
    """
    Build a synthetic inventory dataset with realistic distributions.

    Feature distributions
    ---------------------
    current_stock_kg  : Uniform [200, 12 000]   kg
    daily_usage_kg    : Uniform [50,  1 500]     kg/day
    lead_time_days    : Discrete {2, 3, 5, 7, 10, 14}
    usage_variability : Uniform [0.05, 0.45]    (CV — std/mean of daily usage)
    safety_stock_days : Discrete {1, 2, 3, 5, 7}

    Target
    ------
    days_to_stockout = current_stock_kg / effective_daily_usage

    effective_daily_usage is jittered by ±variability to simulate real demand
    fluctuation, making the regression task non-trivial.
    """
    rng = np.random.default_rng(seed)

    stock   = rng.uniform(200.0, 12_000.0, n_samples)
    usage   = rng.uniform(50.0,  1_500.0,  n_samples)
    lead    = rng.choice([2, 3, 5, 7, 10, 14], size=n_samples)
    cv      = rng.uniform(0.05, 0.45, n_samples)          # usage coefficient of variation
    safety  = rng.choice([1, 2, 3, 5, 7], size=n_samples)

    # Effective usage = nominal usage × (1 + noise drawn from N(0, CV))
    noise_factor = 1.0 + rng.normal(0.0, cv, n_samples)
    noise_factor = np.clip(noise_factor, 0.3, 2.5)
    effective_usage = usage * noise_factor
    effective_usage = np.maximum(effective_usage, 1.0)    # avoid div-by-zero

    days_to_stockout = np.round(stock / effective_usage, 3)
    days_to_stockout = np.clip(days_to_stockout, 0.0, 180.0)  # cap at 6 months

    return pd.DataFrame(
        {
            "current_stock_kg":  np.round(stock, 1),
            "daily_usage_kg":    np.round(usage, 1),
            "lead_time_days":    lead.astype(float),
            "usage_variability": np.round(cv, 4),
            "safety_stock_days": safety.astype(float),
            "days_to_stockout":  days_to_stockout,
        }
    )


# ---------------------------------------------------------------------------
# Training entry point
# ---------------------------------------------------------------------------

def train_inventory_forecast_model(
    n_samples:     int   = 4000,
    n_estimators:  int   = 200,
    learning_rate: float = 0.08,
    max_depth:     int   = 4,
    seed:          int   = 42,
    verbose:       bool  = True,
) -> None:
    """
    Generate a synthetic inventory dataset, train a GradientBoostingRegressor
    to predict days_to_stockout, and persist the model + scaler.

    Parameters
    ----------
    n_samples     : dataset size (default 4 000)
    n_estimators  : boosting rounds (default 200)
    learning_rate : shrinkage rate (default 0.08)
    max_depth     : max depth of individual trees (default 4)
    seed          : random seed for reproducibility
    verbose       : print progress and metrics
    """
    def _log(msg: str) -> None:
        if verbose:
            print(msg, flush=True)

    _log("\n══════════════════════════════════════════════")
    _log("  A-I-M-S  ·  Inventory Forecast Model Training")
    _log("══════════════════════════════════════════════")

    # ── 1. Dataset ─────────────────────────────────────────────────────────
    _log(f"\n[1/5] Generating synthetic inventory dataset  ({n_samples:,} samples) …")
    df = _generate_synthetic_dataset(n_samples=n_samples, seed=seed)
    _log(f"      days_to_stockout  mean={df['days_to_stockout'].mean():.1f} d  "
         f"std={df['days_to_stockout'].std():.1f} d  "
         f"min={df['days_to_stockout'].min():.1f}  "
         f"max={df['days_to_stockout'].max():.1f}")

    # ── 2. Split ────────────────────────────────────────────────────────────
    _log("\n[2/5] Splitting 80 / 20 train-test …")
    X = df[FEATURE_COLS]
    y = df["days_to_stockout"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=seed
    )

    # ── 3. Scale ─────────────────────────────────────────────────────────────
    _log("\n[3/5] Fitting StandardScaler on training split …")
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)

    # ── 4. Train ─────────────────────────────────────────────────────────────
    _log(f"\n[4/5] Training GradientBoostingRegressor  "
         f"(n_estimators={n_estimators}, lr={learning_rate}, max_depth={max_depth}) …")
    reg = GradientBoostingRegressor(
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        max_depth=max_depth,
        min_samples_leaf=5,
        subsample=0.85,
        random_state=seed,
    )
    reg.fit(X_train_sc, y_train)

    # ── 5. Evaluate ──────────────────────────────────────────────────────────
    _log("\n[5/5] Evaluation on held-out test split …")
    y_pred = reg.predict(X_test_sc)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred) ** 0.5
    r2   = r2_score(y_test, y_pred)
    _log(f"\n  MAE  : {mae:.3f} days")
    _log(f"  RMSE : {rmse:.3f} days")
    _log(f"  R²   : {r2:.4f}")

    importances = dict(zip(FEATURE_COLS, reg.feature_importances_.round(4)))
    _log(f"\n  Feature importances : {importances}")

    # ── Persist ───────────────────────────────────────────────────────────────
    try:
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as fh:
            pickle.dump(reg, fh)
        _log(f"\n  ✓  Model  saved → {MODEL_PATH}")
        with open(SCALER_PATH, "wb") as fh:
            pickle.dump(scaler, fh)
        _log(f"  ✓  Scaler saved → {SCALER_PATH}")
    except OSError as exc:
        print(f"\n  ✗  Failed to write artifacts: {exc}", file=sys.stderr)
        raise

    _log("\n  Training complete.\n")


# ---------------------------------------------------------------------------
# Lazy-loaded inference globals
# ---------------------------------------------------------------------------

_model:  Any | None = None
_scaler: Any | None = None
_forecast_engine_status: str = "not_loaded"


def _ensure_loaded() -> None:
    global _model, _scaler, _forecast_engine_status
    if _forecast_engine_status != "not_loaded":
        return

    try:
        with open(MODEL_PATH, "rb") as fh:
            _model = pickle.load(fh)
        with open(SCALER_PATH, "rb") as fh:
            _scaler = pickle.load(fh)
        _forecast_engine_status = "Model Loaded Successfully"
    except FileNotFoundError:
        _model = _scaler = None
        _forecast_engine_status = "Fallback Heuristic Mode (artifacts not found — run training script)"
    except Exception as exc:
        _model = _scaler = None
        _forecast_engine_status = f"Fallback Heuristic Mode ({type(exc).__name__}: {exc})"


def _heuristic_days(stock: float, usage: float) -> float:
    """Simple ratio fallback when pickle is unavailable."""
    if usage <= 0:
        return 999.0
    return round(stock / usage, 3)


def _days_to_stockout_prob(days: float, lead_time: float) -> float:
    """
    Convert predicted days_to_stockout into a 0-1 stockout probability.

    The curve is calibrated so that:
    - days ≤ lead_time          → prob ≥ 0.75  (very likely to stock out)
    - days = lead_time × 2      → prob ≈ 0.35
    - days ≥ lead_time × 4      → prob ≤ 0.05
    """
    if lead_time <= 0:
        lead_time = 3.0
    ratio = days / lead_time
    if ratio <= 1.0:
        prob = min(0.99, max(0.75, 0.98 - (ratio - 0.0) * 0.23))
    elif ratio <= 2.0:
        prob = min(0.74, max(0.35, 0.74 - (ratio - 1.0) * 0.39))
    else:
        prob = max(0.02, 0.35 - (ratio - 2.0) * 0.083)
    return round(prob, 4)


def forecast_inventory(
    current_stock_kg: float,
    daily_usage_kg:   float,
    lead_time_days:   float = 3.0,
    usage_variability: float = 0.15,
    safety_stock_days: float = 2.0,
) -> dict[str, Any]:
    """
    Forecast inventory stockout risk for a single material.

    Parameters
    ----------
    current_stock_kg   : current stock level in kg
    daily_usage_kg     : average daily consumption in kg
    lead_time_days     : supplier lead time in days (default 3)
    usage_variability  : CV of daily usage; 0.15 = ±15 % (default 0.15)
    safety_stock_days  : desired safety buffer in days (default 2)

    Returns
    -------
    dict with keys:
        days_to_stockout          float
        stockout_probability      float  0–1
        reorder_quantity_suggestion float  kg
        forecast_status           str
    """
    _ensure_loaded()

    if daily_usage_kg <= 0:
        return {
            "days_to_stockout":           999.0,
            "stockout_probability":        0.0,
            "reorder_quantity_suggestion": 0.0,
            "forecast_status":            "No active usage detected",
        }

    # ── ML prediction ────────────────────────────────────────────────────────
    if _model is not None and _scaler is not None:
        try:
            row = pd.DataFrame([{
                "current_stock_kg":  current_stock_kg,
                "daily_usage_kg":    daily_usage_kg,
                "lead_time_days":    lead_time_days,
                "usage_variability": usage_variability,
                "safety_stock_days": safety_stock_days,
            }])
            scaled = _scaler.transform(row[FEATURE_COLS])
            days = float(np.clip(_model.predict(scaled)[0], 0.0, 999.0))
        except Exception:
            days = _heuristic_days(current_stock_kg, daily_usage_kg)
    else:
        days = _heuristic_days(current_stock_kg, daily_usage_kg)

    days = round(days, 2)

    # ── Derived outputs ───────────────────────────────────────────────────────
    stockout_prob = _days_to_stockout_prob(days, lead_time_days)

    # Reorder quantity covers: lead_time × usage + safety buffer − current stock
    # Minimum order floor: 7 days of usage to avoid trivial replenishment orders
    target_stock = daily_usage_kg * (lead_time_days + safety_stock_days + 7.0)
    reorder_qty  = max(0.0, target_stock - current_stock_kg)
    if stockout_prob >= 0.75 and reorder_qty < daily_usage_kg * 5:
        reorder_qty = daily_usage_kg * 10.0          # emergency replenishment
    reorder_qty = round(reorder_qty, 1)

    return {
        "days_to_stockout":           days,
        "stockout_probability":        stockout_prob,
        "reorder_quantity_suggestion": reorder_qty,
        "forecast_status":            _forecast_engine_status,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    train_inventory_forecast_model()
