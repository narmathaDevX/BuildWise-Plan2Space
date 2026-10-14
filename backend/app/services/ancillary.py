"""Pre-construction and ancillary cost calculation service for Tamil Nadu residential builds.

Covers essential non-civil expenses that typically cause 15-25% budget overruns:
TNEB connection, 300ft borewell + pump, DTCP sanction, compound wall, RCC sump, septic tank, and soil testing.
"""

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

try:
    with open(DATA_DIR / "ancillary_costs.json", "r", encoding="utf-8") as f:
        ANCILLARY_DATA = json.load(f)
except Exception:
    ANCILLARY_DATA = {}


def calculate_ancillary_costs(
    built_up_area: float = 1850.0,
    plot_area: float = 2400.0,
    selected_keys: list[str] | None = None,
) -> dict[str, Any]:
    """Calculates itemized pre-construction and ancillary expenses."""
    packages = ANCILLARY_DATA.get("packages", [])
    items = []
    total_ancillary_cost = 0

    area = max(100.0, float(built_up_area))

    for pkg in packages:
        key = pkg.get("key", "")
        # If selected_keys is specified, filter by it; otherwise include all default packages
        is_selected = True if selected_keys is None else (key in selected_keys)

        base_amt = float(pkg.get("base_amount", 0.0))
        rate_sqft = float(pkg.get("formula_per_sqft", 0.0))

        calculated_cost = int(round(base_amt + (area * rate_sqft)))

        if is_selected:
            total_ancillary_cost += calculated_cost

        items.append(
            {
                "key": key,
                "name": pkg.get("name", ""),
                "category": pkg.get("category", ""),
                "description": pkg.get("description", ""),
                "base_amount": base_amt,
                "formula_per_sqft": rate_sqft,
                "calculated_cost": calculated_cost,
                "mandatory": bool(pkg.get("mandatory", False)),
                "included": is_selected,
            }
        )

    return {
        "currency": "INR",
        "authority": ANCILLARY_DATA.get("authority", "Builders Association of India (BAI) TN Centre"),
        "total_ancillary_cost": total_ancillary_cost,
        "items": items,
        "advice": (
            "Ancillary and statutory pre-construction costs account for 18% to 22% of total capital required. "
            "Securing funds for borewell, TNEB, and DTCP sanction upfront ensures the site never halts before plinth level."
        ),
    }
