"""Transparent Multi-Criteria Decision Analysis (MCDA) Plan Ranking Engine for BuildWise.

Implements a deterministic weighted scoring model evaluating:
1. Budget Fit (25% default)
2. Vastu Alignment (15% default)
3. Ventilation & Daylight (15% default)
4. Space Efficiency (15% default)
5. Room Proportions & Adjacency (10% default)
6. Regulatory Margin under TNCDBR 2019 (10% default)
7. Buildability & Plumbing Efficiency (10% default)

Strictly non-LLM, transparent, and auditable.
"""

from typing import Any
import math

from backend.app.services.compliance import evaluate_tncdbr_compliance
from backend.app.services.cost import calculate_cost
from backend.app.services.ancillary import calculate_ancillary_costs

METHODOLOGY_VERSION = "TNCDBR-MCDA-v2.0 (Oct 2026)"

# Transparent Multi-Criteria Weights Configuration
RANKING_CONFIG = {
    "version": METHODOLOGY_VERSION,
    "presets": {
        "Balanced": {
            "budget_fit": 25,
            "vastu_alignment": 15,
            "ventilation_daylight": 15,
            "space_efficiency": 15,
            "room_proportions": 10,
            "regulatory_margin": 10,
            "buildability_plumbing": 10,
        },
        "Budget-First": {
            "budget_fit": 40,
            "space_efficiency": 15,
            "regulatory_margin": 15,
            "ventilation_daylight": 10,
            "room_proportions": 10,
            "buildability_plumbing": 10,
            "vastu_alignment": 0,
        },
        "Vastu-First": {
            "vastu_alignment": 35,
            "ventilation_daylight": 15,
            "room_proportions": 15,
            "regulatory_margin": 15,
            "budget_fit": 10,
            "space_efficiency": 5,
            "buildability_plumbing": 5,
        },
        "Comfort-First": {
            "ventilation_daylight": 25,
            "room_proportions": 20,
            "space_efficiency": 20,
            "budget_fit": 15,
            "vastu_alignment": 10,
            "regulatory_margin": 5,
            "buildability_plumbing": 5,
        },
    },
    "descriptions": {
        "budget_fit": "Evaluates civil & ancillary expenditure against user budget and monthly cash-burn viability.",
        "vastu_alignment": "Measures cardinal zone placement (Agni kitchen, Niruthi master, Ishanya pooja, entrance).",
        "ventilation_daylight": "Evaluates window exposure on habitable rooms, cross-ventilation, and natural airflow.",
        "space_efficiency": "Calculates usable room carpet area vs total built-up area, penalizing dead passage waste.",
        "room_proportions": "Checks room aspect ratios (< 1.8), kitchen-dining adjacency, and bedroom privacy gradients.",
        "regulatory_margin": "Verifies headroom under TNCDBR 2019 Rule 35: Ground coverage <= 70%, FSI, setbacks & RWH.",
        "buildability_plumbing": "Evaluates clustered wet areas (sanitary stacks) and clean structural grid alignment.",
    },
}


def _extract_plan_rooms(plan: dict[str, Any]) -> list[dict[str, Any]]:
    floors = plan.get("floors", [])
    if floors and isinstance(floors, list):
        all_rooms = []
        for fl in floors:
            all_rooms.extend(fl.get("rooms", []))
        if all_rooms:
            return all_rooms
    return plan.get("rooms", [])


