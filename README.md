# BuildWise — Tamil Nadu House Construction Planning Platform

BuildWise is a Python-backed house construction planning web application designed specifically for residential house planning in Tamil Nadu, India. It operates natively with Indian Rupee (INR `₹`) budgets and feet / sq.ft plot and built-up dimensions.

The system combines an existing minimalist React frontend with a pure-Python FastAPI backend, SQLite database persistence, an algorithmic floor-plan constraint solver, civil engineering cost/schedule simulation models, dynamic material estimation, and end-to-end integration.

---

## 1. System Overview

### Core Features
- **House Planner (4 Steps):** Interactive dimensional configuration (length, width, orientation/facing, location, bedrooms, bathrooms, floors, parking, balcony, pooja, utility), with live server-side affordability analysis and parameter bounds validation.
- **Algorithmic Floor-Plan Engine:** Pure-Python deterministic constraint-satisfaction solver that respects mandatory Tamil Nadu municipal setbacks (front: 5 ft, rear: 3 ft, sides: 3 ft), minimum room areas, attached-bathroom co-location, and generates stable plan IDs with fitness scoring.
- **Cost Estimation Engine:** Engineering formula based on CPWD and Tamil Nadu PWD Schedule of Rates (SOR). Supports Economy, Standard, and Premium quality tiers, 10+ Tamil Nadu district location multipliers, and uses a largest-remainder rounding algorithm to guarantee that the 5 cost categories sum to exactly 100% of the total estimate.
- **Schedule Simulation:** Month-by-month discrete cash-flow simulation across 7 sequential construction stages (Site Preparation, Foundation, Structure, Walls & Partitions, Electrical, Plumbing, Flooring & Finishing). Enforces predecessor dependency constraints, physical monthly burn capacity caps, and Northeast monsoon weather slowdown adjustments (October–November). Start dates are dynamically derived from the next calendar month.
- **Materials Schedule:** Standard thumb-rule quantities per square foot for core materials (Cement, Steel, M-Sand, Bricks, Floor Tiles, Paint) with dated rate cards (October 2026). Includes one-click purchase status toggling and custom material additions.
- **Project Reports & Dashboard:** Comprehensive project identity, 4-metric progress grid, 4-milestone status grid, budget utilization, and one-click printable report (`window.print()`).
- **Authentication & Persistence:** Secure bcrypt password hashing and JWT authentication with an optional bypass (`AUTH_REQUIRED=false` by default) so the UI works seamlessly with a default local guest user.

---

## 2. Architecture & Design Principles

```
buildwise/
├── backend/
│   ├── app/
│   │   ├── config.py              # Pydantic Settings & environment variables
│   │   ├── main.py                # FastAPI app, CORS, custom 422 error handler
│   │   ├── db/
│   │   │   ├── models.py          # SQLAlchemy 2.0 models (User, Project, Plan, Estimate, Material)
│   │   │   ├── session.py         # Engine & session management (SQLite)
│   │   │   └── init_db.py         # Idempotent DB initialization & demo project seed
│   │   ├── data/
│   │   │   ├── rates.json         # CPWD / TN PWD base rate cards by quality
│   │   │   ├── locations.json     # Tamil Nadu district cost index multipliers
│   │   │   ├── materials.json     # Material factors, rates, and unit definitions
│   │   │   └── stages.json        # 7 construction stages & predecessor dependencies
│   │   ├── services/
│   │   │   ├── floorplan/solver.py# Deterministic constraint solver & conflict analyzer
│   │   │   ├── cost.py            # Civil engineering cost formula & 5-item breakdown
│   │   │   ├── schedule.py        # Discrete-event cash flow & timeline simulator
│   │   │   ├── materials.py       # Materials scheduling & procurement metrics
│   │   │   ├── affordability.py   # Quick affordability evaluator (Step 3)
│   │   │   └── auth.py            # Bcrypt hashing & JWT token issuance
│   │   └── routers/
│   │       ├── auth.py            # /api/auth/register, /api/auth/login, /api/auth/me
│   │       ├── plans.py           # /api/generate
│   │       ├── estimates.py       # /api/estimate/affordability, cost, schedule
│   │       ├── projects.py        # /api/projects/current summary, save, select, report
│   │       ├── materials.py       # /api/projects/current/materials (list, patch, add, delete)
│   │       └── ml.py              # /api/ml/status
│   ├── tests/                     # 22 comprehensive Pytest integration & unit tests
│   ├── requirements.txt           # Python dependencies
│   └── .env.example               # Backend environment variables
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Navigation & inline Dashboard wired to backend
│   │   ├── pages/
│   │   │   ├── HousePlanner.jsx   # 4-step wizard with live server affordability check
│   │   │   ├── GeneratedPlan.jsx  # Plan viewer, comparison, backend cost/schedule estimates
│   │   │   ├── Construction.jsx   # 7-stage tracker with month stepper & cost-weighted progress
│   │   │   ├── Materials.jsx      # Materials schedule, numeric quantities, click-to-toggle
│   │   │   └── Reports.jsx        # Consolidated report with print/save support
│   │   ├── services/
│   │   │   ├── api.js             # Shared API client with camelCase/snake_case mapping
│   │   │   └── planApi.js         # Generator client calling /api/generate
│   │   └── context/ThemeContext.jsx
│   ├── package.json
│   └── vite.config.js
│
├── docs/
│   ├── API_CONTRACT.md            # Comprehensive OpenAPI-aligned API specification
│   ├── DATASET_AND_MODEL_DECISION.md # ML candidate audit & civil engineering formula decision
│   ├── PROGRESS_CHECKLIST.md      # Phase-by-phase implementation log
│   └── screenshots/
│       ├── before/                # 20 pre-integration baseline screenshots (light & dark)
│       └── after/                 # 20 post-integration verified screenshots (light & dark)
└── README.md
```

