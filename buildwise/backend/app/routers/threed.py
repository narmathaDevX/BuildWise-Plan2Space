"""BuildWise 3D Model Generation and Delivery Router."""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.app.services.floorplan_to_3d import export_plan_to_glb

router = APIRouter(prefix="/api/3d", tags=["3D Plan Generation"])

MODELS_DIR = Path("backend/data/models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)


class Generate3DPayload(BaseModel):
    plan: Dict[str, Any]
    options: Dict[str, Any] = Field(default_factory=dict)


@router.post("/generate")
def generate_3d_plan(payload: Generate3DPayload) -> Dict[str, Any]:
    """
    Converts a BuildWise 2D floor plan into an interactive watertight 3D GLB model.
    """
    try:
        plan = payload.plan
        plan_id = plan.get("plan_id")
        if not plan_id:
            # Deterministic hash of plan rooms
            rooms = plan.get("floors", [{}])[0].get("rooms", [])
            sig = json.dumps(rooms, sort_keys=True)
            plan_id = "bw_" + hashlib.md5(sig.encode("utf-8")).hexdigest()[:10]

        glb_filename = f"{plan_id}.glb"
        glb_path = MODELS_DIR / glb_filename

        meta = export_plan_to_glb(plan, glb_path, payload.options)

        return {
            "success": True,
            "plan_id": plan_id,
            "model_url": f"/api/3d/model/{glb_filename}",
            "stats": meta,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"3D Model generation failed: {exc}",
        ) from exc


@router.get("/model/{filename}")
def get_3d_model(filename: str):
    """Streams the binary glTF (.glb) model for interactive 3D rendering."""
    # Sanitize filename
    safe_name = Path(filename).name
    model_path = MODELS_DIR / safe_name

    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"3D model '{filename}' not found.")

    return FileResponse(
        str(model_path),
        media_type="model/gltf-binary",
        filename=safe_name,
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )
