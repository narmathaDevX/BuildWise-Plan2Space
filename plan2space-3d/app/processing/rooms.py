"""Room contour extraction and area estimation with opening gap bridging."""

from typing import List
import cv2
import numpy as np

from app.schemas.geometry import Room, Point2D


def extract_rooms_from_binary(
    binary_wall_mask: np.ndarray,
    img_height: int,
    pixels_per_metre: float,
    min_area_sqm: float = 3.0,
) -> List[Room]:
    """
    Extracts enclosed room cavities by closing opening gaps (doors/windows)
    and finding closed negative spaces inside the wall network.
    Approximates contours as simplified polygons in metres (Math coordinate convention).
    """
    h, w = binary_wall_mask.shape

    # Morphological closing along horizontal and vertical directions
    # to bridge door/window openings up to ~1.6m (80px at 50ppm)
    k_size = max(15, int(1.6 * pixels_per_metre))
    k_horiz = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, 3))
    k_vert = cv2.getStructuringElement(cv2.MORPH_RECT, (3, k_size))

    closed_h = cv2.morphologyEx(binary_wall_mask, cv2.MORPH_CLOSE, k_horiz)
    closed = cv2.morphologyEx(closed_h, cv2.MORPH_CLOSE, k_vert)

    # Invert: rooms become foreground (255), walls become 0
    room_spaces = cv2.bitwise_not(closed)

    # Clear border so outside space is connected to 0 and discarded
    cv2.floodFill(room_spaces, None, (0, 0), 0)
    cv2.floodFill(room_spaces, None, (w - 1, 0), 0)
    cv2.floodFill(room_spaces, None, (0, h - 1), 0)
    cv2.floodFill(room_spaces, None, (w - 1, h - 1), 0)

    contours, _ = cv2.findContours(room_spaces, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    rooms: List[Room] = []
    min_area_px = min_area_sqm * (pixels_per_metre ** 2)

    room_count = 1
    for cnt in contours:
        area_px = cv2.contourArea(cnt)
        if area_px < min_area_px:
            continue

        # Approximate polygon
        epsilon = 0.02 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        if len(approx) < 3:
            continue

        # Convert to Point2D in metres (Math convention: Y up)
        pts: List[Point2D] = []
        for pt in approx:
            px_x, px_y = pt[0]
            m_x = round(px_x / pixels_per_metre, 4)
            m_y = round((img_height - px_y) / pixels_per_metre, 4)
            pts.append(Point2D(x=m_x, y=m_y))

        area_sqm = round(area_px / (pixels_per_metre ** 2), 2)

        # Heuristic name based on size
        if area_sqm >= 22.0:
            name = f"Living / Hall {room_count}"
        elif area_sqm >= 11.0:
            name = f"Bedroom {room_count}"
        elif area_sqm >= 6.0:
            name = f"Kitchen / Dining {room_count}"
        else:
            name = f"Bath / Utility {room_count}"

        room_count += 1

        rooms.append(
            Room(
                id=f"rm_{len(rooms) + 1:02d}",
                name=name,
                polygon=pts,
                area_sqm=area_sqm,
                floor_thickness=0.15,
                source="estimated",
            )
        )

    return rooms
