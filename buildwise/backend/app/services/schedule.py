from datetime import date, datetime
import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "stages.json", "r", encoding="utf-8") as f:
    STAGES_CONFIG = json.load(f)


def get_default_start_date() -> date:
    today = date.today()
    if today.month == 12:
        return date(today.year + 1, 1, 1)
    return date(today.year, today.month + 1, 1)


def add_months(start: date, months: int) -> date:
    new_month = start.month + months
    new_year = start.year + (new_month - 1) // 12
    new_month = ((new_month - 1) % 12) + 1
    return date(new_year, new_month, 1)


def format_month_year(d: date) -> str:
    return d.strftime("%B %Y")


def simulate_schedule(
    total_cost: int,
    monthly_budget: float,
    breakdown: list[dict[str, Any]] | None = None,
    quality: str = "Standard",
    floors: int = 1,
    built_up_area: float = 1850.0,
    start_date: str | None = None,
) -> dict[str, Any]:
    t_cost = int(total_cost)
    m_budget = max(20000.0, float(monthly_budget))

    # Parse or default start date
    if start_date:
        try:
            cur_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            cur_start = get_default_start_date()
    else:
        cur_start = get_default_start_date()

    # Map category costs
    cat_map: dict[str, int] = {}
    if breakdown:
        for b in breakdown:
            cat_map[b["key"]] = int(b["amount"])
    else:
        # Standard default split
        cat_map["structure"] = int(t_cost * 0.34)
        cat_map["masonry"] = int(t_cost * 0.18)
        cat_map["electrical_plumbing"] = int(t_cost * 0.15)
        cat_map["flooring_finishing"] = int(t_cost * 0.22)
        cat_map["doors_windows"] = t_cost - sum(cat_map.values())

    s_cost = cat_map.get("structure", int(t_cost * 0.34))
    m_cost = cat_map.get("masonry", int(t_cost * 0.18))
    ep_cost = cat_map.get("electrical_plumbing", int(t_cost * 0.15))
    ff_cost = cat_map.get("flooring_finishing", int(t_cost * 0.22))
    dw_cost = cat_map.get("doors_windows", int(t_cost * 0.11))

    # Allocate stage costs matching exactly total_cost
    stage_costs: dict[str, int] = {
        "site_prep": int(round(s_cost * 0.10)),
        "foundation": int(round(s_cost * 0.35)),
        "structure": s_cost - int(round(s_cost * 0.10)) - int(round(s_cost * 0.35)),
        "walls": m_cost,
        "electrical": int(round(ep_cost * 0.50)),
        "plumbing": ep_cost - int(round(ep_cost * 0.50)),
        "finishing": ff_cost + dw_cost,
    }

    # Verify stage costs sum
    allocated_sum = sum(stage_costs.values())
    diff = t_cost - allocated_sum
    stage_costs["structure"] += diff

    # Prepare stage state
    stages_info = STAGES_CONFIG["stages"]
    stage_dict = {s["key"]: s for s in stages_info}

    spent_per_stage: dict[str, int] = {k: 0 for k in stage_costs}
    progress_per_stage: dict[str, float] = {k: 0.0 for k in stage_costs}

    rollover_funds = 0.0
    cum_spend = 0
    months_data: list[dict[str, Any]] = []

    stage_start_month: dict[str, int] = {}
    stage_end_month: dict[str, int] = {}

    max_simulation_months = 48
    month_idx = 1

    monsoon_months = set(STAGES_CONFIG.get("monsoon_months", [10, 11, 12]))
    monsoon_slowdown = float(STAGES_CONFIG.get("monsoon_slowdown_factor", 0.25))

    while month_idx <= max_simulation_months:
        # Check if all completed
        if all(spent_per_stage[k] >= stage_costs[k] for k in stage_costs):
            break

        current_cal_date = add_months(cur_start, month_idx - 1)
        is_monsoon = current_cal_date.month in monsoon_months

        available_cash = rollover_funds + m_budget
        month_spend = 0

        # Allocate cash to eligible stages
        for s_def in stages_info:
            k = s_def["key"]
            if spent_per_stage[k] >= stage_costs[k]:
                continue

            # Check dependency satisfaction
            predecessors = s_def["predecessors"]
            min_req = s_def["min_predecessor_progress"]
            eligible = True
            for p in predecessors:
                if progress_per_stage[p] < min_req:
                    eligible = False
                    break

            if not eligible:
                continue

            if k not in stage_start_month:
                stage_start_month[k] = month_idx

            rem_cost = stage_costs[k] - spent_per_stage[k]
            min_dur = s_def["min_duration_months"]
            base_capacity = stage_costs[k] / float(min_dur)

            # Apply monsoon slowdown to outdoor/foundation stages
            if is_monsoon and s_def.get("weather_sensitive", False):
                base_capacity *= (1.0 - monsoon_slowdown)

            spend_cap = min(rem_cost, int(round(base_capacity)))
            alloc = min(available_cash - month_spend, float(spend_cap))

            if alloc > 0:
                spend_int = int(round(alloc))
                spend_per_stage_now = min(spend_int, rem_cost)
                spent_per_stage[k] += spend_per_stage_now
                month_spend += spend_per_stage_now
                progress_per_stage[k] = min(
                    100.0,
                    round((spent_per_stage[k] / max(1, stage_costs[k])) * 100.0, 1),
                )

                if spent_per_stage[k] >= stage_costs[k] and k not in stage_end_month:
                    stage_end_month[k] = month_idx

        rollover_funds = available_cash - month_spend
        cum_spend += month_spend

        # Determine overall progress (cost-weighted)
        overall_prog = min(100, int(round((cum_spend / float(t_cost)) * 100.0)))

        # Determine current active stage
        current_active_key = "finishing"
        for s_def in stages_info:
            k = s_def["key"]
            if 0 < progress_per_stage[k] < 100:
                current_active_key = k
                break
            elif progress_per_stage[k] == 0:
                current_active_key = k
                break

        # Compute next stage funding needed
        next_funding = 0
        for s_def in stages_info:
            k = s_def["key"]
            if progress_per_stage[k] < 100:
                next_funding = stage_costs[k] - spent_per_stage[k]
                break

        # Record monthly snapshot
        stage_status_map = {}
        for s_def in stages_info:
            k = s_def["key"]
            p = progress_per_stage[k]
            if p >= 100:
                stage_status_map[k] = "completed"
            elif p > 0:
                stage_status_map[k] = "active"
            else:
                stage_status_map[k] = "upcoming"

        months_data.append(
            {
                "month": month_idx,
                "label": f"Month {month_idx} ({current_cal_date.strftime('%b %Y')})",
                "spend": month_spend,
                "cumulative_spend": cum_spend,
                "overall_progress": overall_prog,
                "stage_progress": {k: int(round(progress_per_stage[k])) for k in stage_costs},
                "stage_status": stage_status_map,
                "current_stage_key": current_active_key,
                "next_stage_funding_needed": next_funding,
            }
        )

        month_idx += 1

    total_months_estimated = len(months_data)
    completion_cal_date = add_months(cur_start, total_months_estimated)

    # Stages summary list
    summary_stages = []
    for s_def in stages_info:
        k = s_def["key"]
        s_start = stage_start_month.get(k, 1)
        s_end = stage_end_month.get(k, s_start + s_def["min_duration_months"] - 1)
        dur = max(1, s_end - s_start + 1)
        summary_stages.append(
            {
                "key": k,
                "name": s_def["name"],
                "description": s_def["description"],
                "cost": stage_costs[k],
                "start_month": s_start,
                "end_month": s_end,
                "duration_months": dur,
            }
        )

    # Minimum monthly budget needed to finish in target nominal months (10-12 months)
    nominal_target_months = max(8, min(14, int(round(built_up_area / 180.0))))
    min_budget_target = int(round(t_cost / float(nominal_target_months)))

    return {
        "start_date": cur_start.strftime("%Y-%m-%d"),
        "estimated_months": total_months_estimated,
        "completion_date": format_month_year(completion_cal_date),
        "total_spend": cum_spend,
        "funding": {
            "status": "adequate" if m_budget >= min_budget_target * 0.9 else "tight",
            "shortfall": max(0, t_cost - int(m_budget * total_months_estimated)),
            "min_monthly_budget_for_target": min_budget_target,
        },
        "stages": summary_stages,
        "months": months_data,
        "assumptions": [
            f"Construction start date derived dynamically as first day of next month: {cur_start.strftime('%B %d, %Y')}.",
            "Unspent cash rolls over automatically across sequential construction months.",
            "Maximum monthly cash absorption per stage is capped by crew and material curing capacity.",
            "Northeast Monsoon seasonal adjustment (Oct-Dec) factors a 25% pace reduction on earthwork and concrete curing.",
        ],
        "limitations": [
            "Cost-weighted progress serves as an analytical financial model proxy for on-site physical milestones.",
            "Weather events or delayed material delivery may require dynamic adjustments to target completion.",
        ],
    }
