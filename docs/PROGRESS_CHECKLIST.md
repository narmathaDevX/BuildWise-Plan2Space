# BuildWise Implementation Progress Checklist

This checklist tracks the implementation of backend, database, cost/schedule/material logic, floor-plan generation, ML evaluation, and frontend integration for **BuildWise**.

---

## Phase 1: Inspection & Baseline
- [x] Locate frontend root (`/Users/narmathan/buildwise/frontend`, containing `package.json`, `vite.config.js`, `src/`).
- [x] Confirm repository facts (ThemeProvider in `main.jsx`, inline Dashboard in `App.jsx`, empty files list, Streamlit stubs).
- [x] Check git state and create feature branch `feature/backend`.
- [x] Run frontend dev server (`http://127.0.0.1:5173/`).
- [x] Capture all "before" screenshots in light and dark mode (`docs/screenshots/before/`).
- [x] Initialize `docs/PROGRESS_CHECKLIST.md`.

---

## Phase 2: Architecture & API Contract
- [x] Define database schema (SQLite via SQLAlchemy 2.x): `users`, `projects`, `plans`, `estimates`, `materials`.
- [x] Author `docs/API_CONTRACT.md` covering all endpoints with exact request/response schemas and examples.
- [x] Document frontend integration mapping per file.

---

## Phase 3: Dataset & Machine Learning Decision
- [x] Inspect workspace for existing datasets.
- [x] Search and assess public Indian construction cost / housing / floor plan datasets.
- [x] Author `docs/DATASET_AND_MODEL_DECISION.md` documenting evidence, dataset sources, metrics, and whether ML or transparent formula is justified.
- [x] Document rejection of synthetic/simulated datasets and house sale price regression data; establish transparent civil engineering cost formulas based on CPWD / TN PWD Schedule of Rates.
- [x] Implement `/api/ml/status` honesty endpoint reporting formula status and real-world training prerequisite criteria.

---

## Phase 4: Backend Implementation
- [x] Install/verify backend dependencies (`fastapi`, `uvicorn`, `pydantic-settings`, `sqlalchemy`, `bcrypt`, `pyjwt`, `pytest`, `httpx`).
- [x] Create `backend/app/config.py` (pydantic-settings, `.env` support).
- [x] Create `backend/app/db/` (SQLAlchemy models, SQLite connection, auto-`init_db` seeding default user and demo project).
- [x] Create `backend/app/data/*.json` (construction rates, location multipliers, material thumb rules, stage definitions, split ratios).
- [x] Create `backend/app/services/`:
  - [x] `floorplan/solver.py` (pure-Python constraint satisfaction engine, setback envelope, min room areas/aspect ratios, attached bath co-location, deterministic stable plan_ids, conflict reporting).
  - [x] `cost.py` (rates by quality, TN location multipliers, 5-category breakdown with largest-remainder rounding ensuring 100% exact sum).
  - [x] `affordability.py` (live Step 3 quick estimator comparing monthly budget to projected burn rate).
  - [x] `schedule.py` (7-stage discrete-event cash flow simulation, predecessor dependencies, physical monthly burn capacity caps, monsoon adjustments).
  - [x] `materials.py` (thumb-rule quantities, dated rate cards, custom items, procurement status).
- [x] Create `backend/app/routers/`:
  - [x] `auth.py` (register, login, me, bcrypt hashing, JWT tokens, `AUTH_REQUIRED=false` default user fallback).
  - [x] `plans.py` (`POST /api/generate` matching existing contract).
  - [x] `estimates.py` (`/api/estimate/affordability`, `/api/estimate/cost`, `/api/estimate/schedule`).
  - [x] `projects.py` (current project summary, full project, save planner, select plan, construction month stepper, report).
  - [x] `materials.py` (list, patch purchase status, add custom material, delete).
  - [x] `ml.py` (`GET /api/ml/status`).
- [x] Create `backend/app/main.py` (FastAPI app, CORS origins, custom 422 error handler returning string `detail`).
- [x] Write `backend/requirements.txt` and `backend/.env.example`.

---

## Phase 5: Model Integration & Status Reporting
- [x] Complete transparent engineering formula in `backend/app/services/cost.py`.
- [x] Implement `GET /api/ml/status` returning complete transparency metadata (engine type, baseline, why synthetic models were rejected, and real data requirements).
- [x] Verify "MODEL SCORE" copy transparency in documentation (constraint satisfaction fitness, not ML).

---

