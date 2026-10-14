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

---

## Phase 11: Real-World Tamil Nadu Production Platform Transformation
- [x] **TNCDBR 2019 Statutory Compliance Engine (`backend/app/data/tncdbr_rules.json`, `services/compliance.py`, `routers/estimates.py`, `routers/projects.py`)**:
  - Encoded official statutory rules from Tamil Nadu Combined Development and Building Rules, 2019 (G.O. Ms No. 18, Housing & Urban Development Dept, dt. 04.02.2019).
  - Implemented automated evaluation for:
    - Maximum Ground Plot Coverage (<= 70%).
    - Permissible Floor Space Index (FSI 1.50 for road < 9m, 1.75 for 9m-12m, 2.00 for > 12m).
    - Minimum Building Yard Setbacks (5 ft front, 5 ft rear, 3 ft sides).
    - Non-High Rise Residential Height Ceiling (<= G+3 / 12 metres).
    - Mandatory Rainwater Harvesting (RWH) percolation pit sizing (1.25 L per sq ft roof area under Section 215-A of Tamil Nadu District Municipalities Act & G.O. Ms No. 138/MAWS).
    - Sump (8,000L) and bio-septic tank (10,000L) sizing requirements.
  - Exposed via `POST /api/estimate/compliance` and `GET /api/projects/current/compliance`.
- [x] **Pre-Construction & Ancillary Cost Engine (`backend/app/data/ancillary_costs.json`, `services/ancillary.py`, `routers/estimates.py`, `routers/projects.py`)**:
  - Solved the #1 real-world failure mode where builders budget only civil construction and run out of funds by accounting for 18%–22% in essential pre-construction items:
    1. DTCP / CMDA & Local Body Plan Sanction (₹85k base + ₹35/sq ft)
    2. TANGEDCO / TNEB 3-Phase Electrical Service Connection (₹65,000)
    3. Borewell Drilling (300 ft) & 1.5 HP Stainless Submersible Pump (₹1,65,000)
    4. Underground RCC Drinking Water Sump (8,000L) & Bio-Septic Tank (₹1,75,000)
    5. Compound Boundary Wall (140 R.ft) & Wrought Iron Main Gate (₹2,40,000)
    6. Soil Investigation (SPT Boring) & Structural Engineering Design (₹45,000)
    7. Mandatory Rainwater Harvesting (RWH) Percolation Recharge Pit (₹28,000)
  - Exposed via `POST /api/estimate/ancillary` and `GET /api/projects/current/ancillary`.
- [x] **Contractor Milestone Payment Escrow & 5% Retention Fund (`services/milestones.py`, `routers/projects.py`, `Construction.jsx`)**:
  - Implemented the 8-stage civil milestone payment schedule with exact 100% percentage distribution:
    1. Mobilization & Site Demarcation (5%)
    2. Footings & Plinth Beam Casting (15%)
    3. RCC Columns & Roof Slab Casting (20%)
    4. Brick Masonry & Lintel Bands (15%)
    5. Concealed Plumbing & Electrical Rough-in (15%)
    6. Internal Plastering & Floor Tiles (15%)
    7. Painting, Sanitary Fittings & Joinery (10%)
    8. Handover & Defect Liability Retention (5% held for 90 days)
  - Enforced mandatory homeowner inspection gates before cheque release.
  - Added anti-abandonment protections withholding 5% for 90 days to verify terrace waterproofing against monsoons.
  - Integrated 3-tab navigation on `Construction.jsx` (`Daily Site Tasks`, `Contractor Payment Escrow`, `On-Site Quality Protocols`).
- [x] **Homeowner On-Site Quality Inspection Protocols (`Construction.jsx`)**:
  - Embedded 5 practical non-engineer inspection checks:
    1. Concrete Cover Blocks (50mm on footings, 25mm on slabs).
    2. 14-Day Continuous Wet Hessian Curing (Tamil Nadu heat protection).
    3. Field Sand Silt Jar Test (< 8% silt).
    4. CPVC Water Supply Line 10-Bar Pressure Test (zero leak before wall concealment).
    5. Vitrified Floor Tile Mallet Tap Test (zero hollow drummy sound).
- [x] **Tamil Nadu District-Level Pricing & Wage Rates Schedule (`backend/app/data/tn_district_rates_2026.json`, `routers/materials.py`, `Materials.jsx`)**:
  - Implemented regional pricing across 5 zones:
    - Chennai (CMDA Metro, 1.08x)
    - Coimbatore (Kongu Baseline, 1.00x)
    - Madurai (South Hub, 0.96x)
    - Tiruchirappalli (Delta Hub, 0.95x)
    - Salem (Steel & Mineral Hub, 0.94x)
  - Encoded daily wage schedule per Tamil Nadu PWD SOR 2025–2026 across all 7 construction trades (Head Mason, Assistant Mason, Barbender, Shuttering Carpenter, Plumber, Electrician, Helper).
  - Built interactive District Pricing Switcher bar and Daily Wage Schedule modal on `Materials.jsx`.
