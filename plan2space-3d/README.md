# Plan2Space 3D 🏠

> **Interactive 2D Floor Plan to 3D House Model Converter**
> *Built with FastAPI, Shapely, Trimesh, OpenCV, and Three.js on macOS.*

Plan2Space 3D is a standalone, local-first application that converts 2D architectural house plans (images or structured geometry) into interactive, watertight 3D models with tagged layers (`walls`, `floor`, `roof`, `openings`).

---

## Key Features

- **Deterministic Geometry Engine:** Powered by Shapely and Trimesh. Generates watertight, real-scale architectural meshes in metres without fragile CSG booleans.
- **Door & Window Slicing:** Centerline partitioning creates real openings with floor sills, open gaps for light/sightlines, and overhead lintels.
- **OpenCV Computer Vision Baseline:** Adaptive thresholding, Hough transform, orthogonal line snapping, collinear merging, and room cavity extraction.
- **Interactive 2D SVG Correction Editor:** Move wall endpoints, draw walls, insert doors/windows, and calibrate real-world dimensions.
- **Standard 3D Export:** Generates industry-standard **GLB (binary glTF)** and **Wavefront OBJ** models.
- **Interior Design Studio:** Full interactive studio (`studio.html`) featuring face-level wall painting (inner/outer/top), room-level painting, 24 architectural preset colours, custom hex picker, 7 procedural furniture categories (Beds, Seating, Storage, Tables, Electronics/Appliances, Bathroom, Decor) with real-world dimensions in metres, ghost placement, wall snapping, 50-step undo/redo stack, and client-side GLB export.
- **Single-Server Architecture:** Both the REST API and the frontend are served directly by FastAPI.

---

## Coordinate System Conventions

- **2D Plan Geometry:** Math coordinate convention. Origin `(0, 0)` is at the bottom-left of the bounding box. `+X` points right (East) and `+Y` points up (North). All coordinates are in **metres**.
- **3D glTF Coordinate System:** Right-handed standard:
  - `X = plan_x`
  - `Y = height (vertical up)`
  - `Z = -plan_y`

---

## Quick Start on macOS

### 1. Requirements
- macOS 13+ (Apple Silicon or Intel)
- Python 3.11+ (Python 3.13 tested and supported)

### 2. Launch the Application

In your macOS Terminal:

