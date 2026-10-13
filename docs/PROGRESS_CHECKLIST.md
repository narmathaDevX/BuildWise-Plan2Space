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