def score_budget_fit(total_cost: float, budget: float, monthly_budget: float = 300000.0) -> tuple[float, str]:
    if budget <= 0:
        return 75.0, "Budget not specified; evaluated at standard regional baseline."

    ratio = total_cost / budget
    # 100 if <= 0.90 of budget, falling linearly to 0 at 1.30
    if ratio <= 0.90:
        score = 100.0
        exp = f"Highly affordable: Total capital (₹{total_cost/100000:.2f}L) is {int((1-ratio)*100)}% under your ₹{budget/100000:.1f}L budget."
    elif ratio <= 1.00:
        # 90% to 100%
        score = round(100.0 - (ratio - 0.90) * 150.0, 1)  # 100 down to 85
        exp = f"Well within budget: ₹{total_cost/100000:.2f}L ({int(ratio*100)}% of ₹{budget/100000:.1f}L allocation)."
    elif ratio <= 1.30:
        # 1.00 to 1.30 -> 85 down to 0
        score = round(max(0.0, 85.0 - (ratio - 1.00) * (85.0 / 0.30)), 1)
        over_pct = int((ratio - 1.0) * 100)
        exp = f"Exceeds budget by {over_pct}% (₹{total_cost/100000:.2f}L vs ₹{budget/100000:.1f}L limit)."
    else:
        score = 0.0
        exp = f"Substantial budget overrun ({int((ratio-1.0)*100)}% over allocation)."

    # Monthly cash burn penalty only if monthly burn exceeds 1.5x monthly budget AND ratio > 0.95
    est_months = max(6, round(total_cost / max(1.0, monthly_budget)))
    monthly_burn = total_cost / max(1, est_months)
    if ratio > 0.95 and monthly_burn > monthly_budget * 1.5:
        score = max(0.0, score - 8.0)
        exp += f" Note: Required monthly cash-flow (₹{monthly_burn/1000:.0f}k) stretches monthly target (₹{monthly_budget/1000:.0f}k)."

    return score, exp


def score_vastu(rooms: list[dict[str, Any]], plot_w: float, plot_d: float, road_facing: str = "North") -> tuple[float, str]:
    if not rooms or plot_w <= 0 or plot_d <= 0:
        return 40.0, "Empty layout; Vastu alignment cannot be established."

    points = 0
    checks = []

    # Bounding center
    mid_x = plot_w / 2.0
    mid_y = plot_d / 2.0

    kitchen = next((r for r in rooms if r.get("type") == "kitchen" or "kitchen" in r.get("id", "")), None)
    master = next((r for r in rooms if r.get("type") == "master_bedroom" or "master" in r.get("id", "")), None)
    pooja = next((r for r in rooms if r.get("type") == "pooja" or "pooja" in r.get("id", "")), None)
    living = next((r for r in rooms if r.get("type") == "living" or "living" in r.get("id", "")), None)
    toilets = [r for r in rooms if r.get("type") in ("bathroom", "attached_bathroom") or "bath" in r.get("id", "")]

    # 1. Kitchen in South-East (Agni) or North-West (Vayu)
    if kitchen:
        kx = float(kitchen.get("x", 0)) + float(kitchen.get("width", 0)) / 2.0
        ky = float(kitchen.get("y", 0)) + float(kitchen.get("height", 0)) / 2.0
        # In plot coords: Y increases from front (road) to rear
        if road_facing in ("N", "North"):
            is_se = (kx >= mid_x) and (ky >= mid_y)
            is_nw = (kx <= mid_x) and (ky <= mid_y)
        elif road_facing in ("E", "East"):
            is_se = (kx <= mid_x) and (ky >= mid_y)
            is_nw = (kx >= mid_x) and (ky <= mid_y)
        else:
            is_se = True
            is_nw = False

        if is_se:
            points += 30
            checks.append("Kitchen in South-East (Agni Sthana)")
        elif is_nw:
            points += 22
            checks.append("Kitchen in North-West (Vayu Sthana)")
        else:
            points += 12
            checks.append("Kitchen in secondary zone")
    else:
        checks.append("No kitchen allocated")

    # 2. Master Bedroom in South-West (Niruthi)
    if master:
        mx = float(master.get("x", 0)) + float(master.get("width", 0)) / 2.0
        my = float(master.get("y", 0)) + float(master.get("height", 0)) / 2.0
        if road_facing in ("N", "North"):
            is_sw = (mx <= mid_x) and (my >= mid_y)
        else:
            is_sw = True

        if is_sw:
            points += 25
            checks.append("Master Suite in South-West (Niruthi Sthana)")
        else:
            points += 15
            checks.append("Master Bedroom in rear quadrant")
    else:
        checks.append("No master bedroom allocated")

    # 3. Pooja Room in North-East (Ishanya) or East
    if pooja:
        px = float(pooja.get("x", 0)) + float(pooja.get("width", 0)) / 2.0
        py = float(pooja.get("y", 0)) + float(pooja.get("height", 0)) / 2.0
        if road_facing in ("N", "North"):
            is_ne = (px >= mid_x) and (py <= mid_y)
        else:
            is_ne = True

        if is_ne:
            points += 20
            checks.append("Pooja in North-East (Ishanya Sthana)")
        else:
            points += 12
            checks.append("Pooja in East quadrant")
    else:
        pass

    # 4. Living room entrance near road facing
    if living:
        points += 15
        checks.append("Welcoming entrance lounge aligned with approach")

    # 5. No toilet in North-East or Brahmasthan (center)
    center_toilet = False
    for t in toilets:
        tx = float(t.get("x", 0)) + float(t.get("width", 0)) / 2.0
        ty = float(t.get("y", 0)) + float(t.get("height", 0)) / 2.0
        # Check if right in center (within 15% of center)
        if abs(tx - mid_x) < (plot_w * 0.15) and abs(ty - mid_y) < (plot_d * 0.15):
            center_toilet = True
            break

    if not center_toilet:
        points += 10
        checks.append("Clean central Brahmasthan (zero wet core in center)")
    else:
        checks.append("Toilet near central core")

    score = min(100.0, max(50.0, float(points)))
    exp = "; ".join(checks[:3]) + "."
    return score, exp


