"""Saved Plans, History, Materials Requirement & Cost Estimation API Endpoints."""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.storage.job_store import storage, utc_now_iso
from app.services.estimation import calculate_plan_estimate

router = APIRouter(prefix="/saved-plans", tags=["Saved Plans & Estimates"])


class SavePlanMetadataRequest(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    notes: Optional[str] = None
    budget_inr: Optional[float] = None


@router.get("", response_model=List[Dict[str, Any]])
def list_saved_plans():
    """
    Returns all saved floor plans with their latest 3D conversion job,
    interior design customizations, and cost estimate summaries.
    """
    plans = storage.list_floor_plans()
    result = []

    for p in plans:
        # Check for completed 3D conversion job
        latest_job = storage.get_latest_job_for_plan(p.id)
        conversion_id = latest_job.id if latest_job else None

        # Check for saved interior design
        design = None
        if conversion_id:
            design = storage.get_design(conversion_id)

        # Compute materials & cost estimate
        estimate = calculate_plan_estimate(p.geometry, design)

        # Roof details
        roof_data = estimate["plan_summary"]["roof"]

        result.append({
            "id": p.id,
            "name": p.name,
            "image_url": p.image_url,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "has_conversion": latest_job is not None,
            "latest_conversion_id": conversion_id,
            "conversion_status": latest_job.status if latest_job else "none",
            "has_design": design is not None,
            "plan_summary": estimate["plan_summary"],
            "cost_summary": estimate["cost_summary"],
            "roof_style": f"{'Clay Tiles' if roof_data['is_tiled'] else 'Plain Smooth'} ({roof_data['shape'].capitalize()})",
            "furniture_count": estimate["plan_summary"]["furniture_count"],
            "rooms": estimate["rooms"],
            "metadata": p.geometry.metadata or {},
        })

    return result


@router.get("/{plan_id}/estimate", response_model=Dict[str, Any])
def get_plan_estimate(plan_id: str):
    """
    Retrieves the complete itemized Bill of Materials (BoQ) and realistic cost
    estimate for a specific floor plan, accounting for architectural geometry,
    roof selection, and placed furniture.
    """
    plan = storage.get_floor_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")

    latest_job = storage.get_latest_job_for_plan(plan_id)
    design = None
    if latest_job:
        design = storage.get_design(latest_job.id)

    estimate = calculate_plan_estimate(plan.geometry, design)
    return {
        "plan_id": plan.id,
        "plan_name": plan.name,
        "conversion_id": latest_job.id if latest_job else None,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
        **estimate,
    }


@router.post("/{plan_id}/save", response_model=Dict[str, Any])
def save_plan_metadata(plan_id: str, req: SavePlanMetadataRequest):
    """
    Bookmarks or updates plan metadata (custom name, notes, client name) in saved history.
    """
    plan = storage.get_floor_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")

    if req.name:
        plan.name = req.name
        plan.geometry.name = req.name

    if req.client_name or req.notes or req.budget_inr:
        if not plan.geometry.metadata:
            plan.geometry.metadata = {}
        if req.client_name:
            plan.geometry.metadata["client_name"] = req.client_name
        if req.notes:
            plan.geometry.metadata["notes"] = req.notes
        if req.budget_inr:
            plan.geometry.metadata["budget_inr"] = req.budget_inr

    updated = storage.save_floor_plan(
        plan_id=plan.id,
        name=plan.name,
        geometry=plan.geometry,
        image_url=plan.image_url,
        warnings=plan.warnings,
    )

    return {
        "status": "saved",
        "plan_id": updated.id,
        "name": updated.name,
        "updated_at": updated.updated_at,
    }


@router.delete("/{plan_id}")
def delete_saved_plan(plan_id: str):
    """Deletes a plan from saved history."""
    deleted = storage.delete_floor_plan(plan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Floor plan '{plan_id}' not found.")
    return {"status": "deleted", "plan_id": plan_id}
