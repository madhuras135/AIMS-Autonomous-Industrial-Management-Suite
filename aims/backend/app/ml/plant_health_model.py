"""
plant_health_model.py — A-I-M-S Plant Health Score Engine
==========================================================

This module is RULE-BASED (no trained model required).

Design rationale
----------------
A composite 0–100 plant health score is more actionable than raw probabilities
because it gives management a single number to track shift-over-shift.  The
formula is intentionally transparent and auditable — no black-box model needed
for a linear aggregation of three well-understood sub-scores.

Score composition
-----------------

  H = 100 × ( w_mach × machine_score
             + w_fail × reliability_score
             + w_inv  × supply_score )

  where the weights sum to 1.0.

Sub-score definitions
---------------------
  machine_score    = fraction of machines in NORMAL state
                     (CRITICAL counts as 0, WARNING as 0.4)

  reliability_score = 1.0 − avg_failure_probability  (from Random Forest)
                      Clamped to [0, 1].

  supply_score     = 1.0 − avg_stockout_probability  (from inventory forecast)
                     Clamped to [0, 1].

Penalty modifiers (applied after linear blend)
--------------------------
  • Any CRITICAL machine   → −8 points per asset, max penalty −16
  • Stockout probability > 0.9 for any material → −5 points

The final score is clamped to [0, 100] and rounded to one decimal place.

Usage
-----
    from app.ml.plant_health_model import compute_plant_health_score

    score = compute_plant_health_score({
        "machine_statuses":         ["NORMAL", "WARNING", "CRITICAL", "NORMAL"],
        "failure_probabilities":    [0.12, 0.48, 0.91, 0.08],
        "stockout_probabilities":   [0.05, 0.82],
    })
    # → e.g. 53.4

    # Or pass aggregated floats directly (used by data_simulation.run_orchestration):
    score = compute_plant_health_score({
        "frac_machines_ok":         0.5,   # fraction of machines in NORMAL
        "avg_failure_probability":  0.40,
        "avg_stockout_probability": 0.44,
    })

Both calling conventions are supported.
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Weights — adjust here to change the composite formula
# ---------------------------------------------------------------------------

_W_MACHINE     = 0.40   # weight for fraction of machines healthy
_W_RELIABILITY = 0.30   # weight for avg failure probability (inverted)
_W_SUPPLY      = 0.30   # weight for avg stockout probability (inverted)

# Penalty per CRITICAL machine (capped)
_PENALTY_PER_CRITICAL       = 8.0
_MAX_CRITICAL_PENALTY       = 16.0

# Penalty for any single material with near-certain stockout
_PENALTY_STOCKOUT_SEVERE    = 5.0
_STOCKOUT_SEVERE_THRESHOLD  = 0.90


def _extract_aggregates(metrics: dict[str, Any]) -> tuple[float, float, float, int, list[float]]:
    """
    Parse either raw lists or pre-aggregated floats from the metrics dict.

    Returns
    -------
    frac_ok            : float  fraction of machines in NORMAL state
    avg_failure_prob   : float  0–1
    avg_stockout_prob  : float  0–1
    n_critical         : int    number of CRITICAL machines
    stockout_probs     : list   per-material stockout probabilities
    """
    # --- Raw list convention ---
    if "machine_statuses" in metrics:
        statuses: list[str] = metrics["machine_statuses"]
        n = len(statuses) or 1

        # Machine score: NORMAL=1, WARNING=0.4, CRITICAL=0
        weighted_ok = sum(
            1.0 if s == "NORMAL" else (0.4 if s == "WARNING" else 0.0)
            for s in statuses
        )
        frac_ok  = weighted_ok / n
        n_crit   = sum(1 for s in statuses if s == "CRITICAL")

        fail_probs: list[float] = [
            float(p) for p in metrics.get("failure_probabilities", [])
        ]
        avg_fail = sum(fail_probs) / len(fail_probs) if fail_probs else 0.0

        stockout_probs: list[float] = [
            float(p) for p in metrics.get("stockout_probabilities", [])
        ]
        avg_stock = sum(stockout_probs) / len(stockout_probs) if stockout_probs else 0.0

        return frac_ok, avg_fail, avg_stock, n_crit, stockout_probs

    # --- Pre-aggregated convention (used by data_simulation.py) ---
    frac_ok    = float(metrics.get("frac_machines_ok",        1.0))
    avg_fail   = float(metrics.get("avg_failure_probability", 0.0))
    avg_stock  = float(metrics.get("avg_stockout_probability",0.0))
    n_crit     = int(  metrics.get("n_critical_machines",       0))
    stockout_p = [avg_stock]   # single aggregate; no per-material detail

    return frac_ok, avg_fail, avg_stock, n_crit, stockout_p


def compute_plant_health_score(metrics: dict[str, Any]) -> float:
    """
    Compute a composite 0–100 plant health score from operational metrics.

    Parameters
    ----------
    metrics : dict — accepts either calling convention:

      Convention A (raw data):
        machine_statuses      : list[str]   e.g. ["NORMAL", "WARNING", "CRITICAL"]
        failure_probabilities : list[float] per-machine RF failure probability 0–1
        stockout_probabilities: list[float] per-material stockout probability 0–1

      Convention B (pre-aggregated, matches data_simulation.run_orchestration):
        frac_machines_ok         : float  0–1  fraction of non-critical machines
        avg_failure_probability  : float  0–1
        avg_stockout_probability : float  0–1
        n_critical_machines      : int         (optional, default 0)

    Returns
    -------
    float — health score in [0.0, 100.0], one decimal place

    Interpretation guide
    --------------------
    90–100  Optimal          All assets running; minimal supply risk
    75–89   Good             Minor issues; no immediate action required
    60–74   Moderate         At least one machine in WARNING or supply running low
    40–59   Degraded         CRITICAL asset(s) or serious supply risk
    0–39    Severe / Crisis  Multiple critical failures or imminent stockout
    """
    frac_ok, avg_fail, avg_stock, n_crit, stockout_probs = _extract_aggregates(metrics)

    # Clamp inputs to valid ranges
    frac_ok   = max(0.0, min(1.0, frac_ok))
    avg_fail  = max(0.0, min(1.0, avg_fail))
    avg_stock = max(0.0, min(1.0, avg_stock))

    # ── Sub-scores ────────────────────────────────────────────────────────────
    machine_score     = frac_ok
    reliability_score = 1.0 - avg_fail
    supply_score      = 1.0 - avg_stock

    # ── Linear blend ─────────────────────────────────────────────────────────
    raw = 100.0 * (
        _W_MACHINE     * machine_score
        + _W_RELIABILITY * reliability_score
        + _W_SUPPLY      * supply_score
    )

    # ── Penalty modifiers ─────────────────────────────────────────────────────
    critical_penalty = min(_MAX_CRITICAL_PENALTY, n_crit * _PENALTY_PER_CRITICAL)
    raw -= critical_penalty

    severe_stockouts = sum(1 for p in stockout_probs if p >= _STOCKOUT_SEVERE_THRESHOLD)
    raw -= severe_stockouts * _PENALTY_STOCKOUT_SEVERE

    # ── Clamp and round ───────────────────────────────────────────────────────
    return round(max(0.0, min(100.0, raw)), 1)


def health_score_label(score: float) -> str:
    """Return a human-readable tier label for a plant health score."""
    if score >= 90:
        return "Optimal"
    if score >= 75:
        return "Good"
    if score >= 60:
        return "Moderate"
    if score >= 40:
        return "Degraded"
    return "Severe"


# ---------------------------------------------------------------------------
# Self-test / demo — not a training block, just a quick sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n  A-I-M-S · Plant Health Score Engine — self-test\n")

    scenarios = [
        {
            "label": "All nominal",
            "metrics": {
                "machine_statuses":       ["NORMAL", "NORMAL", "NORMAL", "NORMAL"],
                "failure_probabilities":  [0.08, 0.11, 0.09, 0.10],
                "stockout_probabilities": [0.04, 0.06],
            },
        },
        {
            "label": "One warning, mild stockout risk",
            "metrics": {
                "machine_statuses":       ["NORMAL", "NORMAL", "WARNING", "NORMAL"],
                "failure_probabilities":  [0.10, 0.13, 0.58, 0.09],
                "stockout_probabilities": [0.35, 0.08],
            },
        },
        {
            "label": "One critical machine, critical inventory",
            "metrics": {
                "machine_statuses":       ["NORMAL", "NORMAL", "WARNING", "CRITICAL"],
                "failure_probabilities":  [0.12, 0.14, 0.60, 0.92],
                "stockout_probabilities": [0.18, 0.94],
            },
        },
        {
            "label": "Two critical machines, severe stockout",
            "metrics": {
                "machine_statuses":       ["CRITICAL", "NORMAL", "WARNING", "CRITICAL"],
                "failure_probabilities":  [0.91, 0.13, 0.62, 0.88],
                "stockout_probabilities": [0.95, 0.91],
            },
        },
        {
            "label": "Pre-aggregated convention (data_simulation compatible)",
            "metrics": {
                "frac_machines_ok":         0.5,
                "avg_failure_probability":  0.40,
                "avg_stockout_probability": 0.44,
                "n_critical_machines":      1,
            },
        },
    ]

    for s in scenarios:
        score = compute_plant_health_score(s["metrics"])
        label = health_score_label(score)
        print(f"  {s['label']:<52}  →  {score:5.1f}  [{label}]")

    print()
