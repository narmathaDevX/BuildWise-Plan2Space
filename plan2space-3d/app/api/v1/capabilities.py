"""Capabilities endpoint reporting system features and coordinate conventions."""

import shutil
from fastapi import APIRouter
from app.config import settings
from app.schemas.responses import CapabilitiesResponse

router = APIRouter(tags=["Capabilities"])


def is_ocr_functional() -> bool:
    """Checks if Tesseract binary and pytesseract package are present."""
    if not settings.ENABLE_OCR:
        return False
    if shutil.which("tesseract") is None:
        return False
    try:
        import pytesseract  # type: ignore
        return True
    except ImportError:
        return False


@router.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities() -> CapabilitiesResponse:
    """Returns runtime capabilities, geometry engine details, and coordinate conventions."""
    ocr_ok = is_ocr_functional()
    return CapabilitiesResponse(
        version=settings.VERSION,
        geometry_engine="shapely + trimesh + mapbox_earcut",
        ocr_available=ocr_ok,
        ocr_enabled=settings.ENABLE_OCR and ocr_ok,
        design_studio=True,
        supported_export_formats=["glb", "obj"],
        supported_image_types=settings.ALLOWED_IMAGE_TYPES,
        coordinate_system={
            "2D": "Math convention: X right, Y up in metres",
            "3D_glTF": "X = 2D X, Y = 2D Height (up), Z = -2D Y",
        },
        defaults={
            "wall_height_m": settings.DEFAULT_WALL_HEIGHT,
            "exterior_wall_thickness_m": settings.DEFAULT_EXTERIOR_WALL_THICKNESS,
            "interior_wall_thickness_m": settings.DEFAULT_INTERIOR_WALL_THICKNESS,
            "floor_thickness_m": settings.DEFAULT_FLOOR_THICKNESS,
            "door_width_m": settings.DEFAULT_DOOR_WIDTH,
            "door_height_m": settings.DEFAULT_DOOR_HEIGHT,
            "window_width_m": settings.DEFAULT_WINDOW_WIDTH,
            "window_height_m": settings.DEFAULT_WINDOW_HEIGHT,
            "window_sill_m": settings.DEFAULT_WINDOW_SILL,
            "default_plan_longest_side_m": settings.DEFAULT_PLAN_LONGEST_SIDE_M,
        },
    )
