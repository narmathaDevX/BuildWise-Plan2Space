"""Visual styles and layer definitions for 3D meshes."""

from typing import Dict, Tuple
import numpy as np


class LayerStyle:
    def __init__(self, name: str, color_rgba: Tuple[int, int, int, int], roughness: float = 0.8):
        self.name = name
        self.color_rgba = color_rgba
        self.roughness = roughness


LAYER_STYLES: Dict[str, LayerStyle] = {
    "walls": LayerStyle("walls", (236, 239, 244, 255), roughness=0.9),
    "floor": LayerStyle("floor", (210, 205, 195, 255), roughness=0.6),
    "roof": LayerStyle("roof", (100, 116, 139, 255), roughness=0.8),
    "openings": LayerStyle("openings", (64, 75, 90, 255), roughness=0.5),
}


def apply_layer_color(mesh, layer_name: str):
    """Assigns vertex/face visual colors according to layer style."""
    style = LAYER_STYLES.get(layer_name, LAYER_STYLES["walls"])
    c = np.array(style.color_rgba, dtype=np.uint8)
    if hasattr(mesh, "visual"):
        mesh.visual.face_colors = np.tile(c, (len(mesh.faces), 1))
