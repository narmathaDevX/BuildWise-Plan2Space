from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.app.services.affordability import estimate_affordability
from backend.app.services.ancillary import calculate_ancillary_costs
from backend.app.services.compliance import evaluate_tncdbr_compliance
from backend.app.services.cost import calculate_cost
from backend.app.services.schedule import simulate_schedule

router = APIRouter(prefix="/api/estimate", tags=["Estimates"])


class ComplianceRequest(BaseModel):
    plot_width: float
    plot_depth: float
    built_up_area: float
    ground_built_up_area: float | None = None
    floors: int = 1
    front_setback: float = 5.0
    rear_setback: float = 5.0
    side_left_setback: float = 3.0
    side_right_setback: float = 3.0
    road_width_feet: float = 30.0


class AncillaryRequest(BaseModel):
    built_up_area: float = 1850.0
    plot_area: float = 2400.0
    selected_keys: list[str] | None = None


class AffordabilityRequest(BaseModel):
    plot_width: float
    plot_depth: float
    floors: int = 1
    bedrooms: int = 3
    bathrooms: int = 2
    quality: str = "Standard"
    location: str = "Tamil Nadu"
    budget: float = 3500000.0
    monthly_budget: float = 300000.0


class CostRequest(BaseModel):
    plan_id: str | None = None
    total_built_up_area: float
    plot_area: float | None = None
    floors: int = 1
    location: str = "Tamil Nadu"
    quality: str = "Standard"
    budget: float | None = None


class ScheduleRequest(BaseModel):
    total_cost: int
    monthly_budget: float = 300000.0
    breakdown: list[dict[str, Any]] | None = None
    quality: str = "Standard"
    floors: int = 1
    built_up_area: float = 1850.0
    start_date: str | None = None


@router.post("/affordability")
def estimate_plan_affordability(payload: AffordabilityRequest) -> dict[str, Any]:
    return estimate_affordability(
        plot_width=payload.plot_width,
        plot_depth=payload.plot_depth,
        floors=payload.floors,
        bedrooms=payload.bedrooms,
        bathrooms=payload.bathrooms,
        quality=payload.quality,
        location=payload.location,
        budget=payload.budget,
        monthly_budget=payload.monthly_budget,
    )


@router.post("/cost")
def estimate_plan_cost(payload: CostRequest) -> dict[str, Any]:
    return calculate_cost(
        total_built_up_area=payload.total_built_up_area,
        quality=payload.quality,
        location=payload.location,
        floors=payload.floors,
        plot_area=payload.plot_area,
        budget=payload.budget,
        plan_id=payload.plan_id,
    )


@router.post("/schedule")
def estimate_plan_schedule(payload: ScheduleRequest) -> dict[str, Any]:
    return simulate_schedule(
        total_cost=payload.total_cost,
        monthly_budget=payload.monthly_budget,
        breakdown=payload.breakdown,
        quality=payload.quality,
        floors=payload.floors,
        built_up_area=payload.built_up_area,
        start_date=payload.start_date,
    )


@router.post("/compliance")
def estimate_tncdbr_compliance(payload: ComplianceRequest) -> dict[str, Any]:
    return evaluate_tncdbr_compliance(
        plot_width=payload.plot_width,
        plot_depth=payload.plot_depth,
        built_up_area=payload.built_up_area,
        ground_built_up_area=payload.ground_built_up_area,
        floors=payload.floors,
        front_setback=payload.front_setback,
        rear_setback=payload.rear_setback,
        side_left_setback=payload.side_left_setback,
        side_right_setback=payload.side_right_setback,
        road_width_feet=payload.road_width_feet,
    )


@router.post("/ancillary")
def estimate_ancillary(payload: AncillaryRequest) -> dict[str, Any]:
    return calculate_ancillary_costs(
        built_up_area=payload.built_up_area,
        plot_area=payload.plot_area,
        selected_keys=payload.selected_keys,
    )
