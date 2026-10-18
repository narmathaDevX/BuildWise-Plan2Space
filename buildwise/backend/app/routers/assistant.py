"""AI Plan Advisor Router for BuildWise powered by Google Gemini.

Provides:
- POST /api/assistant/summarize (Structured plan analysis with caching and offline fallback)
- POST /api/assistant/chat (Streaming Q&A via SSE)
- POST /api/assistant/explain-ranking (Plain language explanation of ranking & tradeoffs)
"""

import hashlib
import json
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db.models import AISummary, PlanModel, Project, User
from backend.app.db.session import get_db
from backend.app.routers.auth import get_current_user
from backend.app.services.compliance import evaluate_tncdbr_compliance
from backend.app.services.cost import calculate_cost
from backend.app.services.ancillary import calculate_ancillary_costs
from backend.app.services.floorplan.solver import FloorPlanSolver
from backend.app.services.gemini_client import (
    compute_plan_content_hash,
    explain_plan_ranking,
    generate_plan_summary,
    generate_plan_walkthrough,
    modify_plan_parameters,
    stream_chat_response,
)
from backend.app.services.ranking import rank_plans
from backend.app.services.schedule import simulate_schedule

router = APIRouter(prefix="/api/assistant", tags=["AI Plan Advisor"])

# In-memory per-user rate limiter: {user_id: [timestamps]}
USER_REQUEST_TIMESTAMPS: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(user_id: str) -> None:
    limit = settings.RATE_LIMIT_PER_MINUTE
    now = time.time()
    cutoff = now - 60.0
    timestamps = [t for t in USER_REQUEST_TIMESTAMPS[user_id] if t > cutoff]
    if len(timestamps) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({limit} requests per minute). Please wait before submitting more queries.",
        )
    timestamps.append(now)
    USER_REQUEST_TIMESTAMPS[user_id] = timestamps


class SummarizeRequest(BaseModel):
    plan_id: str
    language: str = "en"  # "en" | "ta"
    audience: str = "homeowner"  # "homeowner" | "professional"
    plan_data: dict[str, Any] | None = None
    form_data: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    plan_id: str
    message: str
    language: str = "en"
    history: list[dict[str, Any]] = Field(default_factory=list)
    plan_data: dict[str, Any] | None = None
    form_data: dict[str, Any] | None = None


class ExplainRankingRequest(BaseModel):
    plans: list[dict[str, Any]]
    form: dict[str, Any] = Field(default_factory=dict)
    language: str = "en"


class WalkthroughRequest(BaseModel):
    plan_id: str = "active"
    language: str = "en"  # "en" | "ta"
    plan_data: dict[str, Any] | None = None
    form_data: dict[str, Any] | None = None


class ModifyPlanRequest(BaseModel):
    instruction: str
    current_form: dict[str, Any]
    current_plan: dict[str, Any] | None = None
    language: str = "en"


