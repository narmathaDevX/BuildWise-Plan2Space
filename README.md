# BuildWise — Tamil Nadu House Construction Planning Platform

BuildWise is a Python-backed house construction planning web application designed specifically for residential house planning in Tamil Nadu, India. It operates natively with Indian Rupee (INR `₹`) budgets and feet / sq.ft plot and built-up dimensions.

The system combines an existing minimalist React frontend with a pure-Python FastAPI backend, SQLite database persistence, an algorithmic floor-plan constraint solver, civil engineering cost/schedule simulation models, dynamic material estimation, and end-to-end integration.

---

## 1. System Overview

### Core Features
- **House Planner (4 Steps):** Interactive dimensional configuration (length, width, orientation/facing, location, bedrooms 1–8, bathrooms 1–6, floors 1–4, parking, balcony, pooja, utility), with live server-side affordability analysis and parameter bounds validation. Strictly gated behind authentication: unauthenticated users are prompted with an intuitive AuthModal, and plan generation automatically resumes upon login.
- **Architectural Floor-Plan Engine & CAD Blueprint Rendering:** Algorithmic geometric constraint solver guaranteeing 100% room preservation (including all requested bathrooms up to 6, covered verandah sit-outs, and spacious kitchens), rendering AutoCAD-grade blueprints with double-line load-bearing walls, $90^\circ$ curved inward door swings, exterior ventilation windows, and authentic Tamil Nadu residential fixtures (beds, commodes, gas hobs, dining sets, car parking, balconies). Generates 4 distinct architectural archetypes on "Another plan".
- **Cost Estimation Engine:** Engineering formula based on CPWD and Tamil Nadu PWD Schedule of Rates (SOR). Supports Economy, Standard, and Premium quality tiers, 10+ Tamil Nadu district location multipliers, and uses a largest-remainder rounding algorithm to guarantee that the 5 cost categories sum to exactly 100% of the total estimate.
- **Schedule Simulation & Dynamic Site Checklist:** Month-by-month discrete cash-flow simulation across 7 sequential construction stages. Dynamically generates day-by-day site execution tasks ($months \times 25$ working days, e.g. Day 1 to 350) initialized completely unchecked (`completed: false`) for daily on-site physical tracking. Homeowners can manually edit tasks, reassign days, postpone tasks (+1 day), add custom items, or delete tasks.
- **Global Reactive State Synchronization:** Switching or generating plans automatically fires global synchronization events, instantly re-aligning material bills of quantities, budget breakdowns, construction timeline, and statutory compliance across all tabs without page reloads.
- **Materials Schedule & Regional Provenance:** Standard thumb-rule quantities with real-world Tamil Nadu PWD SOR 2025–2026 and BAI market rate provenance. Includes 5-zone district pricing multipliers, 7-trade daily wage schedules, custom material creation, and CSV dataset export.
- **Saved Plans Portfolio & Liked Blueprint Bookmarking:** Full architectural portfolio management. Clients and homeowners can bookmark/like generated designs directly in `GeneratedPlan`, assign custom project titles and client notes (e.g., DTCP submission preferences, Vastu orientations), and inspect all saved plans from the `HousePlanner` page with actions to reload inputs into the 4-step wizard or open the CAD blueprint directly.
- **Project Reports & Dashboard:** Comprehensive project identity, 4-metric progress grid, 4-milestone status grid, budget utilization, institutional Bank Loan Dossier (SBI / HDFC 80% LTV), and one-click printable report (`window.print()`).
- **Authentication & Persistence:** Secure bcrypt password hashing and JWT authentication supporting registration, login, and quick demo builder sign in.

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

### D. Cost Estimation Scope & Pre-Construction Ancillaries
- Real-world home construction projects in Tamil Nadu frequently suffer 15%–25% budget overruns because owners budget only the "civil superstructure" and get blindsided by mandatory site infrastructure.
- BuildWise explicitly models both **Civil Construction Costs** (M20 RCC structure, brick masonry, joinery, finishing) and **Pre-Construction Ancillary Packages**:
  1. DTCP / CMDA & Local Body Plan Sanction (Single-window scrutiny & infrastructure charges).
  2. TANGEDCO / TNEB 3-Phase Electrical Service Connection & Meter Security Deposit.
  3. 300-ft Borewell Drilling & 1.5 HP Stainless Steel Submersible Pump System.
  4. 8,000-Litre Underground RCC Drinking Water Sump & Bio-Septic Tank with Soak Pit.
  5. 140 R.ft Compound Wall with RCC Stiffeners & 12-ft Wrought Iron Entrance Gate.
  6. Soil Investigation (SPT Standard Penetration Test) & Structural Engineering Stamped Drawings.
  7. Mandatory Rainwater Harvesting (RWH) Percolation Recharge Shaft (Section 215-A TN District Municipalities Act).