- [x] **Bank Loan & DTCP Sanction Ready Construction Project Dossier (`Reports.jsx`, `routers/projects.py`)**:
  - Integrated 3 capital tiers: Civil Contract, Pre-Construction Ancillaries, and All-Inclusive Total.
  - Computed 80% Loan-to-Value (LTV) max bank loan eligibility and 20% owner equity contribution under SBI Realty, HDFC, and Canara Bank guidelines.
  - Added stage-by-stage bank technical valuer disbursement schedule.
  - Added official TNCDBR 2019 statutory compliance certificate and pre-construction ancillary packages breakdown.
- [x] **Comprehensive Testing & Verification**:
  - 31 passing Pytest backend tests in `backend/tests/` (including 7 new tests in `test_realworld_engines.py`).
  - Frontend production build passing in ~200ms (`npm run build`).
  - 7 visual verification screenshots captured in `docs/screenshots/`:
    - `realworld_1_planner_compliance.png`
    - `realworld_2_generated_plan.png`
    - `realworld_3_construction_escrow.png`
    - `realworld_4_construction_quality.png`
    - `realworld_5_materials_districts.png`
    - `realworld_6_materials_wages_modal.png`
    - `realworld_7_reports_bank_dossier.png`

---

## Phase 12: Professional Architectural Floor-Plan Engine & Spatial Balance
- [x] **100% Bathroom & Room Preservation Engine (`solver.py`)**:
  - Fixed room extraction and mapping to guarantee that EVERY requested bathroom is assigned and rendered (support for 1 to 6 bathrooms).
  - Explicitly mapped `master_bath` (Ensuite Master), `bath_bed2` (Ensuite Bath 2 / Senior Ensuite), `common_bath` (Common Bathroom), and `bath_bed3` (Attached Bath 3).
  - Eliminated silent dropping of bathrooms; verified with unit tests and live browser execution.
- [x] **Ground Floor Balcony & Verandah Sit-Out Integration**:
  - Removed single-floor balcony omission logic.
  - Implemented covered `Front Balcony / Sit-Out` (`பூமுக வராண்டா`) on Floor 0 whenever the user ticks Balcony, directly connecting to the front living lounge and car parking porch.
- [x] **Realistic, Practical Kitchen & Dining Proportions**:
  - Resized modular kitchens from cramped single-column leftovers into spacious, functional chef kitchens ($140\text{--}258\,\text{sq ft}$, e.g. $17'\times 11'$ or $14.4'\times 18'$) with dedicated attached Utility & Wash Yards ($6'\times 18'$ or $8'\times 18'$).
  - Scaled dining halls to realistic, balanced proportions ($160\text{--}250\,\text{sq ft}$) instead of the previous $408\,\text{sq ft}$ banquet room.
- [x] **Architectural Bathroom Proportion Bounds (No 17-ft Bowling Alleys)**:
  - Enforced width and depth bounds ($5'\times 7'$ to $7'\times 9.5'$, $40\text{--}66\,\text{sq ft}$) with aspect ratios bounded between $1.2$ and $1.5$.
  - Integrated walk-in wardrobe and dressing alcoves to maintain clean geometric envelopes.
- [x] **4 Truly Distinct Architectural Archetypes on "Another Plan"**:
  - Archetype 0: **Traditional Vastu Courtyard Flow** (NW Car Porch, NE Verandah/Living, Brahmasthan Dining, SE Agni Kitchen/Utility, SW Niruthi Master Suite).
  - Archetype 1: **Contemporary Open Great-Room Layout** (L-shaped social pavilion, open dining, island kitchen with pantry, side sleeping suites).
  - Archetype 2: **Split-Wing Generational Suite Layout** (Step-free senior bedroom with private bath at front left, central family living & dining, rear master suite).
  - Archetype 3: **Linear Breezeway & Central Gallery Suite Layout** (H-plan with central gallery corridor dividing private suites and daytime pavilion).
- [x] **Testing & Verification**:
  - 32 Pytest backend tests passing in `backend/tests/` (added `test_user_reported_floorplan_requirements_3baths_balcony_kitchen`).
  - Production build passing in 230ms (`npm run build`).
  - Captured live browser screenshots:
    - `docs/screenshots/realworld_verified_plan_3baths_balcony.png` (Layout A: 3 baths, balcony, 188 sq ft kitchen)
    - `docs/screenshots/realworld_verified_vastu_plan_3baths.png` (Layout B: 3 baths, balcony, 190 sq ft kitchen)
    - `docs/screenshots/realworld_verified_another_plan_option.png` (Appended layout options on seed rotation)

