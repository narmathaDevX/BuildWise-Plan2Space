"""TNCDBR 2019 Statutory Compliance Evaluator for Tamil Nadu Residential Buildings.

Based on Tamil Nadu Combined Development and Building Rules, 2019 (TNCDBR 2019)
Notification: G.O. (Ms) No. 18, Housing and Urban Development [UD4(3)] Dept, dt. 04.02.2019
Directorate of Town and Country Planning (DTCP) & Chennai Metropolitan Development Authority (CMDA).
"""

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

try:
    with open(DATA_DIR / "tncdbr_rules.json", "r", encoding="utf-8") as f:
        TNCDBR_DATA = json.load(f)
except Exception:
    TNCDBR_DATA = {}


def evaluate_tncdbr_compliance(
    plot_width: float,
    plot_depth: float,
    built_up_area: float,
    ground_built_up_area: float | None = None,
    floors: int = 1,
    front_setback: float = 5.0,
    rear_setback: float = 5.0,
    side_left_setback: float = 3.0,
    side_right_setback: float = 3.0,
    road_width_feet: float = 30.0,
) -> dict[str, Any]:
    """Evaluates architectural and site specifications against TNCDBR 2019 statutory norms."""
    plot_area = round(float(plot_width) * float(plot_depth), 2)
    floors = max(1, min(4, int(floors)))

    # Ground floor footprint
    if ground_built_up_area and ground_built_up_area > 0:
        ground_cov_sqft = float(ground_built_up_area)
    else:
        # Approximate ground floor coverage from total built up divided by floors
        ground_cov_sqft = round(float(built_up_area) / floors, 2)

    rules = TNCDBR_DATA.get("rules", {}).get("residential_ordinary", {})
    max_coverage_pct = float(rules.get("max_plot_coverage_pct", 70.0))

    actual_coverage_pct = round((ground_cov_sqft / max(1.0, plot_area)) * 100, 1)
    coverage_passed = actual_coverage_pct <= max_coverage_pct

    # FSI Limits based on road width
    road_width_m = float(road_width_feet) * 0.3048
    if road_width_m < 9.0:
        allowed_fsi = 1.50
        road_category = "Below 9m (< 30 ft)"
    elif road_width_m <= 12.0:
        allowed_fsi = 1.75
        road_category = "9m to 12m (30 - 40 ft)"
    else:
        allowed_fsi = 2.00
        road_category = "Above 12m (> 40 ft)"

    actual_fsi = round(float(built_up_area) / max(1.0, plot_area), 2)
    fsi_passed = actual_fsi <= allowed_fsi

    # Setbacks evaluation
    min_setbacks = rules.get(
        "minimum_setbacks_feet",
        {"front": 5.0, "rear": 5.0, "side_left": 3.0, "side_right": 3.0},
    )

    front_passed = float(front_setback) >= float(min_setbacks.get("front", 5.0))
    rear_passed = float(rear_setback) >= float(min_setbacks.get("rear", 5.0))
    side_l_passed = float(side_left_setback) >= float(min_setbacks.get("side_left", 3.0))
    side_r_passed = float(side_right_setback) >= float(min_setbacks.get("side_right", 3.0))
    setbacks_passed = front_passed and rear_passed and side_l_passed and side_r_passed

    # Floors and height
    floors_passed = floors <= int(rules.get("max_floors", 4))

    # Mandatory Rainwater Harvesting (RWH) Calculation
    # G.O. Ms No. 138/MAWS: 1.25 L per sq ft roof area
    rwh_litres_required = int(round(ground_cov_sqft * 1.25))
    min_recharge_pit_dia_ft = 4.5
    min_recharge_pit_depth_ft = 10.0

    # Overall Compliance
    all_compliant = bool(coverage_passed and fsi_passed and setbacks_passed and floors_passed)

    checks = [
        {
            "id": "plot_coverage",
            "name": "Maximum Ground Plot Coverage",
            "statutory_limit": f"<= {max_coverage_pct}%",
            "actual_value": f"{actual_coverage_pct}% ({int(ground_cov_sqft)} sq ft)",
            "passed": coverage_passed,
            "rule": "TNCDBR 2019 Rule 35(1) - Residential Ordinary",
            "note": "Compliant ground footprint allows required open yard and aeration." if coverage_passed else f"Ground coverage exceeds {max_coverage_pct}% limit. Reduce footprint or expand setbacks.",
        },
        {
            "id": "fsi_check",
            "name": "Floor Space Index (FSI)",
            "statutory_limit": f"<= {allowed_fsi} (for road {road_category})",
            "actual_value": f"{actual_fsi}",
            "passed": fsi_passed,
            "rule": "TNCDBR 2019 Rule 35(2) - FSI Parameter",
            "note": "Within permissible development envelope." if fsi_passed else f"Built-up area exceeds statutory FSI limit of {allowed_fsi} for {road_category} road.",
        },
        {
            "id": "setbacks_check",
            "name": "Building Yard Setbacks",
            "statutory_limit": f"Front >= {min_setbacks.get('front', 5.0)}', Rear >= {min_setbacks.get('rear', 5.0)}', Sides >= {min_setbacks.get('side_left', 3.0)}'",
            "actual_value": f"F: {front_setback}', R: {rear_setback}', L: {side_left_setback}', R: {side_right_setback}'",
            "passed": setbacks_passed,
            "rule": "TNCDBR 2019 Rule 35(3) - Minimum Yard Standards",
            "note": "All yard clearances meet DTCP/CMDA emergency fire access and light ventilation norms." if setbacks_passed else "One or more setbacks are below minimum statutory widths.",
        },
        {
            "id": "building_height",
            "name": "Building Floors & Height",
            "statutory_limit": "<= G+3 (4 floors / 12 metres)",
            "actual_value": f"G+{floors-1} ({floors} floors)",
            "passed": floors_passed,
            "rule": "TNCDBR 2019 Rule 35(4) - Non-High Rise Residential",
            "note": "Standard residential permission applicable without special MSB clearance." if floors_passed else "Floors exceed G+3 ceiling. Multi-storey building (MSB) sanction needed.",
        },
        {
            "id": "rainwater_harvesting",
            "name": "Mandatory Rainwater Harvesting (RWH)",
            "statutory_limit": "Mandatory per Section 215-A TN District Municipalities Act",
            "actual_value": f"{rwh_litres_required} Litres minimum recharge capacity",
            "passed": True,
            "rule": "G.O. Ms No. 138/MAWS & TNCDBR Rule 40",
            "note": f"Requires min {min_recharge_pit_dia_ft} ft diameter x {min_recharge_pit_depth_ft} ft depth recharge shaft with 40mm metal filter bed.",
        },
    ]

    return {
        "is_statutory_compliant": all_compliant,
        "statutory_framework": "Tamil Nadu Combined Development and Building Rules, 2019 (TNCDBR 2019)",
        "governing_order": "G.O. (Ms) No. 18, Housing and Urban Development [UD4(3)] Dept, dt. 04.02.2019",
        "authority": "DTCP & CMDA",
        "plot_summary": {
            "plot_dimensions": f"{plot_width} ft x {plot_depth} ft",
            "plot_area_sqft": plot_area,
            "built_up_area_sqft": built_up_area,
            "ground_coverage_sqft": ground_cov_sqft,
            "ground_coverage_pct": actual_coverage_pct,
            "fsi_actual": actual_fsi,
            "fsi_permissible": allowed_fsi,
            "road_width_feet": road_width_feet,
        },
        "rwh_mandate": {
            "required_recharge_litres": rwh_litres_required,
            "recommended_pit_dia_ft": min_recharge_pit_dia_ft,
            "recommended_pit_depth_ft": min_recharge_pit_depth_ft,
            "statutory_act": "Section 215-A of Tamil Nadu District Municipalities Act & G.O. Ms No. 138/MAWS",
        },
        "sanitary_mandate": {
            "underground_sump_litres": 8000,
            "septic_tank_litres": 10000,
        },
        "checks": checks,
    }