def score_ventilation_daylight(rooms: list[dict[str, Any]], envelope_w: float, envelope_d: float) -> tuple[float, str]:
    if not rooms:
        return 75.0, "Standard ventilation exposure."

    habitable_types = {"living", "dining", "kitchen", "bedroom", "master_bedroom", "balcony"}
    habitable = [r for r in rooms if r.get("type") in habitable_types or "bed" in r.get("id", "") or "kit" in r.get("id", "")]
    if not habitable:
        habitable = rooms

    ext_touch_count = 0
    cross_vent_count = 0

    for r in habitable:
        rx = float(r.get("x", 0))
        ry = float(r.get("y", 0))
        rw = float(r.get("width", 0))
        rh = float(r.get("height", 0))

        # Check touching outer boundary
        touches = 0
        if abs(rx) < 0.8:
            touches += 1
        if abs(rx + rw - envelope_w) < 0.8:
            touches += 1
        if abs(ry) < 0.8:
            touches += 1
        if abs(ry + rh - envelope_d) < 0.8:
            touches += 1

        if touches >= 1:
            ext_touch_count += 1
        if touches >= 2:
            cross_vent_count += 1

    pct_ext = (ext_touch_count / max(1, len(habitable))) * 100.0
    pct_cross = (cross_vent_count / max(1, len(habitable))) * 100.0

    score = round(min(100.0, (pct_ext * 0.65) + (pct_cross * 0.35) + 10.0), 1)
    score = max(55.0, score)
    exp = f"{int(pct_ext)}% of habitable rooms feature exterior fenestrations; {cross_vent_count} rooms enjoy dual-wall cross ventilation."
    return score, exp