---

## 3. Engineering Decisions & Disclosures

### A. Floor Plan Generation is Algorithmic, Not Machine Learning
- The UI contains labels reading `"MODEL SCORE"` and `"YOUR MODEL-GENERATED DESIGN"`.
- **Honesty Disclosure:** The generation engine is a **pure-Python deterministic constraint-satisfaction and geometric slicing algorithm**, not a neural network or machine learning model.
- The "score" represents a geometric penalty function evaluating:
  1. Room aspect ratios (penalty for narrow rooms with ratio > 2.2).
  2. Adjacency satisfaction (co-locating attached bathrooms with the master bedroom).
  3. Window / perimeter wall exposure for natural ventilation.
  4. Area efficiency relative to requested targets.
- The UI copy has been preserved to honor the constraint of zero UI text restructuring, but its nature is fully documented here.

### B. Machine Learning Status & Cost Estimation Audit
- As documented in `docs/DATASET_AND_MODEL_DECISION.md`, public "Indian house price" datasets (e.g. Kaggle Bangalore/Chennai house sales data) represent **real-estate sales transactions** (heavily dominated by land value, locality prestige, and developer speculation), not **brick-and-mortar construction costs**.
- Training a model on synthetic data generated from our own formulas would violate the project's honesty constraints.
- Therefore, BuildWise uses transparent, verifiable civil engineering formulas grounded in **CPWD Plinth Area Rates and Tamil Nadu PWD Schedule of Rates (SOR)**.
- The endpoint `GET /api/ml/status` provides programmatic verification of this decision, reporting the formula baseline and outlining requirements for future ML adoption (minimum 500 verified contractor Bill of Quantities across diverse TN soil conditions and structural specifications).

