"""Interior Design Studio REST API endpoints.
Provides design state persistence, wall validation, and procedural catalogue definitions.
"""

import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status, Depends

from app.config import settings
from app.storage.job_store import storage
from app.schemas.design import DesignState, CatalogueResponse
from app.services.catalogue import get_catalogue
from app.geometry.builder import GeometryBuilder

ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]+$")


def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Verifies optional API key if configured in settings."""
    if settings.API_KEY is not None and x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key in X-API-Key header.",
        )


router = APIRouter(tags=["Interior Design Studio"], dependencies=[Depends(verify_api_key)])


def _validate_safe_id(id_val: str, label: str = "ID") -> str:
    if not ID_REGEX.match(id_val):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label} format: must be alphanumeric with dashes/underscores.",
        )
    return id_val


@router.get("/design-catalogue", response_model=CatalogueResponse)
def get_design_catalogue():
    """Returns static catalogue specification: categories, variants, dimensions, and 24 preset colors."""
    return get_catalogue()


@router.get("/conversions/{conversion_id}/geometry")
def get_conversion_geometry(conversion_id: str):
    """Returns floor plan geometry and wall faces lookup for the specified conversion."""
    _validate_safe_id(conversion_id, "Conversion ID")
    job = storage.get_job(conversion_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversion job '{conversion_id}' not found.",
        )

    plan = storage.get_floor_plan(job.floor_plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Floor plan '{job.floor_plan_id}' associated with conversion not found.",
        )

    builder = GeometryBuilder(plan.geometry, job.parameters)
    wall_faces_lookup = builder.get_wall_faces_lookup()

    return {
        "job_id": job.id,
        "floor_plan_id": plan.id,
        "floor_plan_name": plan.name,
        "geometry": plan.geometry.model_dump(),
        "wall_faces_lookup": wall_faces_lookup,
    }


@router.get("/conversions/{conversion_id}/design", response_model=DesignState)
def get_conversion_design(conversion_id: str):
    """
    Returns saved interior design state for this conversion:
    wall colours, floor colours, ceiling colour, and placed furniture list.
    """
    _validate_safe_id(conversion_id, "Conversion ID")
    job = storage.get_job(conversion_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversion job '{conversion_id}' not found.",
        )

    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conversion '{conversion_id}' is in '{job.status}' status (must be 'completed' to view or edit designs).",
        )

    design = storage.get_design(conversion_id)
    if not design:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No design saved for conversion '{conversion_id}'.",
        )

    return design


@router.put("/conversions/{conversion_id}/design", response_model=DesignState)
def save_conversion_design(conversion_id: str, design: DesignState):
    """
    Saves or updates the interior design state for a completed conversion.
    Validates wall IDs against the conversion's underlying floor plan geometry,
    verifies hex colors and ensures furniture items do not exceed 300.
    """
    _validate_safe_id(conversion_id, "Conversion ID")
    job = storage.get_job(conversion_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversion job '{conversion_id}' not found.",
        )

    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conversion '{conversion_id}' is in '{job.status}' status (must be 'completed' to save design).",
        )

    plan = storage.get_floor_plan(job.floor_plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Floor plan '{job.floor_plan_id}' associated with conversion not found.",
        )

    # Ensure conversion_id matches path
    design.conversion_id = conversion_id

    # Validate wall IDs exist in geometry
    valid_wall_ids = {w.id for w in plan.geometry.walls}
    for w_paint in design.walls:
        if w_paint.wall_id not in valid_wall_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Wall ID '{w_paint.wall_id}' does not exist in floor plan geometry. Valid IDs: {sorted(list(valid_wall_ids))}",
            )

    saved = storage.save_design(conversion_id, design)
    return saved


@router.delete("/conversions/{conversion_id}/design")
def delete_conversion_design(conversion_id: str):
    """Clears saved interior design state for this conversion, resetting to blank model."""
    _validate_safe_id(conversion_id, "Conversion ID")
    job = storage.get_job(conversion_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversion job '{conversion_id}' not found.",
        )

    deleted = storage.delete_design(conversion_id)
    return {
        "success": True,
        "detail": f"Design for conversion '{conversion_id}' has been reset to default.",
        "was_present": deleted,
    }