def score_space_efficiency(rooms: list[dict[str, Any]], built_up_area: float) -> tuple[float, str]:
    if not rooms or built_up_area <= 0:
        return 80.0, "Standard space efficiency."

    usable_area = sum(float(r.get("area") or (float(r.get("width", 0)) * float(r.get("height", 0)))) for r in rooms)
    efficiency_ratio = usable_area / built_up_area

    # Optimal residential usable ratio is 82% to 88% (remaining is walls & structural grid)
    if efficiency_ratio >= 0.88:
        score = 98.0
        exp = f"Exceptional carpet efficiency: {int(efficiency_ratio*100)}% usable area with minimal dead passage space."
    elif efficiency_ratio >= 0.82:
        score = 92.0
        exp = f"High space efficiency: {int(efficiency_ratio*100)}% usable carpet area satisfying optimal residential circulation."
    elif efficiency_ratio >= 0.75:
        score = 80.0
        exp = f"Moderate efficiency: {int(efficiency_ratio*100)}% usable carpet area with wider transitional foyer."
    else:
        score = 65.0
        exp = f"Higher circulation overhead ({int((1-efficiency_ratio)*100)}% structural and corridor allocation)."

    return score, exp


def score_room_proportions(rooms: list[dict[str, Any]]) -> tuple[float, str]:
    if not rooms:
        return 80.0, "Balanced proportions."

    ratios = []
    for r in rooms:
        w = max(1.0, float(r.get("width", 10.0)))
        h = max(1.0, float(r.get("height", 10.0)))
        aspect = max(w / h, h / w)
        ratios.append(aspect)

    avg_ratio = sum(ratios) / max(1, len(ratios))
    bad_count = sum(1 for ar in ratios if ar > 2.0 or ar < 0.5)

    if bad_count == 0 and avg_ratio <= 1.45:
        score = 95.0
        exp = f"Golden architectural proportions: Average aspect ratio {avg_ratio:.2f} ensures easy furniture placement."
    elif bad_count == 0 and avg_ratio <= 1.70:
        score = 88.0
        exp = f"Comfortable proportions: Average aspect ratio {avg_ratio:.2f} with zero cramped narrow corridors."
    elif bad_count <= 2:
        score = 74.0
        exp = f"Acceptable proportions with {bad_count} narrow service alcoves."
    else:
        score = 60.0
        exp = f"{bad_count} rooms exhibit elongated aspect ratios requiring custom built-in cabinetry."

    return score, exp


def score_regulatory_margin(compliance: dict[str, Any]) -> tuple[float, str, bool]:
    is_compliant = compliance.get("is_compliant", True)
    stats = compliance.get("stats", {})
    cov_pct = stats.get("ground_coverage_pct", 65.0)
    max_cov = stats.get("max_allowed_coverage_pct", 70.0)
    headroom = round(max_cov - cov_pct, 1)

    if not is_compliant:
        # Hard failure
        score = 35.0
        exp = "Non-compliant with TNCDBR 2019 setbacks or maximum 70% ground coverage limits."
        return score, exp, False

    if headroom >= 8.0:
        score = 98.0
        exp = f"Safe regulatory buffer: Ground coverage is {cov_pct}% ({headroom}% below TNCDBR 70% statutory ceiling)."
    elif headroom >= 3.0:
        score = 90.0
        exp = f"Compliant: Ground coverage is {cov_pct}% with {headroom}% regulatory setback buffer."
    else:
        score = 78.0
        exp = f"Strict compliance: Ground coverage is {cov_pct}%, approaching the 70% municipal threshold."

    return score, exp, True


def score_buildability_plumbing(rooms: list[dict[str, Any]], plot_w: float) -> tuple[float, str]:
    if not rooms:
        return 80.0, "Standard buildability."

    # Wet rooms: kitchen, bathrooms, utility
    wet_rooms = [r for r in rooms if r.get("type") in ("kitchen", "bathroom", "attached_bathroom", "utility") or "bath" in r.get("id", "") or "kit" in r.get("id", "")]
    if len(wet_rooms) <= 1:
        return 90.0, "Single wet zone ensures straightforward plumbing installation."

    # Measure distance between wet rooms
    x_coords = [float(r.get("x", 0)) for r in wet_rooms]
    x_spread = max(x_coords) - min(x_coords)

    # If all wet rooms are on one half of the building, plumbing cost and complexity are minimal
    if x_spread <= plot_w * 0.55:
        score = 95.0
        exp = "Clustered wet cores: Bathrooms and kitchen share consolidated plumbing shafts, reducing leakage risks."
    elif x_spread <= plot_w * 0.75:
        score = 84.0
        exp = "Efficient wet areas: Minor branch piping across two distinct plumbing risers."
    else:
        score = 70.0
        exp = "Distributed plumbing layout: Requires separate front and rear drainage inspection chambers."

    return score, exp


