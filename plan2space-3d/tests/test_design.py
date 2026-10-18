"""Comprehensive unit and integration tests for Interior Design Studio API."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.storage.job_store import storage
from tests.test_geometry import create_sample_rectangular_plan

client = TestClient(app)


@pytest.fixture
def completed_conversion():
    """Sets up a real floor plan and completed conversion in storage for testing."""
    plan_data = create_sample_rectangular_plan()
    plan_resp = storage.save_floor_plan(
        plan_id="fp_design_test",
        name="Design Studio Test House",
        geometry=plan_data,
    )

    from app.schemas.responses import ConversionJobResponse
    from app.schemas.requests import BuildParameters
    from app.storage.job_store import utc_now_iso

    job = ConversionJobResponse(
        id="job_design_test_1",
        floor_plan_id=plan_resp.id,
        status="completed",
        progress=1.0,
        current_step="Completed",
        created_at=utc_now_iso(),
        completed_at=utc_now_iso(),
        parameters=BuildParameters(include_floor=True),
        artifacts={"glb": "/models/job_design_test_1.glb"},
    )
    storage.save_job(job)
    return job


def test_design_catalogue_endpoint():
    res = client.get("/api/v1/design-catalogue")
    assert res.status_code == 200
    data = res.json()

    assert "categories" in data
    assert len(data["categories"]) == 7

    cat_ids = [c["category_id"] for c in data["categories"]]
    assert "beds" in cat_ids
    assert "seating" in cat_ids
    assert "storage" in cat_ids
    assert "tables" in cat_ids
    assert "electronics" in cat_ids
    assert "bathroom" in cat_ids
    assert "decor" in cat_ids

    # Check color presets: at least 24
    assert "color_presets" in data
    assert len(data["color_presets"]) >= 24

    # Verify each color preset has valid 7-char hex
    for cp in data["color_presets"]:
        assert cp["hex"].startswith("#")
        assert len(cp["hex"]) == 7


def test_capabilities_includes_design_studio():
    res = client.get("/api/v1/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert data.get("design_studio") is True


def test_conversion_geometry_endpoint(completed_conversion):
    res = client.get(f"/api/v1/conversions/{completed_conversion.id}/geometry")
    assert res.status_code == 200
    data = res.json()
    assert data["job_id"] == completed_conversion.id
    assert "geometry" in data
    assert "wall_faces_lookup" in data
    assert "w_south" in data["wall_faces_lookup"]


def test_design_crud_lifecycle(completed_conversion):
    job_id = completed_conversion.id

    # 1. Initially no design -> 404
    storage.delete_design(job_id)
    res_get_init = client.get(f"/api/v1/conversions/{job_id}/design")
    assert res_get_init.status_code == 404

    # 2. Save valid design
    design_payload = {
        "conversion_id": job_id,
        "walls": [
            {"wall_id": "w_south", "face": "pos_normal", "color": "#F8F7F2", "finish": "matte"},
            {"wall_id": "w_north", "face": "all", "color": "#3B82F6", "finish": "satin"},
        ],
        "floors": [
            {"room_id": "rm_main", "color": "#EDE6D6", "finish": "matte"},
        ],
        "ceiling": {
            "color": "#FFFFFF",
            "finish": "matte",
        },
        "furniture": [
            {
                "item_type": "bed",
                "variant": "double",
                "category": "beds",
                "position": [2.5, 0.0, -3.0],
                "rotation": [0.0, 1.57, 0.0],
                "scale": [1.0, 1.0, 1.0],
                "colors": {"primary": "#EDE6D6", "secondary": "#334155"},
                "custom_label": "Master Bed",
            }
        ],
    }

    res_put = client.put(f"/api/v1/conversions/{job_id}/design", json=design_payload)
    assert res_put.status_code == 200
    saved = res_put.json()
    assert saved["conversion_id"] == job_id
    assert len(saved["walls"]) == 2
    assert len(saved["furniture"]) == 1
    assert saved["furniture"][0]["custom_label"] == "Master Bed"
    assert saved["updated_at"] is not None

    # 3. Retrieve design
    res_get = client.get(f"/api/v1/conversions/{job_id}/design")
    assert res_get.status_code == 200
    retrieved = res_get.json()
    assert retrieved["walls"][0]["wall_id"] == "w_south"
    assert retrieved["walls"][0]["color"] == "#F8F7F2"

    # 4. Delete design -> 200
    res_del = client.delete(f"/api/v1/conversions/{job_id}/design")
    assert res_del.status_code == 200

    # 5. Retrieve after delete -> 404
    res_get_after = client.get(f"/api/v1/conversions/{job_id}/design")
    assert res_get_after.status_code == 404


def test_design_validation_invalid_wall_id(completed_conversion):
    job_id = completed_conversion.id
    invalid_payload = {
        "conversion_id": job_id,
        "walls": [
            {"wall_id": "w_non_existent", "face": "all", "color": "#FFFFFF"},
        ],
        "furniture": [],
    }
    res = client.put(f"/api/v1/conversions/{job_id}/design", json=invalid_payload)
    assert res.status_code == 422
    assert "Wall ID 'w_non_existent' does not exist" in res.json()["detail"]


def test_design_validation_invalid_hex_color(completed_conversion):
    job_id = completed_conversion.id
    invalid_payload = {
        "conversion_id": job_id,
        "walls": [
            {"wall_id": "w_south", "face": "all", "color": "blue"},
        ],
        "furniture": [],
    }
    res = client.put(f"/api/v1/conversions/{job_id}/design", json=invalid_payload)
    assert res.status_code == 422


def test_design_validation_nan_position(completed_conversion):
    job_id = completed_conversion.id
    # Test invalid position via null or string in position array
    invalid_raw_json = (
        f'{{"conversion_id": "{job_id}", "walls": [], "furniture": ['
        f'{{"item_type": "chair", "variant": "dining_chair", "category": "seating", '
        f'"position": [0.0, null, 0.0], "rotation": [0.0, 0.0, 0.0]}}]}}'
    )
    res = client.put(
        f"/api/v1/conversions/{job_id}/design",
        content=invalid_raw_json,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422


def test_design_conflict_on_non_completed_job():
    # Setup job in 'processing' status
    from app.schemas.responses import ConversionJobResponse
    from app.schemas.requests import BuildParameters
    from app.storage.job_store import utc_now_iso

    job = ConversionJobResponse(
        id="job_in_progress",
        floor_plan_id="fp_design_test",
        status="processing",
        progress=0.5,
        created_at=utc_now_iso(),
        parameters=BuildParameters(),
    )
    storage.save_job(job)

    res_get = client.get(f"/api/v1/conversions/{job.id}/design")
    assert res_get.status_code == 409

    res_put = client.put(
        f"/api/v1/conversions/{job.id}/design",
        json={"conversion_id": job.id, "walls": [], "furniture": []},
    )
    assert res_put.status_code == 409
