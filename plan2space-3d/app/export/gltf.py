"""GLB / glTF export utilities for Plan2Space 3D."""

from pathlib import Path
import trimesh


def export_glb(scene: trimesh.Scene, output_path: Path) -> Path:
    """
    Exports a trimesh.Scene to a standalone binary GLB file.
    Validates the generated artifact by reloading it.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    glb_bytes = scene.export(file_type="glb")
    if not glb_bytes:
        raise ValueError("Failed to export scene to GLB: empty output.")

    with open(output_path, "wb") as f:
        f.write(glb_bytes)

    # Sanity check re-loading
    loaded = trimesh.load(str(output_path), file_type="glb")
    if isinstance(loaded, trimesh.Scene):
        vertex_count = sum(len(g.vertices) for g in loaded.geometry.values() if hasattr(g, "vertices"))
    elif hasattr(loaded, "vertices"):
        vertex_count = len(loaded.vertices)
    else:
        vertex_count = 0

    if vertex_count == 0:
        raise ValueError("Exported GLB validation failed: re-loaded model has 0 vertices.")

    return output_path
