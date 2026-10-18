"""Deterministic 3D Geometry Builder for Plan2Space 3D.
Converts 2D FloorPlanGeometry to 3D Trimesh Scene with layers (walls, floor, roof).
Coordinate System:
- 2D: X right, Y up (metres)
- 3D: X = 2D X, Y = 2D Height (up), Z = -2D Y (metres)
"""

from typing import List, Optional, Tuple, Dict, Any
import numpy as np
import trimesh
from shapely.geometry import Point, Polygon, MultiPolygon, box
from shapely.ops import unary_union

from app.schemas.geometry import FloorPlanGeometry, Wall, Opening, Room, RoofParameters
from app.schemas.requests import BuildParameters
from app.schemas.responses import MeshStats
from app.geometry.layers import apply_layer_color, LAYER_STYLES
from app.geometry.validator import validate_floor_plan_geometry


# 4x4 Transformation matrix from 2D plane + vertical extrude to glTF coordinate system
# In trimesh extrude: [x_2d, y_2d, z_extrude]
# We want glTF: X = x_2d, Y = z_extrude, Z = -y_2d
EXTRUDE_TO_GLTF_MATRIX = np.array([
    [1.0,  0.0,  0.0, 0.0],
    [0.0,  0.0,  1.0, 0.0],
    [0.0, -1.0,  0.0, 0.0],
    [0.0,  0.0,  0.0, 1.0],
], dtype=float)


def extrude_2d_polygon_to_3d(
    poly: Polygon,
    bottom_y: float,
    top_y: float,
) -> Optional[trimesh.Trimesh]:
    """
    Extrudes a 2D shapely polygon between bottom_y and top_y,
    and applies the 2D->glTF coordinate transformation.
    """
    height = top_y - bottom_y
    if height <= 1e-4 or poly.is_empty or poly.area <= 1e-6:
        return None

    try:
        # Trimesh polygon extrusion
        mesh = trimesh.creation.extrude_polygon(poly, height=height)
        if len(mesh.vertices) == 0:
            return None

        # Translate in Z (which maps to height in glTF) by bottom_y
        if abs(bottom_y) > 1e-6:
            mesh.apply_translation([0.0, 0.0, bottom_y])

        # Apply transformation to glTF coordinates
        mesh.apply_transform(EXTRUDE_TO_GLTF_MATRIX)
        return mesh
    except Exception:
        return None