def _build_grounded_plan_context(
    plan_id: str,
    plan_data: dict[str, Any] | None = None,
    form_data: dict[str, Any] | None = None,
    current_user: User | None = None,
    db: Session | None = None,
) -> dict[str, Any]:
    """Assembles a verified, un-manipulated engineering context object."""
    plan_dict = plan_data or {}
    form_dict = form_data or {}

    # If plan_dict is empty, search database
    if not plan_dict and db is not None:
        db_plan = db.query(PlanModel).filter(PlanModel.plan_id == plan_id).first()
        if db_plan:
            plan_dict = db_plan.get_plan_data()

    # If form_dict is empty, search project
    if not form_dict and db is not None and current_user is not None:
        proj = db.query(Project).filter(Project.user_id == current_user.id).first()
        if proj and proj.form_json:
            try:
                form_dict = json.loads(proj.form_json)
            except Exception:
                form_dict = {}

    plot_w = float(form_dict.get("width") or plan_dict.get("request_echo", {}).get("plot", {}).get("width") or 40.0)
    plot_d = float(form_dict.get("length") or plan_dict.get("request_echo", {}).get("plot", {}).get("depth") or 60.0)
    facing = str(form_dict.get("facing") or plan_dict.get("request_echo", {}).get("road_side") or "North")
    quality = str(form_dict.get("quality") or "Standard")
    budget = float(form_dict.get("budget") or 3500000.0)
    monthly_budget = float(form_dict.get("monthlyBudget") or 300000.0)
    floors = int(form_dict.get("floors") or plan_dict.get("request_echo", {}).get("floors") or len(plan_dict.get("floors", [])) or 1)

    built_up = float(
        plan_dict.get("built_up_area")
        or plan_dict.get("details", {}).get("total_built_up")
        or plan_dict.get("details", {}).get("built_up_area")
        or (plot_w * plot_d * 0.75)
    )
    ground_built_up = float(plan_dict.get("details", {}).get("ground_built_up") or built_up)

    # Cost calculation
    civil = calculate_cost(
        total_built_up_area=built_up,
        quality=quality,
        location=form_dict.get("location", "Tamil Nadu"),
        floors=floors,
        plot_area=plot_w * plot_d,
        budget=budget,
    )
    ancillary = calculate_ancillary_costs(built_up_area=built_up, plot_area=plot_w * plot_d)
    total_cost = civil["total_cost"] + ancillary["total_ancillary_cost"]

    # Schedule simulation
    sched = simulate_schedule(
        total_cost=total_cost,
        monthly_budget=monthly_budget,
        breakdown=civil["breakdown"],
        quality=quality,
    )

    # Compliance
    comp = evaluate_tncdbr_compliance(
        plot_width=plot_w,
        plot_depth=plot_d,
        built_up_area=built_up,
        ground_built_up_area=ground_built_up,
        floors=floors,
    )

    # Extract rooms across all floors
    floors_list = plan_dict.get("floors", [])
    all_rooms_summary = []
    floor_breakdowns = []

    if floors_list and isinstance(floors_list, list):
        for fl_idx, fl in enumerate(floors_list):
            fl_level = fl.get("level", fl_idx)
            fl_name = "Ground Floor" if fl_level == 0 else f"First Floor (Level {fl_level})" if fl_level == 1 else f"Floor Level {fl_level}"
            fl_rooms = fl.get("rooms", [])
            fl_room_summaries = []
            fl_beds = 0
            fl_baths = 0
            for r in fl_rooms:
                rtype = r.get("type", "")
                rname = r.get("name") or r.get("id")
                is_bed = rtype in ("bedroom", "master_bedroom") and not any(kw in (r.get("id", "") + rname).lower() for kw in ("dress", "wardrobe", "study", "store", "alcove"))
                is_bath = "bath" in rtype or "toilet" in rtype
                if is_bed:
                    fl_beds += 1
                if is_bath:
                    fl_baths += 1

                r_item = {
                    "name": rname,
                    "type": rtype,
                    "floor_level": fl_level,
                    "floor_name": fl_name,
                    "width": r.get("width"),
                    "height": r.get("height"),
                    "area_sqft": r.get("area"),
                }
                all_rooms_summary.append(r_item)
                fl_room_summaries.append(r_item)

            floor_breakdowns.append({
                "level": fl_level,
                "name": fl_name,
                "rooms_count": len(fl_rooms),
                "bedrooms_count": fl_beds,
                "bathrooms_count": fl_baths,
                "rooms": fl_room_summaries,
            })
    else:
        for r in plan_dict.get("rooms", []):
            all_rooms_summary.append({
                "name": r.get("name") or r.get("id"),
                "type": r.get("type"),
                "floor_level": 0,
                "floor_name": "Ground Floor",
                "width": r.get("width"),
                "height": r.get("height"),
                "area_sqft": r.get("area"),
            })

    total_bedrooms = sum(
        1 for r in all_rooms_summary
        if r.get("type") in ("bedroom", "master_bedroom")
        and not any(kw in (r.get("name", "")).lower() for kw in ("dress", "wardrobe", "study", "store", "alcove"))
    )
    total_bathrooms = sum(
        1 for r in all_rooms_summary
        if "bath" in r.get("type", "") or "toilet" in r.get("type", "")
    )

    return {
        "plan_id": plan_id,
        "plan_name": plan_dict.get("name", "Architectural Layout"),
        "plot_width": plot_w,
        "plot_depth": plot_d,
        "plot_area_sqft": plot_w * plot_d,
        "facing": facing,
        "quality": quality,
        "budget": budget,
        "floors_count": floors,
        "built_up_area": built_up,
        "ground_built_up": ground_built_up,
        "ground_coverage_pct": comp.get("stats", {}).get("ground_coverage_pct", 66.0),
        "fsi": comp.get("stats", {}).get("fsi", 0.77),
        "is_tncdbr_compliant": comp.get("is_compliant", True),
        "civil_cost": civil["total_cost"],
        "ancillary_cost": ancillary["total_ancillary_cost"],
        "total_cost": total_cost,
        "estimated_months": sched["estimated_months"],
        "cost_breakdown": civil["breakdown"],
        "rooms": all_rooms_summary,
        "floor_breakdowns": floor_breakdowns,
        "total_bedrooms": total_bedrooms,
        "total_bathrooms": total_bathrooms,
        "score": plan_dict.get("score", 88.0),
        "ranking": plan_dict.get("ranking", {}),
    }


