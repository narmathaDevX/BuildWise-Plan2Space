"""Request schemas for Plan2Space 3D API."""

from typing import List, Literal, Optional, Tuple
from pydantic import BaseModel, Field
from app.schemas.geometry import FloorPlanGeometry, RoofParameters, Scale


class BuildParameters(BaseModel):
    default_wall_height: float = Field(default=2.7, gt=0.0, description="Default wall height in metres")
    exterior_wall_thickness: float = Field(default=0.23, gt=0.0, description="Exterior wall thickness in metres")
    interior_wall_thickness: float = Field(default=0.115, gt=0.0, description="Interior wall thickness in metres")
    floor_thickness: float = Field(default=0.15, gt=0.0, description="Floor slab thickness in metres")
    include_floor: bool = Field(default=True, description="Generate floor slab meshes")
    roof: RoofParameters = Field(default_factory=RoofParameters, description="Roof configuration")
    export_formats: List[Literal["glb", "obj"]] = Field(default=["glb"], description="Formats to generate")
    unit: Literal["m"] = Field(default="m", description="Standard measurement unit (metres)")


class ScaleCalibrationRequest(BaseModel):
    method: Literal["line", "dimensions"] = Field(..., description="Calibration method: 'line' or 'dimensions'")
    # Line calibration:
    point_a_px: Optional[Tuple[float, float]] = Field(default=None, description="Start point [x, y] in pixels")
    point_b_px: Optional[Tuple[float, float]] = Field(default=None, description="End point [x, y] in pixels")
    known_length_m: Optional[float] = Field(default=None, gt=0.0, description="Known length between points in metres")
    # Dimensions calibration:
    known_width_m: Optional[float] = Field(default=None, gt=0.0, description="Known overall width in metres")
    known_depth_m: Optional[float] = Field(default=None, gt=0.0, description="Known overall depth in metres")


class CreateFloorPlanRequest(BaseModel):
    name: Optional[str] = Field(default="Floor Plan", description="Plan name")
    geometry: Optional[FloorPlanGeometry] = Field(default=None, description="Initial floor plan geometry")
    scale: Optional[Scale] = Field(default=None, description="Known scale calibration")


class CreateConversionJobRequest(BaseModel):
    floor_plan_id: str = Field(..., description="Floor plan ID to convert")
    parameters: BuildParameters = Field(default_factory=BuildParameters, description="3D build configuration")
