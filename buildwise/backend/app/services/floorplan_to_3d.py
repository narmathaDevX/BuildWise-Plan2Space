"""Converts BuildWise 2D floor plans (in feet) into watertight 3D models (in metres).
Features:
- Room boundary wall extraction (exterior vs interior classification)
- Realistic door openings and window sills/lintels
- Layer tagging (walls, floor, roof) with BuildWise architectural color palette
- Export to binary glTF (.glb)
"""

import hashlib
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import trimesh
from shapely.geometry import Polygon, box

FT_TO_M = 0.3048

# Transformation matrix from 2D (x, y) + height (z) to glTF 3D (X=x, Y=z, Z=-y)
EXTRUDE_TO_GLTF_MATRIX = np.array([
    [1.0,  0.0,  0.0, 0.0],
    [0.0,  0.0,  1.0, 0.0],
    [0.0, -1.0,  0.0, 0.0],
    [0.0,  0.0,  0.0, 1.0],
], dtype=float)

# BuildWise Architectural Palette
COLORS = {
    "walls": np.array([238, 234, 228, 255], dtype=np.uint8),      # Warm stone
    "interior_walls": np.array([245, 242, 238, 255], dtype=np.uint8), # Off-white partition
    "floor": np.array([218, 210, 198, 255], dtype=np.uint8),      # Light ceramic / limestone
    "roof": np.array([185, 104, 72, 255], dtype=np.uint8),        # BuildWise Terracotta (#b96848)
    "roof_flat": np.array([222, 218, 210, 255], dtype=np.uint8),  # Flat concrete terrace
    "roof_parapet": np.array([195, 188, 178, 255], dtype=np.uint8),# Parapet coping
    "roof_tiles": np.array([196, 77, 44, 255], dtype=np.uint8),    # Terracotta Mangalore clay tile
}


def apply_color(mesh: trimesh.Trimesh, color_rgba: np.ndarray):
    if hasattr(mesh, "visual") and len(mesh.faces) > 0:
        mesh.visual.face_colors = np.tile(color_rgba, (len(mesh.faces), 1))


def extrude_poly(poly: Polygon, bottom_h: float, top_h: float) -> Optional[trimesh.Trimesh]:
    height = top_h - bottom_h
    if height <= 1e-4 or poly.is_empty or poly.area <= 1e-6:
        return None
    try:
        m = trimesh.creation.extrude_polygon(poly, height=height)
        if len(m.vertices) == 0:
            return None
        if abs(bottom_h) > 1e-6:
            m.apply_translation([0.0, 0.0, bottom_h])
        m.apply_transform(EXTRUDE_TO_GLTF_MATRIX)
        return m
    except Exception:
        return None


def wall_span_box(x1: float, y1: float, x2: float, y2: float, thickness: float) -> Optional[Polygon]:
    length = math.hypot(x2 - x1, y2 - y1)
    if length <= 1e-4:
        return None
    ux = (x2 - x1) / length
    uy = (y2 - y1) / length
    nx = -uy
    ny = ux
    t = thickness / 2.0

    p1 = (x1 - t * nx, y1 - t * ny)
    p2 = (x2 - t * nx, y2 - t * ny)
    p3 = (x2 + t * nx, y2 + t * ny)
    p4 = (x1 + t * nx, y1 + t * ny)
    p = Polygon([p1, p2, p3, p4])
    return p if p.is_valid and p.area > 1e-6 else None


def build_flat_roof_mesh(min_x: float, min_y: float, max_x: float, max_y: float, wall_height: float) -> Optional[trimesh.Trimesh]:
    """Generates a flat concrete terrace slab with parapet boundary."""
    try:
        # Base slab
        p_slab = box(min_x - 0.2, min_y - 0.2, max_x + 0.2, max_y + 0.2)
        m_slab = extrude_poly(p_slab, wall_height, wall_height + 0.15)
        if not m_slab:
            return None
        apply_color(m_slab, COLORS["roof_flat"])

        # Parapet wall
        p_outer = box(min_x - 0.2, min_y - 0.2, max_x + 0.2, max_y + 0.2)
        p_inner = box(min_x - 0.05, min_y - 0.05, max_x + 0.05, max_y + 0.05)
        p_parapet = p_outer.difference(p_inner)
        m_parapet = extrude_poly(p_parapet, wall_height + 0.15, wall_height + 0.55)
        if m_parapet:
            apply_color(m_parapet, COLORS["roof_parapet"])
            return trimesh.util.concatenate([m_slab, m_parapet])
        return m_slab
    except Exception:
        return None


