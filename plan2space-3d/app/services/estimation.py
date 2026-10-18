"""
Materials Required and Cost Estimation Engine for Plan2Space 3D.
Computes Bill of Quantities (BoQ) and realistic cost estimates based on
architectural geometry, roof selection, finishes, and placed furniture.
"""

import math
from typing import Dict, List, Any, Optional
from app.schemas.geometry import FloorPlanGeometry
from app.schemas.design import DesignState


# Standard Unit Rates in INR (Indian Rupees) and conversion to USD
# Modeled after realistic residential construction cost indices
USD_EXCHANGE_RATE = 82.5  # 1 USD = 82.5 INR

UNIT_RATES_INR = {
    # Structural & Masonry
    "modular_brick": 9.50,            # per brick
    "cement_bag": 385.00,             # per 50kg bag
    "river_sand_cum": 1650.00,        # per cubic metre
    "coarse_aggregate_cum": 1450.00,  # per cubic metre
    "tmt_steel_kg": 68.00,            # per kg
    "concrete_ready_mix_cum": 4500.00,# per cubic metre

    # Finishes
    "wall_plaster_putty_sqm": 85.00,  # per sq.m
    "wall_paint_litre": 320.00,       # per litre (emulsion)
    "exterior_weather_paint": 360.00, # per litre
    "floor_vitrified_tiles_sqm": 850.00, # per sq.m
    "tile_adhesive_bag": 320.00,      # per 20kg bag

    # Roof Materials
    "spanish_clay_roof_tile": 58.00,  # per tile
    "roof_waterproofing_sqm": 380.00, # per sq.m for flat slab screed/membrane
    "clay_ridge_tile": 95.00,         # per linear metre ridge piece

    # Openings
    "standard_door_unit": 8500.00,    # per door frame & shutter
    "french_double_door": 16500.00,   # per double door unit
    "standard_window_unit": 6200.00,  # per UPVC/alu window unit
    "large_window_unit": 9800.00,     # per large picture window

    # Furniture catalogue item approximate retail rates
    "bed_single": 14000.00,
    "bed_double": 22000.00,
    "bed_king": 32000.00,
    "bed_bunk": 26000.00,
    "sofa_2seater": 18000.00,
    "sofa_3seater": 24000.00,
    "sofa_lshaped": 42000.00,
    "armchair": 9500.00,
    "dining_chair": 3800.00,
    "office_chair": 7500.00,
    "stool": 1800.00,
    "wardrobe": 24000.00,
    "bookshelf": 9500.00,
    "cabinet": 16000.00,
    "table_dining": 22000.00,
    "table_coffee": 6500.00,
    "table_study": 9500.00,
    "table_bedside": 4200.00,
    "tv": 38000.00,
    "refrigerator": 32000.00,
    "washing_machine": 26000.00,
    "air_conditioner": 36000.00,
    "ceiling_fan": 3200.00,
    "lamp": 2800.00,
    "bathtub": 35000.00,
    "shower": 12000.00,
    "toilet": 8500.00,
    "wash_basin": 4500.00,
    "rug": 4500.00,
    "potted_plant": 1200.00,
    "decor": 2500.00,
}