- The consolidated Reports page combines both into an **All-Inclusive Total Project Cost** alongside an institutional **Bank Loan Project Dossier** formatted for SBI Realty and HDFC Home Loans (80% LTV financing).

### E. Contractor Payment Protection & Milestone Escrow
- Releasing large upfront cash advances is the leading cause of contractor abandonment and substandard material substitution in Tamil Nadu.
- BuildWise incorporates the standard civil contracting **8-Stage Milestone Payment Schedule** with a mandatory **5% Handover Retention Fund**:
  - Stage 1: Mobilization & Site Benchmark Layout (5%)
  - Stage 2: Footings & Plinth Beam Concreting (15%)
  - Stage 3: Columns & Roof Slab Casting (20%)
  - Stage 4: Brick Masonry & Lintel Bands (15%)
  - Stage 5: Concealed CPVC Plumbing & PVC Electrical Rough-in (15%)
  - Stage 6: Internal Plastering & Floor Tiles (15%)
  - Stage 7: Finishing, Royale Painting & Sanitary Fixtures (10%)
  - Stage 8: Handover & Defect Liability Retention (5% held for 90 days)
- Milestone releases are strictly gated upon the homeowner physically inspecting and verifying explicit quality checkpoints (e.g. 50mm cover blocks, 14-day wet hessian curing, CPVC 10-bar hydraulic pressure test, and floor tile mallet tap test).

### F. Unused Files
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
- `test_realworld_engines.py`: TNCDBR 2019 statutory compliance evaluation (plot coverage <= 70%, FSI, setbacks, RWH recharge sizing), pre-construction & ancillary cost calculations, 8-stage contractor payment escrow with 5% retention fund, district pricing switcher, and bank loan dossier integration.
- `test_solver.py`: Deterministic seeds, setback boundary enforcement, room target area tolerances, master bathroom adjacency, 4 distinct architectural archetypes, and conflict reporting on impossible dimensions.
- `test_cost.py`: Quality tier rate scaling, Tamil Nadu location index multipliers, exact 100% sum of the 5-category cost breakdown via largest-remainder rounding.
- `test_schedule.py`: Discrete-event cash flow simulation, predecessor order verification, monthly burn rate capacity capping, and monotonicity.
- `test_materials.py`: Thumb-rule calculation, numeric quantities, and purchase status updates.
- `test_tasks.py`: Day-to-day site checklist operations, task completion toggles, task postponement (+1 day), manual editing, deletion, and regeneration.
- `test_saved_plans.py`: Saved plans portfolio lifecycle, bookmarking liked blueprints, custom titles, client notes persistence, retrieval, updates, and deletion.
- `test_auth.py`: Bcrypt registration, login token generation, and `/api/auth/me` profile resolution.
- `test_api.py`: FastAPI error handler returning single-string `detail` on 422 validation errors, project summary, month stepper, materials patching, custom material creation, and report endpoints.
- **Result: 33 passed in 1.15s.**

### Building Frontend
Verify that the production build completes without errors:
```bash
cd /Users/narmathan/buildwise/frontend && npm run build
```
Result: `vite v8.3.3 built client environment in ~235ms with 0 errors`.

### Screenshot Verification
Comprehensive visual verification screenshots are cataloged in `docs/screenshots/`:
- `docs/screenshots/before/`: Baseline captures of all pages prior to code changes.
- `docs/screenshots/after/`: Full end-to-end integration captures showing live data from the FastAPI backend and SQLite database.
- `docs/screenshots/after/verify_1_auth_gate_modal.png`: House Planner Step 4 showing contextual Auth Gate modal preventing unauthenticated plan generation.
- `docs/screenshots/after/verify_2_architectural_floorplan_cad.png`: AutoCAD-grade architectural blueprint rendering with double-line load-bearing walls, $90^\circ$ curved inward door swings, exterior ventilation windows, and furniture fixture outlines.
- `docs/screenshots/after/verify_3_architectural_plan_alternative.png`: Appending distinct architectural archetypes on "Another plan" (Split-Wing, Vastu, Great Room, Linear Breezeway).
- `docs/screenshots/after/verify_4_construction_dynamic_days.png`: Construction page with dynamic 350-day schedule ($months \times 25$ days) and all tasks starting unchecked.
- `docs/screenshots/after/verify_5_edit_task_modal.png`: Construction page manual Task Editor modal allowing on-site task customization, day re-assignment, and trade selection.
- `docs/screenshots/after/verify_6_materials_synchronized.png`: Materials schedule automatically synchronized with active plan parameters.
- `docs/screenshots/after/verify_7_reports_synchronized.png`: Project Report and Bank Loan Dossier automatically synchronized with the generated house plan.
- `docs/screenshots/after/verify_8_saved_plans_portfolio_modal.png`: House Planner "Saved Plans & Blueprints Portfolio" modal with specifications, client notes, and blueprint actions.
- `docs/screenshots/after/verify_9_loaded_into_planner.png`: House Planner Step 1 hydrated with loaded specifications from a saved blueprint.
- `docs/screenshots/after/verify_10_save_liked_plan_modal.png`: GeneratedPlan "Save Plan to Liked Portfolio" modal with custom title and client notes entry.
- `docs/screenshots/after/verify_11_plan_saved_toast.png`: Plan saved confirmation toast, gold star badge (`★`) on layout chips, and saved button state.
- `docs/screenshots/after/verify_12_opened_saved_blueprint.png`: Direct recall and rendering of a saved CAD blueprint from portfolio without re-running generation.