def build_tiled_roof_mesh(min_x: float, min_y: float, max_x: float, max_y: float, wall_height: float) -> Optional[trimesh.Trimesh]:
    """Generates a traditional pitched hip roof with terracotta clay tiles."""
    try:
        overhang = 0.45
        x0, x1 = min_x - overhang, max_x + overhang
        y0, y1 = min_y - overhang, max_y + overhang
        W = x1 - x0
        D = y1 - y0
        if W <= 0.1 or D <= 0.1:
            return None

        # 28-degree pitch ridge rise
        rise = min(1.8, max(1.1, min(W, D) * 0.28))
        zr = wall_height + rise
        z0 = wall_height

        if W >= D:
            yc = (y0 + y1) / 2.0
            hip_offset = max(0.8, D * 0.35)
            if W - 2 * hip_offset < 1.0:
                hip_offset = max(0.4, (W - 1.0) / 2.0)
            xr0 = x0 + hip_offset
            xr1 = x1 - hip_offset

            v = [
                [x0, y0, z0],
                [x1, y0, z0],
                [x1, y1, z0],
                [x0, y1, z0],
                [xr0, yc, zr],
                [xr1, yc, zr],
            ]
            faces = [
                [0, 1, 5], [0, 5, 4],  # front slope
                [1, 2, 5],             # right hip
                [2, 3, 4], [2, 4, 5],  # back slope
                [3, 0, 4],             # left hip
                [0, 3, 2], [0, 2, 1],  # bottom soffit
            ]
        else:
            xc = (x0 + x1) / 2.0
            hip_offset = max(0.8, W * 0.35)
            if D - 2 * hip_offset < 1.0:
                hip_offset = max(0.4, (D - 1.0) / 2.0)
            yr0 = y0 + hip_offset
            yr1 = y1 - hip_offset

            v = [
                [x0, y0, z0],
                [x1, y0, z0],
                [x1, y1, z0],
                [x0, y1, z0],
                [xc, yr0, zr],
                [xc, yr1, zr],
            ]
            faces = [
                [0, 1, 4],             # front hip
                [1, 2, 5], [1, 5, 4],  # right slope
                [2, 3, 5],             # back hip
                [3, 0, 4], [3, 4, 5],  # left slope
                [0, 3, 2], [0, 2, 1],  # bottom soffit
            ]

        m = trimesh.Trimesh(vertices=v, faces=faces)
        m.apply_transform(EXTRUDE_TO_GLTF_MATRIX)
        apply_color(m, COLORS["roof_tiles"])
        return m
    except Exception:
        return None


