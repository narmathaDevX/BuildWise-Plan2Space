import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "materials.json", "r", encoding="utf-8") as f:
    MATERIALS_CONFIG = json.load(f)


def calculate_default_materials(built_up_area: float = 1850.0) -> list[dict[str, Any]]:
    area = max(100.0, float(built_up_area))
    defaults = MATERIALS_CONFIG["defaults"]

    items = []
    for d in defaults:
        qty = round(area * float(d["factor_per_sqft"]), 1)
        # Clean whole numbers
        if d["unit"] in {"bags", "nos"}:
            qty = int(round(qty))
        elif d["unit"] in {"tons", "litres"}:
            qty = round(qty, 1)

        rate = float(d["rate"])
        items.append(
            {
                "key": d["key"],
                "name": d["name"],
                "category": d["category"],
                "quantity": qty,
                "unit": d["unit"],
                "rate": rate,
                "estimated_cost": int(round(qty * rate)),
                "purchased": bool(d.get("default_purchased", False)),
                "is_custom": False,
            }
        )

    return items


def summarize_materials(materials: list[dict[str, Any]]) -> dict[str, Any]:
    total_cost = 0
    purchased_cost = 0
    purchased_count = 0

    cat_counts: dict[str, int] = {}

    for m in materials:
        cost = int(round(float(m["quantity"]) * float(m["rate"])))
        m["estimated_cost"] = cost
        total_cost += cost
        cat = m.get("category", "General")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

        if m.get("purchased", False):
            purchased_cost += cost
            purchased_count += 1

    total_count = len(materials)
    progress_pct = int(round((purchased_count / max(1, total_count)) * 100))

    categories = [
        {"name": cat, "count": count}
        for cat, count in sorted(cat_counts.items())
    ]

    return {
        "rates_as_of": MATERIALS_CONFIG.get("as_of", "October 2026"),
        "total_cost": total_cost,
        "purchased_cost": purchased_cost,
        "purchased_count": purchased_count,
        "total_count": total_count,
        "purchase_progress": progress_pct,
        "categories": categories,
        "materials": materials,
    }
