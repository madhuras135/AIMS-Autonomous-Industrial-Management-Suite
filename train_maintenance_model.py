import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


ARTIFACT_DIR = Path("artifacts")
ARTIFACT_DIR.mkdir(exist_ok=True)


def generate_synthetic_dataset(n_rows: int = 600) -> pd.DataFrame:
    """Create synthetic maintenance telemetry data for industrial machines M1-M4."""
    rng = np.random.default_rng(42)
    machines = ["M1", "M2", "M3", "M4"]
    rows = []

    for _ in range(n_rows):
        machine = rng.choice(machines)
        temperature = rng.normal(loc=72, scale=8, size=1)[0]
        vibration = rng.normal(loc=2.1, scale=0.7, size=1)[0]
        rpm = rng.normal(loc=1800, scale=240, size=1)[0]

        machine_code = {"M1": 1, "M2": 2, "M3": 3, "M4": 4}[machine]

        # Inject failure patterns that mimic real industrial operating conditions.
        if machine == "M1":
            temperature += 8
            vibration += 0.6
        elif machine == "M2":
            temperature += 4
            rpm += 280
        elif machine == "M3":
            vibration += 1.2
            temperature += 10
        elif machine == "M4":
            rpm -= 220
            vibration += 0.5

        temperature = np.clip(temperature, 45, 110)
        vibration = np.clip(vibration, 0.3, 6.5)
        rpm = np.clip(rpm, 600, 3600)

        failure_score = (
            (temperature > 84) * 0.5
            + (vibration > 3.6) * 0.35
            + (rpm > 2600) * 0.25
            + (machine_code == 3) * 0.2
        )
        failure_label = 1 if rng.random() < min(0.95, max(0.05, failure_score)) else 0

        rows.append(
            {
                "machine": machine,
                "machine_code": machine_code,
                "temperature": round(float(temperature), 2),
                "vibration": round(float(vibration), 2),
                "rpm": round(float(rpm), 2),
                "failure_risk": int(failure_label),
            }
        )

    return pd.DataFrame(rows)


def train_model() -> None:
    """Train a RandomForest classifier to predict machine failure risk."""
    df = generate_synthetic_dataset()
    X = df[["machine_code", "temperature", "vibration", "rpm"]]
    y = df["failure_risk"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=220,
        max_depth=6,
        random_state=42,
        class_weight="balanced_subsample",
    )
    model.fit(X_train_scaled, y_train)

    test_accuracy = accuracy_score(y_test, model.predict(X_test_scaled))
    print(f"Model accuracy: {test_accuracy:.3f}")

    with open(ARTIFACT_DIR / "maintenance_model.pkl", "wb") as f:
        pickle.dump(model, f)

    with open(ARTIFACT_DIR / "scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    print(f"Saved model to {ARTIFACT_DIR / 'maintenance_model.pkl'}")
    print(f"Saved scaler to {ARTIFACT_DIR / 'scaler.pkl'}")


if __name__ == "__main__":
    train_model()
