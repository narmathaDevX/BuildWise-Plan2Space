"""Geometry validation and sanity checking for Plan2Space 3D."""

import math
from typing import List, Tuple
from app.schemas.geometry import FloorPlanGeometry, Wall, Opening, Room


class GeometryValidationError(Exception):
    """Raised when floor plan geometry is invalid or cannot be processed."""
    pass


def validate_floor_plan_geometry(geom: FloorPlanGeometry, strict: bool = False) -> Tuple[bool, List[str]]:
    """
    Validates floor plan geometry.
    Returns (is_valid, warnings).
    If strict=True and critical errors exist, raises GeometryValidationError.
    """
    warnings: List[str] = []
    wall_map = {w.id: w for w in geom.walls}

    # 1. Wall validation
    if len(geom.walls) == 0:
        msg = "Floor plan must contain at least one wall."
        if strict:
            raise GeometryValidationError(msg)
        warnings.append(msg)

    degenerate_walls = []
    for w in geom.walls:
        length = w.length
        if length < 0.05:
            degenerate_walls.append(w.id)
            warnings.append(f"Wall '{w.id}' has near-zero length ({length:.3f}m) and will be ignored.")

    # 2. Opening validation
    for op in geom.openings:
        if op.wall_id not in wall_map:
            warnings.append(f"Opening '{op.id}' references non-existent wall '{op.wall_id}'.")
            continue

        parent_wall = wall_map[op.wall_id]
        wall_len = parent_wall.length

        if op.width <= 0.05:
            warnings.append(f"Opening '{op.id}' width ({op.width:.2f}m) is too small.")
        if op.height <= 0.05:
            warnings.append(f"Opening '{op.id}' height ({op.height:.2f}m) is too small.")

        if op.position_along_wall < 0:
            warnings.append(f"Opening '{op.id}' has negative offset ({op.position_along_wall:.2f}m). Clamping to 0.")
            op.position_along_wall = 0.0

        if op.position_along_wall + op.width > wall_len + 0.05:
            warnings.append(
                f"Opening '{op.id}' (span {op.position_along_wall:.2f}m to {op.position_along_wall + op.width:.2f}m) "
                f"exceeds wall '{parent_wall.id}' length ({wall_len:.2f}m)."
            )

        if op.sill_height + op.height > parent_wall.height:
            warnings.append(
                f"Opening '{op.id}' top ({op.sill_height + op.height:.2f}m) exceeds wall height ({parent_wall.height:.2f}m)."
            )

    # Check for opening overlaps per wall
    openings_by_wall: dict[str, List[Opening]] = {}
    for op in geom.openings:
        openings_by_wall.setdefault(op.wall_id, []).append(op)

    for wall_id, ops in openings_by_wall.items():
        sorted_ops = sorted(ops, key=lambda o: o.position_along_wall)
        for i in range(len(sorted_ops) - 1):
            curr_op = sorted_ops[i]
            next_op = sorted_ops[i + 1]
            if curr_op.position_along_wall + curr_op.width > next_op.position_along_wall + 1e-4:
                warnings.append(
                    f"Openings '{curr_op.id}' and '{next_op.id}' overlap along wall '{wall_id}'."
                )

    # 3. Room validation
    for rm in geom.rooms:
        if len(rm.polygon) < 3:
            warnings.append(f"Room '{rm.name}' ({rm.id}) has fewer than 3 boundary points.")
        if rm.area_sqm < 0.1:
            warnings.append(f"Room '{rm.name}' ({rm.id}) has near-zero area ({rm.area_sqm:.2f} m²).")

    # 4. Scale validation
    if geom.scale.pixels_per_metre <= 0:
        warnings.append("Scale pixels_per_metre must be positive. Resetting to default 50 px/m.")
        geom.scale.pixels_per_metre = 50.0
        geom.scale.source = "default"

    if geom.scale.source == "default":
        warnings.append("Floor plan scale is using default assumption (not measured or user-provided).")

    is_valid = len(degenerate_walls) < len(geom.walls)
    return is_valid, warnings
