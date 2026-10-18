"""Floor plans management API endpoints."""

import math
import uuid
from typing import List, Optional, Union
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status, Request
from fastapi.responses import FileResponse

from app.config import settings
from app.storage.job_store import storage
from app.schemas.geometry import FloorPlanGeometry, Scale, Point2D
from app.schemas.requests import CreateFloorPlanRequest, ScaleCalibrationRequest
from app.schemas.responses import FloorPlanResponse
from app.geometry.validator import validate_floor_plan_geometry
from app.processing.pipeline import pipeline

router = APIRouter(prefix="/floor-plans", tags=["Floor Plans"])


@router.post("", response_model=FloorPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_floor_plan(
    request: Request,
    file: Optional[UploadFile] = File(None),
    name: Optional[str] = Form("Floor Plan"),
    scale_pixels_per_metre: Optional[float] = Form(None),
):
    """
    Creates a floor plan.
    Supports either:
    1. Multipart image upload (PNG, JPG, WebP) with optional initial scale.
    2. JSON payload containing structured geometry.
    """
    content_type = request.headers.get("content-type", "")

    # Handle JSON request body
    if "application/json" in content_type:
        try:
            body = await request.json()
            req = CreateFloorPlanRequest.model_validate(body)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON request: {e}")

        plan_id = req.geometry.id if req.geometry and req.geometry.id else f"fp_{uuid.uuid4().hex[:8]}"
        plan_name = req.name or (req.geometry.name if req.geometry else "Floor Plan")
        geometry = req.geometry or FloorPlanGeometry(id=plan_id, name=plan_name)
        if req.scale:
            geometry.scale = req.scale

        is_valid, warnings = validate_floor_plan_geometry(geometry)
        saved = storage.save_floor_plan(
            plan_id=plan_id,
            name=plan_name,
            geometry=geometry,
            warnings=warnings,
        )
        return saved

    # Handle file upload
    if file is None:
        raise HTTPException(
            status_code=400,
            detail="Either a floor plan image file or a JSON geometry payload is required.",
        )

    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed types: {', '.join(settings.ALLOWED_IMAGE_TYPES)}",
        )

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB.",
        )

    plan_id = f"fp_{uuid.uuid4().hex[:8]}"
    clean_filename = file.filename or "plan.png"

    # Save raw uploaded image
    saved_img_path = storage.save_uploaded_image(plan_id, clean_filename, content)

    # Scale override if provided
    scale_override = None
    if scale_pixels_per_metre and scale_pixels_per_metre > 0:
        scale_override = Scale(
            pixels_per_metre=scale_pixels_per_metre,
            source="user_provided",
            confidence=1.0,
        )

    # Run OpenCV pipeline
    try:
        geometry, warnings, meta = pipeline.process(
            image_bytes=content,
            plan_id=plan_id,
            name=name or "Floor Plan",
            scale_override=scale_override,
        )
        geometry.image_path = str(saved_img_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {str(e)}")

    image_url = f"{settings.API_PREFIX}/floor-plans/{plan_id}/image"
    saved = storage.save_floor_plan(
        plan_id=plan_id,
        name=name or "Floor Plan",
        geometry=geometry,
        image_url=image_url,
        warnings=warnings,
    )
    return saved


@router.get("", response_model=List[FloorPlanResponse])
def list_floor_plans():
    """Lists all stored floor plans."""
    return storage.list_floor_plans()


@router.get("/{plan_id}", response_model=FloorPlanResponse)
def get_floor_plan(plan_id: str):
    """Retrieves a single floor plan by ID."""
    plan = storage.get_floor_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")
    return plan


@router.put("/{plan_id}/geometry", response_model=FloorPlanResponse)
def update_floor_plan_geometry(plan_id: str, geometry: FloorPlanGeometry):
    """Updates geometry (from 2D correction editor or programmatic client)."""
    existing = storage.get_floor_plan(plan_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")

    geometry.id = plan_id
    geometry.calculate_bounding_box()
    is_valid, warnings = validate_floor_plan_geometry(geometry)

    saved = storage.save_floor_plan(
        plan_id=plan_id,
        name=existing.name,
        geometry=geometry,
        image_url=existing.image_url,
        warnings=warnings,
    )
    return saved


@router.post("/{plan_id}/calibrate", response_model=FloorPlanResponse)
def calibrate_scale(plan_id: str, req: ScaleCalibrationRequest):
    """Calibrates scale via known line length or bounding dimensions."""
    plan = storage.get_floor_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")

    old_ppm = plan.geometry.scale.pixels_per_metre
    new_ppm = old_ppm
    ref_len = None
    ref_px = None

    if req.method == "line":
        if not req.point_a_px or not req.point_b_px or not req.known_length_m or req.known_length_m <= 0:
            raise HTTPException(status_code=400, detail="Line calibration requires point_a_px, point_b_px, and known_length_m > 0.")
        ax, ay = req.point_a_px
        bx, by = req.point_b_px
        pixel_dist = math.hypot(bx - ax, by - ay)
        if pixel_dist < 5.0:
            raise HTTPException(status_code=400, detail="Reference line length in pixels is too short (< 5px).")
        new_ppm = round(pixel_dist / req.known_length_m, 3)
        ref_len = req.known_length_m
        ref_px = round(pixel_dist, 1)

    elif req.method == "dimensions":
        img_w = plan.geometry.image_width_px or 1000
        img_h = plan.geometry.image_height_px or 800
        if req.known_width_m and req.known_width_m > 0:
            new_ppm = round(img_w / req.known_width_m, 3)
            ref_len = req.known_width_m
            ref_px = float(img_w)
        elif req.known_depth_m and req.known_depth_m > 0:
            new_ppm = round(img_h / req.known_depth_m, 3)
            ref_len = req.known_depth_m
            ref_px = float(img_h)
        else:
            raise HTTPException(status_code=400, detail="Dimensions calibration requires known_width_m or known_depth_m > 0.")

    # Re-scale existing walls if scale ratio changed
    scale_ratio = old_ppm / new_ppm if new_ppm > 0 else 1.0
    for wall in plan.geometry.walls:
        wall.start.x = round(wall.start.x * scale_ratio, 4)
        wall.start.y = round(wall.start.y * scale_ratio, 4)
        wall.end.x = round(wall.end.x * scale_ratio, 4)
        wall.end.y = round(wall.end.y * scale_ratio, 4)

    for op in plan.geometry.openings:
        op.position_along_wall = round(op.position_along_wall * scale_ratio, 3)
        op.width = round(op.width * scale_ratio, 3)

    for rm in plan.geometry.rooms:
        for p in rm.polygon:
            p.x = round(p.x * scale_ratio, 4)
            p.y = round(p.y * scale_ratio, 4)
        rm.area_sqm = round(rm.area_sqm * (scale_ratio ** 2), 2)

    plan.geometry.scale = Scale(
        pixels_per_metre=new_ppm,
        source="user_provided",
        reference_length_m=ref_len,
        reference_pixels=ref_px,
        confidence=1.0,
        warning=None,
    )
    plan.geometry.calculate_bounding_box()

    is_valid, warnings = validate_floor_plan_geometry(plan.geometry)
    saved = storage.save_floor_plan(
        plan_id=plan_id,
        name=plan.name,
        geometry=plan.geometry,
        image_url=plan.image_url,
        warnings=warnings,
    )
    return saved


@router.get("/{plan_id}/image")
def get_floor_plan_image(plan_id: str):
    """Serves uploaded plan image file."""
    plan = storage.get_floor_plan(plan_id)
    if not plan or not plan.geometry.image_path:
        raise HTTPException(status_code=404, detail="Image for floor plan not found.")

    p = storage.base_dir.parent / plan.geometry.image_path if not plan.geometry.image_path.startswith("/") else plan.geometry.image_path
    from pathlib import Path
    path_obj = Path(plan.geometry.image_path)
    if not path_obj.exists():
        raise HTTPException(status_code=404, detail="Image file missing from storage.")

    return FileResponse(str(path_obj))


@router.delete("/{plan_id}")
def delete_floor_plan(plan_id: str):
    """Deletes floor plan and associated uploaded image."""
    success = storage.delete_floor_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")
    return {"deleted": True, "id": plan_id}
