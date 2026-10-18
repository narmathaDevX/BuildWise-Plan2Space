"""Geometry module exports."""

from app.geometry.builder import GeometryBuilder, extrude_2d_polygon_to_3d
from app.geometry.layers import LAYER_STYLES, apply_layer_color
from app.geometry.validator import validate_floor_plan_geometry, GeometryValidationError

__all__ = [
    "GeometryBuilder",
    "extrude_2d_polygon_to_3d",
    "LAYER_STYLES",
    "apply_layer_color",
    "validate_floor_plan_geometry",
    "GeometryValidationError",
]
