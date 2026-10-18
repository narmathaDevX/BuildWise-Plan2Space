# Plan2Space 3D — External Client Integration Guide

This guide demonstrates how any third-party software, web portal, or architecture CAD pipeline can interact with **Plan2Space 3D** over standard HTTP/REST.

---

## Architecture Overview

Plan2Space 3D provides a decoupled, asynchronous 3D generation API:

```
[ Client Application ]  ──( POST /api/v1/conversions )──>  [ Plan2Space 3D API ]
         │                                                            │
         │  <──────( 202 Accepted + Job ID )──────────────────────────┤
         │                                                            ▼
         ├──( GET /api/v1/conversions/{id} )──────────> [ Background Geometry Worker ]
         │                                              (Shapely + Trimesh Engine)
         │  <──────( 200 OK + status: "completed" )───────────────────┤
         ▼                                                            ▼
[ Download .GLB / .OBJ ] <──( GET .../model?format=glb )──  [ Model Storage ]
```

---

## Standalone Python Integration Example (`client.py`)

Below is a complete, copy-pasteable Python script using `httpx` to upload an image, trigger 3D generation, poll for completion, and save the binary `.glb` model.

```python
"""
Standalone Plan2Space 3D Client Example.
Requires: pip install httpx
"""

import time
from pathlib import Path
import httpx

PLAN2SPACE_BASE_URL = "http://localhost:8000"


class Plan2SpaceClient:
    def __init__(self, base_url: str = PLAN2SPACE_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(base_url=self.base_url, timeout=60.0)

    def check_health(self) -> bool:
        resp = self.client.get("/health")
        return resp.status_code == 200 and resp.json().get("status") == "ok"

    def upload_floor_plan(self, image_path: Path, name: str = "Client Plan") -> str:
        with open(image_path, "rb") as f:
            files = {"file": (image_path.name, f, "image/png")}
            data = {"name": name}
            resp = self.client.post("/api/v1/floor-plans", files=files, data=data)
            resp.raise_for_status()
            return resp.json()["id"]

    def submit_conversion(
        self,
        floor_plan_id: str,
        wall_height_m: float = 2.7,
        include_floor: bool = True,
        roof_type: str = "none",
    ) -> str:
        payload = {
            "floor_plan_id": floor_plan_id,
            "parameters": {
                "default_wall_height": wall_height_m,
                "exterior_wall_thickness": 0.23,
                "include_floor": include_floor,
                "roof": {"type": roof_type},
                "export_formats": ["glb", "obj"],
            },
        }
        resp = self.client.post("/api/v1/conversions", json=payload)
        resp.raise_for_status()
        return resp.json()["id"]

    def wait_for_completion(self, job_id: str, timeout_sec: float = 30.0) -> dict:
        start_time = time.time()
        while time.time() - start_time < timeout_sec:
            resp = self.client.get(f"/api/v1/conversions/{job_id}")
            resp.raise_for_status()
            data = resp.json()
            status = data.get("status")

            if status == "completed":
                return data
            elif status == "failed":
                raise RuntimeError(f"3D conversion failed: {data.get('error')}")

            time.sleep(0.3)
        raise TimeoutError(f"Job {job_id} exceeded timeout of {timeout_sec}s")

    def download_model(self, job_id: str, output_path: Path, format: str = "glb"):
        resp = self.client.get(f"/api/v1/conversions/{job_id}/model?format={format}")
        resp.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(resp.content)
        print(f"Downloaded 3D model to: {output_path} ({len(resp.content)} bytes)")


# Usage Demonstration
if __name__ == "__main__":
    client = Plan2SpaceClient()

    if not client.check_health():
        print("Plan2Space 3D server is not running!")
        exit(1)

    print("1. Server is healthy. Uploading plan...")
    plan_id = client.upload_floor_plan(
        Path("sample_floorplans/simple_rect/floorplan.png"),
        name="Automated Client House",
    )
    print(f"   Created Plan ID: {plan_id}")

    print("2. Launching 3D conversion...")
    job_id = client.submit_conversion(plan_id, wall_height_m=2.8, include_floor=True)
    print(f"   Submitted Job ID: {job_id}")

    print("3. Waiting for 3D mesh completion...")
    job_result = client.wait_for_completion(job_id)
    stats = job_result["mesh_stats"]
    print(f"   Generated: {stats['vertex_count']} verts, {stats['face_count']} faces")

    print("4. Saving binary GLB artifact...")
    client.download_model(job_id, Path("output_house.glb"), format="glb")
    print("Done!")
```
