from typing import Any

from backend.app.services.cost import calculate_cost


def estimate_affordability(
    plot_width: float,
    plot_depth: float,
    floors: int = 1,
    bedrooms: int = 3,
    bathrooms: int = 2,
    quality: str = "Standard",
    location: str = "Tamil Nadu",
    budget: float = 3500000.0,
    monthly_budget: float = 300000.0,
) -> dict[str, Any]:
    pw = max(15.0, float(plot_width))
    pd = max(15.0, float(plot_depth))
    num_floors = max(1, min(4, int(floors)))
    num_beds = max(1, min(8, int(bedrooms)))
    num_baths = max(1, min(6, int(bathrooms)))

    # Compute approximate built-up area
    env_w = max(10.0, pw - 6.0)
    env_d = max(10.0, pd - 8.0)
    max_ground = env_w * env_d

    # Program requirement estimate:
    # living (180), kitchen (80), dining (90), utility (40), pooja (30), parking (150)
    core_common = 570.0
    bedroom_area = num_beds * 140.0
    bathroom_area = num_baths * 45.0
    staircase_area = 100.0 if num_floors > 1 else 0.0

    target_program = (core_common + bedroom_area + bathroom_area + staircase_area) * 1.15
    # Bound by buildable envelope
    max_total = max_ground * num_floors * 0.85
    approx_built_up = int(round(min(max_total, max(600.0, target_program)) / 50.0) * 50)

    # Cost estimate
    cost_res = calculate_cost(
        total_built_up_area=approx_built_up,
        quality=quality,
        location=location,
        floors=num_floors,
        plot_area=pw * pd,
        budget=budget,
    )
    est_cost = cost_res["total_cost"]

    # Basic duration estimate in months:
    # Average construction pace is roughly 150-200 sq ft per month for residential builds
    nominal_months = max(6, min(24, int(round(approx_built_up / 175.0))))

    # Financial funding pace check
    m_budget = max(10000.0, float(monthly_budget))
    months_by_cash = int(round(est_cost / m_budget))
    projected_months = max(nominal_months, min(36, months_by_cash))

    required_monthly = est_cost / nominal_months
    ratio = round(m_budget / required_monthly, 2)

    if ratio >= 0.90:
        label = "Good"
        explanation = (
            f"Your monthly budget of ₹{int(m_budget):,} comfortably covers the projected "
            f"₹{int(required_monthly):,} monthly capital requirement for a {nominal_months}-month completion."
        )
    elif ratio >= 0.65:
        label = "Tight"
        explanation = (
            f"Your monthly budget is slightly below the ideal pacing rate (₹{int(required_monthly):,}/mo). "
            f"Construction duration will extend to approximately {projected_months} months."
        )
    else:
        label = "Insufficient"
        explanation = (
            f"Monthly budget of ₹{int(m_budget):,} is significantly below construction capital burn. "
            f"Consider phased construction, increasing monthly allocation, or scaling down the built-up area."
        )

    # Budget status against total budget
    b_stat = cost_res["budget"]["status"]

    return {
        "approx_built_up_area": approx_built_up,
        "estimated_cost": est_cost,
        "budget_status": b_stat,
        "months_to_complete": projected_months,
        "affordability": {
            "label": label,
            "ratio": ratio,
            "explanation": explanation,
        },
    }
