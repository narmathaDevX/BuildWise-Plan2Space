"""Smoke test script verifying Plan2Space 3D end-to-end functionality.
Can run standalone: python scripts/smoke_test.py [BASE_URL]
If BASE_URL is not given, runs in-process using TestClient.
"""

import sys
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from app.main import app

def run_smoke_test(base_url: str = None):
    print("=" * 60)
    print("Plan2Space 3D — Comprehensive Smoke Test")
    print("=" * 60)

    if base_url:
        print(f"Connecting to running server at: {base_url}")
        client = httpx.Client(base_url=base_url, timeout=30.0)
    else:
        print("Running in-process test client...")
        from fastapi.testclient import TestClient
        client = TestClient(app)

    def get(path): return client.get(path)
    def post(path, **kw): return client.post(path, **kw)

    # 1. Health check
    print("\n[1/6] Checking /health ...")
    r = get("/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print(f"  OK: {r.json()}")

    # 2. Capabilities check
    print("\n[2/6] Checking /api/v1/capabilities ...")
    r = get("/api/v1/capabilities")
    assert r.status_code == 200, f"Capabilities failed: {r.text}"
    caps = r.json()
    print(f"  Version: {caps['version']}")
    print(f"  Geometry Engine: {caps['geometry_engine']}")
    print(f"  Coordinate 3D: {caps['coordinate_system']['3D_glTF']}")

    # 3. Create Floor Plan
    print("\n[3/6] Creating 10m x 8m Floor Plan ...")
    plan_payload = {
        "name": "Smoke Test House",
        "geometry": {
            "id": "fp_smoke_test",
            "name": "Smoke Test House",
            "walls": [
                {"id": "w1", "start": {"x": 0, "y": 0}, "end": {"x": 10, "y": 0}, "thickness": 0.23, "height": 2.7, "is_exterior": True},
                {"id": "w2", "start": {"x": 10, "y": 0}, "end": {"x": 10, "y": 8}, "thickness": 0.23, "height": 2.7, "is_exterior": True},
                {"id": "w3", "start": {"x": 10, "y": 8}, "end": {"x": 0, "y": 8}, "thickness": 0.23, "height": 2.7, "is_exterior": True},
                {"id": "w4", "start": {"x": 0, "y": 8}, "end": {"x": 0, "y": 0}, "thickness": 0.23, "height": 2.7, "is_exterior": True},
            ],
            "openings": [
                {"id": "d1", "wall_id": "w1", "type": "door", "position_along_wall": 4.0, "width": 1.0, "height": 2.1, "sill_height": 0.0},
                {"id": "w1", "wall_id": "w3", "type": "window", "position_along_wall": 3.0, "width": 1.5, "height": 1.2, "sill_height": 0.9},
            ],
            "rooms": [
                {
                    "id": "r1",
                    "name": "Main Hall",
                    "polygon": [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 8}, {"x": 0, "y": 8}],
                    "area_sqm": 80.0,
                }
            ],
            "scale": {"pixels_per_metre": 50.0, "source": "user_provided", "confidence": 1.0},
        }
    }
    r = post("/api/v1/floor-plans", json=plan_payload)
    assert r.status_code == 201, f"Create plan failed: {r.text}"
    plan_id = r.json()["id"]
    print(f"  Created Plan ID: {plan_id}")

    # 4. Trigger Conversion
    print("\n[4/6] Triggering 3D conversion job ...")
    r = post("/api/v1/conversions", json={
        "floor_plan_id": plan_id,
        "parameters": {
            "default_wall_height": 2.7,
            "exterior_wall_thickness": 0.23,
            "include_floor": True,
            "roof": {"type": "flat", "thickness": 0.15, "overhang": 0.3},
            "export_formats": ["glb", "obj"],
        }
    })
    assert r.status_code in (200, 202), f"Trigger conversion failed: {r.text}"
    job_id = r.json()["id"]
    print(f"  Job ID: {job_id}")

    # 5. Poll Conversion Job
    print("\n[5/6] Polling conversion job to completion ...")
    start_time = time.time()
    job_status = "queued"
    while time.time() - start_time < 15.0:
        r = get(f"/api/v1/conversions/{job_id}")
        data = r.json()
        job_status = data["status"]
        prog = data.get("progress", 0.0)
        step = data.get("current_step", "")
        print(f"  -> Status: {job_status.upper()} ({int(prog * 100)}%) - {step}")
        if job_status in ("completed", "failed"):
            break
        time.sleep(0.2)

    assert job_status == "completed", f"Job failed or timed out: {data.get('error')}"
    stats = data["mesh_stats"]
    print(f"  Mesh generated: {stats['vertex_count']} vertices, {stats['face_count']} faces")
    print(f"  Layers: {', '.join(stats['layers'])}")
    print(f"  Bounding Box Dimensions: {stats['dimensions_m']}")

    # 6. Verify Model Artifact Download
    print("\n[6/6] Verifying GLB model download ...")
    r = get(f"/api/v1/conversions/{job_id}/model?format=glb")
    assert r.status_code == 200, f"Model download failed: {r.status_code}"
    glb_size = len(r.content)
    print(f"  GLB downloaded successfully: {glb_size} bytes")
    assert glb_size > 1000

    print("\n" + "=" * 60)
    print("ALL SMOKE TESTS PASSED SUCCESSFULLY! (EXIT 0)")
    print("=" * 60)
    return 0

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(run_smoke_test(url))
