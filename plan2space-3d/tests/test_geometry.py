"""Unit tests for deterministic 3D geometry generation."""

import pytest
from app.schemas.geometry import FloorPlanGeometry, Wall, Opening, Room, Point2D, RoofParameters
from app.schemas.requests import BuildParameters
from app.geometry.builder import GeometryBuilder
from app.geometry.validator import validate_floor_plan_geometry


def create_sample_rectangular_plan() -> FloorPlanGeometry:
    """Creates a 10m x 8m rectangular house with a door and a window."""
    # 4 perimeter walls
    # w1: (0,0) -> (10,0) (bottom / south)
    # w2: (10,0) -> (10,8) (right / east)
    # w3: (10,8) -> (0,8) (top / north)
    # w4: (0,8) -> (0,0) (left / west)
    w1 = Wall(id="w_south", start=Point2D(x=0.0, y=0.0), end=Point2D(x=10.0, y=0.0), thickness=0.23, height=2.7)
    w2 = Wall(id="w_east", start=Point2D(x=10.0, y=0.0), end=Point2D(x=10.0, y=8.0), thickness=0.23, height=2.7)
    w3 = Wall(id="w_north", start=Point2D(x=10.0, y=8.0), end=Point2D(x=0.0, y=8.0), thickness=0.23, height=2.7)
    w4 = Wall(id="w_west", start=Point2D(x=0.0, y=8.0), end=Point2D(x=0.0, y=0.0), thickness=0.23, height=2.7)

    # Door on south wall at offset 4m, width 1.0m, height 2.1m, sill 0m
    door = Opening(
        id="door_main",
        wall_id="w_south",
        type="door",
        position_along_wall=4.0,
        width=1.0,
        height=2.1,
        sill_height=0.0,
    )

    # Window on north wall at offset 3m, width 1.5m, height 1.2m, sill 0.9m
    window = Opening(
        id="win_living",
        wall_id="w_north",
        type="window",
        position_along_wall=3.0,
        width=1.5,
        height=1.2,
        sill_height=0.9,
    )

    # Single room
    room = Room(
        id="rm_main",
        name="Living Room",
        polygon=[Point2D(x=0.0, y=0.0), Point2D(x=10.0, y=0.0), Point2D(x=10.0, y=8.0), Point2D(x=0.0, y=8.0)],
        area_sqm=80.0,
    )

    return FloorPlanGeometry(
        id="plan_test_rect",
        name="10x8 Rectangle Test",
        walls=[w1, w2, w3, w4],
        openings=[door, window],
        rooms=[room],
    )


def test_geometry_validation():
    plan = create_sample_rectangular_plan()
    is_valid, warnings = validate_floor_plan_geometry(plan)
    assert is_valid is True
    assert len(warnings) <= 1  # May have default scale warning


def test_geometry_builder_walls_and_openings():
    plan = create_sample_rectangular_plan()
    builder = GeometryBuilder(plan, BuildParameters(include_floor=True))
    scene, stats = builder.build_scene()

    assert stats.vertex_count > 0
    assert stats.face_count > 0
    assert "walls" in stats.layers
    assert "floor" in stats.layers

    # Check bounding box dimensions
    # X width should be ~10m (plus wall thickness margin)
    # Y height should be ~2.7m (plus floor thickness margin)
    # Z depth should be ~8m
    width_x = stats.dimensions_m[0]
    height_y = stats.dimensions_m[1]
    depth_z = stats.dimensions_m[2]

    assert 9.8 <= width_x <= 10.5
    assert 2.6 <= height_y <= 3.2
    assert 7.8 <= depth_z <= 8.5


def test_geometry_builder_with_gabled_roof():
    plan = create_sample_rectangular_plan()
    params = BuildParameters(
        roof=RoofParameters(type="gabled", pitch_deg=20.0, overhang=0.4),
        include_floor=True,
    )
    builder = GeometryBuilder(plan, params)
    scene, stats = builder.build_scene()

    assert "roof" in stats.layers
    # Total height should be > 2.7m due to gabled roof
    assert stats.dimensions_m[1] > 2.7


def test_wall_faces_lookup():
    plan = create_sample_rectangular_plan()
    builder = GeometryBuilder(plan)
    lookup = builder.get_wall_faces_lookup()

    assert "w_south" in lookup
    assert "w_east" in lookup
    assert "w_north" in lookup
    assert "w_west" in lookup

    south_info = lookup["w_south"]
    assert south_info["faces"]["pos_normal"]["room_id"] == "rm_main"
    assert south_info["faces"]["pos_normal"]["room_name"] == "Living Room"
    assert south_info["faces"]["neg_normal"]["room_id"] is None
    assert south_info["faces"]["neg_normal"]["room_name"] == "Exterior"