## Phase 6: Frontend Integration
- [x] Create `frontend/src/services/api.js` (shared client with snake_case ↔ camelCase mapping and error handling).
- [x] Create `frontend/.env.example` with `VITE_API_BASE_URL`.
- [x] Update `frontend/src/services/planApi.js` (shared base URL, send `parking` and `balcony` rooms).
- [x] Update `frontend/src/pages/HousePlanner.jsx` (validation, live affordability estimate replacing hardcoded "Good").
- [x] Update `frontend/src/pages/GeneratedPlan.jsx` (backend cost & schedule estimates, select plan persistence).
- [x] Update `frontend/src/App.jsx` (Dashboard loaded from `/api/projects/current/summary`, empty state, loading state).
- [x] Update `frontend/src/pages/Construction.jsx` (loaded from `/construction?month=n`, month stepper, cost-weighted progress).
- [x] Update `frontend/src/pages/Materials.jsx` (loaded from API, numeric quantities, toggle purchased, add material form, dated rates).
- [x] Update `frontend/src/pages/Reports.jsx` (loaded from `/report`, 5-category breakdown, print report).
- [x] Verify zero hardcoded demo data remains on functional pages.

---

## Phase 7: Testing & Verification
- [x] Run comprehensive `pytest` test suite covering:
  - [x] Floor plan solver invariants & determinism (5 tests).
  - [x] Cost estimation formulas and 100% breakdown sum (3 tests).
  - [x] Schedule simulation invariants (monotonicity, dependency ordering, cash burn cap) (2 tests).
  - [x] Materials calculations and purchase status updates (1 test).
  - [x] Auth registration, login, and JWT (2 tests).
  - [x] Project persistence and API error handler (422 string `detail`) (9 tests).
  - [x] Result: 22 passed in 1.24s.
- [x] Run `npm run build` to ensure clean frontend build (vite v8.3.3 built in 256ms with 0 errors).
- [x] Run end-to-end flow in browser and capture "after" screenshots (`docs/screenshots/after/`) covering all pages and states in light and dark mode.

---

## Phase 8: Final Verification & Documentation
- [x] Author comprehensive root `README.md` and `backend/README.md`.
- [x] Record all assumptions, limitations, and honesty disclosures.
- [x] Final deliverable verification.

---

## Phase 9: Realism Overhaul & Day-to-Day Site Execution Checklist (User Requested)
- [x] **Realistic Floor Plan Engine Overhaul (`backend/app/services/floorplan/solver.py`)**:
  - Replaced naive horizontal slices with an architecturally grounded 4-band/3-band residential solver.
  - Enforced realistic residential proportions: Kitchen (~110–135 sq ft, not 310 sq ft), Bathrooms (~45–50 sq ft, not 113 sq ft), Utility (~45–55 sq ft, not 280 sq ft), Car Porch (~170 sq ft at front road side), Living Hall (~364 sq ft), Master Bed & Bed 2 (~256 sq ft each at rear quiet corners with attached bath).
- [x] **"Generate Another Option" & Layout Switcher Fix (`frontend/src/pages/GeneratedPlan.jsx`)**:
  - Automatically switched `selectedIndex` to the newly appended plan.
  - Added an interactive layout pill bar (`Layout A (Recommended)`, `Layout B`, `Layout C`...) above the floor plan so users can instantly switch between alternatives.
  - Persisted the complete merged plan collection to the backend database.
- [x] **Comprehensive Tamil Nadu Construction Materials Dataset (`backend/app/data/materials.json`, `materials.py`, `Materials.jsx`)**:
  - Expanded catalog to 17 realistic items spanning all 5 Tamil Nadu categories: `Structure`, `Masonry`, `Finishing`, `Electrical & Plumbing`, `Doors & Windows`.
  - Ground rates sourced from Tamil Nadu PWD Schedule of Rates (SOR 2025-2026) and Builders Association of India (BAI) retail rates (UltraTech/Ramco Cement @ ₹420/bag, TMT Fe 550D @ ₹68,000/ton, M-Sand @ ₹1,850/ton, P-Sand @ ₹2,250/ton, 20mm Blue Metal Jelly @ ₹1,550/ton, Bricks @ ₹10.50/nos, Vitrified Tiles @ ₹85/sq ft, Granite @ ₹160/sq ft, Asian Paints @ ₹280/L, Polycab wiring @ ₹110/sq ft, Ashirvad CPVC plumbing @ ₹125/sq ft, Teak door @ ₹32,000/set, UPVC windows @ ₹450/sq ft).
  - Added interactive category filter pills (`All Materials`, `Structure`, `Masonry`, `Finishing`, `Electrical & Plumbing`, `Doors & Windows`) on the Materials page.
- [x] **Day-to-Day Site Work Checklist (`backend/app/db/models.py`, `routers/tasks.py`, `Construction.jsx`)**:
  - Implemented `ConstructionTask` model with day numbers, stages, trades, critical path flags, and postponement tracking.
  - Seeded 42 realistic day-to-day Tamil Nadu site execution tasks covering all 7 stages (Site Prep, Foundation, Structure, Walls, Electrical, Plumbing, Finishing).
  - Built interactive checklist UI in `Construction.jsx` with day navigation (`< Day X of 40 >`), manual completion checkboxes, and "Postpone to next day (+1 Day)" button.
  - Persisted all status updates and postponements in SQLite database.
