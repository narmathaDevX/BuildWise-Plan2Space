"""Tests for saved plans, history, and materials/cost estimation endpoints."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_saved_plans_and_estimation_lifecycle():
    # 1. Create a sample floor plan
    geom_payload = {
        "name": "Estimate Villa Plan",
        "geometry": {
            "name": "Estimate Villa Plan",
            "walls": [
                {"id": "w1", "start": {"x": 0, "y": 0}, "end": {"x": 10, "y": 0}, "thickness": 0.23, "height": 2.8, "is_exterior": True},
                {"id": "w2", "start": {"x": 10, "y": 0}, "end": {"x": 10, "y": 8}, "thickness": 0.23, "height": 2.8, "is_exterior": True},
                {"id": "w3", "start": {"x": 10, "y": 8}, "end": {"x": 0, "y": 8}, "thickness": 0.23, "height": 2.8, "is_exterior": True},
                {"id": "w4", "start": {"x": 0, "y": 8}, "end": {"x": 0, "y": 0}, "thickness": 0.23, "height": 2.8, "is_exterior": True},
            ],
            "openings": [
                {"id": "d1", "wall_id": "w1", "type": "door", "position_along_wall": 3.0, "width": 1.0, "height": 2.1, "sill_height": 0.0},
                {"id": "win1", "wall_id": "w3", "type": "window", "position_along_wall": 4.0, "width": 1.5, "height": 1.2, "sill_height": 0.9},
            ],
            "rooms": [
                {"id": "r1", "name": "Grand Hall", "polygon": [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 8}, {"x": 0, "y": 8}], "area_sqm": 80.0},
            ],
            "roof": {
                "type": "gabled",
                "thickness": 0.15,
                "pitch_deg": 20.0,
                "overhang": 0.3,
            },
        },
    }

    create_res = client.post("/api/v1/floor-plans", json=geom_payload)
    assert create_res.status_code == 201
    plan_id = create_res.json()["id"]

    # 2. List saved plans
    list_res = client.get("/api/v1/saved-plans")
    assert list_res.status_code == 200
    plans = list_res.json()
    assert any(p["id"] == plan_id for p in plans)

    # 3. Get detailed materials requirement and cost estimate
    est_res = client.get(f"/api/v1/saved-plans/{plan_id}/estimate")
    assert est_res.status_code == 200
    est = est_res.json()

    assert est["plan_id"] == plan_id
    assert "cost_summary" in est
    assert est["cost_summary"]["grand_total_inr"] > 0
    assert est["cost_summary"]["grand_total_usd"] > 0

    assert "bill_of_materials" in est
    bom = est["bill_of_materials"]
    assert len(bom) > 5

    # Check key materials are present
    material_names = [m["name"] for m in bom]
    assert any("Bricks" in name for name in material_names)
    assert any("Cement" in name for name in material_names)
    assert any("Sand" in name for name in material_names)
    assert any("Steel" in name for name in material_names)
    assert any("Tiles" in name for name in material_names)

    # 4. Save metadata / bookmark plan
    save_meta_res = client.post(
        f"/api/v1/saved-plans/{plan_id}/save",
        json={"name": "Updated Villa Plan", "client_name": "Test Client", "budget_inr": 2500000.0},
    )
    assert save_meta_res.status_code == 200

    # 5. Clean up
    del_res = client.delete(f"/api/v1/saved-plans/{plan_id}")
    assert del_res.status_code == 200