def calculate_plan_estimate(geometry: FloorPlanGeometry, design: Optional[DesignState] = None) -> Dict[str, Any]:
    """
    Computes a comprehensive Bill of Materials and Cost Breakdown for a given plan and optional design.
    """
    # 1. Dimensions & Room Areas
    rooms = geometry.rooms or []
    total_floor_area = sum(r.area_sqm for r in rooms) if rooms else 0.0

    # Fallback to bounding box area if no rooms detected
    bbox = geometry.calculate_bounding_box()
    plan_width = bbox.width_m if hasattr(bbox, 'width_m') else (bbox.max_x - bbox.min_x)
    plan_depth = bbox.depth_m if hasattr(bbox, 'depth_m') else (bbox.max_y - bbox.min_y)
    footprint_area = max(1.0, plan_width * plan_depth)

    if total_floor_area <= 0:
        total_floor_area = max(10.0, footprint_area * 0.85)

    # 2. Walls Analysis
    walls = geometry.walls or []
    total_wall_length = 0.0
    ext_wall_vol = 0.0
    int_wall_vol = 0.0
    gross_wall_area = 0.0

    for w in walls:
        dx = w.end.x - w.start.x
        dy = w.end.y - w.start.y
        length = math.hypot(dx, dy)
        height = w.height or 2.7
        thick = w.thickness or (0.23 if w.is_exterior else 0.115)

        total_wall_length += length
        gross_wall_area += length * height
        vol = length * height * thick
        if w.is_exterior:
            ext_wall_vol += vol
        else:
            int_wall_vol += vol

    # 3. Openings Deductions
    openings = geometry.openings or []
    openings_area = 0.0
    doors_count = 0
    windows_count = 0

    for op in openings:
        w_m = op.width or 1.0
        h_m = op.height or 2.1
        openings_area += w_m * h_m
        if op.type == "door":
            doors_count += 1
        elif op.type == "window":
            windows_count += 1

    if doors_count == 0 and len(walls) > 0:
        doors_count = max(1, len(rooms))
    if windows_count == 0 and len(walls) > 0:
        windows_count = max(2, len(rooms) * 2)

    net_wall_area = max(10.0, gross_wall_area - openings_area)
    total_wall_volume = max(2.0, (ext_wall_vol + int_wall_vol) - (openings_area * 0.20))

    # 4. Roof Type Analysis
    roof_cfg = geometry.roof
    roof_type = "plain"
    roof_shape = "flat"
    roof_visible = True

    if design and design.ceiling_paint:
        cp = design.ceiling_paint
        roof_type = getattr(cp, "roof_type", "plain") or "plain"
        roof_shape = getattr(cp, "roof_shape", "gabled" if roof_cfg.type == "gabled" else "flat") or "flat"
        roof_visible = getattr(cp, "roof_visible", True)
    elif roof_cfg.type != "none":
        roof_shape = roof_cfg.type
        roof_type = "tiles" if roof_cfg.type == "gabled" else "plain"

    roof_multiplier = 1.15 if roof_shape == "gabled" else 1.05
    roof_surface_area = footprint_area * roof_multiplier

    # 5. Bill of Materials Quantities Calculation
    # Masonry: Bricks ~500 per m3 of wall volume
    total_bricks = int(round(total_wall_volume * 480))
    # Cement bags for brick mortar: ~1.25 bags/m3
    cement_bags_brickwork = int(round(total_wall_volume * 1.25))

    # Concrete for Slab (Floor slab 0.15m + optional roof slab 0.15m)
    floor_slab_vol = total_floor_area * 0.15
    roof_slab_vol = (footprint_area * 0.15) if roof_shape == "flat" else (footprint_area * 0.10)
    total_concrete_vol = floor_slab_vol + roof_slab_vol

    # Concrete materials (M20 grade: 1:1.5:3):
    # Cement: 8 bags/m3
    cement_bags_concrete = int(round(total_concrete_vol * 7.8))
    # River Sand: 0.45 m3/m3
    sand_concrete_cum = round(total_concrete_vol * 0.45, 2)
    # Coarse Aggregate: 0.85 m3/m3
    agg_concrete_cum = round(total_concrete_vol * 0.85, 2)
    # Steel rebar: 75 kg/m3 of concrete
    steel_rebar_kg = int(round(total_concrete_vol * 75.0))

    # Plastering:
    # 2 sides for walls = net_wall_area * 2 + ceiling area
    total_plaster_area = (net_wall_area * 2.0) + total_floor_area
    cement_bags_plaster = int(round(total_plaster_area * 0.14))
    sand_plaster_cum = round(total_plaster_area * 0.022, 2)

    total_cement_bags = cement_bags_brickwork + cement_bags_concrete + cement_bags_plaster
    total_sand_cum = round((total_wall_volume * 0.28) + sand_concrete_cum + sand_plaster_cum, 2)
    total_aggregate_cum = round(agg_concrete_cum + (total_floor_area * 0.05), 2)

    # Painting:
    # 1 Litre covers ~9.5 m2 for 2 coats
    paint_litres = int(round((net_wall_area * 2.0 + total_floor_area) / 9.5))
    exterior_paint_litres = int(round((total_wall_length * 2.7 * 0.5) / 9.0))

    # Flooring tiles:
    floor_tiles_sqm = round(total_floor_area * 1.08, 1)  # 8% cutting wastage

    # Roof Materials:
    clay_tiles_count = 0
    if roof_type == "tiles":
        # ~16 clay tiles per m2
        clay_tiles_count = int(round(roof_surface_area * 16.0))
        clay_ridge_tiles = int(round(max(plan_width, plan_depth) * 1.2))
    else:
        clay_ridge_tiles = 0

    # Furniture Count & Inventory
    placed_furniture = []
    furniture_cost_inr = 0.0
    if design and design.furniture:
        for f in design.furniture:
            item_type = getattr(f, "item_type", "") or getattr(f, "type", "") or "chair"
            variant = getattr(f, "variant", "") or ""
            key = f"{item_type}_{variant}" if f"{item_type}_{variant}" in UNIT_RATES_INR else item_type
            rate = UNIT_RATES_INR.get(key, UNIT_RATES_INR.get(item_type, 6500.0))

            placed_furniture.append({
                "id": getattr(f, "id", ""),
                "name": getattr(f, "custom_label", None) or f"{item_type} ({variant})",
                "type": item_type,
                "variant": variant,
                "estimated_cost_inr": rate,
            })
            furniture_cost_inr += rate

    # 6. Itemized Bill of Materials
    bom_items = [
        {
            "category": "Civil & Structure",
            "name": "Modular Red Clay Bricks",
            "quantity": total_bricks,
            "unit": "pieces",
            "rate_inr": UNIT_RATES_INR["modular_brick"],
            "total_inr": round(total_bricks * UNIT_RATES_INR["modular_brick"], 2),
        },
        {
            "category": "Civil & Structure",
            "name": "Portland Pozzolana Cement (50kg Bags)",
            "quantity": total_cement_bags,
            "unit": "bags",
            "rate_inr": UNIT_RATES_INR["cement_bag"],
            "total_inr": round(total_cement_bags * UNIT_RATES_INR["cement_bag"], 2),
        },
        {
            "category": "Civil & Structure",
            "name": "Filtered River Sand / M-Sand",
            "quantity": total_sand_cum,
            "unit": "m³",
            "rate_inr": UNIT_RATES_INR["river_sand_cum"],
            "total_inr": round(total_sand_cum * UNIT_RATES_INR["river_sand_cum"], 2),
        },
        {
            "category": "Civil & Structure",
            "name": "Coarse Stone Aggregate (20mm)",
            "quantity": total_aggregate_cum,
            "unit": "m³",
            "rate_inr": UNIT_RATES_INR["coarse_aggregate_cum"],
            "total_inr": round(total_aggregate_cum * UNIT_RATES_INR["coarse_aggregate_cum"], 2),
        },
        {
            "category": "Civil & Structure",
            "name": "Fe-500D TMT Reinforcement Steel",
            "quantity": steel_rebar_kg,
            "unit": "kg",
            "rate_inr": UNIT_RATES_INR["tmt_steel_kg"],
            "total_inr": round(steel_rebar_kg * UNIT_RATES_INR["tmt_steel_kg"], 2),
        },
        {
            "category": "Flooring & Tiling",
            "name": "Glazed Vitrified Floor Tiles (600x600mm)",
            "quantity": floor_tiles_sqm,
            "unit": "m²",
            "rate_inr": UNIT_RATES_INR["floor_vitrified_tiles_sqm"],
            "total_inr": round(floor_tiles_sqm * UNIT_RATES_INR["floor_vitrified_tiles_sqm"], 2),
        },
        {
            "category": "Wall Finishes & Paint",
            "name": "Interior Acrylic Emulsion Paint & Primer",
            "quantity": paint_litres,
            "unit": "litres",
            "rate_inr": UNIT_RATES_INR["wall_paint_litre"],
            "total_inr": round(paint_litres * UNIT_RATES_INR["wall_paint_litre"], 2),
        },
        {
            "category": "Wall Finishes & Paint",
            "name": "Exterior Weatherproof Protective Paint",
            "quantity": exterior_paint_litres,
            "unit": "litres",
            "rate_inr": UNIT_RATES_INR["exterior_weather_paint"],
            "total_inr": round(exterior_paint_litres * UNIT_RATES_INR["exterior_weather_paint"], 2),
        },
        {
            "category": "Doors & Windows",
            "name": "Factory Flush Doors & Hardwood Frames",
            "quantity": doors_count,
            "unit": "units",
            "rate_inr": UNIT_RATES_INR["standard_door_unit"],
            "total_inr": round(doors_count * UNIT_RATES_INR["standard_door_unit"], 2),
        },
        {
            "category": "Doors & Windows",
            "name": "Anodized Aluminium / UPVC Windows",
            "quantity": windows_count,
            "unit": "units",
            "rate_inr": UNIT_RATES_INR["standard_window_unit"],
            "total_inr": round(windows_count * UNIT_RATES_INR["standard_window_unit"], 2),
        },
    ]

    # Add Roof specific materials
    if roof_type == "tiles":
        bom_items.append({
            "category": "Roofing",
            "name": "Interlocking Spanish Terracotta Roof Tiles",
            "quantity": clay_tiles_count,
            "unit": "tiles",
            "rate_inr": UNIT_RATES_INR["spanish_clay_roof_tile"],
            "total_inr": round(clay_tiles_count * UNIT_RATES_INR["spanish_clay_roof_tile"], 2),
        })
        if clay_ridge_tiles > 0:
            bom_items.append({
                "category": "Roofing",
                "name": "Terracotta Ridge & Eaves Caps",
                "quantity": clay_ridge_tiles,
                "unit": "pieces",
                "rate_inr": UNIT_RATES_INR["clay_ridge_tile"],
                "total_inr": round(clay_ridge_tiles * UNIT_RATES_INR["clay_ridge_tile"], 2),
            })
    else:
        bom_items.append({
            "category": "Roofing",
            "name": "Polymer Roof Slab Waterproofing & Screed",
            "quantity": round(roof_surface_area, 1),
            "unit": "m²",
            "rate_inr": UNIT_RATES_INR["roof_waterproofing_sqm"],
            "total_inr": round(roof_surface_area * UNIT_RATES_INR["roof_waterproofing_sqm"], 2),
        })

    # Subtotals
    materials_cost_inr = sum(item["total_inr"] for item in bom_items)
    # Labor & Overhead: ~32% of civil & finishing materials
    labor_cost_inr = round(materials_cost_inr * 0.32, 2)
    grand_total_inr = round(materials_cost_inr + labor_cost_inr + furniture_cost_inr, 2)

    return {
        "plan_summary": {
            "total_floor_area_sqm": round(total_floor_area, 2),
            "total_floor_area_sqft": round(total_floor_area * 10.7639, 1),
            "footprint_area_sqm": round(footprint_area, 2),
            "walls_count": len(walls),
            "openings_count": len(openings),
            "rooms_count": len(rooms),
            "doors_count": doors_count,
            "windows_count": windows_count,
            "roof": {
                "type": roof_type,
                "shape": roof_shape,
                "surface_area_sqm": round(roof_surface_area, 2),
                "is_tiled": roof_type == "tiles",
            },
            "furniture_count": len(placed_furniture),
        },
        "cost_summary": {
            "materials_cost_inr": round(materials_cost_inr, 2),
            "materials_cost_usd": round(materials_cost_inr / USD_EXCHANGE_RATE, 2),
            "labor_cost_inr": round(labor_cost_inr, 2),
            "labor_cost_usd": round(labor_cost_inr / USD_EXCHANGE_RATE, 2),
            "furniture_cost_inr": round(furniture_cost_inr, 2),
            "furniture_cost_usd": round(furniture_cost_inr / USD_EXCHANGE_RATE, 2),
            "grand_total_inr": grand_total_inr,
            "grand_total_usd": round(grand_total_inr / USD_EXCHANGE_RATE, 2),
            "cost_per_sqm_inr": round(grand_total_inr / max(1.0, total_floor_area), 2),
            "cost_per_sqft_inr": round((grand_total_inr / max(1.0, total_floor_area)) / 10.7639, 2),
        },
        "bill_of_materials": bom_items,
        "placed_furniture": placed_furniture,
        "rooms": [
            {
                "id": r.id,
                "name": r.name,
                "area_sqm": round(r.area_sqm, 2),
                "area_sqft": round(r.area_sqm * 10.7639, 1),
            }
            for r in rooms
        ],
    }
