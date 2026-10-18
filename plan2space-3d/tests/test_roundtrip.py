"""Round-trip verification test: Image upload -> Detect -> Edit in 2D -> 3D Generate -> Updated Model."""

import time
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
SAMPLES_DIR = Path(__file__).resolve().parent.parent / "sample_floorplans"


def test_roundtrip_detection_edit_and_regeneration():
    # 1. Upload sample floorplan image
    img_path = SAMPLES_DIR / "simple_rect" / "floorplan.png"
    with open(img_path, "rb") as f:
        res_upload = client.post(
            "/api/v1/floor-plans",
            files={"file": ("plan.png", f, "image/png")},
            data={"name": "Roundtrip Test Plan", "scale_pixels_per_metre": "50.0"},
        )
    assert res_upload.status_code == 201
    plan_data = res_upload.json()
    plan_id = plan_data["id"]
    initial_wall_count = len(plan_data["geometry"]["walls"])
    assert initial_wall_count >= 4

    # 2. Trigger initial 3D conversion
    res_job1 = client.post(
        "/api/v1/conversions",
        json={"floor_plan_id": plan_id, "parameters": {"default_wall_height": 2.7}},
    )
    assert res_job1.status_code == 202
    job1_id = res_job1.json()["id"]

    for _ in range(50):
        poll1 = client.get(f"/api/v1/conversions/{job1_id}").json()
        if poll1["status"] in ("completed", "failed"):
            break
        time.sleep(0.1)
    assert poll1["status"] == "completed"
    v_count1 = poll1["mesh_stats"]["vertex_count"]

    # 3. Simulate user 2D Editor correction: Add an interior partition wall
    updated_geom = plan_data["geometry"]
    new_wall = {
        "id": "w_partition_test",
        "start": {"x": 5.0, "y": 0.0},
        "end": {"x": 5.0, "y": 8.0},
        "thickness": 0.15,
        "height": 2.7,
        "is_exterior": False,
        "source": "user_provided",
    }
    updated_geom["walls"].append(new_wall)

    res_put = client.put(f"/api/v1/floor-plans/{plan_id}/geometry", json=updated_geom)
    assert res_put.status_code == 200
    assert len(res_put.json()["geometry"]["walls"]) == initial_wall_count + 1

    # 4. Trigger second 3D conversion with edited geometry
    res_job2 = client.post(
        "/api/v1/conversions",
        json={"floor_plan_id": plan_id, "parameters": {"default_wall_height": 2.7}},
    )
    job2_id = res_job2.json()["id"]

    for _ in range(50):
        poll2 = client.get(f"/api/v1/conversions/{job2_id}").json()
        if poll2["status"] in ("completed", "failed"):
            break
        time.sleep(0.1)
    assert poll2["status"] == "completed"
    v_count2 = poll2["mesh_stats"]["vertex_count"]

    # The updated 3D mesh must contain additional geometry from the new partition wall
    assert v_count2 > v_count1

    # Verify model download
    res_glb = client.get(f"/api/v1/conversions/{job2_id}/model?format=glb")
    assert res_glb.status_code == 200
    assert len(res_glb.content) > 1000
