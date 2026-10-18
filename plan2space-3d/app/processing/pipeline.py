"""Main Floor Plan Image Processing Pipeline."""

from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
import cv2
import numpy as np

from app.config import settings
from app.schemas.geometry import FloorPlanGeometry, Scale, Wall, Opening, Room
from app.processing.binarize import preprocess_image
from app.processing.walls import detect_walls_from_binary
from app.processing.openings import detect_openings_along_walls
from app.processing.rooms import extract_rooms_from_binary


class FloorPlanProcessingPipeline:
    """Non-ML Computer Vision extraction pipeline using OpenCV."""

    def process(
        self,
        image_bytes: bytes,
        plan_id: str,
        name: str = "Floor Plan",
        scale_override: Optional[Scale] = None,
    ) -> Tuple[FloorPlanGeometry, List[str], Dict[str, Any]]:
        warnings: List[str] = []

        # 1. Preprocess & Binarize
        color_img, binary_mask, quality_score = preprocess_image(image_bytes)
        img_h, img_w = binary_mask.shape

        # 2. Scale Handling
        if scale_override and scale_override.pixels_per_metre > 0:
            scale = scale_override
        else:
            # Estimate default scale: assume longest side of wall bounding box is 12m
            ys, xs = np.nonzero(binary_mask)
            if len(xs) > 0 and len(ys) > 0:
                span_w = float(np.max(xs) - np.min(xs))
                span_h = float(np.max(ys) - np.min(ys))
                longest_px = max(span_w, span_h)
            else:
                longest_px = max(img_w, img_h)

            ppm = max(5.0, longest_px / settings.DEFAULT_PLAN_LONGEST_SIDE_M)
            scale = Scale(
                pixels_per_metre=round(ppm, 2),
                source="default",
                confidence=0.5,
                warning=f"Default scale assumption used: longest side = {settings.DEFAULT_PLAN_LONGEST_SIDE_M}m. Please calibrate for real-world accuracy.",
            )
            warnings.append(scale.warning)

        # 3. Detect Walls
        walls, wall_thickness_m = detect_walls_from_binary(
            binary_mask=binary_mask,
            img_height=img_h,
            pixels_per_metre=scale.pixels_per_metre,
        )

        if not walls:
            warnings.append("No clear walls detected in the image. You can draw walls manually in the 2D editor.")

        # 4. Detect Openings
        openings = detect_openings_along_walls(
            binary_mask=binary_mask,
            walls=walls,
            img_height=img_h,
            pixels_per_metre=scale.pixels_per_metre,
        )

        # 5. Extract Rooms
        rooms = extract_rooms_from_binary(
            binary_wall_mask=binary_mask,
            img_height=img_h,
            pixels_per_metre=scale.pixels_per_metre,
        )

        # 6. Overall Confidence Score Calculation
        wall_score = min(1.0, len(walls) / 8.0) * 0.4
        scale_score = (1.0 if scale.source == "user_provided" else 0.5) * 0.2
        quality_component = quality_score * 0.2
        room_component = (0.2 if len(rooms) > 0 else 0.05)
        overall_confidence = round(wall_score + scale_score + quality_component + room_component, 2)

        needs_review = overall_confidence < 0.65 or len(walls) < 4
        if needs_review:
            warnings.append("Detection confidence is moderate/low. Reviewing walls in the 2D editor is recommended before 3D generation.")

        metadata = {
            "image_width_px": img_w,
            "image_height_px": img_h,
            "quality_score": round(quality_score, 2),
            "confidence_score": overall_confidence,
            "needs_review": needs_review,
            "wall_count": len(walls),
            "opening_count": len(openings),
            "room_count": len(rooms),
            "detected_wall_thickness_m": round(wall_thickness_m, 3),
        }

        geom = FloorPlanGeometry(
            id=plan_id,
            name=name,
            walls=walls,
            openings=openings,
            rooms=rooms,
            scale=scale,
            image_width_px=img_w,
            image_height_px=img_h,
            metadata=metadata,
        )
        geom.calculate_bounding_box()

        return geom, warnings, metadata


pipeline = FloorPlanProcessingPipeline()
