import json
import math
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "rates.json", "r", encoding="utf-8") as f:
    RATES_DATA = json.load(f)

with open(DATA_DIR / "locations.json", "r", encoding="utf-8") as f:
    LOCATIONS_DATA = json.load(f)


def largest_remainder_round(values: list[float], target_sum: int = 100) -> list[int]:
    """Rounds a list of floats to integers such that their sum equals target_sum."""
    floored = [math.floor(v) for v in values]
    remainders = [(v - math.floor(v), i) for i, v in enumerate(values)]
    remainders.sort(key=lambda x: x[0], reverse=True)

    diff = target_sum - sum(floored)
    for k in range(diff):
        idx = remainders[k][1]
        floored[idx] += 1

    return floored


def calculate_cost(
    total_built_up_area: float,
    quality: str = "Standard",
    location: str = "Tamil Nadu",
    floors: int = 1,
    plot_area: float | None = None,
    budget: float | None = None,
    plan_id: str | None = None,
) -> dict[str, Any]:
    area = max(100.0, float(total_built_up_area))
    quality_clean = quality.title() if quality.title() in RATES_DATA["base_rates_per_sqft"] else "Standard"

    base_rate = float(RATES_DATA["base_rates_per_sqft"][quality_clean])

    # Location lookup
    loc_clean = location.lower().strip()
    loc_multiplier = RATES_DATA.get("default_multiplier", 1.0)
    matched_city = None
    for city_key, city_info in LOCATIONS_DATA.get("cities", {}).items():
        if city_key in loc_clean:
            loc_multiplier = city_info["multiplier"]
            matched_city = city_key.title()
            break

    # Multi-storey adjustment
    storey_key = str(min(4, max(1, int(floors))))
    storey_factor = float(RATES_DATA.get("multi_storey_factors", {}).get(storey_key, 1.0))

    effective_rate = round(base_rate * loc_multiplier * storey_factor, 2)
    raw_total = area * effective_rate
    # Round total cost to nearest 5,000 INR
    total_cost = int(round(raw_total / 5000.0) * 5000)

    # 5-Category Breakdown: Structure, Masonry, Electrical & Plumbing, Flooring & Finishing, Doors & Windows
    split_pcts = RATES_DATA["category_split_percentages"].get(quality_clean, RATES_DATA["category_split_percentages"]["Standard"])
    raw_pcts = [
        split_pcts["structure"],
        split_pcts["masonry"],
        split_pcts["electrical_plumbing"],
        split_pcts["flooring_finishing"],
        split_pcts["doors_windows"],
    ]

    integer_pcts = largest_remainder_round(raw_pcts, 100)

    keys = ["structure", "masonry", "electrical_plumbing", "flooring_finishing", "doors_windows"]
    names = [
        "Structure",
        "Masonry",
        "Electrical & Plumbing",
        "Flooring & Finishing",
        "Doors & Windows",
    ]

    # Compute raw amounts
    amounts = [int(round(total_cost * (p / 100.0))) for p in raw_pcts]
    # Rebalance amounts so sum equals total_cost exactly
    amount_diff = total_cost - sum(amounts)
    amounts[0] += amount_diff

    breakdown = [
        {
            "key": keys[i],
            "name": names[i],
            "amount": amounts[i],
            "percentage": integer_pcts[i],
        }
        for i in range(5)
    ]

    # Uncertainty range (5%)
    band_pct = RATES_DATA.get("uncertainty_band_pct", 5.0) / 100.0
    low_cost = int(round((total_cost * (1.0 - band_pct)) / 1000.0) * 1000)
    high_cost = int(round((total_cost * (1.0 + band_pct)) / 1000.0) * 1000)

    # Budget analysis
    planned_budget = float(budget) if budget and budget > 0 else 3500000.0
    remaining_budget = planned_budget - total_cost
    used_pct = round((total_cost / planned_budget) * 100.0, 1)

    if remaining_budget >= 0:
        budget_status = "within"
    elif abs(remaining_budget) <= planned_budget * 0.10:
        budget_status = "tight"
    else:
        budget_status = "over"

    assumptions = [
        f"Base plinth rate for {quality_clean} specification: ₹{int(base_rate):,} / sq ft (sourced from CPWD & TN PWD benchmark rates).",
        f"Location multiplier applied: {loc_multiplier} ({matched_city if matched_city else 'Neutral Tamil Nadu baseline'}).",
        f"Storey multiplier applied: {storey_factor} for {floors} floor(s).",
        "Breakdown percentages adjusted via largest-remainder algorithm to sum to exactly 100%.",
    ]
    if not matched_city and location:
        assumptions.append(f"Unrecognized district in '{location}'; applied neutral baseline multiplier 1.00.")

    excluded_items = [
        "Land purchase, legal registration and stamp duty charges",
        "Panchayat / DTCP / CMDA sanction approval fees",
        "Compound boundary wall and security iron entrance gates",
        "Borewell drilling, underground RCC water sump, and septic tank",
        "Interior loose furniture, modular kitchen accessories, and solar PV setup",
    ]

    return {
        "total_cost": total_cost,
        "cost_per_sqft": round(total_cost / area, 2),
        "range": {
            "low": low_cost,
            "high": high_cost,
        },
        "breakdown": breakdown,
        "budget": {
            "planned": planned_budget,
            "remaining": remaining_budget,
            "used_pct": used_pct,
            "status": budget_status,
        },
        "method": "formula",
        "assumptions": assumptions,
        "excluded_items": excluded_items,
        "rates_as_of": RATES_DATA.get("as_of", "October 2026"),
        "disclaimer": "Indicative construction estimate only. Actual costs depend on site soil condition, structural design, and live material price variations.",
    }
