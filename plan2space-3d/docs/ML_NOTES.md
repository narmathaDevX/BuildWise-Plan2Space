# Machine Learning Architecture & Future Roadmap

This document outlines why Machine Learning (ML) was intentionally omitted from Plan2Space 3D v1, evaluates the engineering trade-offs, and specifies the v2 ML upgrade path.

---

## 1. Why v1 Uses Deterministic Computer Vision Instead of Deep Learning

### A. Geometric Guarantees vs. Probabilistic Hallucination
- **Watertight Solid Geometry:** 3D rendering and CAD/BIM interoperability require strict topological consistency: walls must be planar, corners must meet at precise coordinates, and floor slabs must form non-self-intersecting polygons.
- **Neural Network Limitations:** End-to-end neural networks predicting 3D meshes directly (e.g., Pixel2Mesh, NeRFs, Gaussian Splatting) produce fuzzy, non-manifold point clouds or surfaces with millions of unorganized triangles. They cannot produce parameterized BIM objects (e.g. "a 23 cm brick wall with a 90 cm door opening").
- **Deterministic Pipeline:** Plan2Space 3D v1 uses OpenCV for edge feature detection and Shapely + Trimesh for polygon construction. This guarantees that every extruded wall is a true geometric prism with valid normals and zero self-intersections.

### B. Training Data Domain Shift
- Public floor plan datasets (e.g. **CubiCasa5k**, **R-Plan**, **SESYD**) have severe domain distribution bias:
  - CubiCasa5k consists primarily of Nordic residential plans with standardized vector styles.
  - Real-world plans uploaded by users range from hand-drawn pencil sketches on graph paper, to real estate marketing brochures with 3D furniture renders, to scanned blueprints.
- Off-the-shelf deep learning models perform poorly on out-of-distribution plans without heavy fine-tuning.

### C. Zero-Dependency Lightweight Footprint
- Including PyTorch, torchvision, or ONNX Runtime would expand the dependency footprint from **~60 MB** to **> 2 GB**, requiring CUDA/Metal runtime compilation and significant RAM.
- The v1 OpenCV-based pipeline runs in **under 50 milliseconds** on any modern CPU without requiring a GPU or neural accelerator.

---

## 2. Roadmap: The v2 Machine Learning Upgrade Path

For Plan2Space 3D v2, a hybrid architecture will be introduced: **Deep Learning for Perception, Deterministic Geometry for Mesh Construction**.

```
  Uploaded Image
        │
        ▼
┌──────────────────────────────────────────────┐
│  Stage 1: Deep Perception (v2)               │
│  - YOLOv8-seg (Wall / Door / Window Masks)   │
│  - LayoutLMv3 / CRNN (Dimension OCR & Labels)│
└──────────────────────┬───────────────────────┘
                       │ Vectorized Graph
                       ▼
┌──────────────────────────────────────────────┐
│  Stage 2: Deterministic Geometry (v1 Core)   │
│  - Snap-to-grid & Orthogonal Alignment       │
│  - Shapely 2D Polygon Slicing                │
│  - Trimesh 3D Extrusion & GLB Export         │
└──────────────────────────────────────────────┘
```

### 1. Object Detection for Openings (YOLOv8-obb / Faster R-CNN)
- **Task:** Detect doors, windows, and door-swing arcs with oriented bounding boxes (`OBB`).
- **Benefit:** Eliminates heuristics based solely on wall gaps, correctly identifying sliding doors, double doors, and bay windows.

### 2. Transformer-Based Corner Detection (RoomFormer / HEAT)
- **Task:** Formulate floor plan vectorization as direct polygon vertex prediction using a DETR-like transformer architecture.
- **Benefit:** Directly outputs closed room cycles without needing morphological flood-filling.

### 3. Automated OCR & Dimension Extraction
- **Task:** Read dimensional text (e.g. `12'0" x 14'6"` or `3.50 m`) and associate each dimension with its corresponding wall.
- **Benefit:** Automatic scale calibration without requiring the user to manually click two reference points.

### 4. Synthetic Training Pipeline
- To train these models without copyright issues:
  1. Procedurally generate 50,000 architectural floor plans using graph grammars and Shapely.
  2. Render synthetic plans with diverse styles (hand-drawn pencil strokes, blueprint blue, blueprint white, laser CAD).
  3. Apply domain randomization: augment with JPEG compression, scanner glare, crumpled paper textures, and tilt.
  4. Train lightweight ONNX models (< 30 MB) deployable directly in the browser or on the CPU server.