---

## 6. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint returning status and timestamp |
| `GET` | `/api/ml/status` | Machine learning transparency status report |
| `POST` | `/api/auth/register` | Register new user with bcrypt-hashed credentials |
| `POST` | `/api/auth/login` | Authenticate user and return JWT bearer token |
| `GET` | `/api/auth/me` | Fetch active user profile |
| `POST` | `/api/generate` | Generate candidate floor plans satisfying setbacks and archetypes |
| `GET` | `/api/plans/saved` | Retrieve all saved plans and liked blueprints for authenticated user |
| `POST` | `/api/plans/saved` | Save a liked floor plan with custom title, notes, CAD layout, and costs |
| `GET` | `/api/plans/saved/{id}` | Retrieve specific saved blueprint layout by record ID or plan_id |
| `PUT` | `/api/plans/saved/{id}` | Update title or client notes on a saved plan |
| `DELETE`| `/api/plans/saved/{id}` | Remove plan from saved portfolio |
| `POST` | `/api/estimate/affordability` | Live affordability index for Planner Step 3 |
| `POST` | `/api/estimate/cost` | Comprehensive civil construction cost breakdown |
| `POST` | `/api/estimate/schedule` | Month-by-month cash flow and timeline simulation |
| `POST` | `/api/estimate/compliance` | TNCDBR 2019 statutory compliance evaluation |
| `POST` | `/api/estimate/ancillary` | Pre-construction & ancillary packages calculator |
| `GET` | `/api/projects/current` | Retrieve active project with plans and estimates |
| `PUT` | `/api/projects/current` | Persist planner requirements and candidate plans |
| `PUT` | `/api/projects/current/selected-plan` | Select active layout and update dependent estimates |
| `GET` | `/api/projects/current/summary` | Dashboard summary metrics and timeline status |
| `GET` | `/api/projects/current/construction?month=n` | Construction stage progress for month `n` with insights |
| `GET` | `/api/projects/current/milestones` | 8-stage contractor payment escrow schedule and 5% retention fund |
| `GET` | `/api/projects/current/compliance` | TNCDBR 2019 compliance check for active project |
| `GET` | `/api/projects/current/ancillary` | Itemized pre-construction ancillary expenses for active project |
| `GET` | `/api/projects/current/materials` | Materials schedule, categories, and purchase stats |
| `GET` | `/api/projects/current/materials/districts` | Tamil Nadu district pricing multipliers and PWD SOR labor wages |
| `GET` | `/api/projects/current/materials/dataset` | Official Tamil Nadu PWD SOR & BAI materials provenance dataset |
| `GET` | `/api/projects/current/materials/dataset/csv` | Download materials provenance dataset as CSV file |
| `PATCH`| `/api/projects/current/materials/{id}` | Toggle purchase status or edit quantity/rate |
| `POST` | `/api/projects/current/materials` | Add custom material to the project schedule |
| `DELETE`| `/api/projects/current/materials/{id}` | Delete custom material |
| `GET` | `/api/projects/current/tasks` | Daily construction site task checklist (dynamic duration) |
| `PATCH`| `/api/projects/current/tasks/{id}` | Mark daily site task complete / incomplete |
| `PUT`  | `/api/projects/current/tasks/{id}` | Manually edit site task (title, description, trade, day, stage) |
| `DELETE`| `/api/projects/current/tasks/{id}` | Delete construction site task |
| `POST` | `/api/projects/current/tasks/{id}/postpone` | Postpone task to the next construction day (+1 Day) |
| `POST` | `/api/projects/current/tasks` | Create custom day task |
| `POST` | `/api/projects/current/tasks/regenerate` | Re-sync checklist tasks with active plan schedule |
| `GET` | `/api/projects/current/report` | Bank Loan & DTCP Sanction Ready Construction Project Dossier |
