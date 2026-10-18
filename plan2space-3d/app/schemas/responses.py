"""Response schemas for Plan2Space 3D API."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from app.schemas.geometry import FloorPlanGeometry
from app.schemas.requests import BuildParameters

JobStatus = Literal["queued", "processing", "completed", "failed"]


class CapabilitiesResponse(BaseModel):
    version: str = "1.0.0"
    geometry_engine: str = "shapely + trimesh + mapbox_earcut"
    ocr_available: bool
    ocr_enabled: bool
    design_studio: bool = True
    supported_export_formats: List[str] = ["glb", "obj"]
    supported_image_types: List[str] = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    coordinate_system: Dict[str, str] = Field(
        default={
            "2D": "Math convention: X right, Y up in metres",
            "3D_glTF": "X = 2D X, Y = 2D Height (up), Z = -2D Y",
        }
    )
    defaults: Dict[str, Any] = Field(
        default={
            "wall_height_m": 2.7,
            "exterior_wall_thickness_m": 0.23,
            "interior_wall_thickness_m": 0.115,
            "floor_thickness_m": 0.15,
            "door_width_m": 0.9,
            "door_height_m": 2.1,
            "window_width_m": 1.2,
            "window_height_m": 1.2,
            "window_sill_m": 0.9,
            "default_plan_longest_side_m": 12.0,
        }
    )


class MeshStats(BaseModel):
    vertex_count: int
    face_count: int
    is_watertight: bool
    bounding_box_min: List[float]
    bounding_box_max: List[float]
    dimensions_m: List[float]  # [width_x, height_y, depth_z]
    layers: List[str]


class ConversionJobResponse(BaseModel):
    id: str
    floor_plan_id: str
    status: JobStatus
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    current_step: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None
    parameters: BuildParameters
    artifacts: Dict[str, str] = Field(default_factory=dict)
    mesh_stats: Optional[MeshStats] = None


class FloorPlanResponse(BaseModel):
    id: str
    name: str
    geometry: FloorPlanGeometry
    image_url: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    created_at: str
    updated_at: str
