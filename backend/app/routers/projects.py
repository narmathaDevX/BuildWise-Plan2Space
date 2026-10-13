import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.models import Estimate, Material, PlanModel, Project, User
from backend.app.db.session import get_db
from backend.app.routers.auth import get_current_user
from backend.app.services.cost import calculate_cost
from backend.app.services.materials import calculate_default_materials
from backend.app.services.schedule import simulate_schedule

router = APIRouter(prefix="/api/projects", tags=["Projects"])


class UpdateProjectPayload(BaseModel):
    name: str | None = None
    form: dict[str, Any]
    plans: list[dict[str, Any]] = Field(default_factory=list)
    selected_plan_id: str | None = None


class SelectPlanPayload(BaseModel):
    plan_id: str


def get_current_project(user: User, db: Session) -> Project | None:
    return (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .first()
    )


@router.get("")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "location": p.location,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat(),
        }
        for p in projects
    ]


@router.get("/current")
def get_current_project_detail(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        return {
            "id": None,
            "name": None,
            "has_project": False,
            "status": "No Project",
        }

    form_data = project.get_form()
    plans_models = db.query(PlanModel).filter(PlanModel.project_id == project.id).all()
    plans_list = [p.get_plan_data() for p in plans_models]

    estimate = (
        db.query(Estimate)
        .filter(Estimate.project_id == project.id)
        .order_by(Estimate.created_at.desc())
        .first()
    )

    return {
        "id": project.id,
        "name": project.name,
        "location": project.location,
        "status": project.status,
        "has_project": True,
        "form": form_data,
        "selected_plan_id": project.selected_plan_id,
        "plans": plans_list,
        "cost_estimate": estimate.get_cost() if estimate else None,
        "schedule_estimate": estimate.get_schedule() if estimate else None,
        "construction_start_date": project.construction_start_date,
        "current_month": project.current_month,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


@router.put("/current")
def save_current_project(
    payload: UpdateProjectPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    form = payload.form

    plot_w = float(form.get("width", 40))
    plot_l = float(form.get("length", 60))
    plot_area = plot_w * plot_l
    location = form.get("location", "Tamil Nadu")
    quality = form.get("quality", "Standard")
    budget = float(form.get("budget", 3500000))
    monthly_budget = float(form.get("monthlyBudget", 300000))
    floors = int(form.get("floors", 1))

    # Built-up area estimation
    selected_plan = None
    if payload.plans:
        if payload.selected_plan_id:
            selected_plan = next((p for p in payload.plans if p.get("plan_id") == payload.selected_plan_id), None)
        if not selected_plan:
            selected_plan = payload.plans[0]

    if selected_plan:
        built_up = float(
            selected_plan.get("details", {}).get("total_built_up")
            or selected_plan.get("details", {}).get("built_up_area")
            or selected_plan.get("built_up_area")
            or 1850.0
        )
    else:
        built_up = 1850.0

    cost_res = calculate_cost(
        total_built_up_area=built_up,
        quality=quality,
        location=location,
        floors=floors,
        plot_area=plot_area,
        budget=budget,
    )

    sched_res = simulate_schedule(
        total_cost=cost_res["total_cost"],
        monthly_budget=monthly_budget,
        breakdown=cost_res["breakdown"],
        quality=quality,
        floors=floors,
        built_up_area=built_up,
    )

    if not project:
        project = Project(
            user_id=current_user.id,
            name=payload.name or "My Dream Home",
            location=location,
            form_json=json.dumps(form),
            selected_plan_id=selected_plan.get("plan_id") if selected_plan else None,
            construction_start_date=sched_res["start_date"],
            current_month=1,
            status="Planning",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
    else:
        if payload.name:
            project.name = payload.name
        project.location = location
        project.set_form(form)
        if selected_plan:
            project.selected_plan_id = selected_plan.get("plan_id")
        project.construction_start_date = sched_res["start_date"]
        db.commit()

    # Save plans if provided
    if payload.plans:
        # Delete old plans
        db.query(PlanModel).filter(PlanModel.project_id == project.id).delete()
        for p in payload.plans:
            pid = p.get("plan_id") or p.get("id")
            db_plan = PlanModel(
                project_id=project.id,
                plan_id=pid,
                seed=p.get("meta", {}).get("seed", 42),
                plan_json=json.dumps(p),
                score=float(p.get("score") or p.get("score_breakdown", {}).get("total") or 88.0),
            )
            db.add(db_plan)

    # Save estimate
    db.query(Estimate).filter(Estimate.project_id == project.id).delete()
    est = Estimate(
        project_id=project.id,
        plan_id=project.selected_plan_id,
        cost_json=json.dumps(cost_res),
        schedule_json=json.dumps(sched_res),
    )
    db.add(est)

    # Refresh materials for new built-up area while preserving existing purchase flags
    existing_mats = {m.key: m.purchased for m in db.query(Material).filter(Material.project_id == project.id).all()}
    db.query(Material).filter(Material.project_id == project.id, Material.is_custom == False).delete()  # noqa: E712
    default_mats = calculate_default_materials(built_up)
    for dm in default_mats:
        purchased_flag = existing_mats.get(dm["key"], dm["purchased"])
        new_mat = Material(
            project_id=project.id,
            key=dm["key"],
            name=dm["name"],
            category=dm["category"],
            quantity=dm["quantity"],
            unit=dm["unit"],
            rate=dm["rate"],
            purchased=purchased_flag,
            is_custom=False,
        )
        db.add(new_mat)

    db.commit()
    return get_current_project_detail(current_user, db)


@router.put("/current/selected-plan")
def select_plan(
    payload: SelectPlanPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    plan_model = (
        db.query(PlanModel)
        .filter(PlanModel.project_id == project.id, PlanModel.plan_id == payload.plan_id)
        .first()
    )
    if not plan_model:
        raise HTTPException(status_code=404, detail=f"Plan '{payload.plan_id}' not found in project.")

    project.selected_plan_id = payload.plan_id
    plan_data = plan_model.get_plan_data()

    built_up = float(
        plan_data.get("details", {}).get("total_built_up")
        or plan_data.get("details", {}).get("built_up_area")
        or plan_data.get("built_up_area")
        or 1850.0
    )

    form = project.get_form()
    quality = form.get("quality", "Standard")
    location = project.location or "Tamil Nadu"
    budget = float(form.get("budget", 3500000))
    monthly_budget = float(form.get("monthlyBudget", 300000))
    floors = int(form.get("floors", 1))

    cost_res = calculate_cost(
        total_built_up_area=built_up,
        quality=quality,
        location=location,
        floors=floors,
        budget=budget,
    )
    sched_res = simulate_schedule(
        total_cost=cost_res["total_cost"],
        monthly_budget=monthly_budget,
        breakdown=cost_res["breakdown"],
        quality=quality,
        floors=floors,
        built_up_area=built_up,
    )

    est = db.query(Estimate).filter(Estimate.project_id == project.id).first()
    if not est:
        est = Estimate(project_id=project.id)
        db.add(est)
    est.plan_id = payload.plan_id
    est.set_cost(cost_res)
    est.set_schedule(sched_res)

    # Refresh standard materials
    existing_purchased = {m.key: m.purchased for m in db.query(Material).filter(Material.project_id == project.id).all()}
    db.query(Material).filter(Material.project_id == project.id, Material.is_custom == False).delete()  # noqa: E712
    for dm in calculate_default_materials(built_up):
        m = Material(
            project_id=project.id,
            key=dm["key"],
            name=dm["name"],
            category=dm["category"],
            quantity=dm["quantity"],
            unit=dm["unit"],
            rate=dm["rate"],
            purchased=existing_purchased.get(dm["key"], dm["purchased"]),
            is_custom=False,
        )
        db.add(m)

    db.commit()
    return {"status": "updated", "selected_plan_id": payload.plan_id}


@router.get("/current/summary")
def get_project_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        return {
            "has_project": False,
            "name": None,
            "location": None,
            "status": "No Project",
            "plot_area": 0,
            "built_up_area": 0,
            "estimated_cost": 0,
            "cost_formatted": "₹0L",
            "budget_status": "No project",
            "estimated_months": 0,
            "progress_percent": 0,
            "timeline_steps": [],
        }

    form = project.get_form()
    pw = float(form.get("width", 40))
    pl = float(form.get("length", 60))
    plot_area = int(round(pw * pl))

    est = db.query(Estimate).filter(Estimate.project_id == project.id).first()
    cost_data = est.get_cost() if est else {}
    sched_data = est.get_schedule() if est else {}

    total_cost = cost_data.get("total_cost", 3250000)
    cost_in_lakh = round(total_cost / 100000.0, 1)

    # Built up area
    selected_plan_id = project.selected_plan_id
    plan_m = db.query(PlanModel).filter(PlanModel.project_id == project.id, PlanModel.plan_id == selected_plan_id).first() if selected_plan_id else None
    if plan_m:
        pdata = plan_m.get_plan_data()
        built_up = int(round(pdata.get("details", {}).get("total_built_up") or 1850))
    else:
        built_up = 1850

    # Get projected month and overall progress
    cur_month = max(1, project.current_month)
    months_list = sched_data.get("months", [])
    overall_prog = 18
    if months_list:
        m_record = next((m for m in months_list if m["month"] == cur_month), months_list[min(cur_month - 1, len(months_list) - 1)])
        overall_prog = m_record.get("overall_progress", 18)

    # 5 timeline steps: Planning, Foundation, Structure, Finishing, Complete
    timeline_steps = [
        {"name": "Planning", "status": "completed" if overall_prog >= 10 else "active"},
        {"name": "Foundation", "status": "completed" if overall_prog >= 35 else ("active" if overall_prog >= 10 else "upcoming")},
        {"name": "Structure", "status": "completed" if overall_prog >= 75 else ("active" if overall_prog >= 35 else "upcoming")},
        {"name": "Finishing", "status": "completed" if overall_prog >= 98 else ("active" if overall_prog >= 75 else "upcoming")},
        {"name": "Complete", "status": "completed" if overall_prog >= 100 else "upcoming"},
    ]

    return {
        "has_project": True,
        "name": project.name,
        "location": project.location,
        "status": project.status,
        "plot_area": plot_area,
        "built_up_area": built_up,
        "estimated_cost": total_cost,
        "cost_formatted": f"₹{cost_in_lakh}L",
        "budget_status": "within budget" if cost_data.get("budget", {}).get("remaining", 1) >= 0 else "over budget",
        "estimated_months": sched_data.get("estimated_months", 10),
        "progress_percent": overall_prog,
        "timeline_steps": timeline_steps,
    }


@router.get("/current/construction")
def get_project_construction(
    month: int = Query(default=1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        return {
            "has_project": False,
            "month": 1,
            "total_months": 0,
            "stages": [],
        }

    est = db.query(Estimate).filter(Estimate.project_id == project.id).first()
    sched = est.get_schedule() if est else {}
    months_list = sched.get("months", [])
    total_months = sched.get("estimated_months", 11)

    cur_m = min(month, total_months)
    m_record = next((m for m in months_list if m["month"] == cur_m), months_list[-1] if months_list else {})

    stage_prog_map = m_record.get("stage_progress", {})
    stage_stat_map = m_record.get("stage_status", {})
    overall_progress = m_record.get("overall_progress", 0)

    sched_stages = sched.get("stages", [])
    result_stages = []
    completed_count = 0
    current_stage_obj = None

    for s in sched_stages:
        k = s["key"]
        prog = stage_prog_map.get(k, 0)
        stat = stage_stat_map.get(k, "upcoming")
        if prog == 100:
            completed_count += 1
        stg_item = {
            "key": k,
            "name": s["name"],
            "description": s["description"],
            "progress": prog,
            "status": stat,
        }
        result_stages.append(stg_item)
        if stat == "active" and not current_stage_obj:
            current_stage_obj = stg_item

    if not current_stage_obj and result_stages:
        current_stage_obj = result_stages[-1]

    months_remaining = max(0, total_months - cur_m)

    target_completion_text = f"{current_stage_obj['name']} / Target completion: {current_stage_obj['progress']}%" if current_stage_obj else "Planning"

    # Insights
    month_spend = m_record.get("spend", 300000)
    next_needed = m_record.get("next_stage_funding_needed", 0)
    insights = [
        {
            "label": "CASH ALLOCATION",
            "title": f"₹{int(month_spend):,} allocated",
            "text": "Spend rate is dynamically phased based on active stage capacity.",
        },
        {
            "label": "CURRENT MILESTONE",
            "title": current_stage_obj["name"] if current_stage_obj else "Planning",
            "text": f"Current stage is at {current_stage_obj['progress'] if current_stage_obj else 0}% projected progress.",
        },
        {
            "label": "NEXT STAGE CAPITAL",
            "title": f"₹{int(next_needed):,} needed",
            "text": "Subsequent stage requirements are accounted for in cash rollover.",
        },
    ]

    return {
        "has_project": True,
        "month": cur_m,
        "total_months": total_months,
        "month_label": m_record.get("label", f"Month {cur_m}"),
        "overall_progress": overall_progress,
        "completed_stages": completed_count,
        "current_stage": current_stage_obj,
        "estimated_completion": sched.get("completion_date", "March 2027"),
        "months_remaining": months_remaining,
        "current_phase_target": target_completion_text,
        "status_text": "Planning projected progress",
        "insights": insights,
        "stages": result_stages,
    }


@router.get("/current/report")
def get_project_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        return {
            "has_project": False,
            "project_name": "No Project",
            "location": "",
            "budget": 0,
            "estimated_cost": 0,
            "remaining": 0,
            "metrics": {},
            "cost_breakdown": [],
            "materials_summary": {"purchased_count": 0, "total_count": 0},
            "status_grid": [],
        }

    form = project.get_form()
    pw = float(form.get("width", 40))
    pl = float(form.get("length", 60))
    plot_area = int(round(pw * pl))
    budget = float(form.get("budget", 3500000))

    est = db.query(Estimate).filter(Estimate.project_id == project.id).first()
    cost_data = est.get_cost() if est else {}
    sched_data = est.get_schedule() if est else {}

    total_cost = cost_data.get("total_cost", 3250000)
    remaining = budget - total_cost

    plan_m = db.query(PlanModel).filter(PlanModel.project_id == project.id, PlanModel.plan_id == project.selected_plan_id).first() if project.selected_plan_id else None
    built_up = int(round(plan_m.get_plan_data().get("details", {}).get("total_built_up") or 1850)) if plan_m else 1850

    # Stages & current phase
    cur_m = project.current_month
    months_list = sched_data.get("months", [])
    overall_prog = 18
    completed_stages_count = 2
    current_phase_name = "Structure"

    if months_list:
        m_record = next((m for m in months_list if m["month"] == cur_m), months_list[min(cur_m - 1, len(months_list) - 1)])
        overall_prog = m_record.get("overall_progress", 18)
        stage_prog_map = m_record.get("stage_progress", {})
        stage_stat_map = m_record.get("stage_status", {})
        completed_stages_count = sum(1 for p in stage_prog_map.values() if p == 100)
        for s in sched_data.get("stages", []):
            if stage_stat_map.get(s["key"]) == "active":
                current_phase_name = s["name"]
                break

    # Materials summary
    mats = db.query(Material).filter(Material.project_id == project.id).all()
    total_mats = len(mats)
    purchased_mats = sum(1 for m in mats if m.purchased)

    breakdown = cost_data.get("breakdown", [
        {"name": "Structure", "amount": 1120000, "percentage": 34},
        {"name": "Masonry", "amount": 585000, "percentage": 18},
        {"name": "Electrical & Plumbing", "amount": 487500, "percentage": 15},
        {"name": "Flooring & Finishing", "amount": 682500, "percentage": 21},
        {"name": "Doors & Windows", "amount": 325000, "percentage": 10},
    ])

    status_grid = [
        {
            "title": "Planning",
            "subtitle": "Requirements and house plan prepared",
            "value": "Complete",
            "status": "completed",
        },
        {
            "title": "Foundation",
            "subtitle": "Foundation stage completed" if overall_prog >= 35 else "Foundation stage planned",
            "value": "Complete" if overall_prog >= 35 else "Pending",
            "status": "completed" if overall_prog >= 35 else "upcoming",
        },
        {
            "title": "Structure",
            "subtitle": "Structural work currently underway" if 35 <= overall_prog < 75 else ("Structural framing completed" if overall_prog >= 75 else "Structure pending"),
            "value": f"{min(100, int(round((overall_prog - 35) / 40.0 * 100)))}%" if 35 <= overall_prog < 75 else ("Complete" if overall_prog >= 75 else "Pending"),
            "status": "active" if 35 <= overall_prog < 75 else ("completed" if overall_prog >= 75 else "upcoming"),
        },
        {
            "title": "Finishing",
            "subtitle": "Finishing and services underway" if 75 <= overall_prog < 100 else ("Finishing completed" if overall_prog >= 100 else "Yet to begin"),
            "value": f"{min(100, int(round((overall_prog - 75) / 25.0 * 100)))}%" if 75 <= overall_prog < 100 else ("Complete" if overall_prog >= 100 else "Pending"),
            "status": "active" if 75 <= overall_prog < 100 else ("completed" if overall_prog >= 100 else "upcoming"),
        },
    ]

    return {
        "has_project": True,
        "project_name": project.name,
        "location": project.location,
        "status_label": "Planning active",
        "budget": budget,
        "estimated_cost": total_cost,
        "remaining": remaining,
        "metrics": {
            "plot_area": plot_area,
            "built_up_area": built_up,
            "estimated_duration_months": sched_data.get("estimated_months", 10),
            "overall_progress_pct": overall_prog,
            "completed_stages": completed_stages_count,
            "current_phase": current_phase_name,
        },
        "cost_breakdown": breakdown,
        "materials_summary": {
            "purchased_count": purchased_mats,
            "total_count": total_mats,
        },
        "expected_completion": sched_data.get("completion_date", "September 2027"),
        "status_grid": status_grid,
    }
