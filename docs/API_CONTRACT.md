# BuildWise API Contract & Specification

This document defines the formal API contract between the BuildWise Python FastAPI backend and the React frontend.

---

## 1. Global Conventions & Standards

- **Base URL:** `http://127.0.0.1:8000` (Configurable via `VITE_API_BASE_URL` on frontend, `CORS_ORIGINS` on backend).
- **Format:** JSON (`application/json`).
- **Naming Convention:**
  - Backend API parameters and responses use `snake_case`.
  - Frontend internal state uses `camelCase`; transformation is handled in `services/api.js`.
- **Error Response Shape:**
  FastAPI default 422 validation handlers are overridden so `detail` is always a **human-readable string**:
  ```json
  {
    "detail": "Descriptive error message",
    "errors": [
      {
        "field": "plot.width",
        "message": "Width must be between 15 and 300 feet"
      }
    ]
  }
  ```
- **Currency & Units:**
  - Currency: Indian Rupee (INR, `₹`).
  - Distance: Feet (`ft`).
  - Area: Square feet (`sq ft`).
- **Origin & Coordinate System for Floor Plans:**
  - Origin `(0, 0)` is at the top-left corner of the plot.
  - `X` axis increases to the right.
  - `Y` axis increases downward (matching SVG rendering standards).
  - `road_side`: `"N"` (top, Y=0), `"S"` (bottom, Y=depth), `"W"` (left, X=0), `"E"` (right, X=width).
  - Front setback applies to the `road_side` boundary; rear setback to opposite boundary; left/right setbacks to lateral boundaries.

---

## 2. Authentication Endpoints

> **Design Note:** The existing UI operates in guest/single-user mode without login screens. With `AUTH_REQUIRED=false` (default), all project calls resolve to a default local user (`guest@buildwise.local`). When `AUTH_REQUIRED=true`, a Bearer JWT token in the `Authorization` header is required.