```bash
cd ~/plan2space-3d

# 1. Activate the Python virtual environment
source .venv/bin/activate

# 2. Start the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Open the Web Application
Open your web browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## How to Use the Web Application (9-Step Workflow)

1. **Plan Input:** Click one of the sample buttons (**Clean Rectangle**, **L-Shaped**, or **Noisy Scan**) or upload your own floor plan image (`PNG`, `JPG`, `WebP`).
2. **Review Detection:** Check the detected wall count, room count, and confidence score. Any detection warnings are displayed transparently.
3. **Calibrate Scale:** Click **Measure Line on 2D Plan**, click two points of known length, enter the metres (e.g. `5.0m`), and click **Apply**.
4. **2D Geometry Editor:**
   - **Move / Edit:** Drag wall endpoints to reposition or align walls.
   - **Add Wall:** Click two points to draw a new wall.
   - **Add Door / Window:** Click along any wall to insert an opening.
   - **Delete:** Select any wall and click Delete.
5. **Set 3D Parameters:** Adjust wall height (default `2.7m`), wall thickness (`0.23m`), floor slab (`0.15m`), or roof style (**Flat**, **Gabled 20°**, or **Open Top**).
6. **Generate 3D Mesh:** Click **🚀 Generate Interactive 3D Model**. The background worker builds the 3D geometry in milliseconds.
7. **Interactive 3D Viewer:**
   - Left-click and drag to rotate.
   - Right-click and drag to pan.
   - Scroll to zoom.
   - Toggle visibility of individual layers (**Walls**, **Floor**, **Roof**).
   - Use camera presets (**Perspective**, **Top**, **Front**).
8. **Export Center:** Download the final **.GLB** model, **.OBJ** mesh, or **.JSON** geometry with one click.
9. **Snapshot:** Click **📸 Snapshot Viewport** to download a high-resolution PNG render.

---

## Inspecting 3D Models on macOS

### Option A: macOS QuickLook (Built into macOS Finder)
1. In Finder, open the project folder `~/plan2space-3d/data/models/`.
2. Select any generated `.glb` file.
3. Press the **Spacebar** on your Mac keyboard.
4. macOS QuickLook will open a native interactive 3D viewer allowing you to rotate and inspect the house model directly!

### Option B: Online glTF Viewers
You can also drag and drop any exported `.glb` file into:
- [glTF Sample Viewer](https://github.khronos.org/glTF-Sample-Viewer-Release/)
- [Don McCurdy's glTF Viewer](https://gltf-viewer.donmccurdy.com/)

---

## Running the Automated Test Suite

### Run All Pytest Tests
```bash
cd ~/plan2space-3d
./.venv/bin/pytest
```
*Executes all 21 unit and integration tests across capabilities, geometry, GLB/OBJ export, OpenCV pipeline, API CRUD, design studio persistence, validation, and 2D-to-3D roundtrip.*

### Run the End-to-End Smoke Test
```bash
./.venv/bin/python3 scripts/smoke_test.py
```
*Tests the complete pipeline end-to-end (health, capabilities, plan creation, 3D conversion, job polling, and model download).*

---

## Directory Structure

```
plan2space-3d/
├── app/
│   ├── config.py              # Configuration & defaults (metres, timeouts, paths)
│   ├── main.py                # FastAPI entrypoint & static frontend mount
│   ├── api/v1/                # Versioned REST endpoints (capabilities, plans, conversions, design)
│   ├── geometry/              # Deterministic 3D builder (Shapely + Trimesh)
│   ├── processing/            # OpenCV computer vision pipeline
│   ├── export/                # Validated GLB and OBJ exporters
│   ├── schemas/               # Pydantic v2 schemas (geometry, requests, responses, design)
│   ├── services/              # Background conversion worker and furniture catalogue
│   └── storage/               # File-based job, model, and design store
├── frontend/
│   ├── index.html             # 2D Plan & 3D Model Viewer UI
│   ├── studio.html            # Interior Design Studio UI
│   ├── css/
│   │   ├── style.css          # Viewer & editor styling
│   │   └── studio.css         # Studio styling (palette, catalogue, inspector)
│   ├── js/
│   │   ├── app.js, api.js, editor.js, viewer.js
│   │   └── studio/            # Studio ES modules (studioApp, studioViewer, wallPainter, furnitureManager, exporter, history)
│   └── vendor/                # Vendored Three.js, OrbitControls, GLTFLoader
├── sample_floorplans/         # Programmatic test datasets (rect, l_shaped, noisy)
├── scripts/
│   ├── generate_samples.py    # Generates benchmark plans
│   └── smoke_test.py          # End-to-end smoke verification
├── tests/                     # 21 passing pytest integration & unit tests
├── docs/
│   ├── API.md                 # Complete REST API specification
│   ├── INTEGRATION_GUIDE.md   # External client integration guide
│   ├── DETECTION_NOTES.md     # Benchmark analysis and CV failure modes
│   └── ML_NOTES.md            # Why non-ML in v1 and v2 deep learning roadmap
├── requirements.txt           # Pinned production dependencies
└── pytest.ini                 # Pytest configuration
```

---

## Troubleshooting

- **Port 8000 already in use:**
  Run on a different port:
  ```bash
  uvicorn app.main:app --port 8001
  ```
- **Tesseract OCR status:**
  Plan2Space 3D works out-of-the-box without OCR. If Tesseract is not installed on your system, `/api/v1/capabilities` reports `ocr_available: false` and the system continues running normally.
- **Three.js vendor files:**
  Three.js, OrbitControls, and GLTFLoader are vendored locally in `frontend/vendor/`, enabling completely offline 3D viewing.