### C. Authentication & Guest Fallback
- The UI has no dedicated login/registration screens, displaying only a static profile avatar `"N"`.
- Full user registration and JWT authentication endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`) are implemented with unit tests.
- By default, `AUTH_REQUIRED=false` is set in configuration. When no JWT Bearer token is provided in the request headers, the backend automatically operates on an auto-seeded default local user (`guest@buildwise.local`).
- To require authentication in production:
  1. Set `AUTH_REQUIRED=true` in `backend/.env`.
  2. Implement login/register modal dialogs in the frontend to store the received token via `localStorage.setItem('buildwise_token', token)`.

### D. Cost Estimation Scope & Exclusions
- The cost model estimates building construction from earthwork excavation up to architectural finishing.
- **Excluded Items:** Land purchase, statutory municipal approvals, compound wall & gate, borewell/sump installation, interior furniture & modular woodwork, and rooftop solar installations. These are surfaced in API responses as `excluded_items`.

### E. Unused Files
- The six files matching `frontend/pages/*.py` (`Dashboard.py`, `HousePlanner.py`, `Construction.py`, `Materials.py`, `Reports.py`, `CostEstimation.py`) are legacy Streamlit stubs from an earlier prototype. They are intentionally left untouched and are not used by the React application.

---

## 4. Setup & Running Instructions

### Prerequisites
- Python 3.11+ (or Python 3.13)
- Node.js 18+ and npm
- Chrome (for automated screenshots)

### Backend Setup
1. Open a terminal and navigate to the project directory:
   ```bash
   cd /Users/narmathan/buildwise
   ```
2. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```
3. Install backend dependencies (if not already installed):
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
5. The API is accessible at `http://127.0.0.1:8000`. Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend Setup
1. Open a second terminal and navigate to the frontend directory:
   ```bash
   cd /Users/narmathan/buildwise/frontend
   ```
2. Start the Vite dev server:
   ```bash
   npm run dev -- --host 127.0.0.1 --port 5173
   ```
3. Open your browser and navigate to `http://127.0.0.1:5173`.

---

## 5. Verification & Testing

### Running Backend Unit & Integration Tests
Execute the complete test suite:
```bash
/Users/narmathan/buildwise/venv/bin/pytest backend/tests
```
**Test Suite Summary:**
- `test_solver.py`: Deterministic seeds, setback boundary enforcement, room target area tolerances, master bathroom adjacency, and structured conflict reporting on impossible dimensions.
- `test_cost.py`: Quality tier rate scaling, Tamil Nadu location index multipliers, exact 100% sum of the 5-category cost breakdown via largest-remainder rounding.
- `test_schedule.py`: Discrete-event cash flow simulation, predecessor order verification, monthly burn rate capacity capping, and monotonicity.
- `test_materials.py`: Thumb-rule calculation, numeric quantities, and purchase status updates.
- `test_auth.py`: Bcrypt registration, login token generation, and `/api/auth/me` profile resolution.
- `test_api.py`: FastAPI error handler returning single-string `detail` on 422 validation errors, project summary, month stepper, materials patching, custom material creation, and report endpoints.
- **Result: 22 passed in 1.24s.**

### Building Frontend
Verify that the production build completes without errors:
```bash
cd /Users/narmathan/buildwise/frontend && npm run build
```
Result: `vite v8.3.3 built client environment in ~250ms with 0 errors`.

### Screenshot Verification
Baseline ("before") and post-integration ("after") screenshots covering every view and state in both light and dark themes are cataloged in `docs/screenshots/`:
- `docs/screenshots/before/`: Baseline captures of all pages prior to code changes.
- `docs/screenshots/after/`: Full end-to-end integration captures showing live data from the FastAPI backend and SQLite database.

---

## 6. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint returning status and timestamp |
| `GET` | `/api/ml/status` | Machine learning transparency status report |
| `POST` | `/api/auth/register` | Register new user with bcrypt-hashed credentials |
| `POST` | `/api/auth/login` | Authenticate user and return JWT bearer token |
| `GET` | `/api/auth/me` | Fetch active user profile |
| `POST` | `/api/generate` | Generate candidate floor plans satisfying setbacks |
| `POST` | `/api/estimate/affordability` | Live affordability index for Planner Step 3 |
| `POST` | `/api/estimate/cost` | Comprehensive construction cost breakdown |
| `POST` | `/api/estimate/schedule` | Month-by-month cash flow and timeline simulation |
| `GET` | `/api/projects/current` | Retrieve active project with plans and estimates |
| `PUT` | `/api/projects/current` | Persist planner requirements and candidate plans |
| `PUT` | `/api/projects/current/selected-plan` | Select active layout and update dependent estimates |
| `GET` | `/api/projects/current/summary` | Dashboard summary metrics and timeline status |
| `GET` | `/api/projects/current/construction?month=n` | Construction stage progress for month `n` with insights |
| `GET` | `/api/projects/current/materials` | Materials schedule, categories, and purchase stats |
| `PATCH`| `/api/projects/current/materials/{id}` | Toggle purchase status or edit quantity/rate |
| `POST` | `/api/projects/current/materials` | Add custom material to the project schedule |
| `DELETE`| `/api/projects/current/materials/{id}` | Delete custom material |
| `GET` | `/api/projects/current/report` | Consolidated report data for printing and review |