### 2.1 `POST /api/auth/register`
Creates a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "Narmathan"
}
```

**Response (HTTP 201):**
```json
{
  "user": {
    "id": "usr_94b281f0",
    "email": "user@example.com",
    "name": "Narmathan",
    "created_at": "2026-10-13T14:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer"
}
```

### 2.2 `POST /api/auth/login`
Authenticates a user and returns a JWT access token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (HTTP 200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "user": {
    "id": "usr_94b281f0",
    "email": "user@example.com",
    "name": "Narmathan"
  }
}
```

### 2.3 `GET /api/auth/me`
Returns the active authenticated user profile.

**Headers:** `Authorization: Bearer <token>` (or omitted when `AUTH_REQUIRED=false`)

**Response (HTTP 200):**
```json
{
  "id": "usr_94b281f0",
  "email": "user@example.com",
  "name": "Narmathan",
  "created_at": "2026-10-13T14:30:00Z"
}
```

---

## 3. Floor Plan Generation

### 3.1 `POST /api/generate`
Generates conceptual non-overlapping floor plans or returns structured feasibility conflicts.

**Request:**
```json
{
  "request": {
    "units": "ft",
    "plot": {
      "width": 40.0,
      "depth": 60.0
    },
    "road_side": "N",
    "setbacks": {
      "front": 5.0,
      "rear": 3.0,
      "left": 3.0,
      "right": 3.0
    },
    "floors": 1,
    "rooms": [
      { "id": "living", "type": "living", "min_area": 120.0 },
      { "id": "kitchen", "type": "kitchen", "min_area": 50.0 },
      { "id": "dining", "type": "dining", "min_area": 70.0 },
      { "id": "master", "type": "master_bedroom", "min_area": 120.0 },
      { "id": "master_bath", "type": "attached_bathroom", "min_area": 30.0, "attached_to": "master" },
      { "id": "bedroom_2", "type": "bedroom", "min_area": 100.0 },
      { "id": "bedroom_3", "type": "bedroom", "min_area": 100.0 },
      { "id": "bathroom_1", "type": "bathroom", "min_area": 30.0 },
      { "id": "utility", "type": "utility", "min_area": 30.0 },
      { "id": "parking", "type": "parking", "min_area": 150.0 }
    ],
    "solver_options": {
      "num_alternatives": 3,
      "seed": 42
    }
  },
  "options": {
    "num_alternatives": 3,
    "seed": 42
  }
}
```

**Response (HTTP 200 - Feasible):**
```json
{
  "plans": [
    {
      "plan_id": "plan_7f8a92e104cd",
      "name": "Layout A",
      "score": 88.5,
      "score_breakdown": {
        "total": 88.5,
        "aspect_ratio": 92.0,
        "daylight": 85.0,
        "circulation": 89.0,
        "plumbing_cluster": 87.0
      },
      "request_echo": {
        "plot": { "width": 40.0, "depth": 60.0 },
        "road_side": "N",
        "floors": 1
      },
      "floors": [
        {
          "level": 0,
          "rooms": [
            {
              "id": "living",
              "type": "living",
              "name": "Living",
              "x": 3.0,
              "y": 5.0,
              "width": 18.0,
              "height": 12.0,
              "area": 216.0,
              "polygon": [[3.0, 5.0], [21.0, 5.0], [21.0, 17.0], [3.0, 17.0]]
            }
          ],
          "circulation": []
        }
      ],
      "details": {
        "ground_built_up": 1250.0,
        "total_built_up": 1250.0,
        "plot_coverage_pct": 52.1,
        "circulation_area": 120.0,
        "room_count": 9
      }
    }
  ],
  "conflicts": [],
  "warnings": [],
  "meta": {
    "seed": 42,
    "engine": "BuildWise Constraint Solver v0.2.0",
    "generated_at": "2026-10-13T14:32:00Z",
    "elapsed_ms": 124
  }
}
```

**Response (HTTP 200 - Infeasible Input):**
```json
{
  "plans": [],
  "conflicts": [
    {
      "code": "INSUFFICIENT_ENVELOPE_AREA",
      "message": "Required rooms need at least 1,420 sq ft, but the buildable envelope is only 980 sq ft. Reduce bedrooms, add a floor, or enlarge the plot.",
      "room_id": null,
      "suggestion": "Add a second floor or increase plot dimensions."
    }
  ],
  "warnings": [],
  "meta": {
    "seed": 42,
    "engine": "BuildWise Feasibility Auditor",
    "generated_at": "2026-10-13T14:32:00Z",
    "elapsed_ms": 12
  }
}
```

---

## 4. Estimation Services

### 4.1 `POST /api/estimate/affordability`
Live fast calculator for Planner Step 3 before generating floor plans.

**Request:**
```json
{
  "plot_width": 40.0,
  "plot_depth": 60.0,
  "floors": 1,
  "bedrooms": 3,
  "bathrooms": 2,
  "quality": "Standard",
  "location": "Tamil Nadu",
  "budget": 3500000,
  "monthly_budget": 300000
}
```

**Response (HTTP 200):**
```json
{
  "approx_built_up_area": 1550,
  "estimated_cost": 3410000,
  "budget_status": "within",
  "months_to_complete": 12,
  "affordability": {
    "label": "Good",
    "ratio": 1.05,
    "explanation": "Your monthly budget of ₹3,00,000 comfortably finances construction across the projected 12-month timeline."
  }
}
```

### 4.2 `POST /api/estimate/cost`
Comprehensive cost estimator for a specific plan or built-up area.

**Request:**
```json
{
  "plan_id": "plan_7f8a92e104cd",
  "total_built_up_area": 1850.0,
  "plot_area": 2400.0,
  "floors": 1,
  "location": "Tamil Nadu",
  "quality": "Standard",
  "budget": 3500000
}
```

**Response (HTTP 200):**
```json
{
  "total_cost": 3250000,
  "cost_per_sqft": 1756.76,
  "range": {
    "low": 3087500,
    "high": 3412500
  },
  "breakdown": [
    { "key": "structure", "name": "Structure", "amount": 1120000, "percentage": 34 },
    { "key": "masonry", "name": "Masonry", "amount": 585000, "percentage": 18 },
    { "key": "electrical_plumbing", "name": "Electrical & Plumbing", "amount": 487500, "percentage": 15 },
    { "key": "flooring_finishing", "name": "Flooring & Finishing", "amount": 682500, "percentage": 21 },
    { "key": "doors_windows", "name": "Doors & Windows", "amount": 325000, "percentage": 10 }
  ],
  "budget": {
    "planned": 3500000,
    "remaining": 250000,
    "used_pct": 92.86,
    "status": "within"
  },
  "method": "formula",
  "assumptions": [
    "Base plinth construction rate for Standard specification: ₹1,750 / sq ft (Tamil Nadu PWD & industry benchmark Q3 2026).",
    "Standard soil bearing capacity and flat terrain assumed without pile foundations.",
    "Percentages rounded via largest-remainder method ensuring exact 100% total."
  ],
  "excluded_items": [
    "Land acquisition & registration taxes",
    "Municipal plan sanctions & liaison fees",
    "Compound boundary wall and main entry gate",
    "Borewell, underground sump, and septic tank",
    "Interior loose furniture and modular appliances"
  ],
  "rates_as_of": "October 2026",
  "disclaimer": "Preliminary engineering estimate for planning purposes. Subject to site structural design and material market variations."
}
```

### 4.3 `POST /api/estimate/schedule`
Month-by-month cash-flow and progress simulator.

**Request:**
```json
{
  "total_cost": 3250000,
  "monthly_budget": 300000,
  "quality": "Standard",
  "floors": 1,
  "built_up_area": 1850.0,
  "start_date": "2026-11-01"
}
```

**Response (HTTP 200):**
```json
{
  "start_date": "2026-11-01",
  "estimated_months": 11,
  "completion_date": "September 2027",
  "total_spend": 3250000,
  "funding": {
    "status": "adequate",
    "shortfall": 0,
    "min_monthly_budget_for_target": 295455
  },
  "stages": [
    {
      "key": "site_prep",
      "name": "Site Preparation",
      "description": "Land clearing, marking and excavation",
      "cost": 130000,
      "start_month": 1,
      "end_month": 1,
      "duration_months": 1
    },
    {
      "key": "foundation",
      "name": "Foundation",
      "description": "Footing, foundation and ground beam",
      "cost": 455000,
      "start_month": 1,
      "end_month": 3,
      "duration_months": 2
    },
    {
      "key": "structure",
      "name": "Structure",
      "description": "Columns, beams and slab construction",
      "cost": 845000,
      "start_month": 3,
      "end_month": 6,
      "duration_months": 3
    },
    {
      "key": "walls",
      "name": "Walls & Partitions",
      "description": "Brickwork and internal partitions",
      "cost": 585000,
      "start_month": 5,
      "end_month": 8,
      "duration_months": 3
    },
    {
      "key": "electrical",
      "name": "Electrical",
      "description": "Wiring, switches and electrical points",
      "cost": 243750,
      "start_month": 7,
      "end_month": 9,
      "duration_months": 2
    },
    {
      "key": "plumbing",
      "name": "Plumbing",
      "description": "Water supply and drainage systems",
      "cost": 243750,
      "start_month": 7,
      "end_month": 9,
      "duration_months": 2
    },
    {
      "key": "finishing",
      "name": "Flooring & Finishing",
      "description": "Flooring, painting and final finishes",
      "cost": 747500,
      "start_month": 9,
      "end_month": 11,
      "duration_months": 3
    }
  ],
  "months": [
    {
      "month": 1,
      "label": "Month 1 (Nov 2026)",
      "spend": 300000,
      "cumulative_spend": 300000,
      "overall_progress": 9,
      "stage_progress": {
        "site_prep": 100,
        "foundation": 37,
        "structure": 0,
        "walls": 0,
        "electrical": 0,
        "plumbing": 0,
        "finishing": 0
      },
      "stage_status": {
        "site_prep": "completed",
        "foundation": "active",
        "structure": "upcoming",
        "walls": "upcoming",
        "electrical": "upcoming",
        "plumbing": "upcoming",
        "finishing": "upcoming"
      },
      "current_stage_key": "foundation",
      "next_stage_funding_needed": 155000
    }
  ],
  "assumptions": [
    "Unspent monthly cash rolls over into subsequent months.",
    "Physical construction rate capped by labor/curing capacity per stage."
  ],
  "limitations": [
    "Weather delays (e.g. Northeast Monsoon Oct-Dec) may require schedule buffer.",
    "Cost-weighted progress serves as an analytical proxy for physical site milestones."
  ]
}
```

---

## 5. Project Persistence Endpoints

### 5.1 `GET /api/projects/current`
Fetches the currently active project including saved planner configuration, generated plans, selected plan ID, cost, and schedule.

**Response (HTTP 200 - When Project Exists):**
```json
{
  "id": "proj_1a2b3c4d",
  "name": "My Dream Home",
  "location": "Tamil Nadu",
  "status": "Planning",
  "form": {
    "length": 60,
    "width": 40,
    "facing": "North",
    "location": "Tamil Nadu",
    "bedrooms": 3,
    "bathrooms": 2,
    "floors": 1,
    "parking": true,
    "balcony": true,
    "pooja": false,
    "utility": true,
    "budget": 3500000,
    "monthlyBudget": 300000,
    "quality": "Standard"
  },
  "selected_plan_id": "plan_7f8a92e104cd",
  "plans": [ /* array of Plan objects */ ],
  "cost_estimate": { /* CostEstimate object */ },
  "schedule_estimate": { /* ScheduleEstimate object */ },
  "construction_start_date": "2026-11-01",
  "current_month": 1,
  "created_at": "2026-10-13T14:35:00Z",
  "updated_at": "2026-10-13T14:35:00Z"
}
```

**Response (HTTP 200 - Empty State when No Project Exists):**
```json
{
  "id": null,
  "name": null,
  "status": "No Project",
  "has_project": false
}
```

### 5.2 `PUT /api/projects/current`
Upserts planner form values and persists newly generated plans.

**Request:**
```json
{
  "name": "My Dream Home",
  "form": {
    "length": 60,
    "width": 40,
    "facing": "North",
    "location": "Tamil Nadu",
    "bedrooms": 3,
    "bathrooms": 2,
    "floors": 1,
    "parking": true,
    "balcony": true,
    "pooja": false,
    "utility": true,
    "budget": 3500000,
    "monthlyBudget": 300000,
    "quality": "Standard"
  },
  "plans": [ /* array of Plan objects */ ],
  "selected_plan_id": "plan_7f8a92e104cd"
}
```

**Response (HTTP 200):** Returns updated project representation.

### 5.3 `PUT /api/projects/current/selected-plan`
Updates the user's selected plan option.

**Request:**
```json
{
  "plan_id": "plan_7f8a92e104cd"
}
```

**Response (HTTP 200):**
```json
{
  "status": "updated",
  "selected_plan_id": "plan_7f8a92e104cd"
}
```

### 5.4 `GET /api/projects/current/summary`
Feeds the Dashboard top hero and stats row.

**Response (HTTP 200):**
```json
{
  "has_project": true,
  "name": "My Dream Home",
  "location": "Tamil Nadu",
  "status": "Planning",
  "plot_area": 2400,
  "built_up_area": 1850,
  "estimated_cost": 3250000,
  "cost_formatted": "₹32.5L",
  "budget_status": "within budget",
  "estimated_months": 10,
  "progress_percent": 18,
  "timeline_steps": [
    { "name": "Planning", "status": "active" },
    { "name": "Foundation", "status": "upcoming" },
    { "name": "Structure", "status": "upcoming" },
    { "name": "Finishing", "status": "upcoming" },
    { "name": "Complete", "status": "upcoming" }
  ]
}
```

### 5.5 `GET /api/projects/current/construction?month=n`
Feeds the Construction tracking page with cost-weighted progress and stage milestones for projected month `n`.

**Response (HTTP 200):**
```json
{
  "has_project": true,
  "month": 2,
  "total_months": 11,
  "month_label": "Month 2 of 11 (Dec 2026)",
  "overall_progress": 18,
  "completed_stages": 1,
  "current_stage": {
    "key": "foundation",
    "name": "Foundation",
    "description": "Footing, foundation and ground beam",
    "progress": 75,
    "status": "active"
  },
  "estimated_completion": "September 2027",
  "months_remaining": 9,
  "current_phase_target": "Foundation / Target completion: 75%",
  "status_text": "Planning projected progress",
  "insights": [
    {
      "label": "CASH BURN",
      "title": "₹3,00,000 / month",
      "text": "Spend is aligned with your monthly budget allocation."
    },
    {
      "label": "CRITICAL PATH",
      "title": "Curing Time",
      "text": "Foundation slab curing takes mandatory 14 days before column load."
    },
    {
      "label": "NEXT MILESTONE",
      "title": "Plinth Beam",
      "text": "Rebar inspection due upon completion of foundation work."
    }
  ],
  "stages": [
    {
      "key": "site_prep",
      "name": "Site Preparation",
      "description": "Land clearing, marking and excavation",
      "progress": 100,
      "status": "completed"
    },
    {
      "key": "foundation",
      "name": "Foundation",
      "description": "Footing, foundation and ground beam",
      "progress": 75,
      "status": "active"
    },
    {
      "key": "structure",
      "name": "Structure",
      "description": "Columns, beams and slab construction",
      "progress": 0,
      "status": "upcoming"
    },
    {
      "key": "walls",
      "name": "Walls & Partitions",
      "description": "Brickwork and internal partitions",
      "progress": 0,
      "status": "upcoming"
    },
    {
      "key": "electrical",
      "name": "Electrical",
      "description": "Wiring, switches and electrical points",
      "progress": 0,
      "status": "upcoming"
    },
    {
      "key": "plumbing",
      "name": "Plumbing",
      "description": "Water supply and drainage systems",
      "progress": 0,
      "status": "upcoming"
    },
    {
      "key": "finishing",
      "name": "Flooring & Finishing",
      "description": "Flooring, painting and final finishes",
      "progress": 0,
      "status": "upcoming"
    }
  ]
}
```

### 5.6 `GET /api/projects/current/report`
Feeds the Reports page with full financial breakdown, metrics, and procurement status.

**Response (HTTP 200):**
```json
{
  "has_project": true,
  "project_name": "My Dream Home",
  "location": "Tamil Nadu",
  "status_label": "Planning active",
  "budget": 3500000,
  "estimated_cost": 3250000,
  "remaining": 250000,
  "metrics": {
    "plot_area": 2400,
    "built_up_area": 1850,
    "estimated_duration_months": 10,
    "overall_progress_pct": 18
  },
  "cost_breakdown": [
    { "name": "Structure", "amount": 1120000, "percentage": 34 },
    { "name": "Masonry", "amount": 585000, "percentage": 18 },
    { "name": "Electrical & Plumbing", "amount": 487500, "percentage": 15 },
    { "name": "Flooring & Finishing", "amount": 682500, "percentage": 21 },
    { "name": "Doors & Windows", "amount": 325000, "percentage": 10 }
  ],
  "materials_summary": {
    "purchased_count": 2,
    "total_count": 6
  },
  "expected_completion": "September 2027",
  "status_grid": [
    { "title": "Budget Status", "value": "Within budget", "subtitle": "₹2.5L contingency reserve" },
    { "title": "Timeline", "value": "11 months total", "subtitle": "Current progress: Month 2" },
    { "title": "Procurement", "value": "2 of 6 items", "subtitle": "Structural steel & cement secured" },
    { "title": "Approvals", "value": "Pending submission", "subtitle": "Local panchayat/DTCP submission" }
  ]
}
```

---

## 6. Materials Endpoints

### 6.1 `GET /api/projects/current/materials`
Returns bill of quantities, unit rates, purchase flags, category counts, and rates date.

**Response (HTTP 200):**
```json
{
  "rates_as_of": "October 2026",
  "total_cost": 724450,
  "purchased_cost": 434800,
  "purchased_count": 2,
  "total_count": 6,
  "purchase_progress": 33,
  "categories": [
    { "name": "Structure", "count": 2 },
    { "name": "Masonry", "count": 2 },
    { "name": "Finishing", "count": 2 }
  ],
  "materials": [
    {
      "id": "mat_1",
      "key": "cement",
      "name": "Cement",
      "category": "Structure",
      "quantity": 420,
      "unit": "bags",
      "rate": 420,
      "estimated_cost": 176400,
      "purchased": true,
      "is_custom": false
    },
    {
      "id": "mat_2",
      "key": "steel",
      "name": "Steel",
      "category": "Structure",
      "quantity": 3.8,
      "unit": "tons",
      "rate": 68000,
      "estimated_cost": 258400,
      "purchased": true,
      "is_custom": false
    },
    {
      "id": "mat_3",
      "key": "m_sand",
      "name": "M-Sand",
      "category": "Masonry",
      "quantity": 32,
      "unit": "tons",
      "rate": 1800,
      "estimated_cost": 57600,
      "purchased": false,
      "is_custom": false
    },
    {
      "id": "mat_4",
      "key": "bricks",
      "name": "Bricks",
      "category": "Masonry",
      "quantity": 18000,
      "unit": "nos",
      "rate": 9,
      "estimated_cost": 162000,
      "purchased": false,
      "is_custom": false
    },
    {
      "id": "mat_5",
      "key": "floor_tiles",
      "name": "Floor Tiles",
      "category": "Finishing",
      "quantity": 1650,
      "unit": "sq.ft",
      "rate": 85,
      "estimated_cost": 140250,
      "purchased": false,
      "is_custom": false
    },
    {
      "id": "mat_6",
      "key": "paint",
      "name": "Paint",
      "category": "Finishing",
      "quantity": 95,
      "unit": "litres",
      "rate": 260,
      "estimated_cost": 24700,
      "purchased": false,
      "is_custom": false
    }
  ]
}
```

### 6.2 `PATCH /api/projects/current/materials/{id}`
Toggles procurement status (`purchased: true/false`) or edits quantity/rate.

**Request:**
```json
{
  "purchased": true
}
```

**Response (HTTP 200):** Returns updated material object.

### 6.3 `POST /api/projects/current/materials`
Adds a custom user-defined material item.

**Request:**
```json
{
  "name": "Teak Wood Main Door",
  "category": "Finishing",
  "quantity": 1,
  "unit": "nos",
  "rate": 35000,
  "purchased": false
}
```

**Response (HTTP 201):** Returns created material object with generated ID and `is_custom: true`.

### 6.4 `DELETE /api/projects/current/materials/{id}`
Deletes a custom material item (standard default materials cannot be deleted, only toggled).

---

## 7. System & Diagnostic Endpoints

### 7.1 `GET /api/health`
**Response (HTTP 200):**
```json
{
  "status": "ok",
  "engine_loaded": true,
  "database": "connected",
  "timestamp": "2026-10-13T14:40:00Z"
}
```

### 7.2 `GET /api/ml/status`
Transparent report on machine learning models and estimation methods.

**Response (HTTP 200):**
```json
{
  "model_type": "formula_based",
  "artifact_loaded": false,
  "features": [],
  "metrics": null,
  "status": "transparent_formula",
  "description": "Tamil Nadu PWD & CPWD plinth-area rate formula with tiered specifications and localized district multipliers. No synthetic or unverified ML models are loaded."
}
```
