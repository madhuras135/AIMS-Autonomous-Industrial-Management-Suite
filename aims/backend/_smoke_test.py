"""Quick smoke-test: verify import safety and inference of all three ML modules."""
import sys
sys.path.insert(0, ".")

print("Importing machine_failure_model ...")
from app.ml.machine_failure_model import predict_failure_risk, FEATURE_COLS, ARTIFACT_DIR
print("  OK - no auto-training triggered")

print("Importing inventory_forecast_model ...")
from app.ml.inventory_forecast_model import forecast_inventory
print("  OK - no auto-training triggered")

print("Importing plant_health_model ...")
from app.ml.plant_health_model import compute_plant_health_score, health_score_label
print("  OK - heuristic module, no model load needed")

# Inference in heuristic fallback mode (no pkl artifacts present)
r = predict_failure_risk({
    "temperature": 98.6, "vibration": 7.9,
    "rpm": 980, "operating_hours": 6234.7, "past_fault_count": 2
})
assert "failure_probability" in r and "status_tier" in r
print(f"  predict_failure_risk: prob={r['failure_probability']}  tier={r['status_tier']}  engine={r['engine_status'][:40]}")

inv = forecast_inventory(1100.0, 420.0, 3.0)
assert "days_to_stockout" in inv and "stockout_probability" in inv
print(f"  forecast_inventory:   days={inv['days_to_stockout']}  p_stockout={inv['stockout_probability']}")

score = compute_plant_health_score({
    "machine_statuses": ["NORMAL", "NORMAL", "WARNING", "CRITICAL"],
    "failure_probabilities": [0.12, 0.14, 0.60, 0.92],
    "stockout_probabilities": [0.18, 0.94],
})
assert 0.0 <= score <= 100.0
print(f"  compute_plant_health_score: score={score}  label={health_score_label(score)}")

print("\nAll assertions passed.")