- [x] **Zero Hardcoded Data Audit**:
  - Verified Dashboard, House Planner, GeneratedPlan, Construction, Materials, and Reports all consume dynamic backend APIs with graceful empty/loading states.
- [x] **Testing & Verification**:
  - All 23 Pytest backend tests passing (`pytest backend/tests/`).
  - Frontend production build passing (`npm run build`).
  - Captured updated verification screenshots in `docs/screenshots/after/`.

---

## Phase 10: Architectural Archetypes, Day-1 Unchecked Checklist, PWD SOR Provenance & Full Login (Latest Enhancements)
- [x] **4 Distinct Architectural Floor Plan Archetypes on "Generate Another Option" (`solver.py`)**:
  - Developed 4 genuinely distinct architectural layout archetypes selected deterministically via `(seed + alt_index) % 4`:
    1. **Traditional Vastu Courtyard Layout**: North-East street-facing formal living, central Brahmasthan dining hall core, East Agni kitchen & utility, South-West Niruthi master suite.
    2. **Contemporary Open Great-Room Layout**: Integrated open social lounge, modern island kitchen with breakfast counter, split bedrooms with rear garden-facing master suite.
    3. **Split-Wing Generational Suite Layout**: Ground-floor elderly / guest suite at front with step-free entry, central family dining, and private rear master wing.
    4. **Linear Breezeway & Dual Master Suite Layout**: Cross-ventilated breezeway dining and kitchen along side axis, balanced dual master bedroom suites at rear.
  - Successive calls to "Generate another option" append completely distinct architectural layouts with unique room coordinates, functional adjacencies, and titles (`Layout A: Traditional Vastu...`, `Layout B: Contemporary Open Great-Room...`).
  - Added test `test_architectural_archetypes_distinct_layouts()` in `backend/tests/test_solver.py`.
- [x] **Clean Day-by-Day Site Work Checklist (Starting Unchecked at Day 1)**:
  - Reset all daily tasks across Days 1–40 in `DEFAULT_SITE_TASKS` and SQLite database to `completed: False`, `postponed_count: 0`.
  - Construction page defaults cleanly to Day 1 showing unchecked initial site execution tasks (`Site clearing and boundary benchmark setup`, `Plot setback and road margin verification`).
  - On-site workers/homebuilders manually check tasks upon completion or click "Postpone (+1 Day)".
- [x] **Authentic Tamil Nadu Materials Dataset & Provenance Section (`Materials.jsx`, `tamilnadu_pwd_bai_materials_dataset.json/.csv`)**:
  - Curated complete 17-item dataset citing:
    - **Tamil Nadu PWD Schedule of Rates (SOR) 2025–2026** (Buildings & Structural Works, G.O. Ms No. 142/PWD).
    - **Builders Association of India (BAI) Tamil Nadu State Centre Material Cost Index** (Chennai, Coimbatore, Madurai, Trichy, Salem).
    - **Wholesale ground market hubs**: Koyambedu Steel Yard, Sriperumbudur Logistics Corridor, Karur Quarry Belt, Parrys Corner Tiles Depot.
  - Implemented `GET /api/projects/current/materials/dataset` and `GET /api/projects/current/materials/dataset/csv` download endpoints.
  - Added "Price Sources & Dataset" button and modal on `Materials.jsx` featuring official citations, category filter pills, interactive rate comparison table (PWD SOR vs Market Rate vs IS Standards), and one-click CSV download.
- [x] **Full Login & Registration UI (`AuthModal.jsx`, `App.jsx`)**:
  - Implemented `AuthModal.jsx` with tabs for "Sign In" and "Create Account", email/password validation, and Quick Demo Sign In (`guest@buildwise.local`).
  - Integrated with backend JWT auth (`/api/auth/login`, `/api/auth/register`, `/api/auth/me`).
  - Added "Sign In" button in top nav header, user profile avatar, and account dropdown with "Switch Account" and "Sign Out" actions.
- [x] **End-to-End Test & Screenshot Verification**:
  - 24 Pytest backend tests passing in `backend/tests/`.
  - Frontend production build passing in 200ms (`npm run build`).
  - Captured live browser screenshots in `docs/screenshots/after/`:
    - `11_dashboard_with_login_cta.png`
    - `12_auth_login_modal.png`
    - `13_construction_day1_unchecked.png`
    - `13b_construction_task_checked_live.png`
    - `14_materials_page_with_provenance_btn.png`
    - `15_materials_price_sources_modal.png`
    - `16_generated_plan_distinct_options.png`
    - `17_generated_plan_appended_archetype.png`