class BuildWise3DConverter:
    """Converts a BuildWise plan dictionary to an interactive 3D Trimesh Scene."""

    def __init__(self, plan_data: Dict[str, Any], options: Optional[Dict[str, Any]] = None):
        self.plan = plan_data
        self.options = options or {}
        self.wall_height = float(self.options.get("wall_height_m", 2.8))
        self.ext_thickness = float(self.options.get("exterior_wall_thickness_m", 0.23))
        self.int_thickness = float(self.options.get("interior_wall_thickness_m", 0.115))
        self.floor_thickness = float(self.options.get("floor_thickness_m", 0.15))
        self.include_floor = bool(self.options.get("include_floor", True))
        self.include_roof = bool(self.options.get("include_roof", False))
        self.roof_type = str(self.options.get("roof_type", "flat")).lower()

    def convert_to_3d_scene(self) -> Tuple[trimesh.Scene, Dict[str, Any]]:
        scene = trimesh.Scene()
        layers: List[str] = []
        all_meshes: List[trimesh.Trimesh] = []

        # 1. Extract rooms across floors (currently Level 0 ground floor)
        floors = self.plan.get("floors", [])
        if not floors:
            # Fallback if top-level rooms list
            rooms_raw = self.plan.get("rooms", [])
        else:
            rooms_raw = floors[0].get("rooms", [])

        if not rooms_raw:
            raise ValueError("Plan contains no rooms to convert to 3D.")

        # Convert rooms from feet to metres
        rooms_m = []
        for r in rooms_raw:
            rx = float(r.get("x", 0.0)) * FT_TO_M
            ry = float(r.get("y", 0.0)) * FT_TO_M
            rw = float(r.get("width", 0.0)) * FT_TO_M
            rh = float(r.get("height", 0.0)) * FT_TO_M
            if rw > 0.1 and rh > 0.1:
                rooms_m.append({
                    "id": str(r.get("id", "")),
                    "name": str(r.get("name", "Room")),
                    "type": str(r.get("type", "living")),
                    "x": rx, "y": ry, "w": rw, "h": rh,
                    "poly": Polygon([(rx, ry), (rx + rw, ry), (rx + rw, ry + rh), (rx, ry + rh)])
                })

        # 2. Extract and classify edges into Exterior vs Interior walls
        edges_map: Dict[Tuple[float, float, float, float], List[dict]] = {}

        for rm in rooms_m:
            x, y, w, h = rm["x"], rm["y"], rm["w"], rm["h"]
            # 4 boundary segments: south, east, north, west
            segments = [
                ((x, y), (x + w, y)),         # south
                ((x + w, y), (x + w, y + h)), # east
                ((x, y + h), (x + w, y + h)), # north
                ((x, y), (x, y + h)),         # west
            ]
            for (p1, p2) in segments:
                # Canonical ordered key
                if (p1[0], p1[1]) > (p2[0], p2[1]):
                    key = (round(p2[0], 3), round(p2[1], 3), round(p1[0], 3), round(p1[1], 3))
                else:
                    key = (round(p1[0], 3), round(p1[1], 3), round(p2[0], 3), round(p2[1], 3))
                edges_map.setdefault(key, []).append(rm)

        # 3. Build Wall Meshes with Openings (Doors & Windows)
        wall_parts: List[trimesh.Trimesh] = []

        for (x1, y1, x2, y2), adjacent_rooms in edges_map.items():
            is_exterior = len(adjacent_rooms) == 1
            thickness = self.ext_thickness if is_exterior else self.int_thickness
            length = math.hypot(x2 - x1, y2 - y1)
            if length < 0.2:
                continue

            primary_rm = adjacent_rooms[0]
            rm_type = primary_rm["type"]

            # Determine openings along this wall
            # If exterior wall of living, bedroom, dining, or kitchen: add a window
            has_window = is_exterior and rm_type in ("living", "bedroom", "master_bedroom", "dining", "kitchen") and length >= 2.0
            # If exterior wall of living room at front (min y): add main entry door
            has_main_door = is_exterior and rm_type in ("living", "hall", "foyer") and y1 < 2.0 and length >= 2.2
            # If interior wall: add connecting door
            has_interior_door = not is_exterior and length >= 1.4

            if not has_window and not has_main_door and not has_interior_door:
                # Solid wall
                p_box = wall_span_box(x1, y1, x2, y2, thickness)
                if p_box:
                    m = extrude_poly(p_box, 0.0, self.wall_height)
                    if m:
                        wall_parts.append(m)
            else:
                # Wall with opening: slice along length
                # Window: sill=0.9m, height=1.2m, width=1.4m
                # Door: sill=0.0m, height=2.1m, width=1.0m
                if has_main_door or has_interior_door:
                    op_w = 1.0 if has_main_door else 0.9
                    op_h = 2.1
                    op_sill = 0.0
                else:
                    op_w = min(1.4, length * 0.5)
                    op_h = 1.2
                    op_sill = 0.9

                op_start = (length - op_w) / 2.0
                op_end = op_start + op_w

                ux = (x2 - x1) / length
                uy = (y2 - y1) / length

                # Segment 1: before opening
                if op_start > 0.05:
                    p1 = wall_span_box(x1, y1, x1 + op_start * ux, y1 + op_start * uy, thickness)
                    if p1:
                        m1 = extrude_poly(p1, 0.0, self.wall_height)
                        if m1: wall_parts.append(m1)

                # Segment 2: opening span (sill & lintel)
                ox1, oy1 = x1 + op_start * ux, y1 + op_start * uy
                ox2, oy2 = x1 + op_end * ux, y1 + op_end * uy
                op_box = wall_span_box(ox1, oy1, ox2, oy2, thickness)
                if op_box:
                    if op_sill > 0.01:
                        m_sill = extrude_poly(op_box, 0.0, op_sill)
                        if m_sill: wall_parts.append(m_sill)
                    lintel_bottom = op_sill + op_h
                    if lintel_bottom < self.wall_height - 0.01:
                        m_lintel = extrude_poly(op_box, lintel_bottom, self.wall_height)
                        if m_lintel: wall_parts.append(m_lintel)

                # Segment 3: after opening
                if op_end < length - 0.05:
                    p3 = wall_span_box(x1 + op_end * ux, y1 + op_end * uy, x2, y2, thickness)
                    if p3:
                        m3 = extrude_poly(p3, 0.0, self.wall_height)
                        if m3: wall_parts.append(m3)

        if wall_parts:
            combined_walls = trimesh.util.concatenate(wall_parts)
            apply_color(combined_walls, COLORS["walls"])
            scene.add_geometry(combined_walls, node_name="walls", geom_name="walls")
            layers.append("walls")
            all_meshes.append(combined_walls)

        # 4. Build Floor Slabs with individual room node names
        if self.include_floor and rooms_m:
            floor_parts = []
            for rm in rooms_m:
                m_fl = extrude_poly(rm["poly"], -self.floor_thickness, 0.0)
                if m_fl:
                    apply_color(m_fl, COLORS["floor"])
                    rm_node_id = f"room_{rm['id']}"
                    scene.add_geometry(m_fl, node_name=rm_node_id, geom_name=rm_node_id)
                    floor_parts.append(m_fl)
                    all_meshes.append(m_fl)
            if floor_parts:
                layers.append("floor")

        # 5. Build Roof (Flat and Tiled options)
        # We generate both roof types so the user can switch between Flat Terrace and Mangalore Tiles dynamically
        if (self.include_roof or self.roof_type in ("flat", "tiles", "all")) and rooms_m:
            all_pts = []
            for rm in rooms_m:
                all_pts.extend([(rm["x"], rm["y"]), (rm["x"] + rm["w"], rm["y"] + rm["h"])])
            min_x = min(p[0] for p in all_pts)
            max_x = max(p[0] for p in all_pts)
            min_y = min(p[1] for p in all_pts)
            max_y = max(p[1] for p in all_pts)

            # Flat Concrete Roof Mesh with Parapet
            m_flat = build_flat_roof_mesh(min_x, min_y, max_x, max_y, self.wall_height)
            if m_flat:
                scene.add_geometry(m_flat, node_name="roof_flat", geom_name="roof_flat")
                layers.append("roof_flat")
                all_meshes.append(m_flat)

            # Traditional Pitched Mangalore Clay Tiles Roof
            m_tiles = build_tiled_roof_mesh(min_x, min_y, max_x, max_y, self.wall_height)
            if m_tiles:
                scene.add_geometry(m_tiles, node_name="roof_tiles", geom_name="roof_tiles")
                layers.append("roof_tiles")
                all_meshes.append(m_tiles)

            if m_flat or m_tiles:
                layers.append("roof")

        if not all_meshes:
            raise ValueError("No 3D geometry generated from rooms.")

        combined_all = trimesh.util.concatenate(all_meshes)
        bounds = combined_all.bounds
        dims_m = (bounds[1] - bounds[0]).tolist()
        dims_ft = [round(d / FT_TO_M, 1) for d in dims_m]

        rooms_info = [
            {
                "id": rm["id"],
                "mesh_name": f"room_{rm['id']}",
                "name": rm["name"],
                "type": rm["type"],
                "center_m": [
                    round(rm["x"] + rm["w"] / 2.0, 3),
                    0.25,
                    round(-(rm["y"] + rm["h"] / 2.0), 3),
                ],
                "size_m": [round(rm["w"], 3), self.wall_height, round(rm["h"], 3)],
                "width_ft": round(rm["w"] / FT_TO_M, 1),
                "height_ft": round(rm["h"] / FT_TO_M, 1),
                "area_sqft": round((rm["w"] * rm["h"]) / (FT_TO_M ** 2), 1),
            }
            for rm in rooms_m
        ]

        meta = {
            "vertex_count": int(len(combined_all.vertices)),
            "face_count": int(len(combined_all.faces)),
            "dimensions_m": [round(d, 2) for d in dims_m],
            "dimensions_ft": dims_ft,
            "layers": layers,
            "rooms_info": rooms_info,
        }

        return scene, meta


def export_plan_to_glb(plan_data: Dict[str, Any], output_path: Path, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    converter = BuildWise3DConverter(plan_data, options)
    scene, meta = converter.convert_to_3d_scene()
    glb_bytes = scene.export(file_type="glb")
    with open(output_path, "wb") as f:
        f.write(glb_bytes)
    meta["file_size_bytes"] = output_path.stat().st_size
    return meta
