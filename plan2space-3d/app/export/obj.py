"""OBJ export utilities for Plan2Space 3D."""

from pathlib import Path
import trimesh


def export_obj(scene: trimesh.Scene, output_path: Path) -> Path:
    """
    Exports a trimesh.Scene to a standalone OBJ file.
    Validates that the file was written and is non-empty.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    obj_data = scene.export(file_type="obj")
    if not obj_data:
        raise ValueError("Failed to export scene to OBJ: empty output.")

    mode = "w" if isinstance(obj_data, str) else "wb"
    with open(output_path, mode) as f:
        f.write(obj_data)

    if output_path.stat().st_size == 0:
        raise ValueError("Exported OBJ is 0 bytes.")

    return output_path
