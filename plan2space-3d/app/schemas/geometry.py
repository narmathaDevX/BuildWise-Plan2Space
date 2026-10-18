"""Geometry schema definitions for Plan2Space 3D.
Coordinate Conventions:
- 2D Plan: Math convention (X right, Y up in metres).
- 3D glTF: X = 2D X, Y = 2D Height (up), Z = -2D Y.
All dimensions are strictly in METRES.
"""

from __future__ import annotations
import math
import uuid
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


ProvenanceSource = Literal["measured", "user_provided", "estimated", "default"]
OpeningKind = Literal["door", "window"]
RoofKind = Literal["none", "flat", "gabled"]


class Point2D(BaseModel):
    x: float = Field(..., description="X coordinate in metres (math convention: right is positive)")
    y: float = Field(..., description="Y coordinate in metres (math convention: up is positive)")

    def distance_to(self, other: Point2D) -> float:
        return math.hypot(self.x - other.x, self.y - other.y)

    def to_tuple(self) -> tuple[float, float]:
        return (self.x, self.y)


class Scale(BaseModel):
    pixels_per_metre: float = Field(default=50.0, gt=0, description="Pixel to metre conversion ratio")
    source: ProvenanceSource = Field(default="default", description="Provenance of this scale factor")
    reference_length_m: Optional[float] = Field(default=None, description="Known length in metres used for calibration")
    reference_pixels: Optional[float] = Field(default=None, description="Pixel length measured for calibration")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score [0, 1]")
    warning: Optional[str] = Field(default=None, description="Warning if scale is defaulted or estimated")


class Opening(BaseModel):
    id: str = Field(default_factory=lambda: f"op_{uuid.uuid4().hex[:8]}")
    wall_id: str = Field(..., description="ID of wall hosting this opening")
    type: OpeningKind = Field(..., description="Type of opening: door or window")
    position_along_wall: float = Field(
        ..., ge=0.0, description="Offset from wall start point along centerline in metres"
    )
    width: float = Field(..., gt=0.0, description="Opening clear width in metres")
    height: float = Field(..., gt=0.0, description="Opening clear height in metres")
    sill_height: float = Field(default=0.0, ge=0.0, description="Height from floor to bottom of opening in metres")
    source: ProvenanceSource = Field(default="default")

    @field_validator("sill_height")
    @classmethod
    def validate_sill(cls, v: float, info) -> float:
        return v


class Wall(BaseModel):
    id: str = Field(default_factory=lambda: f"w_{uuid.uuid4().hex[:8]}")
    start: Point2D
    end: Point2D
    thickness: float = Field(default=0.23, gt=0.0, description="Wall thickness in metres")
    height: float = Field(default=2.7, gt=0.0, description="Wall height in metres")
    is_exterior: bool = Field(default=True, description="True if exterior perimeter wall")
    source: ProvenanceSource = Field(default="default")

    @property
    def length(self) -> float:
        return self.start.distance_to(self.end)

    @property
    def direction(self) -> tuple[float, float]:
        l = self.length
        if l < 1e-6:
            return (1.0, 0.0)
        return ((self.end.x - self.start.x) / l, (self.end.y - self.start.y) / l)

    @property
    def normal(self) -> tuple[float, float]:
        dx, dy = self.direction
        return (-dy, dx)


class Room(BaseModel):
    id: str = Field(default_factory=lambda: f"rm_{uuid.uuid4().hex[:8]}")
    name: str = Field(default="Room", description="Descriptive label e.g. Living Room, Bedroom")
    polygon: List[Point2D] = Field(..., min_length=3, description="Boundary polygon ordered points")
    area_sqm: float = Field(..., ge=0.0, description="Floor area in square metres")
    floor_thickness: float = Field(default=0.15, gt=0.0, description="Slab thickness in metres")
    color_hex: Optional[str] = Field(default=None, description="Visual display color")
    source: ProvenanceSource = Field(default="default")


class RoofParameters(BaseModel):
    type: RoofKind = Field(default="none", description="Roof geometry style")
    thickness: float = Field(default=0.15, gt=0.0, description="Roof slab or panel thickness in metres")
    pitch_deg: float = Field(default=15.0, ge=0.0, le=60.0, description="Pitch angle in degrees for gabled roof")
    overhang: float = Field(default=0.3, ge=0.0, description="Eaves overhang in metres")


class BoundingBox2D(BaseModel):
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    width_m: float
    depth_m: float


class FloorPlanGeometry(BaseModel):
    id: str = Field(default_factory=lambda: f"fp_{uuid.uuid4().hex[:8]}")
    name: str = Field(default="Floor Plan")
    walls: List[Wall] = Field(default_factory=list)
    openings: List[Opening] = Field(default_factory=list)
    rooms: List[Room] = Field(default_factory=list)
    scale: Scale = Field(default_factory=Scale)
    roof: RoofParameters = Field(default_factory=RoofParameters)
    image_path: Optional[str] = None
    image_width_px: Optional[int] = None
    image_height_px: Optional[int] = None
    bounding_box: Optional[BoundingBox2D] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def calculate_bounding_box(self) -> BoundingBox2D:
        all_pts: List[Point2D] = []
        for w in self.walls:
            all_pts.extend([w.start, w.end])
        for r in self.rooms:
            all_pts.extend(r.polygon)

        if not all_pts:
            return BoundingBox2D(min_x=0.0, min_y=0.0, max_x=10.0, max_y=8.0, width_m=10.0, depth_m=8.0)

        xs = [p.x for p in all_pts]
        ys = [p.y for p in all_pts]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        bbox = BoundingBox2D(
            min_x=min_x,
            min_y=min_y,
            max_x=max_x,
            max_y=max_y,
            width_m=max(0.01, max_x - min_x),
            depth_m=max(0.01, max_y - min_y),
        )
        self.bounding_box = bbox
        return bbox
