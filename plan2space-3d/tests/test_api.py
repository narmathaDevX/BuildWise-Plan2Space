"""Comprehensive integration tests for Plan2Space 3D REST API."""

import time
from fastapi.testclient import TestClient
from app.main import app
from tests.test_geometry import create_sample_rectangular_plan

client = TestClient(app)


def test_floor_plan_crud_and_conversion_pipeline():
    # 1. Create Floor Plan via JSON
    plan_data = create_sample_rectangular_plan()
    create_req = {
        "name": "Integration Test Plan",
        "geometry": plan_data.model_dump(),
    }
    res_create = client.post("/api/v1/floor-plans", json=create_req)
    assert res_create.status_code == 201
    plan_resp = res_create.json()
    plan_id = plan_resp["id"]
    assert plan_id is not None
    assert len(plan_resp["geometry"]["walls"]) == 4

    # 2. Get Floor Plan
    res_get = client.get(f"/api/v1/floor-plans/{plan_id}")
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "Integration Test Plan"

    # 3. Update Geometry
    geom_to_update = plan_resp["geometry"]
    geom_to_update["walls"][0]["height"] = 3.0
    res_put = client.put(f"/api/v1/floor-plans/{plan_id}/geometry", json=geom_to_update)
    assert res_put.status_code == 200
    assert res_put.json()["geometry"]["walls"][0]["height"] == 3.0

    # 4. Calibrate Scale
    res_cal = client.post(
        f"/api/v1/floor-plans/{plan_id}/calibrate",
        json={
            "method": "line",
            "point_a_px": [100.0, 100.0],
            "point_b_px": [300.0, 100.0],
            "known_length_m": 4.0,
        },
    )
    assert res_cal.status_code == 200
    # 200px / 4m = 50 px/m
    assert abs(res_cal.json()["geometry"]["scale"]["pixels_per_metre"] - 50.0) < 0.1
    assert res_cal.json()["geometry"]["scale"]["source"] == "user_provided"

    # 5. Trigger Conversion Job
    conv_req = {
        "floor_plan_id": plan_id,
        "parameters": {
            "default_wall_height": 2.8,
            "exterior_wall_thickness": 0.23,
            "include_floor": True,
            "export_formats": ["glb", "obj"],
        },
    }
    res_conv = client.post("/api/v1/conversions", json=conv_req)
    assert res_conv.status_code == 202
    job_id = res_conv.json()["id"]

    # 6. Poll for completion (in-process thread pool completes quickly)
    max_wait = 10.0
    start = time.time()
    job_done = False
    final_job = None

    while time.time() - start < max_wait:
        res_poll = client.get(f"/api/v1/conversions/{job_id}")
        assert res_poll.status_code == 200
        final_job = res_poll.json()
        if final_job["status"] in ("completed", "failed"):
            job_done = True
            break
        time.sleep(0.1)

    assert job_done, f"Job did not finish in time: {final_job}"
    assert final_job["status"] == "completed"
    assert final_job["progress"] == 1.0
    assert "glb" in final_job["artifacts"]
    assert "obj" in final_job["artifacts"]
    assert final_job["mesh_stats"]["vertex_count"] > 0

    # 7. Download GLB Model
    res_model_glb = client.get(f"/api/v1/conversions/{job_id}/model?format=glb")
    assert res_model_glb.status_code == 200
    assert len(res_model_glb.content) > 0
    assert res_model_glb.headers["content-type"] == "model/gltf-binary"

    # 8. Download OBJ Model
    res_model_obj = client.get(f"/api/v1/conversions/{job_id}/model?format=obj")
    assert res_model_obj.status_code == 200
    assert len(res_model_obj.content) > 0

    # 9. Get Conversion Preview
    res_prev = client.get(f"/api/v1/conversions/{job_id}/preview")
    assert res_prev.status_code == 200
    assert res_prev.json()["status"] == "completed"

    # 10. Delete Floor Plan
    res_del = client.delete(f"/api/v1/floor-plans/{plan_id}")
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True