class GeometryBuilder:
    """Deterministic 3D Mesh Generator for floor plans."""

    def __init__(self, geometry: FloorPlanGeometry, parameters: Optional[BuildParameters] = None):
        self.geometry = geometry
        self.params = parameters or BuildParameters()
        self.walls_map: Dict[str, Wall] = {w.id: w for w in geometry.walls}
        self.openings_by_wall: Dict[str, List[Opening]] = {}
        for op in geometry.openings:
            self.openings_by_wall.setdefault(op.wall_id, []).append(op)

    def _build_wall_span_polygon(
        self,
        wall: Wall,
        start_dist: float,
        end_dist: float,
    ) -> Optional[Polygon]:
        """Creates a 2D rectangle polygon for a segment of a wall."""
        if end_dist <= start_dist + 1e-4:
            return None

        x1, y1 = wall.start.x, wall.start.y
        ux, uy = wall.direction
        nx, ny = wall.normal
        half_thick = (wall.thickness if wall.thickness > 0 else self.params.exterior_wall_thickness) / 2.0

        p1_x = x1 + start_dist * ux - half_thick * nx
        p1_y = y1 + start_dist * uy - half_thick * ny

        p2_x = x1 + end_dist * ux - half_thick * nx
        p2_y = y1 + end_dist * uy - half_thick * ny

        p3_x = x1 + end_dist * ux + half_thick * nx
        p3_y = y1 + end_dist * uy + half_thick * ny

        p4_x = x1 + start_dist * ux + half_thick * nx
        p4_y = y1 + start_dist * uy + half_thick * ny

        poly = Polygon([(p1_x, p1_y), (p2_x, p2_y), (p3_x, p3_y), (p4_x, p4_y)])
        return poly if poly.is_valid and poly.area > 1e-6 else None

    def build_single_wall_mesh(self, wall: Wall) -> Optional[trimesh.Trimesh]:
        """Builds 3D mesh for an individual wall with door/window openings sliced."""
        wall_len = wall.length
        if wall_len < 0.05:
            return None

        wall_height = wall.height if wall.height > 0 else self.params.default_wall_height
        wall_ops = self.openings_by_wall.get(wall.id, [])
        wall_submeshes: List[trimesh.Trimesh] = []

        if not wall_ops:
            poly = self._build_wall_span_polygon(wall, 0.0, wall_len)
            if poly:
                m = extrude_2d_polygon_to_3d(poly, 0.0, wall_height)
                if m is not None:
                    apply_layer_color(m, "walls")
                    return m
            return None

        sorted_ops = sorted(wall_ops, key=lambda o: o.position_along_wall)
        curr = 0.0

        for op in sorted_ops:
            op_start = max(0.0, min(wall_len, op.position_along_wall))
            op_end = max(0.0, min(wall_len, op_start + op.width))

            if op_start > curr + 1e-4:
                poly_before = self._build_wall_span_polygon(wall, curr, op_start)
                if poly_before:
                    m = extrude_2d_polygon_to_3d(poly_before, 0.0, wall_height)
                    if m:
                        wall_submeshes.append(m)

            if op_end > op_start + 1e-4:
                op_poly = self._build_wall_span_polygon(wall, op_start, op_end)
                if op_poly:
                    if op.sill_height > 0.01:
                        m_sill = extrude_2d_polygon_to_3d(op_poly, 0.0, op.sill_height)
                        if m_sill:
                            wall_submeshes.append(m_sill)

                    lintel_bottom = op.sill_height + op.height
                    if lintel_bottom < wall_height - 0.01:
                        m_lintel = extrude_2d_polygon_to_3d(op_poly, lintel_bottom, wall_height)
                        if m_lintel:
                            wall_submeshes.append(m_lintel)

            curr = max(curr, op_end)

        if curr < wall_len - 1e-4:
            poly_after = self._build_wall_span_polygon(wall, curr, wall_len)
            if poly_after:
                m_fixed = extrude_2d_polygon_to_3d(poly_after, 0.0, wall_height)
                if m_fixed:
                    wall_submeshes.append(m_fixed)

        if not wall_submeshes:
            return None

        combined = trimesh.util.concatenate(wall_submeshes)
        apply_layer_color(combined, "walls")
        return combined

    def build_walls_mesh(self) -> Optional[trimesh.Trimesh]:
        """
        Builds the combined 3D walls mesh for backwards compatibility.
        """
        wall_submeshes: List[trimesh.Trimesh] = []
        seen_spans = set()
        for wall in self.geometry.walls:
            p1 = (round(wall.start.x, 2), round(wall.start.y, 2))
            p2 = (round(wall.end.x, 2), round(wall.end.y, 2))
            span = tuple(sorted([p1, p2]))
            if span in seen_spans:
                continue
            seen_spans.add(span)

            m = self.build_single_wall_mesh(wall)
            if m is not None:
                wall_submeshes.append(m)

        if not wall_submeshes:
            return None

        combined = trimesh.util.concatenate(wall_submeshes)
        apply_layer_color(combined, "walls")
        return combined

    def build_floor_meshes(self) -> Dict[str, trimesh.Trimesh]:
        """Builds floor slab meshes per room or for entire building footprint."""
        if not self.params.include_floor:
            return {}

        floor_thickness = self.params.floor_thickness
        meshes: Dict[str, trimesh.Trimesh] = {}

        if self.geometry.rooms:
            for rm in self.geometry.rooms:
                if len(rm.polygon) < 3:
                    continue
                pts = [(p.x, p.y) for p in rm.polygon]
                poly = Polygon(pts)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.is_empty or poly.area < 1e-4:
                    continue

                m = extrude_2d_polygon_to_3d(poly, -floor_thickness, 0.0)
                if m:
                    apply_layer_color(m, "floor")
                    meshes[f"floor:{rm.id}"] = m
        else:
            # Fallback: building footprint from wall centerlines bounding polygon
            wall_polys = []
            for w in self.geometry.walls:
                p = self._build_wall_span_polygon(w, 0.0, w.length)
                if p:
                    wall_polys.append(p)
            if wall_polys:
                merged = unary_union(wall_polys)
                hull = merged.convex_hull
                if isinstance(hull, Polygon) and not hull.is_empty:
                    m = extrude_2d_polygon_to_3d(hull, -floor_thickness, 0.0)
                    if m:
                        apply_layer_color(m, "floor")
                        meshes["floor"] = m

        return meshes

    def build_floor_mesh(self) -> Optional[trimesh.Trimesh]:
        """Builds combined floor slab mesh for backwards compatibility."""
        meshes = list(self.build_floor_meshes().values())
        if not meshes:
            return None
        combined = trimesh.util.concatenate(meshes)
        apply_layer_color(combined, "floor")
        return combined

    def build_roof_mesh(self) -> Optional[trimesh.Trimesh]:
        """Builds flat or gabled roof based on configuration."""
        roof_cfg = self.params.roof
        if roof_cfg.type == "none":
            return None

        # Determine top wall height
        max_h = max([w.height for w in self.geometry.walls], default=self.params.default_wall_height)

        # Footprint boundary
        bbox = self.geometry.calculate_bounding_box()
        overhang = roof_cfg.overhang
        x_min = bbox.min_x - overhang
        x_max = bbox.max_x + overhang
        y_min = bbox.min_y - overhang
        y_max = bbox.max_y + overhang

        if roof_cfg.type == "flat":
            rect_poly = box(x_min, y_min, x_max, y_max)
            m = extrude_2d_polygon_to_3d(rect_poly, max_h, max_h + roof_cfg.thickness)
            if m:
                apply_layer_color(m, "roof")
            return m

        if roof_cfg.type == "gabled":
            # Triangular gable prism along the longer axis
            width = x_max - x_min
            depth = y_max - y_min
            pitch_rad = np.radians(roof_cfg.pitch_deg)

            if width >= depth:
                # Ridge runs parallel to X axis (east-west)
                ridge_rise = (depth / 2.0) * np.tan(pitch_rad)
                mid_y = (y_min + y_max) / 2.0

                v_raw = np.array([
                    [x_min, y_min, max_h],
                    [x_min, y_max, max_h],
                    [x_min, mid_y, max_h + ridge_rise],
                    [x_max, y_min, max_h],
                    [x_max, y_max, max_h],
                    [x_max, mid_y, max_h + ridge_rise],
                ], dtype=float)

                faces = np.array([
                    [0, 2, 1],  # front gable
                    [3, 4, 5],  # back gable
                    [0, 1, 4], [0, 4, 3],  # bottom base
                    [0, 3, 5], [0, 5, 2],  # south pitch
                    [1, 2, 5], [1, 5, 4],  # north pitch
                ], dtype=int)
            else:
                # Ridge runs parallel to Y axis (north-south)
                ridge_rise = (width / 2.0) * np.tan(pitch_rad)
                mid_x = (x_min + x_max) / 2.0

                v_raw = np.array([
                    [x_min, y_min, max_h],
                    [x_max, y_min, max_h],
                    [mid_x, y_min, max_h + ridge_rise],
                    [x_min, y_max, max_h],
                    [x_max, y_max, max_h],
                    [mid_x, y_max, max_h + ridge_rise],
                ], dtype=float)

                faces = np.array([
                    [0, 1, 2],  # south gable
                    [3, 5, 4],  # north gable
                    [0, 4, 1], [0, 3, 4],  # bottom base
                    [0, 2, 5], [0, 5, 3],  # west pitch
                    [1, 4, 5], [1, 5, 2],  # east pitch
                ], dtype=int)

            # Transform raw vertices [x, y, z] to glTF coordinates: X = x, Y = z, Z = -y
            v_gltf = np.zeros_like(v_raw)
            v_gltf[:, 0] = v_raw[:, 0]
            v_gltf[:, 1] = v_raw[:, 2]
            v_gltf[:, 2] = -v_raw[:, 1]

            roof_mesh = trimesh.Trimesh(vertices=v_gltf, faces=faces, process=True)
            apply_layer_color(roof_mesh, "roof")
            return roof_mesh

        return None

    def get_wall_faces_lookup(self) -> Dict[str, Any]:
        """
        Computes a mapping for each wall's faces to adjacent rooms or exterior.
        Used by the Interior Design Studio for raycasting and room-level painting.
        Coordinates are in glTF 3D space: X = 2D x, Y = 2D height, Z = -2D y.
        """
        lookup: Dict[str, Any] = {}

        # Prepare room Shapely polygons
        room_polys: List[Tuple[Room, Polygon]] = []
        for rm in self.geometry.rooms:
            if len(rm.polygon) >= 3:
                p = Polygon([(pt.x, pt.y) for pt in rm.polygon])
                if not p.is_valid:
                    p = p.buffer(0)
                if not p.is_empty:
                    room_polys.append((rm, p))

        for wall in self.geometry.walls:
            ux, uy = wall.direction
            nx, ny = wall.normal
            mx = (wall.start.x + wall.end.x) / 2.0
            my = (wall.start.y + wall.end.y) / 2.0

            half_thick = (wall.thickness if wall.thickness > 0 else self.params.exterior_wall_thickness) / 2.0
            test_offset = half_thick + 0.10

            pt_pos = Point(mx + test_offset * nx, my + test_offset * ny)
            pt_neg = Point(mx - test_offset * nx, my - test_offset * ny)

            pos_room = None
            neg_room = None

            for rm, poly in room_polys:
                if poly.contains(pt_pos) or poly.distance(pt_pos) < 0.05:
                    pos_room = rm
                if poly.contains(pt_neg) or poly.distance(pt_neg) < 0.05:
                    neg_room = rm

            # glTF 3D normals: X = 2D x, Y = height, Z = -2D y
            pos_normal_3d = [float(nx), 0.0, float(-ny)]
            neg_normal_3d = [float(-nx), 0.0, float(ny)]
            dir_3d = [float(ux), 0.0, float(-uy)]

            lookup[wall.id] = {
                "wall_id": wall.id,
                "direction_3d": dir_3d,
                "normal_3d": pos_normal_3d,
                "faces": {
                    "pos_normal": {
                        "normal_3d": pos_normal_3d,
                        "room_id": pos_room.id if pos_room else None,
                        "room_name": pos_room.name if pos_room else "Exterior",
                    },
                    "neg_normal": {
                        "normal_3d": neg_normal_3d,
                        "room_id": neg_room.id if neg_room else None,
                        "room_name": neg_room.name if neg_room else "Exterior",
                    },
                    "top": {
                        "normal_3d": [0.0, 1.0, 0.0],
                        "room_id": None,
                        "room_name": "Top",
                    },
                    "start_cap": {
                        "normal_3d": [-dir_3d[0], 0.0, -dir_3d[2]],
                        "room_id": None,
                        "room_name": "End",
                    },
                    "end_cap": {
                        "normal_3d": dir_3d,
                        "room_id": None,
                        "room_name": "End",
                    },
                },
            }

        return lookup

    def build_scene(self) -> Tuple[trimesh.Scene, MeshStats]:
        """
        Builds complete 3D scene containing tagged layers and individual wall/floor meshes.
        Returns (scene, mesh_stats).
        """
        scene = trimesh.Scene()
        layers: List[str] = []
        all_meshes: List[trimesh.Trimesh] = []

        # 1. Walls: add each wall as its own node `wall:<wall_id>`
        wall_added = False
        seen_spans = set()
        for wall in self.geometry.walls:
            # Prevent coplanar duplicate wall meshes (e.g. adjacent rooms sharing an edge)
            p1 = (round(wall.start.x, 2), round(wall.start.y, 2))
            p2 = (round(wall.end.x, 2), round(wall.end.y, 2))
            span = tuple(sorted([p1, p2]))
            if span in seen_spans:
                continue
            seen_spans.add(span)

            w_mesh = self.build_single_wall_mesh(wall)
            if w_mesh is not None and len(w_mesh.vertices) > 0:
                scene.add_geometry(w_mesh, node_name=f"wall:{wall.id}", geom_name=f"wall:{wall.id}")
                all_meshes.append(w_mesh)
                wall_added = True

        if wall_added:
            layers.append("walls")

        # 2. Floor: add per-room `floor:<room_id>` or fallback `floor`
        floor_dict = self.build_floor_meshes()
        floor_added = False
        for f_name, f_mesh in floor_dict.items():
            if f_mesh is not None and len(f_mesh.vertices) > 0:
                scene.add_geometry(f_mesh, node_name=f_name, geom_name=f_name)
                all_meshes.append(f_mesh)
                floor_added = True

        if floor_added:
            layers.append("floor")

        # 3. Roof
        roof_mesh = self.build_roof_mesh()
        if roof_mesh is not None and len(roof_mesh.vertices) > 0:
            scene.add_geometry(roof_mesh, node_name="roof", geom_name="roof")
            layers.append("roof")
            all_meshes.append(roof_mesh)

        if not all_meshes:
            raise ValueError("No 3D geometry could be generated from the given floor plan.")

        # Compute aggregate mesh statistics
        combined = trimesh.util.concatenate(all_meshes)
        bounds = combined.bounds
        min_b = bounds[0].tolist()
        max_b = bounds[1].tolist()
        dims = (bounds[1] - bounds[0]).tolist()

        stats = MeshStats(
            vertex_count=int(len(combined.vertices)),
            face_count=int(len(combined.faces)),
            is_watertight=bool(combined.is_watertight),
            bounding_box_min=min_b,
            bounding_box_max=max_b,
            dimensions_m=dims,
            layers=layers,
        )

        return scene, stats
