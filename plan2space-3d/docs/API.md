# Plan2Space 3D — REST API Reference (v1)

Base URL: `http://localhost:8000/api/v1`

All units in geometry and build parameters are strictly in **metres**.

---

## 1. Coordinate System Conventions

- **2D Plan Geometry:**
  - Math convention: Origin `(0, 0)` at lower-left, `+X` extends to the right (East), `+Y` extends upward (North).
  - All wall endpoints and room polygons use this coordinate space.
- **3D glTF Space:**
  - `X = plan_x`
  - `Y = height (vertical up)`
  - `Z = -plan_y`
  - Matches the standard glTF 2.0 / Three.js right-handed coordinate system.

---

## 2. Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check (returns `200 OK`). |
| `GET` | `/api/v1/capabilities` | Runtime capabilities, coordinate systems, and defaults. |
| `POST` | `/api/v1/floor-plans` | Create a floor plan via image upload or JSON payload. |
| `GET` | `/api/v1/floor-plans` | List all stored floor plans. |
| `GET` | `/api/v1/floor-plans/{id}` | Retrieve details and geometry for a floor plan. |
| `PUT` | `/api/v1/floor-plans/{id}/geometry` | Update 2D floor plan geometry. |
| `POST` | `/api/v1/floor-plans/{id}/calibrate` | Calibrate scale using a reference line or known dimensions. |
| `GET` | `/api/v1/floor-plans/{id}/image` | Stream uploaded floor plan image. |
| `DELETE` | `/api/v1/floor-plans/{id}` | Delete a floor plan and its associated artifacts. |
| `POST` | `/api/v1/conversions` | Submit a 3D mesh generation job. |
| `GET` | `/api/v1/conversions/{id}` | Poll progress and status of a conversion job. |
| `GET` | `/api/v1/conversions/{id}/model` | Download exported 3D model (`glb` or `obj`). |
| `GET` | `/api/v1/conversions/{id}/preview` | Retrieve preview statistics and metadata. |

---

## 3. Endpoint Details & Examples

### `GET /health`
Verifies server health.

**Example Request:**
```bash
curl -s http://localhost:8000/health
```

**Example Response (200 OK):**
```json
{
  "status": "ok",
  "app": "Plan2Space 3D",
  "version": "1.0.0"
}
```

---

### `GET /api/v1/capabilities`
Reports runtime engine status, OCR availability, coordinate conventions, and defaults.

**Example Request:**
```bash
curl -s http://localhost:8000/api/v1/capabilities
```

**Example Response (200 OK):**
```json
{
  "version": "1.0.0",
  "geometry_engine": "shapely + trimesh + mapbox_earcut",
  "ocr_available": false,
  "ocr_enabled": false,
  "supported_export_formats": ["glb", "obj"],
  "supported_image_types": ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  "coordinate_system": {
    "2D": "Math convention: X right, Y up in metres",
    "3D_glTF": "X = 2D X, Y = 2D Height (up), Z = -2D Y"
  },
  "defaults": {
    "wall_height_m": 2.7,
    "exterior_wall_thickness_m": 0.23,
    "interior_wall_thickness_m": 0.115,
    "floor_thickness_m": 0.15,
    "door_width_m": 0.9,
    "door_height_m": 2.1,
    "window_width_m": 1.2,
    "window_height_m": 1.2,
    "window_sill_m": 0.9,
    "default_plan_longest_side_m": 12.0
  }
}
```

---

### `POST /api/v1/floor-plans`
Creates a new floor plan from either:
1. `multipart/form-data` with an image file (`file`) and optional `name`.
2. `application/json` with structured geometry.

**Example JSON Request:**
```bash
curl -X POST http://localhost:8000/api/v1/floor-plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "10x8 Rectangle",
    "geometry": {
      "walls": [
        {"id": "w1", "start": {"x": 0, "y": 0}, "end": {"x": 10, "y": 0}, "thickness": 0.23, "height": 2.7, "is_exterior": true},
        {"id": "w2", "start": {"x": 10, "y": 0}, "end": {"x": 10, "y": 8}, "thickness": 0.23, "height": 2.7, "is_exterior": true},
        {"id": "w3", "start": {"x": 10, "y": 8}, "end": {"x": 0, "y": 8}, "thickness": 0.23, "height": 2.7, "is_exterior": true},
        {"id": "w4", "start": {"x": 0, "y": 8}, "end": {"x": 0, "y": 0}, "thickness": 0.23, "height": 2.7, "is_exterior": true}
      ],
      "openings": [
        {"id": "d1", "wall_id": "w1", "type": "door", "position_along_wall": 4.0, "width": 1.0, "height": 2.1, "sill_height": 0.0}
      ],
      "rooms": [
        {"id": "r1", "name": "Living Hall", "polygon": [{"x":0,"y":0}, {"x":10,"y":0}, {"x":10,"y":8}, {"x":0,"y":8}], "area_sqm": 80.0}
      ],
      "scale": {"pixels_per_metre": 50.0, "source": "user_provided"}
    }
  }'
```

**Example Response (201 Created):**
```json
{
  "id": "fp_8a2b1c",
  "name": "10x8 Rectangle",
  "geometry": { ... },
  "image_url": null,
  "warnings": [],
  "created_at": "2026-10-15T10:00:00Z",
  "updated_at": "2026-10-15T10:00:00Z"
}
```

---

### `POST /api/v1/conversions`
Submits a background job to generate 3D meshes.

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/v1/conversions \
  -H "Content-Type: application/json" \
  -d '{
    "floor_plan_id": "fp_8a2b1c",
    "parameters": {
      "default_wall_height": 2.7,
      "exterior_wall_thickness": 0.23,
      "include_floor": true,
      "roof": {"type": "none"},
      "export_formats": ["glb", "obj"]
    }
  }'
