"""Pydantic v2 schemas for Interior Design Studio (colors, furniture, catalogue)."""

from __future__ import annotations
import math
import uuid
import re
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator


HEX_COLOR_REGEX = r"^#[0-9a-fA-F]{6}$"
HEX_COLOR_PATTERN = re.compile(HEX_COLOR_REGEX)


def validate_hex_color(val: str, field_name: str = "color") -> str:
    if not isinstance(val, str) or not HEX_COLOR_PATTERN.match(val):
        raise ValueError(f"'{field_name}' must be a 6-digit hex color string in format #RRGGBB (got '{val}')")
    return val.upper()


def validate_finite_float_list(vals: List[float], expected_len: Optional[int] = None, field_name: str = "vector") -> List[float]:
    if expected_len is not None and len(vals) != expected_len:
        raise ValueError(f"'{field_name}' must have length {expected_len} (got {len(vals)})")
    for idx, v in enumerate(vals):
        if not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ValueError(f"'{field_name}[{idx}]' must be a finite number (got {v})")
    return [float(v) for v in vals]


FinishType = Literal["matte", "satin", "gloss"]
WallFaceType = Literal["pos_normal", "neg_normal", "top", "all", "caps"]


class WallPaintItem(BaseModel):
    wall_id: str = Field(..., description="Target wall ID from geometry")
    face: WallFaceType = Field(default="all", description="Face: pos_normal, neg_normal, top, or all")
    color: str = Field(..., description="6-digit hex color e.g. #F8F7F2")
    finish: FinishType = Field(default="matte", description="Surface finish")

    @field_validator("color")
    @classmethod
    def check_color(cls, v: str) -> str:
        return validate_hex_color(v, "color")


class FloorPaintItem(BaseModel):
    room_id: str = Field(..., description="Target room ID or 'floor' for entire slab")
    color: str = Field(..., description="6-digit hex color")
    finish: FinishType = Field(default="matte")

    @field_validator("color")
    @classmethod
    def check_color(cls, v: str) -> str:
        return validate_hex_color(v, "color")


class CeilingPaint(BaseModel):
    color: str = Field(..., description="6-digit hex color")
    finish: FinishType = Field(default="matte")
    roof_type: Optional[str] = Field(default="tiles", description="Roof texture style: 'tiles' or 'plain'")
    roof_shape: Optional[str] = Field(default="gabled", description="Roof shape: 'flat' or 'gabled'")
    roof_visible: Optional[bool] = Field(default=False, description="Whether roof is visible")

    @field_validator("color")
    @classmethod
    def check_color(cls, v: str) -> str:
        return validate_hex_color(v, "color")


class FurnitureItem(BaseModel):
    id: str = Field(default_factory=lambda: f"furn_{uuid.uuid4().hex[:8]}")
    item_type: str = Field(..., description="Item type identifier e.g. bed, sofa, dining_table")
    variant: str = Field(..., description="Variant identifier e.g. double, 3-seater, wall-mounted")
    category: str = Field(..., description="Category: beds, seating, storage, tables, electronics, bathroom, decor")
    position: List[float] = Field(..., description="[x, y, z] position in 3D metres")
    rotation: List[float] = Field(..., description="[rx, ry, rz] Euler rotation in radians")
    scale: List[float] = Field(default_factory=lambda: [1.0, 1.0, 1.0], description="[sx, sy, sz] scale factors")
    dimensions: Optional[List[float]] = Field(default=None, description="[width, depth, height] in metres")
    colors: Dict[str, str] = Field(default_factory=dict, description="Custom hex colors e.g. primary, secondary")
    custom_label: Optional[str] = Field(default=None, description="Optional user custom label")

    @field_validator("position")
    @classmethod
    def check_position(cls, v: List[float]) -> List[float]:
        return validate_finite_float_list(v, 3, "position")

    @field_validator("rotation")
    @classmethod
    def check_rotation(cls, v: List[float]) -> List[float]:
        if len(v) not in (3, 4):
            raise ValueError(f"'rotation' must be either Euler (3 floats) or Quaternion (4 floats), got {len(v)}")
        return validate_finite_float_list(v, None, "rotation")

    @field_validator("scale")
    @classmethod
    def check_scale(cls, v: List[float]) -> List[float]:
        v_floats = validate_finite_float_list(v, 3, "scale")
        for s in v_floats:
            if s <= 0:
                raise ValueError("Scale dimensions must be strictly positive")
        return v_floats

    @field_validator("dimensions")
    @classmethod
    def check_dimensions(cls, v: Optional[List[float]]) -> Optional[List[float]]:
        if v is None:
            return None
        v_floats = validate_finite_float_list(v, 3, "dimensions")
        for d in v_floats:
            if d <= 0:
                raise ValueError("Dimensions must be strictly positive")
        return v_floats

    @field_validator("colors")
    @classmethod
    def check_colors(cls, v: Dict[str, str]) -> Dict[str, str]:
        validated = {}
        for k, col in v.items():
            validated[k] = validate_hex_color(col, f"colors.{k}")
        return validated


class DesignState(BaseModel):
    conversion_id: str
    walls: List[WallPaintItem] = Field(default_factory=list)
    floors: List[FloorPaintItem] = Field(default_factory=list)
    ceiling: Optional[CeilingPaint] = None
    furniture: List[FurnitureItem] = Field(default_factory=list, max_length=300)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("furniture")
    @classmethod
    def check_furniture_limit(cls, v: List[FurnitureItem]) -> List[FurnitureItem]:
        if len(v) > 300:
            raise ValueError(f"Maximum 300 furniture items allowed per scene (got {len(v)})")
        return v


# --- Catalogue Schemas ---

class FurnitureVariantSpec(BaseModel):
    variant_id: str
    name: str
    default_dimensions: List[float] = Field(..., description="[width, depth, height] in metres")
    default_colors: Dict[str, str] = Field(default_factory=dict)
    is_wall_mounted: bool = False
    is_ceiling_mounted: bool = False


class FurnitureItemSpec(BaseModel):
    type_id: str
    name: str
    category: str
    variants: List[FurnitureVariantSpec]


class FurnitureCategorySpec(BaseModel):
    category_id: str
    name: str
    icon: str
    items: List[FurnitureItemSpec]


class ColorPreset(BaseModel):
    name: str
    hex: str
    category: str


class CatalogueResponse(BaseModel):
    categories: List[FurnitureCategorySpec]
    color_presets: List[ColorPreset]
    finishes: List[str] = ["matte", "satin", "gloss"]
