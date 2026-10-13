
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Locate the existing model package.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_SRC = PROJECT_ROOT / "buildwise_engine" / "src"

if not MODEL_SRC.exists():
    raise RuntimeError(
        f"BuildWise model source not found: {MODEL_SRC}"
    )

sys.path.insert(0, str(MODEL_SRC))

import buildwise_engine as bwe  # noqa: E402


app = FastAPI(
    title="BuildWise API",
    version="1.0.0",
    description="Backend API for BuildWise house-plan generation.",
)

# Allow the local React/Vite frontend to communicate with FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GeneratePlanRequest(BaseModel):
    request: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


class ValidatePlanRequest(BaseModel):
    plan: dict[str, Any]
    request: dict[str, Any]
    jurisdiction: str | None = None


@app.get("/")
def root():
    return {
        "message": "BuildWise API is running",
        "model": "buildwise_engine",
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": True}


@app.post("/api/generate")
def generate_plan(payload: GeneratePlanRequest):
    try:
        # Use the model's existing public generation API.
        return bwe.generate_plans(
            payload.request,
            options=payload.options or None,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Plan generation failed: {exc}",
        ) from exc


@app.post("/api/feasibility")
def check_feasibility(payload: dict[str, Any]):
    try:
        return bwe.check_feasibility(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Feasibility check failed: {exc}",
        ) from exc


@app.post("/api/validate")
def validate_plan(payload: ValidatePlanRequest):
    try:
        return bwe.validate_plan(
            payload.plan,
            payload.request,
            jurisdiction=payload.jurisdiction,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Plan validation failed: {exc}",
        ) from exc


@app.get("/api/jurisdictions")
def list_jurisdictions():
    return bwe.list_supported_jurisdictions()
