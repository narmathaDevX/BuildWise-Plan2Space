"""Wall detection, orthogonal snapping, collinear merging, and thickness estimation."""

import math
import uuid
from typing import List, Tuple, Dict, Any
import cv2
import numpy as np

from app.schemas.geometry import Wall, Point2D


def estimate_wall_thickness_pixels(binary_mask: np.ndarray) -> float:
    """Uses distance transform to estimate median wall thickness in pixels."""
    dist = cv2.distanceTransform(binary_mask, cv2.DIST_L2, 5)
    foreground = dist[dist > 1.0]
    if len(foreground) == 0:
        return 10.0  # sensible fallback in pixels
    # Double the median radius gives full thickness
    median_radius = float(np.median(foreground))
    return max(4.0, median_radius * 2.0)


def snap_to_orthogonal(x1: float, y1: float, x2: float, y2: float, angle_tol_deg: float = 7.0) -> Tuple[float, float, float, float]:
    """Snaps nearly horizontal or vertical lines to strictly orthogonal axes."""
    dx = x2 - x1
    dy = y2 - y1
    angle = abs(math.degrees(math.atan2(dy, dx))) % 180

    # Near horizontal (0 or 180)
    if angle <= angle_tol_deg or angle >= 180 - angle_tol_deg:
        avg_y = (y1 + y2) / 2.0
        return (x1, avg_y, x2, avg_y)

    # Near vertical (90)
    if abs(angle - 90) <= angle_tol_deg:
        avg_x = (x1 + x2) / 2.0
        return (avg_x, y1, avg_x, y2)

    return (x1, y1, x2, y2)


def are_segments_collinear_and_close(
    s1: Tuple[float, float, float, float],
    s2: Tuple[float, float, float, float],
    max_dist_px: float = 12.0,
    max_gap_px: float = 30.0,
) -> bool:
    """Checks if two orthogonal segments lie on the same line and can be merged."""
    x1, y1, x2, y2 = s1
    x3, y3, x4, y4 = s2

    is_s1_horiz = abs(y1 - y2) < 1e-3
    is_s2_horiz = abs(y3 - y4) < 1e-3

    if is_s1_horiz and is_s2_horiz:
        # Check perpendicular distance between horizontal lines
        if abs(y1 - y3) > max_dist_px:
            return False
        # Check longitudinal overlap or gap
        s1_min, s1_max = min(x1, x2), max(x1, x2)
        s2_min, s2_max = min(x3, x4), max(x3, x4)
        gap = max(0.0, max(s1_min, s2_min) - min(s1_max, s2_max))
        return gap <= max_gap_px

    is_s1_vert = abs(x1 - x2) < 1e-3
    is_s2_vert = abs(x3 - x4) < 1e-3

    if is_s1_vert and is_s2_vert:
        if abs(x1 - x3) > max_dist_px:
            return False
        s1_min, s1_max = min(y1, y2), max(y1, y2)
        s2_min, s2_max = min(y3, y4), max(y3, y4)
        gap = max(0.0, max(s1_min, s2_min) - min(s1_max, s2_max))
        return gap <= max_gap_px

    return False


def merge_collinear_segments(segments: List[Tuple[float, float, float, float]]) -> List[Tuple[float, float, float, float]]:
    """Iteratively merges collinear overlapping or close segments."""
    merged = list(segments)
    changed = True

    while changed:
        changed = False
        new_merged = []
        used = [False] * len(merged)

        for i in range(len(merged)):
            if used[i]:
                continue
            curr = merged[i]
            for j in range(i + 1, len(merged)):
                if used[j]:
                    continue
                cand = merged[j]
                if are_segments_collinear_and_close(curr, cand):
                    # Merge curr and cand
                    x1, y1, x2, y2 = curr
                    x3, y3, x4, y4 = cand
                    is_horiz = abs(y1 - y2) < 1e-3
                    if is_horiz:
                        y_avg = (y1 + y2 + y3 + y4) / 4.0
                        all_x = [x1, x2, x3, x4]
                        curr = (min(all_x), y_avg, max(all_x), y_avg)
                    else:
                        x_avg = (x1 + x2 + x3 + x4) / 4.0
                        all_y = [y1, y2, y3, y4]
                        curr = (x_avg, min(all_y), x_avg, max(all_y))
                    used[j] = True
                    changed = True
            new_merged.append(curr)
        merged = new_merged

    return merged


def detect_walls_from_binary(
    binary_mask: np.ndarray,
    img_height: int,
    pixels_per_metre: float,
    min_length_px: float = 25.0,
) -> Tuple[List[Wall], float]:
    """
    Detects line segments, snaps orthogonally, merges collinear lines,
    and maps them to real-world metres in Math coordinate convention (X right, Y up).
    Returns (walls, estimated_thickness_m).
    """
    thickness_px = estimate_wall_thickness_pixels(binary_mask)
    thickness_m = max(0.15, min(0.35, thickness_px / pixels_per_metre))

    lines = cv2.HoughLinesP(
        binary_mask,
        rho=1,
        theta=np.pi / 180,
        threshold=40,
        minLineLength=int(min_length_px),
        maxLineGap=15,
    )

    if lines is None or len(lines) == 0:
        return [], thickness_m

    raw_segs = []
    for line in lines:
        coords = np.array(line).reshape(-1)
        if len(coords) < 4:
            continue
        x1, y1, x2, y2 = coords[:4]
        # Snap to horizontal/vertical
        sx1, sy1, sx2, sy2 = snap_to_orthogonal(float(x1), float(y1), float(x2), float(y2))
        length = math.hypot(sx2 - sx1, sy2 - sy1)
        if length >= min_length_px:
            raw_segs.append((sx1, sy1, sx2, sy2))

    # Merge collinear segments
    merged_segs = merge_collinear_segments(raw_segs)

    walls: List[Wall] = []
    for idx, (x1, y1, x2, y2) in enumerate(merged_segs):
        # Convert pixel coordinates to Math convention in metres
        # In image: (0,0) top-left, Y down
        # In Math: (0,0) bottom-left, Y up
        m_x1 = round(x1 / pixels_per_metre, 4)
        m_y1 = round((img_height - y1) / pixels_per_metre, 4)
        m_x2 = round(x2 / pixels_per_metre, 4)
        m_y2 = round((img_height - y2) / pixels_per_metre, 4)

        w = Wall(
            id=f"w_{idx + 1:02d}",
            start=Point2D(x=m_x1, y=m_y1),
            end=Point2D(x=m_x2, y=m_y2),
            thickness=round(thickness_m, 3),
            height=2.7,
            is_exterior=True,
            source="estimated",
        )
        if w.length > 0.2:  # at least 20cm in real life
            walls.append(w)

    return walls, thickness_m
