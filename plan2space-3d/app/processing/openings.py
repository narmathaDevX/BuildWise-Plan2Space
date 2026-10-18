"""Opening (door and window) detection heuristics along detected walls."""

import math
from typing import List
import cv2
import numpy as np

from app.schemas.geometry import Wall, Opening, OpeningKind


def detect_openings_along_walls(
    binary_mask: np.ndarray,
    walls: List[Wall],
    img_height: int,
    pixels_per_metre: float,
) -> List[Opening]:
    """
    Samples binary mask along each wall centerline to locate opening gaps
    (doorways or windows) based on expected architectural dimensions (0.7m - 2.5m).
    """
    openings: List[Opening] = []
    h, w = binary_mask.shape

    for wall in walls:
        wall_len_m = wall.length
        if wall_len_m < 1.5:  # Wall too short to contain an opening
            continue

        # Convert wall endpoints from Math metres back to Image pixel space
        px_x1 = wall.start.x * pixels_per_metre
        px_y1 = img_height - (wall.start.y * pixels_per_metre)
        px_x2 = wall.end.x * pixels_per_metre
        px_y2 = img_height - (wall.end.y * pixels_per_metre)

        total_px = math.hypot(px_x2 - px_x1, px_y2 - px_y1)
        if total_px < 10:
            continue

        num_samples = int(total_px)
        t_vals = np.linspace(0.0, 1.0, num_samples)
        sample_xs = np.clip(np.round(px_x1 + t_vals * (px_x2 - px_x1)).astype(int), 0, w - 1)
        sample_ys = np.clip(np.round(px_y1 + t_vals * (px_y2 - px_y1)).astype(int), 0, h - 1)

        # Sample pixel values along centerline (255 = wall, 0 = gap/doorway)
        samples = binary_mask[sample_ys, sample_xs]

        # Find continuous runs of 0 (gaps)
        in_gap = False
        gap_start_idx = 0

        for i, val in enumerate(samples):
            if val < 50:  # Dark / gap
                if not in_gap:
                    in_gap = True
                    gap_start_idx = i
            else:
                if in_gap:
                    in_gap = False
                    gap_length_px = i - gap_start_idx
                    gap_length_m = gap_length_px / pixels_per_metre

                    # An architectural doorway/window is typically between 0.7m and 2.5m
                    # And should not start right at the very tip (leave corner wall meat)
                    start_offset_m = (gap_start_idx / num_samples) * wall_len_m
                    if 0.65 <= gap_length_m <= 2.5 and start_offset_m > 0.1 and (start_offset_m + gap_length_m) < (wall_len_m - 0.1):
                        # Determine if door or window (exterior openings > 1.0m without door arc typically window)
                        op_type: OpeningKind = "door" if gap_length_m <= 1.05 else "window"
                        sill = 0.0 if op_type == "door" else 0.9
                        height = 2.1 if op_type == "door" else 1.2

                        op = Opening(
                            id=f"op_{len(openings) + 1:02d}",
                            wall_id=wall.id,
                            type=op_type,
                            position_along_wall=round(start_offset_m, 3),
                            width=round(gap_length_m, 3),
                            height=round(height, 2),
                            sill_height=round(sill, 2),
                            source="estimated",
                        )
                        openings.append(op)

    return openings
