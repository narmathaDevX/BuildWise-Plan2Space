"""Router for daily site construction tasks and checklist."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.db.models import ConstructionTask, Project, User
from backend.app.db.session import get_db
from backend.app.routers.auth import get_current_user
from backend.app.routers.projects import get_current_project
from backend.app.services.daily_tasks import generate_default_daily_tasks

router = APIRouter(prefix="/api/projects/current/tasks", tags=["construction-tasks"])


class TaskUpdatePayload(BaseModel):
    completed: bool


class TaskCreatePayload(BaseModel):
    title: str
    description: str | None = None
    day_number: int = 1
    stage_key: str = "site_prep"
    trade: str = "General Masonry"
    is_critical: bool = False


def ensure_project_tasks(project: Project, db: Session) -> list[ConstructionTask]:
    tasks = (
        db.query(ConstructionTask)
        .filter(ConstructionTask.project_id == project.id)
        .order_by(ConstructionTask.day_number, ConstructionTask.created_at)
        .all()
    )
    if not tasks:
        templates = generate_default_daily_tasks()
        new_tasks = []
        for t in templates:
            ct = ConstructionTask(
                project_id=project.id,
                stage_key=t["stage_key"],
                day_number=t["day_number"],
                title=t["title"],
                description=t.get("description", ""),
                trade=t.get("trade", "General"),
                completed=t.get("completed", False),
                is_critical=t.get("is_critical", False),
                postponed_count=0,
            )
            db.add(ct)
            new_tasks.append(ct)
        db.commit()
        tasks = (
            db.query(ConstructionTask)
            .filter(ConstructionTask.project_id == project.id)
            .order_by(ConstructionTask.day_number, ConstructionTask.created_at)
            .all()
        )
    return tasks


@router.get("")
def get_tasks(
    day: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        return {
            "has_project": False,
            "tasks": [],
            "selected_day": 1,
            "max_day": 40,
            "min_day": 1,
            "total_tasks": 0,
            "completed_tasks": 0,
            "overall_completion_pct": 0,
            "days_summary": [],
        }

    all_tasks = ensure_project_tasks(project, db)
    if not all_tasks:
        return {
            "has_project": True,
            "tasks": [],
            "selected_day": 1,
            "max_day": 40,
            "min_day": 1,
            "total_tasks": 0,
            "completed_tasks": 0,
            "overall_completion_pct": 0,
            "days_summary": [],
        }

    days_with_tasks = sorted(list({t.day_number for t in all_tasks}))
    min_day = min(days_with_tasks) if days_with_tasks else 1
    max_day = max(days_with_tasks) if days_with_tasks else 40
    if day is not None:
        selected_day = day
    else:
        selected_day = days_with_tasks[0] if days_with_tasks else 1

    day_tasks = [t for t in all_tasks if t.day_number == selected_day]

    total_tasks_count = len(all_tasks)
    completed_tasks_count = sum(1 for t in all_tasks if t.completed)
    day_completed_count = sum(1 for t in day_tasks if t.completed)

    # Days summary map
    day_map: dict[int, dict[str, Any]] = {}
    for t in all_tasks:
        dn = t.day_number
        if dn not in day_map:
            day_map[dn] = {
                "day_number": dn,
                "task_count": 0,
                "completed_count": 0,
                "stage_key": t.stage_key,
                "has_critical": False,
            }
        day_map[dn]["task_count"] += 1
        if t.completed:
            day_map[dn]["completed_count"] += 1
        if t.is_critical:
            day_map[dn]["has_critical"] = True

    days_summary = sorted(day_map.values(), key=lambda x: x["day_number"])

    current_stage_key = day_tasks[0].stage_key if day_tasks else "site_prep"

    return {
        "has_project": True,
        "selected_day": selected_day,
        "stage_key": current_stage_key,
        "min_day": min_day,
        "max_day": max_day,
        "total_tasks": total_tasks_count,
        "completed_tasks": completed_tasks_count,
        "day_total_tasks": len(day_tasks),
        "day_completed_tasks": day_completed_count,
        "overall_completion_pct": int(round((completed_tasks_count / max(1, total_tasks_count)) * 100)),
        "days_summary": days_summary,
        "tasks": [
            {
                "id": t.id,
                "day_number": t.day_number,
                "stage_key": t.stage_key,
                "title": t.title,
                "description": t.description or "",
                "trade": t.trade or "General",
                "completed": bool(t.completed),
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "postponed_count": t.postponed_count or 0,
                "is_critical": bool(t.is_critical),
            }
            for t in day_tasks
        ],
    }


@router.patch("/{task_id}")
def update_task_status(
    task_id: str,
    payload: TaskUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    task = (
        db.query(ConstructionTask)
        .filter(ConstructionTask.id == task_id, ConstructionTask.project_id == project.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Construction task not found.")

    task.completed = payload.completed
    if payload.completed:
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)

    return {
        "id": task.id,
        "day_number": task.day_number,
        "stage_key": task.stage_key,
        "title": task.title,
        "completed": bool(task.completed),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "postponed_count": task.postponed_count,
    }


@router.post("/{task_id}/postpone")
def postpone_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    task = (
        db.query(ConstructionTask)
        .filter(ConstructionTask.id == task_id, ConstructionTask.project_id == project.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Construction task not found.")

    task.day_number += 1
    task.postponed_count = (task.postponed_count or 0) + 1
    # Uncomplete if postponed
    task.completed = False
    task.completed_at = None

    db.commit()
    db.refresh(task)

    return {
        "id": task.id,
        "day_number": task.day_number,
        "stage_key": task.stage_key,
        "title": task.title,
        "completed": False,
        "postponed_count": task.postponed_count,
        "message": f"Task postponed to Day {task.day_number}.",
    }


@router.post("")
def create_custom_task(
    payload: TaskCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    new_task = ConstructionTask(
        project_id=project.id,
        stage_key=payload.stage_key,
        day_number=max(1, payload.day_number),
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else "",
        trade=payload.trade.strip() if payload.trade else "General Masonry",
        is_critical=payload.is_critical,
        completed=False,
        postponed_count=0,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return {
        "id": new_task.id,
        "day_number": new_task.day_number,
        "stage_key": new_task.stage_key,
        "title": new_task.title,
        "completed": False,
        "postponed_count": 0,
    }
