"""In-process background conversion worker using ThreadPoolExecutor."""

import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional
from app.config import settings
from app.storage.job_store import storage
from app.geometry.builder import GeometryBuilder
from app.geometry.validator import validate_floor_plan_geometry
from app.export.gltf import export_glb
from app.export.obj import export_obj

logger = logging.getLogger("plan2space.worker")
_executor: Optional[ThreadPoolExecutor] = None


def get_worker_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=settings.MAX_WORKER_THREADS, thread_name_prefix="p2s_worker")
    return _executor


def process_conversion_task(job_id: str):
    """Executes the 3D conversion pipeline in the background."""
    try:
        job = storage.get_job(job_id)
        if not job:
            logger.error(f"Job {job_id} not found in store")
            return

        storage.update_job_status(job_id, status="processing", progress=0.1, step="Loading floor plan")

        plan = storage.get_floor_plan(job.floor_plan_id)
        if not plan:
            raise ValueError(f"Floor plan {job.floor_plan_id} not found")

        # Step 1: Validate Geometry
        storage.update_job_status(job_id, status="processing", progress=0.25, step="Validating geometry")
        is_valid, warnings = validate_floor_plan_geometry(plan.geometry)
        if not is_valid:
            raise ValueError(f"Floor plan geometry validation failed: {'; '.join(warnings)}")

        # Step 2: Build 3D Mesh Scene
        storage.update_job_status(job_id, status="processing", progress=0.50, step="Building 3D meshes")
        builder = GeometryBuilder(plan.geometry, job.parameters)
        scene, mesh_stats = builder.build_scene()

        # Step 3: Export Artifacts
        storage.update_job_status(job_id, status="processing", progress=0.75, step="Exporting 3D models")
        artifacts = {}

        # GLB export
        glb_path = storage.get_model_path(job_id, "glb")
        export_glb(scene, glb_path)
        artifacts["glb"] = f"{settings.API_PREFIX}/conversions/{job_id}/model?format=glb"

        # OBJ export if requested
        if "obj" in job.parameters.export_formats:
            obj_path = storage.get_model_path(job_id, "obj")
            export_obj(scene, obj_path)
            artifacts["obj"] = f"{settings.API_PREFIX}/conversions/{job_id}/model?format=obj"

        # Step 4: Verification & Complete
        storage.update_job_status(
            job_id,
            status="completed",
            progress=1.0,
            step="Conversion complete",
            artifacts=artifacts,
            mesh_stats=mesh_stats,
        )
        logger.info(f"Conversion job {job_id} completed successfully")

    except Exception as exc:
        logger.exception(f"Conversion job {job_id} failed: {exc}")
        storage.update_job_status(
            job_id,
            status="failed",
            progress=0.0,
            step="Failed",
            error=str(exc),
        )


def submit_conversion_job(job_id: str):
    executor = get_worker_executor()
    executor.submit(process_conversion_task, job_id)