---

## Phase 13: Dynamic Construction Checklist, State Synchronization, Auth Gate & Blueprint CAD
- [x] **Auth Gate for Plan Generation (`AuthModal.jsx`, `App.jsx`, `HousePlanner.jsx`)**:
  - Gated plan generation behind authentication.
  - When logged out, clicking "Generate house plan" opens `AuthModal` displaying a clear contextual notice: *"Sign in or create an account to generate and save your architectural floor plan."*
  - Enabled seamless auto-resumption: once logged in (or via Quick Demo Sign In), the pending plan generation immediately proceeds and renders the floor plan.
  - Step 4 shows a clear lock indicator (`🔒 Sign in required to generate & save plan`) and dynamic button label ("Sign In & Generate Plan" vs "Generate house plan").
- [x] **Dynamic Day-to-Day Construction Timeline & Fully Editable Checklist (`Construction.jsx`, `tasks.py`, `daily_tasks.py`)**:
  - Dynamically calculates the total construction duration in working days from the active project's schedule ($estimated\_months \times 25$ days, e.g. Day 1 to Day 350 for a 14-month schedule).
  - All tasks are initialized **unchecked** (`completed: false`) allowing homeowners to manually check off daily work as completed on-site.
  - Full manual editing:
    - Edit Task modal allows updating title, description, trade/specialist, assigned day number, and construction stage.
    - Postpone task (+1 day) with counter increment.
    - Add custom tasks for any day number.
    - Delete unwanted tasks.
    - "Re-sync Plan" button to re-align checklist with current plan duration.
  - Stage jump chips (`Site Prep (Day 1)`, `Foundation (Day 20)`, `Structure (Day 60)`, `Walls & Lintel (Day 135)`, `Services (Day 175)`, `Finishing (Day 210)`, `Handover`) and direct `GO TO: [ input ] / N` navigation.
- [x] **Global Reactive State Synchronization (`GeneratedPlan.jsx`, `App.jsx`, `Construction.jsx`, `Materials.jsx`, `Reports.jsx`, `projects.py`)**:
  - Selecting or generating a new house plan dispatches a global `buildwise:project-updated` event.
  - All dependent views (`Construction`, `Materials`, `Reports`, and `Dashboard`) re-fetch their data immediately upon plan selection or requirement changes.
  - Automatically re-synchronizes construction duration, material bill of quantities, cost breakdown, and compliance certificates across all pages without requiring page reloads.
- [x] **Architect-Grade Blueprint CAD Visuals & 100% Room Preservation (`GeneratedPlan.jsx`, `solver.py`)**:
  - Double-line architectural wall boundaries ($9''$ exterior load-bearing walls, $4.5''$ interior partition walls).
  - Authentic $90^\circ$ curved inward door swing arcs with jamb cutouts and swing trajectories.
  - Architectural ventilation window symbols with glass panes on exterior walls.
  - Precision architectural fixture outlines:
    - King/queen beds with nightstands and pillow markers.
    - Western commodes with cistern tanks, seats, and washbasins.
    - L-shaped modular kitchen counters with 3-burner gas hobs and Franke sinks.
    - 6-seater dining tables with chair placements.
    - Living room sectionals with coffee tables.
    - Car parking silhouette in the parking porch.
    - Covered verandah sit-out with architectural deck planking.
  - Guaranteed 100% preservation of all requested rooms (including 1–6 bathrooms and balcony/sit-out).
- [x] **Comprehensive Testing & Verification**:
  - 32 Pytest backend tests passing in `backend/tests/`.
  - Frontend production build passing in 227ms (`npm run build`).
  - Captured live browser verification screenshots in `docs/screenshots/after/`:
    - `verify_1_auth_gate_modal.png` (Contextual auth gate on plan generation)
    - `verify_2_architectural_floorplan_cad.png` (AutoCAD-grade blueprint layout with fixtures & door swings)
    - `verify_3_architectural_plan_alternative.png` (Distinct appended architectural archetypes)
    - `verify_4_construction_dynamic_days.png` (Dynamic 350-day schedule with unchecked tasks)
    - `verify_5_edit_task_modal.png` (Full manual task editor modal)
    - `verify_6_materials_synchronized.png` (Synchronized materials BOM)
    - `verify_7_reports_synchronized.png` (Synchronized project report and bank dossier)

