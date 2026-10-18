"""Tests for BuildWise 3D Model Generation endpoints."""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_generate_3d_plan_endpoint():
    sample_plan = {
        "plan_id": "test_bw_3d_01",
        "floors": [
            {
                "level": 0,
                "name": "Ground Floor",
                "rooms": [
                    {"id": "living", "name": "Living Room", "type": "living", "x": 0.0, "y": 0.0, "width": 16.0, "height": 14.0},
                    {"id": "kitchen", "name": "Kitchen", "type": "kitchen", "x": 16.0, "y": 0.0, "width": 12.0, "height": 14.0},
                    {"id": "master_bed", "name": "Master Bedroom", "type": "master_bedroom", "x": 0.0, "y": 14.0, "width": 14.0, "height": 16.0},
                    {"id": "attached_bath", "name": "Master Bath", "type": "attached_bathroom", "x": 14.0, "y": 14.0, "width": 8.0, "height": 10.0},
                ],
            }
        ],
    }

    res = client.post("/api/3d/generate", json={"plan": sample_plan, "options": {"include_floor": True}})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "model_url" in data
    assert "stats" in data
    assert data["stats"]["vertex_count"] > 0
    assert "walls" in data["stats"]["layers"]
    assert "floor" in data["stats"]["layers"]

    # Verify downloading the generated GLB model
    model_url = data["model_url"]
    res_model = client.get(model_url)
    assert res_model.status_code == 200
    assert len(res_model.content) > 1000
    assert res_model.headers["content-type"] == "model/gltf-binary"


def test_generate_3d_with_roof_types():
    sample_plan = {
        "plan_id": "test_bw_3d_roof_01",
        "floors": [
            {
                "level": 0,
                "name": "Ground Floor",
                "rooms": [
                    {"id": "living", "name": "Living Room", "type": "living", "x": 0.0, "y": 0.0, "width": 18.0, "height": 14.0},
                    {"id": "bedroom", "name": "Bedroom", "type": "bedroom", "x": 0.0, "y": 14.0, "width": 14.0, "height": 14.0},
                ],
            }
        ],
    }

    res = client.post("/api/3d/generate", json={"plan": sample_plan, "options": {"include_roof": True}})
    assert res.status_code == 200
    data = res.json()
    assert "roof" in data["stats"]["layers"]
    assert "roof_flat" in data["stats"]["layers"]
    assert "roof_tiles" in data["stats"]["layers"]
