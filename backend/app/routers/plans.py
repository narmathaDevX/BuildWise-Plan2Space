import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.models import SavedPlan, User
from backend.app.db.session import get_db
from backend.app.routers.auth import get_current_user
from backend.app.services.floorplan.solver import FloorPlanSolver

router = APIRouter(prefix="/api", tags=["Plans"])


class GeneratePlanPayload(BaseModel):
    request: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


class SavePlanPayload(BaseModel):
    plan_id: str
    title: str
    notes: str | None = None
    plan: dict[str, Any]
    form: dict[str, Any]
    built_up_area: float | None = None
    estimated_cost: float | None = None
    score: float | None = None


class UpdateSavedPlanPayload(BaseModel):
    title: str | None = None
    notes: str | None = None


@router.post("/generate")
def generate_plans(payload: GeneratePlanPayload) -> dict[str, Any]:
    try:
        solver = FloorPlanSolver(payload.request, payload.options)
        return solver.solve()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Floor plan generation failed: {exc}",
        ) from exc


@router.get("/plans/saved")
def get_saved_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    saved = (
        db.query(SavedPlan)
        .filter(SavedPlan.user_id == current_user.id)
        .order_by(SavedPlan.created_at.desc())
        .all()
    )
    return {
        "saved_plans": [p.to_dict() for p in saved],
        "count": len(saved),
    }


@router.post("/plans/saved", status_code=status.HTTP_201_CREATED)
def save_plan(
    payload: SavePlanPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    form = payload.form or {}
    plan_data = payload.plan or {}

    plot_width = float(form.get("width") or plan_data.get("request_echo", {}).get("plot", {}).get("width") or 40.0)
    plot_length = float(form.get("length") or plan_data.get("request_echo", {}).get("plot", {}).get("depth") or 60.0)
    built_up = float(
        payload.built_up_area
        or plan_data.get("details", {}).get("total_built_up")
        or plan_data.get("details", {}).get("built_up_area")
        or plan_data.get("built_up_area")
        or (plot_width * plot_length * 0.75)
    )
    score_val = float(
        payload.score
        or plan_data.get("score")
        or plan_data.get("score_breakdown", {}).get("total")
        or 89.0
    )

    existing = (
        db.query(SavedPlan)
        .filter(SavedPlan.user_id == current_user.id, SavedPlan.plan_id == payload.plan_id)
        .first()
    )

    if existing:
        existing.title = payload.title or existing.title
        if payload.notes is not None:
            existing.notes = payload.notes
        existing.plan_json = json.dumps(plan_data)
        existing.form_json = json.dumps(form)
        existing.built_up_area = built_up
        if payload.estimated_cost is not None:
            existing.estimated_cost = payload.estimated_cost
        existing.score = score_val
        existing.plot_width = plot_width
        existing.plot_length = plot_length
        existing.facing = str(form.get("facing") or existing.facing)
        existing.bedrooms = int(form.get("bedrooms") or existing.bedrooms)
        existing.bathrooms = int(form.get("bathrooms") or existing.bathrooms)
        existing.floors = int(form.get("floors") or existing.floors)
        existing.quality = str(form.get("quality") or existing.quality)
        db.commit()
        db.refresh(existing)
        return {"status": "updated", "saved_plan": existing.to_dict()}

    saved = SavedPlan(
        user_id=current_user.id,
        plan_id=payload.plan_id,
        title=payload.title,
        notes=payload.notes or "",
        plan_json=json.dumps(plan_data),
        form_json=json.dumps(form),
        plot_width=plot_width,
        plot_length=plot_length,
        built_up_area=built_up,
        estimated_cost=payload.estimated_cost or 0.0,
        score=score_val,
        facing=str(form.get("facing") or "North"),
        bedrooms=int(form.get("bedrooms") or 3),
        bathrooms=int(form.get("bathrooms") or 2),
        floors=int(form.get("floors") or 1),
        quality=str(form.get("quality") or "Standard"),
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return {"status": "saved", "saved_plan": saved.to_dict()}


@router.get("/plans/saved/{plan_record_id}")
def get_saved_plan_by_id(
    plan_record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    saved = (
        db.query(SavedPlan)
        .filter(SavedPlan.id == plan_record_id, SavedPlan.user_id == current_user.id)
        .first()
    )
    if not saved:
        saved = (
            db.query(SavedPlan)
            .filter(SavedPlan.plan_id == plan_record_id, SavedPlan.user_id == current_user.id)
            .first()
        )
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved plan '{plan_record_id}' not found.",
        )
    return {"saved_plan": saved.to_dict()}


@router.put("/plans/saved/{plan_record_id}")
def update_saved_plan(
    plan_record_id: str,
    payload: UpdateSavedPlanPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    saved = (
        db.query(SavedPlan)
        .filter(SavedPlan.id == plan_record_id, SavedPlan.user_id == current_user.id)
        .first()
    )
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved plan '{plan_record_id}' not found.",
        )
    if payload.title is not None:
        saved.title = payload.title
    if payload.notes is not None:
        saved.notes = payload.notes
    db.commit()
    db.refresh(saved)
    return {"status": "updated", "saved_plan": saved.to_dict()}


@router.delete("/plans/saved/{plan_record_id}")
def delete_saved_plan(
    plan_record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    saved = (
        db.query(SavedPlan)
        .filter(SavedPlan.id == plan_record_id, SavedPlan.user_id == current_user.id)
        .first()
    )
    if not saved:
        saved = (
            db.query(SavedPlan)
            .filter(SavedPlan.plan_id == plan_record_id, SavedPlan.user_id == current_user.id)
            .first()
        )
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved plan '{plan_record_id}' not found.",
        )
    db.delete(saved)
    db.commit()
    return {"status": "deleted", "id": plan_record_id}

