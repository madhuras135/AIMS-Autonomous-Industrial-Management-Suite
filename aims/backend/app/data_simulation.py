"""
Mock factory data + rule-based multi-agent pipeline.

TODO: replace rule-based agents with LangGraph graph / real LLM nodes.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from .models import AgentStep, InventoryItem, MachineTelemetry, OrchestrateResponse
from .ml.machine_failure_model import predict_failure_risk
from .ml.inventory_forecast_model import forecast_inventory

MACHINE_IDS = ("M1", "M2", "M3", "M4")

# Deterministic seed snapshot for demo / frontend fallback alignment
_SEED_MACHINES: list[dict[str, Any]] = [
    {
        "machine_id": "M1",
        "temperature_c": 68.2,
        "vibration_mm_s": 2.1,
        "rpm": 1450,
        "operating_hours": 4120.5,
        "status": "NORMAL",
    },
    {
        "machine_id": "M2",
        "temperature_c": 74.8,
        "vibration_mm_s": 3.4,
        "rpm": 1380,
        "operating_hours": 3890.0,
        "status": "NORMAL",
    },
    {
        "machine_id": "M3",
        "temperature_c": 82.1,
        "vibration_mm_s": 4.8,
        "rpm": 1520,
        "operating_hours": 5012.3,
        "status": "WARNING",
    },
    {
        "machine_id": "M4",
        "temperature_c": 98.6,
        "vibration_mm_s": 7.9,
        "rpm": 980,
        "operating_hours": 6234.7,
        "status": "CRITICAL",
    },
]

_SEED_INVENTORY: list[dict[str, Any]] = [
    {"material": "Steel", "current_stock_kg": 4200.0, "daily_usage_kg": 580.0},
    {"material": "Aluminum", "current_stock_kg": 1100.0, "daily_usage_kg": 420.0},
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _inventory_status(days_left: float) -> str:
    if days_left >= 5:
        return "HEALTHY"
    if days_left >= 3:
        return "LOW"
    return "CRITICAL"


def seed_mock_data() -> tuple[list[MachineTelemetry], list[InventoryItem]]:
    """Deterministic sample machines + inventory so the dashboard is always populated."""
    ts = _now_iso()
    machines = []
    for m in _SEED_MACHINES:
        past_faults = 2 if m["machine_id"] == "M4" else (1 if m["machine_id"] == "M3" else 0)
        ml_res = predict_failure_risk({
            "temperature": m["temperature_c"],
            "vibration": m["vibration_mm_s"],
            "rpm": m["rpm"],
            "operating_hours": m["operating_hours"],
            "past_fault_count": past_faults
        })
        machines.append(
            MachineTelemetry(
                machine_id=m["machine_id"],
                timestamp=ts,
                temperature_c=m["temperature_c"],
                vibration_mm_s=m["vibration_mm_s"],
                rpm=m["rpm"],
                operating_hours=m["operating_hours"],
                status=m["status"],
                failure_probability=ml_res["failure_probability"],
                status_tier=ml_res["status_tier"],
                recommended_action=ml_res["recommended_action"],
                engine_status=ml_res["engine_status"]
            )
        )
        
    inventory = []
    for item in _SEED_INVENTORY:
        days_left = round(item["current_stock_kg"] / item["daily_usage_kg"], 2)
        fc_res = forecast_inventory(item["current_stock_kg"], item["daily_usage_kg"], 3.0)
        inventory.append(
            InventoryItem(
                material=item["material"],
                current_stock_kg=item["current_stock_kg"],
                daily_usage_kg=item["daily_usage_kg"],
                days_left=days_left,
                status=_inventory_status(days_left),  # type: ignore[arg-type]
                days_to_stockout=fc_res["days_to_stockout"],
                stockout_probability=fc_res["stockout_probability"],
                reorder_quantity_suggestion=fc_res["reorder_quantity_suggestion"]
            )
        )
    return machines, inventory


def generate_telemetry() -> list[MachineTelemetry]:
    """Generate live-ish telemetry; M4 is often CRITICAL to drive UI warnings."""
    ts = _now_iso()
    machines: list[MachineTelemetry] = []

    for mid in MACHINE_IDS:
        if mid == "M4":
            # ~70% chance CRITICAL so demos reliably show fault state
            critical = random.random() < 0.7
            temp = round(random.uniform(96.0, 102.0) if critical else random.uniform(78.0, 88.0), 1)
            vib = round(random.uniform(6.5, 9.5) if critical else random.uniform(3.0, 5.0), 2)
            rpm = random.randint(900, 1100) if critical else random.randint(1300, 1500)
            status = "CRITICAL" if critical else ("WARNING" if temp > 85 else "NORMAL")
        elif mid == "M3":
            temp = round(random.uniform(78.0, 92.0), 1)
            vib = round(random.uniform(3.5, 6.0), 2)
            rpm = random.randint(1400, 1600)
            status = "WARNING" if temp > 85 or vib > 5.0 else "NORMAL"
        else:
            temp = round(random.uniform(60.0, 80.0), 1)
            vib = round(random.uniform(1.5, 4.0), 2)
            rpm = random.randint(1350, 1550)
            status = "NORMAL"

        op_hours = round(random.uniform(3500, 7000), 1)
        past_faults = 2 if mid == "M4" else (1 if mid == "M3" else 0)
        
        # ML Inference
        ml_res = predict_failure_risk({
            "temperature": temp,
            "vibration": vib,
            "rpm": rpm,
            "operating_hours": op_hours,
            "past_fault_count": past_faults
        })

        machines.append(
            MachineTelemetry(
                machine_id=mid,
                timestamp=ts,
                temperature_c=temp,
                vibration_mm_s=vib,
                rpm=rpm,
                operating_hours=op_hours,
                status=status,  # type: ignore[arg-type]
                failure_probability=ml_res["failure_probability"],
                status_tier=ml_res["status_tier"],
                recommended_action=ml_res["recommended_action"],
                engine_status=ml_res["engine_status"]
            )
        )
    return machines


def generate_inventory() -> list[InventoryItem]:
    """Stock levels with small random jitter around seed values."""
    items: list[InventoryItem] = []
    for base in _SEED_INVENTORY:
        stock = round(base["current_stock_kg"] * random.uniform(0.85, 1.1), 1)
        usage = round(base["daily_usage_kg"] * random.uniform(0.95, 1.05), 1)
        days_left = round(stock / usage, 2) if usage > 0 else 0.0
        
        # ML demand forecasting
        lead_time = 3.0
        fc_res = forecast_inventory(stock, usage, lead_time)
        
        items.append(
            InventoryItem(
                material=base["material"],
                current_stock_kg=stock,
                daily_usage_kg=usage,
                days_left=days_left,
                status=_inventory_status(days_left),  # type: ignore[arg-type]
                days_to_stockout=fc_res["days_to_stockout"],
                stockout_probability=fc_res["stockout_probability"],
                reorder_quantity_suggestion=fc_res["reorder_quantity_suggestion"]
            )
        )
    return items


# --- Rule-based agents (replace with LangGraph / LLM later) -----------------


def machine_agent(machines: list[MachineTelemetry], query: str) -> AgentStep:
    """MachineAgent: detect thermal / vibration anomalies."""
    critical = [m for m in machines if m.status == "CRITICAL"]
    warning = [m for m in machines if m.status == "WARNING"]
    ts = _now_iso()

    if critical:
        m = critical[0]
        fail_pct = min(99, int(70 + (m.temperature_c - 90) * 2 + m.vibration_mm_s))
        return AgentStep(
            agent="MachineAgent",
            message=(
                f"Detected critical thermal threshold on Machine {m.machine_id} "
                f"({m.temperature_c} C, vib {m.vibration_mm_s} mm/s). "
                f"High failure probability ({fail_pct}%). Pushing alert to Maintenance."
            ),
            timestamp=ts,
        )
    if warning:
        m = warning[0]
        return AgentStep(
            agent="MachineAgent",
            message=(
                f"Machine {m.machine_id} elevated: {m.temperature_c} C / "
                f"{m.vibration_mm_s} mm/s. Monitoring; no CRITICAL trip yet. Query: \"{query[:80]}\""
            ),
            timestamp=ts,
        )
    return AgentStep(
        agent="MachineAgent",
        message="All machines within normal operating envelope. No thermal or vibration anomalies detected.",
        timestamp=ts,
    )


def maintenance_agent(machines: list[MachineTelemetry], inventory: list[InventoryItem]) -> AgentStep:
    """MaintenanceAgent: priority + spare parts + shift window."""
    # Mock spare-parts availability
    spare_parts_available = True
    critical = any(m.status == "CRITICAL" for m in machines)
    low_material = next((i for i in inventory if i.status in ("LOW", "CRITICAL")), None)
    ts = _now_iso()

    if critical and spare_parts_available:
        msg = (
            "Verified spare parts availability in inventory. "
            "Scheduled preventive maintenance work order for Shift B."
        )
        if low_material:
            msg += f" Note: {low_material.material} stock is {low_material.status} ({low_material.days_left} days left)."
        return AgentStep(agent="MaintenanceAgent", message=msg, timestamp=ts)

    if critical and not spare_parts_available:
        return AgentStep(
            agent="MaintenanceAgent",
            message="CRITICAL machine flagged but spare kit unavailable. Escalating procurement and holding Shift B slot.",
            timestamp=ts,
        )

    return AgentStep(
        agent="MaintenanceAgent",
        message="No urgent work orders. Routine inspection window remains on next planned downtime.",
        timestamp=ts,
    )


def production_agent(machines: list[MachineTelemetry], query: str) -> AgentStep:
    """ProductionAgent: reroute orders away from CRITICAL assets."""
    critical_ids = [m.machine_id for m in machines if m.status == "CRITICAL"]
    healthy = [m.machine_id for m in machines if m.status == "NORMAL"]
    ts = _now_iso()
    target = healthy[0] if healthy else "M2"

    if critical_ids:
        src = critical_ids[0]
        return AgentStep(
            agent="ProductionAgent",
            message=(
                f"Shifted ongoing batch queue for Order #A102 from Machine {src} "
                f"to Machine {target} to prevent downtime delays."
            ),
            timestamp=ts,
        )

    order_hint = "Order #A102" if "order" in query.lower() or "a102" in query.lower() else "current batch queue"
    return AgentStep(
        agent="ProductionAgent",
        message=f"{order_hint} remains on primary line. Capacity check passed; no reroute required.",
        timestamp=ts,
    )


def supervisor_agent(steps: list[AgentStep], query: str) -> AgentStep:
    """SupervisorAgent: compose final summary for the control room."""
    ts = _now_iso()
    acted = any("CRITICAL" in s.message or "Shifted" in s.message or "Scheduled" in s.message for s in steps)
    if acted:
        message = (
            "Action fully executed. Production line adjusted. Maintenance dispatch logged. "
            f"Supervisor closed query: \"{query[:100]}\""
        )
    else:
        message = (
            "No emergency actions required. Line stable. "
            f"Supervisor acknowledged query: \"{query[:100]}\""
        )
    return AgentStep(agent="SupervisorAgent", message=message, timestamp=ts)


def run_orchestration(query: str) -> OrchestrateResponse:
    """
    Run the multi-agent pipeline against latest simulated plant state.
    """
    machines = generate_telemetry()
    inventory = generate_inventory()

    steps: list[AgentStep] = []
    steps.append(machine_agent(machines, query))
    steps.append(maintenance_agent(machines, inventory))
    steps.append(production_agent(machines, query))
    steps.append(supervisor_agent(steps, query))

    critical = [m.machine_id for m in machines if m.status == "CRITICAL"]
    if critical:
        summary = (
            f"Orchestration complete for \"{query}\". "
            f"Critical asset(s) {', '.join(critical)} handled: maintenance scheduled, "
            "Order #A102 rerouted, supervisor sign-off recorded."
        )
    else:
        summary = (
            f"Orchestration complete for \"{query}\". "
            "Plant state nominal; agents reported no emergency interventions."
        )

    # Calculate plant health score
    warning_critical_count = sum(1 for m in machines if m.status in ("WARNING", "CRITICAL"))
    f_machines_pct = 1.0 - (warning_critical_count / len(machines)) if machines else 1.0
    avg_fail_prob = sum(m.failure_probability or 0.0 for m in machines) / len(machines) if machines else 0.0
    avg_stockout_prob = sum(i.stockout_probability or 0.0 for i in inventory) / len(inventory) if inventory else 0.0
    
    plant_health_score = round(100 * (0.4 * f_machines_pct + 0.3 * (1.0 - avg_fail_prob) + 0.3 * (1.0 - avg_stockout_prob)), 1)
    plant_health_score = max(0.0, min(100.0, plant_health_score))

    return OrchestrateResponse(steps=steps, summary=summary, plant_health_score=plant_health_score)
