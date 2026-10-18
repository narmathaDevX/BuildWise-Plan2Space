"""Unit tests for GLB and OBJ export and verification."""

import tempfile
from pathlib import Path
import trimesh
from app.geometry.builder import GeometryBuilder
from app.schemas.requests import BuildParameters
from app.export.gltf import export_glb
from app.export.obj import export_obj
from tests.test_geometry import create_sample_rectangular_plan


def test_export_glb_and_obj():
    plan = create_sample_rectangular_plan()
    builder = GeometryBuilder(plan, BuildParameters(include_floor=True))
    scene, stats = builder.build_scene()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        glb_path = tmp_path / "model.glb"
        obj_path = tmp_path / "model.obj"

        # 1. Export GLB
        res_glb = export_glb(scene, glb_path)
        assert res_glb.exists()
        assert res_glb.stat().st_size > 0

        # Verify reloading GLB with trimesh
        loaded_glb = trimesh.load(str(glb_path), file_type="glb")
        assert loaded_glb is not None

        # 2. Export OBJ
        res_obj = export_obj(scene, obj_path)
        assert res_obj.exists()
        assert res_obj.stat().st_size > 0