@router.post("/summarize")
def summarize_plan(
    payload: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generates a structured plan summary with per-user rate limiting and SQLite caching."""
    check_rate_limit(current_user.id)

    # Build grounded context
    context = _build_grounded_plan_context(
        plan_id=payload.plan_id,
        plan_data=payload.plan_data,
        form_data=payload.form_data,
        current_user=current_user,
        db=db,
    )

    # Check cache table
    content_hash = compute_plan_content_hash(context)
    cache_key = f"{payload.plan_id}:{content_hash}:{payload.language}:{payload.audience}"
    cached = db.query(AISummary).filter(AISummary.cache_key == cache_key).first()
    if cached:
        res = cached.get_summary()
        res["cached"] = True
        return res

    # Generate summary via Gemini (or deterministic fallback)
    summary_data = generate_plan_summary(
        ctx=context,
        language=payload.language,
        audience=payload.audience,
    )

    # Save to cache
    try:
        new_cached = AISummary(
            cache_key=cache_key,
            plan_id=payload.plan_id,
            language=payload.language,
            audience=payload.audience,
            summary_json=json.dumps(summary_data),
            source=summary_data.get("source", "gemini"),
        )
        db.add(new_cached)
        db.commit()
    except Exception:
        db.rollback()

    summary_data["cached"] = False
    return summary_data


@router.post("/chat")
def chat_about_plan(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Streams Q&A about the active plan via Server-Sent Events (SSE)."""
    check_rate_limit(current_user.id)

    context = _build_grounded_plan_context(
        plan_id=payload.plan_id,
        plan_data=payload.plan_data,
        form_data=payload.form_data,
        current_user=current_user,
        db=db,
    )

    return StreamingResponse(
        stream_chat_response(
            ctx=context,
            message=payload.message,
            language=payload.language,
            history=payload.history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/explain-ranking")
def explain_ranking_endpoint(
    payload: ExplainRankingRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Explains why candidate plans ranked as they did and provides plain-language tradeoffs."""
    check_rate_limit(current_user.id)

    # If ranking is not already computed, compute it
    ranked = rank_plans(payload.plans, form_context=payload.form)
    explanation = explain_plan_ranking(payload.plans, form_context=payload.form, language=payload.language)

    return {
        "status": "success",
        "language": payload.language,
        "ranking": [p.get("ranking") for p in payload.plans if p.get("ranking")],
        "explanation": explanation.get("explanation"),
        "spoken_script": explanation.get("spoken_script"),
        "source": explanation.get("source", "gemini"),
    }


def _build_engine_request_from_form(form: dict[str, Any], seed: int = 42) -> dict[str, Any]:
    facing = str(form.get("facing", "North")).upper()
    bedrooms = int(form.get("bedrooms", 3))
    bathrooms = int(form.get("bathrooms", 2))
    floors = int(form.get("floors", 1))

    rooms = [
        {"id": "living", "type": "living", "min_area": 120},
        {"id": "kitchen", "type": "kitchen", "min_area": 50},
        {"id": "dining", "type": "dining", "min_area": 70},
        {"id": "master", "type": "master_bedroom", "min_area": 120},
        {"id": "master_bath", "type": "attached_bathroom", "min_area": 30, "attached_to": "master"},
    ]
    for i in range(2, bedrooms + 1):
        rooms.append({"id": f"bedroom_{i}", "type": "bedroom", "min_area": 100})

    baths_to_add = max(0, bathrooms - 1)
    for i in range(baths_to_add):
        rooms.append({"id": f"bathroom_{i + 1}", "type": "bathroom", "min_area": 30})

    if form.get("pooja"):
        rooms.append({"id": "pooja", "type": "pooja", "min_area": 25})
    if form.get("utility"):
        rooms.append({"id": "utility", "type": "utility", "min_area": 30})
    if form.get("parking"):
        rooms.append({"id": "parking", "type": "parking", "min_area": 150})
    if form.get("balcony"):
        rooms.append({"id": "balcony", "type": "balcony", "min_area": 50})

    return {
        "request": {
            "units": "ft",
            "plot": {
                "width": float(form.get("width", 40)),
                "depth": float(form.get("length", 60)),
            },
            "road_side": facing[0] if facing else "N",
            "setbacks": {"front": 5, "rear": 3, "left": 3, "right": 3},
            "floors": floors,
            "rooms": rooms,
            "solver_options": {"num_alternatives": 3, "seed": seed},
            "quality": form.get("quality", "Standard"),
            "location": form.get("location", "Tamil Nadu"),
            "budget": float(form.get("budget", 3500000)),
            "monthly_budget": float(form.get("monthlyBudget", 300000)),
        },
        "options": {
            "num_alternatives": 3,
            "seed": seed,
            "quality": form.get("quality", "Standard"),
            "location": form.get("location", "Tamil Nadu"),
        },
    }


@router.post("/walkthrough")
def plan_walkthrough_endpoint(
    payload: WalkthroughRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generates an architectural spatial circulation walkthrough explaining room-to-room connectivity."""
    check_rate_limit(current_user.id)

    context = _build_grounded_plan_context(
        plan_id=payload.plan_id,
        plan_data=payload.plan_data,
        form_data=payload.form_data,
        current_user=current_user,
        db=db,
    )

    walkthrough_data = generate_plan_walkthrough(ctx=context, language=payload.language)

    return {
        "status": "success",
        "language": payload.language,
        "walkthrough": walkthrough_data,
        "source": walkthrough_data.get("source", "gemini"),
    }


@router.post("/modify-plan")
def modify_plan_endpoint(
    payload: ModifyPlanRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Interprets natural-language revision suggestions via Gemini, updates constraints, and re-generates candidate plans."""
    check_rate_limit(current_user.id)

    # 1. Parse natural language modification with LLM / fallback
    mod_result = modify_plan_parameters(
        instruction=payload.instruction,
        current_form=payload.current_form,
        current_plan=payload.current_plan,
    )
    updated_form = mod_result["updated_form"]

    # 2. Run floor plan solver with updated parameters
    engine_req = _build_engine_request_from_form(updated_form)
    solver = FloorPlanSolver(engine_req["request"], engine_req["options"])
    solution = solver.solve()

    plans = solution.get("plans", [])
    if not plans:
        conflicts = solution.get("conflicts", [])
        conflict_msg = conflicts[0].get("message") if conflicts else "Could not generate layout with requested changes."
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=conflict_msg,
        )

    # 3. Transparently rank newly generated plans
    ranked = rank_plans(plans, form_context=updated_form)

    return {
        "status": "success",
        "explanation": mod_result.get("explanation"),
        "changes_applied": mod_result.get("changes_applied", []),
        "updated_form": updated_form,
        "plans": plans,
        "ranking": [p.get("ranking") for p in plans if p.get("ranking")],
        "source": mod_result.get("source", "gemini"),
    }
