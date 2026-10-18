"""3D Conversion jobs and model delivery API endpoints."""

import uuid
from typing import Literal, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.schemas.requests import CreateConversionJobRequest
from app.schemas.responses import ConversionJobResponse
from app.storage.job_store import storage, utc_now_iso
from app.services.conversion_worker import submit_conversion_job

router = APIRouter(prefix="/conversions", tags=["Conversions"])


@router.post("", response_model=ConversionJobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_conversion_job(req: CreateConversionJobRequest):
    """Submits a new 3D conversion job for execution in background worker."""
    plan = storage.get_floor_plan(req.floor_plan_id)
    if not plan:
        raise HTTPException(
            status_code=404,
            detail=f"Floor plan '{req.floor_plan_id}' does not exist.",
        )

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    job = ConversionJobResponse(
        id=job_id,
        floor_plan_id=req.floor_plan_id,
        status="queued",
        progress=0.0,
        current_step="Queued for processing",
        created_at=utc_now_iso(),
        parameters=req.parameters,
        artifacts={},
    )
    storage.save_job(job)

    # Submit task to background worker
    submit_conversion_job(job_id)

    return job


@router.get("/{job_id}", response_model=ConversionJobResponse)
def get_conversion_job(job_id: str):
    """Polls status, progress, current step, and artifacts of a conversion job."""
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Conversion job '{job_id}' not found.")
    return job


@router.get("/{job_id}/model")
def download_model(
    job_id: str,
    format: Literal["glb", "obj"] = Query("glb", description="Desired 3D file format"),
):
    """Downloads exported 3D model (GLB binary or OBJ)."""
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Conversion job '{job_id}' not found.")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is in '{job.status}' state (progress {int(job.progress * 100)}%). Artifact not ready.",
        )

    ext = "glb" if format == "glb" else "obj"
    model_path = storage.get_model_path(job_id, ext)
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model artifact '{ext}' not found on server.")

    media_type = "model/gltf-binary" if ext == "glb" else "text/plain"
    filename = f"plan2space_{job_id}.{ext}"

    return FileResponse(
        str(model_path),
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{job_id}/preview")
def get_conversion_preview(job_id: str):
    """Returns preview metadata and statistics for the converted 3D model."""
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Conversion job '{job_id}' not found.")

    plan = storage.get_floor_plan(job.floor_plan_id)
    return {
        "job_id": job.id,
        "floor_plan_id": job.floor_plan_id,
        "floor_plan_name": plan.name if plan else "Unknown",
        "status": job.status,
        "mesh_stats": job.mesh_stats,
        "artifacts": job.artifacts,
        "completed_at": job.completed_at,
    }
