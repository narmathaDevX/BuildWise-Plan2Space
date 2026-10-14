"""Tests for Tamil Nadu real-world practical engines:

1. TNCDBR 2019 statutory compliance evaluator
2. Pre-construction & ancillary packages calculator
3. 8-stage contractor milestone payment escrow and 5% defect liability retention
4. Tamil Nadu district pricing, wage rates, and bank loan dossier integration
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ancillary import calculate_ancillary_costs
from backend.app.services.compliance import evaluate_tncdbr_compliance
from backend.app.services.milestones import generate_milestone_schedule

client = TestClient(app)


def test_tncdbr_compliance_evaluator():
    # 40 x 60 plot = 2400 sq ft, 1850 sq ft built up, 1 floor
    res = evaluate_tncdbr_compliance(
        plot_width=40.0,
        plot_depth=60.0,
        built_up_area=1850.0,
        ground_built_up_area=1500.0,
        floors=1,
        front_setback=5.0,
        rear_setback=5.0,
        side_left_setback=3.0,
        side_right_setback=3.0,
        road_width_feet=30.0,
    )

    assert "is_statutory_compliant" in res
    assert res["plot_summary"]["plot_area_sqft"] == 2400.0
    # 1500 / 2400 = 62.5% <= 70.0%
    assert res["plot_summary"]["ground_coverage_pct"] <= 70.0
    # FSI: 1850 / 2400 = 0.77 <= 1.50
    assert res["plot_summary"]["fsi_actual"] <= res["plot_summary"]["fsi_permissible"]
    assert res["is_statutory_compliant"] is True

    # RWH calculation (ground cover * 1.25)
    assert res["rwh_mandate"]["required_recharge_litres"] >= 1500
    assert len(res["checks"]) >= 5


def test_ancillary_costs_calculation():
    res = calculate_ancillary_costs(built_up_area=1850.0, plot_area=2400.0)
    assert res["currency"] == "INR"
    assert res["total_ancillary_cost"] > 500000  # Should be around 7-9 lakhs
    assert len(res["items"]) >= 7

    # Check key packages exist
    keys = {item["key"] for item in res["items"]}
    assert "tneb_power_connection" in keys
    assert "borewell_pumping_system" in keys
    assert "dtcp_cmda_approval" in keys
    assert "underground_sump_septic_tank" in keys


def test_milestone_payment_schedule():
    civil_cost = 3250000.0
    schedule = generate_milestone_schedule(civil_cost=civil_cost, current_completed_stages=2)

    assert schedule["total_civil_contract"] == civil_cost
    assert len(schedule["milestones"]) == 8

    # Verify percentages sum to exactly 100%
    total_pct = sum(m["pct_share"] for m in schedule["milestones"])
    assert total_pct == pytest.approx(100.0)

    # Verify 5% retention fund on stage 8
    stage_8 = schedule["milestones"][7]
    assert stage_8["is_retention"] is True
    assert stage_8["pct_share"] == 5.0
    assert schedule["retention_reserve_amount"] == int(round(civil_cost * 0.05))

    # Verify inspection gates are present for every milestone
    for m in schedule["milestones"]:
        assert len(m["inspection_gate"]) > 10


def test_api_compliance_endpoint():
    payload = {
        "plot_width": 40.0,
        "plot_depth": 60.0,
        "built_up_area": 1850.0,
        "ground_built_up_area": 1400.0,
        "floors": 1,
        "front_setback": 5.0,
        "rear_setback": 5.0,
        "side_left_setback": 3.0,
        "side_right_setback": 3.0,
        "road_width_feet": 30.0,
    }
    response = client.post("/api/estimate/compliance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_statutory_compliant"] is True
    assert data["rwh_mandate"]["required_recharge_litres"] > 0


def test_api_ancillary_endpoint():
    payload = {
        "built_up_area": 1850.0,
        "plot_area": 2400.0,
    }
    response = client.post("/api/estimate/ancillary", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_ancillary_cost"] > 0
    assert len(data["items"]) >= 7


def test_api_districts_endpoint():
    response = client.get("/api/projects/current/materials/districts")
    assert response.status_code == 200
    data = response.json()
    assert "districts" in data
    assert "chennai" in data["districts"]
    assert "coimbatore" in data["districts"]
    assert "madurai" in data["districts"]
    assert "trichy" in data["districts"]
    assert "salem" in data["districts"]

    # Verify labor wages schedule is present
    cbe = data["districts"]["coimbatore"]
    assert "labor_wages_per_day" in cbe
    assert cbe["labor_wages_per_day"]["head_mason"] >= 900


def test_api_project_report_bank_dossier():
    response = client.get("/api/projects/current/report")
    assert response.status_code == 200
    data = response.json()

    assert "bank_loan_dossier" in data
    dossier = data["bank_loan_dossier"]
    assert dossier["all_inclusive_project_cost"] > 0
    assert dossier["max_bank_loan_eligibility_80pct"] > 0
    assert len(dossier["stage_disbursements"]) == 8
    assert "compliance_summary" in data
    assert "ancillary_breakdown" in data
