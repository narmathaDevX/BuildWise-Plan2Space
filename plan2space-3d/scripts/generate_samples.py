"""Generates 3 programmatic sample floor plans (images + ground truth JSON).
1. simple_rect: Clean 10m x 8m rectangular house with door and window.
2. l_shaped: L-shaped plan with 3 partitioned rooms and doorways.
3. noisy: Floor plan with simulated scan noise, dimension lines, and slight tilt.
"""

import json
import math
from pathlib import Path
import cv2
import numpy as np

OUTPUT_BASE = Path(__file__).resolve().parent.parent / "sample_floorplans"


def generate_simple_rect():
    """Generates a clean 10m x 8m single-room floor plan."""
    folder = OUTPUT_BASE / "simple_rect"
    folder.mkdir(parents=True, exist_ok=True)

    ppm = 50.0  # 50 pixels per metre
    img_w, img_h = 700, 600
    canvas = np.full((img_h, img_w, 3), 255, dtype=np.uint8)

    # 10m x 8m -> 500px x 400px
    # Math coords: (0,0) to (10,8)
    # Image coords: origin at margin (100, 500) where math y=0 is img y=500
    ox, oy = 100, 500  # math (0,0)
    w_px = int(10.0 * ppm)
    h_px = int(8.0 * ppm)
    thick_px = int(0.24 * ppm)  # 12 px

    # South wall: (ox, oy) to (ox + w_px, oy) -> Door at 4m (200px) width 1m (50px)
    cv2.line(canvas, (ox, oy), (ox + 200, oy), (20, 20, 20), thick_px)
    # Door gap: 200 to 250 px
    cv2.line(canvas, (ox + 250, oy), (ox + w_px, oy), (20, 20, 20), thick_px)

    # East wall: (ox + w_px, oy) to (ox + w_px, oy - h_px)
    cv2.line(canvas, (ox + w_px, oy), (ox + w_px, oy - h_px), (20, 20, 20), thick_px)

    # North wall: (ox + w_px, oy - h_px) to (ox, oy - h_px) -> Window at 3m (150px) width 1.5m (75px)
    cv2.line(canvas, (ox + w_px, oy - h_px), (ox + 225, oy - h_px), (20, 20, 20), thick_px)
    # Window gap: 150 to 225 px
    cv2.line(canvas, (ox + 150, oy - h_px), (ox, oy - h_px), (20, 20, 20), thick_px)

    # West wall: (ox, oy - h_px) to (ox, oy)
    cv2.line(canvas, (ox, oy - h_px), (ox, oy), (20, 20, 20), thick_px)

    # Save image
    img_path = folder / "floorplan.png"
    cv2.imwrite(str(img_path), canvas)

    # Ground truth JSON
    gt = {
        "name": "Simple Rectangular Plan (Ground Truth)",
        "scale": {"pixels_per_metre": ppm, "source": "measured"},
        "dimensions_m": {"width": 10.0, "depth": 8.0},
        "walls": [
            {"id": "w_south", "start": [0.0, 0.0], "end": [10.0, 0.0], "thickness": 0.24, "height": 2.7},
            {"id": "w_east", "start": [10.0, 0.0], "end": [10.0, 8.0], "thickness": 0.24, "height": 2.7},
            {"id": "w_north", "start": [10.0, 8.0], "end": [0.0, 8.0], "thickness": 0.24, "height": 2.7},
            {"id": "w_west", "start": [0.0, 8.0], "end": [0.0, 0.0], "thickness": 0.24, "height": 2.7},
        ],
        "openings": [
            {"id": "door_1", "wall_id": "w_south", "type": "door", "position_along_wall": 4.0, "width": 1.0, "height": 2.1, "sill_height": 0.0},
            {"id": "win_1", "wall_id": "w_north", "type": "window", "position_along_wall": 3.0, "width": 1.5, "height": 1.2, "sill_height": 0.9},
        ],
        "rooms": [
            {
                "id": "room_1",
                "name": "Main Hall",
                "polygon": [[0.0, 0.0], [10.0, 0.0], [10.0, 8.0], [0.0, 8.0]],
                "area_sqm": 80.0,
            }
        ],
    }
    with open(folder / "ground_truth.json", "w", encoding="utf-8") as f:
        json.dump(gt, f, indent=2)


