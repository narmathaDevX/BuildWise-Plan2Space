from typing import Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.services.floorplan.solver import FloorPlanSolver

router = APIRouter(prefix="/api", tags=["Plans"])


class GeneratePlanPayload(BaseModel):
    request: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


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