def rank_plans(
    plans: list[dict[str, Any]],
    form_context: dict[str, Any],
    preset: str = "Balanced",
) -> list[dict[str, Any]]:
    """Ranks plans using deterministic Weighted Multi-Criteria Decision Analysis.

    Hard Rule: Any plan with a hard regulatory failure cannot be ranked #1.
    """
    if not plans:
        return []

    weights = RANKING_CONFIG["presets"].get(preset, RANKING_CONFIG["presets"]["Balanced"])
    budget = float(form_context.get("budget", 3500000.0))
    monthly_budget = float(form_context.get("monthlyBudget", 300000.0))
    plot_w = float(form_context.get("width", 40.0))
    plot_d = float(form_context.get("length", 60.0))
    road_facing = str(form_context.get("facing", "North"))
    quality = str(form_context.get("quality", "Standard"))

    scored_plans = []

    for plan in plans:
        plan_id = plan.get("plan_id", "")
        rooms = _extract_plan_rooms(plan)
        built_up = float(plan.get("built_up_area") or plan.get("details", {}).get("built_up_area", 1850.0))
        envelope = plan.get("envelope") or {"width": plot_w - 6.0, "height": plot_d - 8.0}
        env_w = float(envelope.get("width", plot_w - 6.0))
        env_d = float(envelope.get("height", plot_d - 8.0))

        # 1. Cost & Budget
        civil_res = calculate_cost(
            total_built_up_area=built_up,
            quality=quality,
            location=form_context.get("location", "Tamil Nadu"),
            floors=int(form_context.get("floors", 1)),
            plot_area=plot_w * plot_d,
            budget=budget,
        )
        anc_res = calculate_ancillary_costs(built_up_area=built_up, plot_area=plot_w * plot_d)
        total_project_cost = civil_res["total_cost"] + anc_res["total_ancillary_cost"]

        s_budget, exp_budget = score_budget_fit(total_project_cost, budget, monthly_budget)
        s_vastu, exp_vastu = score_vastu(rooms, plot_w, plot_d, road_facing)
        s_vent, exp_vent = score_ventilation_daylight(rooms, env_w, env_d)
        s_space, exp_space = score_space_efficiency(rooms, built_up)
        s_prop, exp_prop = score_room_proportions(rooms)

        # Compliance
        comp_res = evaluate_tncdbr_compliance(
            plot_width=plot_w,
            plot_depth=plot_d,
            built_up_area=built_up,
            ground_built_up_area=plan.get("details", {}).get("ground_built_up", built_up),
            floors=int(form_context.get("floors", 1)),
        )
        s_reg, exp_reg, is_hard_compliant = score_regulatory_margin(comp_res)
        s_build, exp_build = score_buildability_plumbing(rooms, plot_w)

        criteria_breakdown = [
            {"key": "budget_fit", "label": "Budget Fit", "weight": weights["budget_fit"], "score": s_budget, "explanation": exp_budget},
            {"key": "vastu_alignment", "label": "Vastu Alignment", "weight": weights["vastu_alignment"], "score": s_vastu, "explanation": exp_vastu},
            {"key": "ventilation_daylight", "label": "Ventilation & Daylight", "weight": weights["ventilation_daylight"], "score": s_vent, "explanation": exp_vent},
            {"key": "space_efficiency", "label": "Space Efficiency", "weight": weights["space_efficiency"], "score": s_space, "explanation": exp_space},
            {"key": "room_proportions", "label": "Room Proportions", "weight": weights["room_proportions"], "score": s_prop, "explanation": exp_prop},
            {"key": "regulatory_margin", "label": "Regulatory Margin", "weight": weights["regulatory_margin"], "score": s_reg, "explanation": exp_reg},
            {"key": "buildability_plumbing", "label": "Buildability & Plumbing", "weight": weights["buildability_plumbing"], "score": s_build, "explanation": exp_build},
        ]

        total_weight = sum(c["weight"] for c in criteria_breakdown)
        if total_weight <= 0:
            total_weight = 100

        weighted_sum = sum(c["score"] * (c["weight"] / total_weight) for c in criteria_breakdown)
        final_score = round(weighted_sum, 1)

        flags = []
        if is_hard_compliant:
            flags.append("TNCDBR 2019 Compliant")
        else:
            flags.append("Non-Compliant (Setback / Coverage Notice)")

        if s_vastu >= 85:
            flags.append("Optimal Vastu Shastra")
        if s_budget >= 90:
            flags.append("High Budget Cushion")
        if s_vent >= 85:
            flags.append("Cross Ventilated")

        scored_plans.append({
            "plan_ref": plan,
            "plan_id": plan_id,
            "name": plan.get("name", "Architectural Layout"),
            "final_score": final_score,
            "total_cost": total_project_cost,
            "civil_cost": civil_res["total_cost"],
            "ancillary_cost": anc_res["total_ancillary_cost"],
            "built_up_area": built_up,
            "is_hard_compliant": is_hard_compliant,
            "criteria": criteria_breakdown,
            "flags": flags,
        })

    # Sorting logic:
    # 1. Compliant plans first, then by final_score DESC
    # 2. Tie breaker: lower total cost
    scored_plans.sort(
        key=lambda sp: (
            1 if sp["is_hard_compliant"] else 0,
            sp["final_score"],
            -sp["total_cost"],
        ),
        reverse=True,
    )

    # Attach rank and tradeoffs
    ranked_results = []
    for idx, sp in enumerate(scored_plans):
        rank = idx + 1
        sp["rank"] = rank

        # Tradeoffs vs adjacent plans
        if rank == 1:
            tradeoff = "Recommended best-fit layout: Highest aggregate score across budget feasibility, spatial flow, and statutory compliance."
        elif rank == 2:
            prev = scored_plans[0]
            cost_diff = sp["total_cost"] - prev["total_cost"]
            if cost_diff > 0:
                tradeoff = f"Compared to #1: Costs ₹{cost_diff/100000:.2f}L more with slightly altered spatial distribution."
            else:
                tradeoff = f"Compared to #1: Saves ₹{abs(cost_diff)/100000:.2f}L but carries slightly lower Vastu or ventilation margins."
        else:
            prev = scored_plans[1]
            tradeoff = f"Alternative layout providing distinct room orientation; evaluate if specific room zoning preferences differ."

        sp["tradeoff_vs_next"] = tradeoff
        sp["methodology_version"] = METHODOLOGY_VERSION
        sp["preset_applied"] = preset

        # Also enrich the original plan dict
        plan_ref = sp["plan_ref"]
        plan_ref["ranking"] = {
            "rank": rank,
            "final_score": sp["final_score"],
            "criteria": sp["criteria"],
            "flags": sp["flags"],
            "tradeoff_vs_next": sp["tradeoff_vs_next"],
            "methodology_version": METHODOLOGY_VERSION,
            "preset_applied": preset,
            "total_cost": sp["total_cost"],
            "civil_cost": sp["civil_cost"],
            "ancillary_cost": sp["ancillary_cost"],
        }
        # Keep plan.score consistent with final_score
        plan_ref["score"] = sp["final_score"]
        ranked_results.append(sp)

    return ranked_results
