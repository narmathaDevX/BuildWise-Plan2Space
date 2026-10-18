from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.init_db import init_db

client = TestClient(app)


def test_saved_plans_crud():
    # Ensure DB is seeded
    init_db()

    # 1. Fetch saved plans for guest user
    res = client.get("/api/plans/saved")
    assert res.status_code == 200
    data = res.json()
    assert "saved_plans" in data
    assert data["count"] >= 1

    initial_count = data["count"]

    # 2. Save a new liked plan
    new_plan_id = "test_custom_liked_plan_001"
    sample_plan = {
        "plan_id": new_plan_id,
        "title": "Custom Client Duplex Plan",
        "notes": "Spacious family living with open kitchen and puja alcove.",
        "plan": {
            "plan_id": new_plan_id,
            "title": "Custom Client Duplex Plan",
            "score": 93.4,
            "floors": [{"rooms": [{"id": "living", "name": "Living Room", "polygon": [[0, 0], [15, 0], [15, 20], [0, 20]]}]}],
            "details": {"total_built_up": 2100.0},
        },
        "form": {
            "width": 35,
            "length": 60,
            "facing": "North",
            "bedrooms": 4,
            "bathrooms": 3,
            "floors": 2,
            "quality": "Premium",
            "budget": 5500000,
        },
        "built_up_area": 2100.0,
        "estimated_cost": 5200000.0,
        "score": 93.4,
    }

    create_res = client.post("/api/plans/saved", json=sample_plan)
    assert create_res.status_code in (200, 201)
    saved_obj = create_res.json()["saved_plan"]
    assert saved_obj["plan_id"] == new_plan_id
    assert saved_obj["title"] == "Custom Client Duplex Plan"
    assert saved_obj["built_up_area"] == 2100.0
    assert "cost_breakdown" in saved_obj
    assert saved_obj["cost_breakdown"] is not None
    assert "materials_breakdown" in saved_obj
    assert saved_obj["materials_breakdown"] is not None
    assert len(saved_obj["materials_breakdown"]["materials"]) > 0
    record_id = saved_obj["id"]

    # 3. Retrieve saved plan by record ID
    get_res = client.get(f"/api/plans/saved/{record_id}")
    assert get_res.status_code == 200
    assert get_res.json()["saved_plan"]["id"] == record_id

    # 4. Update title and notes
    update_res = client.put(
        f"/api/plans/saved/{record_id}",
        json={"title": "Client Approved Duplex 4BHK", "notes": "Approved by client for DTCP sanction."},
    )
    assert update_res.status_code == 200
    assert update_res.json()["saved_plan"]["title"] == "Client Approved Duplex 4BHK"
    assert update_res.json()["saved_plan"]["notes"] == "Approved by client for DTCP sanction."

    # 5. Verify total count increased
    list_res = client.get("/api/plans/saved")
    assert list_res.status_code == 200
    assert list_res.json()["count"] == initial_count + 1

    # 6. Delete saved plan
    del_res = client.delete(f"/api/plans/saved/{record_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Verify deleted
    get_after_del = client.get(f"/api/plans/saved/{record_id}")
    assert get_after_del.status_code == 404