def generate_l_shaped():
    """Generates an L-shaped house with 3 rooms and interior walls."""
    folder = OUTPUT_BASE / "l_shaped"
    folder.mkdir(parents=True, exist_ok=True)

    ppm = 50.0
    img_w, img_h = 800, 700
    canvas = np.full((img_h, img_w, 3), 255, dtype=np.uint8)

    # Footprint: 12m wide, 10m deep, with a 5m x 5m cut-out at top-right
    # Room 1 (Living): 7m x 10m (left side)
    # Room 2 (Bedroom): 5m x 5m (bottom right)
    # Room 3 (Kitchen): inside living or top partition
    ox, oy = 100, 600
    thick_px = int(0.24 * ppm)

    # Outer perimeter walls:
    # Bottom wall: (0,0) to (12,0) -> 600px
    cv2.line(canvas, (ox, oy), (ox + 600, oy), (25, 25, 25), thick_px)
    # Right-lower wall: (12,0) to (12,5) -> 250px up
    cv2.line(canvas, (ox + 600, oy), (ox + 600, oy - 250), (25, 25, 25), thick_px)
    # Inner-step wall: (12,5) to (7,5) -> 250px left
    cv2.line(canvas, (ox + 600, oy - 250), (ox + 350, oy - 250), (25, 25, 25), thick_px)
    # Right-upper wall: (7,5) to (7,10) -> 250px up
    cv2.line(canvas, (ox + 350, oy - 250), (ox + 350, oy - 500), (25, 25, 25), thick_px)
    # Top wall: (7,10) to (0,10) -> 350px left
    cv2.line(canvas, (ox + 350, oy - 500), (ox, oy - 500), (25, 25, 25), thick_px)
    # Left wall: (0,10) to (0,0) -> 500px down (with front door gap at 2m from bottom)
    cv2.line(canvas, (ox, oy - 500), (ox, oy - 150), (25, 25, 25), thick_px)
    # Door gap: 100 to 150 px from oy
    cv2.line(canvas, (ox, oy - 100), (ox, oy), (25, 25, 25), thick_px)

    # Interior partition wall separating Bedroom from Living: (7,0) to (7,5) -> (ox+350, oy) to (ox+350, oy-250)
    # With a door gap into bedroom
    cv2.line(canvas, (ox + 350, oy), (ox + 350, oy - 80), (35, 35, 35), thick_px - 2)
    # Interior door gap: 80 to 130 px
    cv2.line(canvas, (ox + 350, oy - 130), (ox + 350, oy - 250), (35, 35, 35), thick_px - 2)

    img_path = folder / "floorplan.png"
    cv2.imwrite(str(img_path), canvas)

    gt = {
        "name": "L-Shaped Multi-Room Plan (Ground Truth)",
        "scale": {"pixels_per_metre": ppm, "source": "measured"},
        "dimensions_m": {"width": 12.0, "depth": 10.0},
        "rooms": [
            {"id": "rm_living", "name": "Living & Dining", "area_sqm": 70.0},
            {"id": "rm_bedroom", "name": "Master Bedroom", "area_sqm": 25.0},
        ],
    }
    with open(folder / "ground_truth.json", "w", encoding="utf-8") as f:
        json.dump(gt, f, indent=2)


def generate_noisy():
    """Generates a plan with paper scan noise, slight skew, and dimension text."""
    folder = OUTPUT_BASE / "noisy"
    folder.mkdir(parents=True, exist_ok=True)

    ppm = 45.0
    img_w, img_h = 750, 650
    canvas = np.full((img_h, img_w, 3), 248, dtype=np.uint8)  # slightly off-white paper

    ox, oy = 120, 520
    w_px = int(9.0 * ppm)
    h_px = int(7.0 * ppm)
    thick_px = int(0.24 * ppm)

    # Draw rectangular walls
    cv2.rectangle(canvas, (ox, oy - h_px), (ox + w_px, oy), (30, 30, 30), thick_px)

    # Door gap
    cv2.rectangle(canvas, (ox + 150, oy - thick_px), (ox + 200, oy + thick_px), (248, 248, 248), -1)

    # Interior partition
    cv2.line(canvas, (ox + 220, oy - h_px), (ox + 220, oy), (30, 30, 30), thick_px - 2)
    # Interior door gap
    cv2.rectangle(canvas, (ox + 220 - thick_px, oy - 180), (ox + 220 + thick_px, oy - 130), (248, 248, 248), -1)

    # Add dimension lines with arrowheads
    cv2.line(canvas, (ox, oy + 40), (ox + w_px, oy + 40), (100, 100, 100), 1)
    cv2.line(canvas, (ox, oy + 30), (ox, oy + 50), (100, 100, 100), 1)
    cv2.line(canvas, (ox + w_px, oy + 30), (ox + w_px, oy + 50), (100, 100, 100), 1)
    cv2.putText(canvas, "9.00 m", (ox + int(w_px / 2) - 30, oy + 35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (80, 80, 80), 1)

    # Add Gaussian noise
    noise = np.random.normal(0, 8, canvas.shape).astype(np.int16)
    noisy_img = np.clip(canvas.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Add slight rotation (1.2 degrees)
    center = (img_w // 2, img_h // 2)
    rot_mat = cv2.getRotationMatrix2D(center, 1.2, 1.0)
    rotated = cv2.warpAffine(noisy_img, rot_mat, (img_w, img_h), borderValue=(245, 245, 245))

    img_path = folder / "floorplan.png"
    cv2.imwrite(str(img_path), rotated)

    gt = {
        "name": "Noisy Skewed Plan (Ground Truth)",
        "scale": {"pixels_per_metre": ppm, "source": "measured"},
        "dimensions_m": {"width": 9.0, "depth": 7.0},
        "notes": "Includes 1.2 deg skew, gaussian paper noise, and dimension lines.",
    }
    with open(folder / "ground_truth.json", "w", encoding="utf-8") as f:
        json.dump(gt, f, indent=2)


if __name__ == "__main__":
    generate_simple_rect()
    generate_l_shaped()
    generate_noisy()
    print("All 3 sample floor plans generated successfully in sample_floorplans/")
