"""Tests for image validation, binarization, and OpenCV processing pipeline."""

import pytest
from pathlib import Path
from app.processing.pipeline import pipeline
from app.processing.binarize import preprocess_image
from app.schemas.geometry import Scale

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "sample_floorplans"


def test_invalid_image_bytes():
    with pytest.raises(ValueError, match="Failed to decode image bytes"):
        preprocess_image(b"not an image raw random bytes")


def test_process_simple_rect():
    img_path = SAMPLES_DIR / "simple_rect" / "floorplan.png"
    assert img_path.exists()
    content = img_path.read_bytes()

    scale = Scale(pixels_per_metre=50.0, source="user_provided")
    geom, warnings, meta = pipeline.process(
        image_bytes=content,
        plan_id="fp_test_rect",
        name="Rect Test",
        scale_override=scale,
    )

    assert len(geom.walls) >= 4
    assert meta["confidence_score"] >= 0.65
    assert meta["image_width_px"] == 700
    assert meta["image_height_px"] == 600
    assert len(geom.rooms) >= 1


def test_process_l_shaped():
    img_path = SAMPLES_DIR / "l_shaped" / "floorplan.png"
    assert img_path.exists()
    content = img_path.read_bytes()

    geom, warnings, meta = pipeline.process(
        image_bytes=content,
        plan_id="fp_test_l",
        name="L Shaped Test",
    )

    assert len(geom.walls) >= 5
    assert meta["wall_count"] >= 5
    assert len(geom.rooms) >= 1


def test_process_noisy_plan():
    img_path = SAMPLES_DIR / "noisy" / "floorplan.png"
    assert img_path.exists()
    content = img_path.read_bytes()

    geom, warnings, meta = pipeline.process(
        image_bytes=content,
        plan_id="fp_test_noisy",
        name="Noisy Plan Test",
    )

    # In noisy plan, warnings should be generated and pipeline shouldn't crash
    assert len(geom.walls) >= 2
    assert len(warnings) > 0
