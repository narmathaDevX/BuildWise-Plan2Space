import pytest
from fastapi.testclient import TestClient

from backend.app.db.init_db import init_db
from backend.app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


def test_validation_error_returns_string_detail():
    # Sending invalid plot dimensions triggers 422
    payload = {
        "request": {
            "units": "ft",
            "plot": {"width": 5.0, "depth": 5.0},  # Below 15 ft minimum
            "road_side": "N",
            "setbacks": {"front": 5, "rear": 3, "left": 3, "right": 3},
            "floors": 1,
            "rooms": [],
        }
    }
    res = client.post("/api/generate", json=payload)
    assert res.status_code == 422
    data = res.json()
    # CRITICAL INVARIANT: detail must be a string, not an object or array
    assert isinstance(data["detail"], str)
    assert len(data["detail"]) > 0


def test_generate_plans_api():
    payload = {
        "request": {
            "units": "ft",
            "plot": {"width": 40.0, "depth": 60.0},
            "road_side": "N",
            "setbacks": {"front": 5, "rear": 3, "left": 3, "right": 3},
            "floors": 1,
            "rooms": [
                {"id": "living", "type": "living", "min_area": 120},
                {"id": "kitchen", "type": "kitchen", "min_area": 50},
                {"id": "dining", "type": "dining", "min_area": 70},
                {"id": "master", "type": "master_bedroom", "min_area": 120},
                {"id": "master_bath", "type": "attached_bathroom", "min_area": 30, "attached_to": "master"},
            ],
            "solver_options": {"num_alternatives": 2, "seed": 42},
        }
    }
    res = client.post("/api/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["plans"]) >= 1
    assert "plan_id" in data["plans"][0]


def test_affordability_api():
    payload = {
        "plot_width": 40,
        "plot_depth": 60,
        "floors": 1,
        "bedrooms": 3,
        "bathrooms": 2,
        "quality": "Standard",
        "location": "Tamil Nadu",
        "budget": 3500000,
        "monthly_budget": 300000,
    }
    res = client.post("/api/estimate/affordability", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "affordability" in data
    assert data["affordability"]["label"] in {"Good", "Tight", "Insufficient"}
    assert "approx_built_up_area" in data


def test_cost_api():
    payload = {
        "total_built_up_area": 1850,
        "quality": "Standard",
        "location": "Tamil Nadu",
        "floors": 1,
        "budget": 3500000,
    }
    res = client.post("/api/estimate/cost", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_cost"] > 0
    assert len(data["breakdown"]) == 5
    assert sum(b["amount"] for b in data["breakdown"]) == data["total_cost"]
    assert sum(b["percentage"] for b in data["breakdown"]) == 100


def test_schedule_api():
    payload = {
        "total_cost": 3250000,
        "monthly_budget": 300000,
        "quality": "Standard",
        "floors": 1,
        "built_up_area": 1850,
    }
    res = client.post("/api/estimate/schedule", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["stages"]) == 7
    assert len(data["months"]) > 0


def test_project_summary_and_construction_and_report_endpoints():
    # Summary
    s_res = client.get("/api/projects/current/summary")
    assert s_res.status_code == 200
    s_data = s_res.json()
    assert s_data["has_project"] is True
    assert s_data["name"] == "My Dream Home"
    assert len(s_data["timeline_steps"]) == 5

    # Construction
    c_res = client.get("/api/projects/current/construction?month=2")
    assert c_res.status_code == 200
    c_data = c_res.json()
    assert len(c_data["stages"]) == 7
    assert len(c_data["insights"]) == 3
    assert c_data["overall_progress"] >= 0

    # Report
    r_res = client.get("/api/projects/current/report")
    assert r_res.status_code == 200
    r_data = r_res.json()
    assert len(r_data["cost_breakdown"]) == 5
    assert len(r_data["status_grid"]) == 4


def test_materials_endpoints():
    m_res = client.get("/api/projects/current/materials")
    assert m_res.status_code == 200
    m_data = m_res.json()
    assert m_data["total_count"] == 6
    mat_id = m_data["materials"][0]["id"]

    # Toggle purchased flag
    p_res = client.patch(
        f"/api/projects/current/materials/{mat_id}",
        json={"purchased": False},
    )
    assert p_res.status_code == 200
    assert p_res.json()["purchased"] is False


def test_ml_status_honest_report():
    res = client.get("/api/ml/status")
    assert res.status_code == 200
    data = res.json()
    assert data["model_type"] == "formula_based"
    assert data["artifact_loaded"] is False
    assert data["status"] == "transparent_formula"
