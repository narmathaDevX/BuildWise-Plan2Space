"""Thread-safe file-based storage for FloorPlans and ConversionJobs."""

import json
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
from app.config import settings
from app.schemas.geometry import FloorPlanGeometry
from app.schemas.responses import ConversionJobResponse, FloorPlanResponse, JobStatus
from app.schemas.design import DesignState


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class StorageManager:
    """Manages persistent JSON metadata and binary artifacts on the local filesystem."""

    def __init__(self, base_data_dir: Optional[Path] = None):
        self.base_dir = base_data_dir or settings.DATA_DIR
        self.plans_dir = self.base_dir / "plans"
        self.jobs_dir = self.base_dir / "jobs"
        self.uploads_dir = self.base_dir / "uploads"
        self.models_dir = self.base_dir / "models"
        self.designs_dir = self.base_dir / "designs"

        for d in (self.plans_dir, self.jobs_dir, self.uploads_dir, self.models_dir, self.designs_dir):
            d.mkdir(parents=True, exist_ok=True)

        self._lock = threading.RLock()

    # --- Floor Plans ---
    def save_floor_plan(
        self,
        plan_id: str,
        name: str,
        geometry: FloorPlanGeometry,
        image_url: Optional[str] = None,
        warnings: Optional[List[str]] = None,
    ) -> FloorPlanResponse:
        with self._lock:
            path = self.plans_dir / f"{plan_id}.json"
            created_at = utc_now_iso()
            if path.exists():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        old = json.load(f)
                        created_at = old.get("created_at", created_at)
                except Exception:
                    pass

            response = FloorPlanResponse(
                id=plan_id,
                name=name,
                geometry=geometry,
                image_url=image_url,
                warnings=warnings or [],
                created_at=created_at,
                updated_at=utc_now_iso(),
            )
            with open(path, "w", encoding="utf-8") as f:
                f.write(response.model_dump_json(indent=2))
            return response

    def get_floor_plan(self, plan_id: str) -> Optional[FloorPlanResponse]:
        with self._lock:
            path = self.plans_dir / f"{plan_id}.json"
            if not path.exists():
                return None
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return FloorPlanResponse.model_validate(data)

    def list_floor_plans(self) -> List[FloorPlanResponse]:
        with self._lock:
            plans = []
            for p in self.plans_dir.glob("*.json"):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    plans.append(FloorPlanResponse.model_validate(data))
                except Exception:
                    continue
            return sorted(plans, key=lambda x: x.updated_at, reverse=True)

    def delete_floor_plan(self, plan_id: str) -> bool:
        with self._lock:
            plan_file = self.plans_dir / f"{plan_id}.json"
            deleted = False
            if plan_file.exists():
                plan_file.unlink()
                deleted = True

            # Also delete associated uploaded images
            upload_sub = self.uploads_dir / plan_id
            if upload_sub.exists():
                shutil.rmtree(upload_sub, ignore_errors=True)
                deleted = True

            return deleted

    # --- Uploaded files ---
    def save_uploaded_image(self, plan_id: str, filename: str, content: bytes) -> Path:
        with self._lock:
            sub = self.uploads_dir / plan_id
            sub.mkdir(parents=True, exist_ok=True)
            target = sub / filename
            with open(target, "wb") as f:
                f.write(content)
            return target

    def get_uploaded_image_path(self, plan_id: str, filename: str) -> Optional[Path]:
        target = self.uploads_dir / plan_id / filename
        if target.exists():
            return target
        return None

    # --- Jobs ---
    def save_job(self, job: ConversionJobResponse) -> None:
        with self._lock:
            path = self.jobs_dir / f"{job.id}.json"
            with open(path, "w", encoding="utf-8") as f:
                f.write(job.model_dump_json(indent=2))

    def get_job(self, job_id: str) -> Optional[ConversionJobResponse]:
        with self._lock:
            path = self.jobs_dir / f"{job_id}.json"
            if not path.exists():
                return None
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ConversionJobResponse.model_validate(data)

    def list_jobs(self) -> List[ConversionJobResponse]:
        with self._lock:
            jobs = []
            for p in self.jobs_dir.glob("*.json"):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    jobs.append(ConversionJobResponse.model_validate(data))
                except Exception:
                    continue
            return sorted(jobs, key=lambda x: x.created_at or "", reverse=True)

    def get_latest_job_for_plan(self, plan_id: str) -> Optional[ConversionJobResponse]:
        jobs = [j for j in self.list_jobs() if j.floor_plan_id == plan_id and j.status == "completed"]
        return jobs[0] if jobs else None

    def update_job_status(
        self,
        job_id: str,
        status: JobStatus,
        progress: float,
        step: Optional[str] = None,
        error: Optional[str] = None,
        artifacts: Optional[Dict[str, str]] = None,
        mesh_stats: Optional[Any] = None,
    ) -> Optional[ConversionJobResponse]:
        with self._lock:
            job = self.get_job(job_id)
            if not job:
                return None
            job.status = status
            job.progress = progress
            if step is not None:
                job.current_step = step
            if error is not None:
                job.error = error
            if artifacts is not None:
                job.artifacts.update(artifacts)
            if mesh_stats is not None:
                job.mesh_stats = mesh_stats
            if status in ("completed", "failed"):
                job.completed_at = utc_now_iso()
            self.save_job(job)
            return job

    def get_model_path(self, job_id: str, fmt: str) -> Path:
        ext = "glb" if fmt.lower() == "glb" else "obj"
        return self.models_dir / f"{job_id}.{ext}"

    # --- Interior Designs ---
    def save_design(self, conversion_id: str, design: DesignState) -> DesignState:
        with self._lock:
            path = self.designs_dir / f"{conversion_id}.json"
            now = utc_now_iso()
            if not design.created_at:
                if path.exists():
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            old = json.load(f)
                            design.created_at = old.get("created_at", now)
                    except Exception:
                        design.created_at = now
                else:
                    design.created_at = now
            design.updated_at = now
            with open(path, "w", encoding="utf-8") as f:
                f.write(design.model_dump_json(indent=2))
            return design

    def get_design(self, conversion_id: str) -> Optional[DesignState]:
        with self._lock:
            path = self.designs_dir / f"{conversion_id}.json"
            if not path.exists():
                return None
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return DesignState.model_validate(data)

    def delete_design(self, conversion_id: str) -> bool:
        with self._lock:
            path = self.designs_dir / f"{conversion_id}.json"
            if path.exists():
                path.unlink()
                return True
            return False


storage = StorageManager()