```

**Example Response (202 Accepted):**
```json
{
  "id": "job_9f4e2a",
  "floor_plan_id": "fp_8a2b1c",
  "status": "queued",
  "progress": 0.0,
  "current_step": "Queued for processing",
  "created_at": "2026-10-15T10:00:05Z",
  "parameters": { ... },
  "artifacts": {}
}
```

---

### `GET /api/v1/conversions/{id}`
Polls job status and retrieves mesh statistics once finished.

**Example Response (200 OK):**
```json
{
  "id": "job_9f4e2a",
  "floor_plan_id": "fp_8a2b1c",
  "status": "completed",
  "progress": 1.0,
  "current_step": "Conversion complete",
  "created_at": "2026-10-15T10:00:05Z",
  "completed_at": "2026-10-15T10:00:06Z",
  "artifacts": {
    "glb": "/api/v1/conversions/job_9f4e2a/model?format=glb",
    "obj": "/api/v1/conversions/job_9f4e2a/model?format=obj"
  },
  "mesh_stats": {
    "vertex_count": 88,
    "face_count": 132,
    "is_watertight": true,
    "bounding_box_min": [-0.115, -0.15, -8.115],
    "bounding_box_max": [10.115, 2.7, 0.115],
    "dimensions_m": [10.23, 2.85, 8.23],
    "layers": ["walls", "floor"]
  }
}
```

---

### `GET /api/v1/conversions/{id}/model?format=glb`
Downloads the binary glTF model (`Content-Type: model/gltf-binary`).

```bash
curl -O -J http://localhost:8000/api/v1/conversions/job_9f4e2a/model?format=glb
```

---

## 4. Interior Design Studio Endpoints

### `GET /api/v1/design-catalogue`
Returns the static furniture catalogue specification: 7 categories, procedural variants, default dimensions (in metres), and 24 curated architectural color presets.

**Example Response (200 OK):**
```json
{
  "categories": [
    {
      "category_id": "beds",
      "name": "Beds",
      "icon": "bed",
      "items": [
        {
          "type_id": "bed",
          "name": "Bed",
          "category": "beds",
          "variants": [
            {
              "variant_id": "double",
              "name": "Double Bed",
              "default_dimensions": [1.5, 2.0, 1.0],
              "default_colors": {"primary": "#EDE6D6", "secondary": "#334155"}
            }
          ]
        }
      ]
    }
  ],
  "color_presets": [
    {"name": "Pure White", "hex": "#FFFFFF", "category": "Whites & Creams"},
    {"name": "Soft Alabaster", "hex": "#F8F7F2", "category": "Whites & Creams"}
  ],
  "finishes": ["matte", "satin", "gloss"]
}
```

---

### `GET /api/v1/conversions/{id}/geometry`
Returns floor plan geometry along with 3D wall face normal and room lookup (`pos_normal`, `neg_normal`, `top`, `start_cap`, `end_cap`).

**Example Response (200 OK):**
```json
{
  "job_id": "job_9f4e2a",
  "floor_plan_id": "fp_8a2b1c",
  "floor_plan_name": "Living Room Plan",
  "geometry": { ... },
  "wall_faces_lookup": {
    "w_south": {
      "direction_3d": [1.0, 0.0, 0.0],
      "normal_3d": [0.0, 0.0, -1.0],
      "faces": {
        "pos_normal": {"normal_3d": [0.0, 0.0, -1.0], "room_id": "rm_main", "room_name": "Living Room"},
        "neg_normal": {"normal_3d": [0.0, 0.0, 1.0], "room_id": null, "room_name": "Exterior"},
        "top": {"normal_3d": [0.0, 1.0, 0.0], "room_name": "Top"}
      }
    }
  }
}
```

---

### `GET /api/v1/conversions/{id}/design`
Retrieves saved design state (wall colours, floor colours, ceiling colour, placed furniture).

**Status Codes:**
- `200 OK`: Returns saved `DesignState`.
- `404 Not Found`: If no design saved yet (`"No design saved for conversion <id>"`).
- `409 Conflict`: If conversion job has not completed.

---

### `PUT /api/v1/conversions/{id}/design`
Saves or updates the interior design state for a completed conversion.
- Validates hex colors against `^#[0-9a-fA-F]{6}$`.
- Limits furniture items to at most 300 items per scene.
- Validates that painted wall IDs exist in conversion floor plan geometry.
- Enforces finite numeric floats for position, rotation, and dimensions.

**Example Request:**
```json
{
  "conversion_id": "job_9f4e2a",
  "walls": [
    {"wall_id": "w_south", "face": "pos_normal", "color": "#F8F7F2", "finish": "matte"}
  ],
  "floors": [
    {"room_id": "rm_main", "color": "#EDE6D6", "finish": "matte"}
  ],
  "ceiling": {
    "color": "#FFFFFF",
    "finish": "matte"
  },
  "furniture": [
    {
      "item_type": "sofa",
      "variant": "3-seater",
      "category": "seating",
      "position": [3.5, 0.0, -2.5],
      "rotation": [0.0, 1.57, 0.0],
      "scale": [1.0, 1.0, 1.0],
      "dimensions": [2.1, 0.9, 0.85],
      "colors": {"primary": "#334155", "secondary": "#F8F7F2"},
      "custom_label": "Living Room Sofa"
    }
  ]
}
```

---

### `DELETE /api/v1/conversions/{id}/design`
Resets the design state for this conversion back to the default blank 3D model.

**Example Response (200 OK):**
```json
{
  "success": true,
  "detail": "Design for conversion 'job_9f4e2a' has been reset to default.",
  "was_present": true
}
```
