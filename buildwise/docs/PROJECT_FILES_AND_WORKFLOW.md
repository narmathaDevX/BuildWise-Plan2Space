# BuildWise: Complete Codebase Directory, File-by-File Reference & System Workflow

> **Project Name:** BuildWise (AI-Powered Residential Construction Planning Platform)
> **Target Jurisdiction:** Tamil Nadu, India
> **Engineering Standards:** Tamil Nadu Combined Development and Building Rules (TNCDBR 2019) & TN PWD Schedule of Rates (SOR 2025–2026)
> **Local Folder Path on macOS:** `/Users/narmathan/buildwise`

---

## Table of Contents
1. [How to Access the Project Folder in macOS Finder](#1-how-to-access-the-project-folder-in-macos-finder)
2. [High-Level Architecture & Tech Stack](#2-high-level-architecture--tech-stack)
3. [End-to-End System Workflow](#3-end-to-end-system-workflow)
4. [Complete File-by-File Catalog & Responsibilities](#4-complete-file-by-file-catalog--responsibilities)
   - [A. Backend Core (`backend/app/`)](#a-backend-core-backendapp)
   - [B. Backend Services & Calculation Engines (`backend/app/services/`)](#b-backend-services--calculation-engines-backendappservices)
   - [C. Backend Routers & API Endpoints (`backend/app/routers/`)](#c-backend-routers--api-endpoints-backendapprouters)
   - [D. Real-World Datasets & Rate Cards (`backend/app/data/`)](#d-real-world-datasets--rate-cards-backendappdata)
   - [E. Backend Test Suite (`backend/tests/`)](#e-backend-test-suite-backendtests)
   - [F. Frontend Source (`frontend/src/`)](#f-frontend-source-frontendsrc)
   - [G. Frontend Pages (`frontend/src/pages/`)](#g-frontend-pages-frontendsrcpages)
   - [H. Frontend Components (`frontend/src/components/`)](#h-frontend-components-frontendsrccomponents)
   - [I. Frontend Services & Hooks (`frontend/src/services/` & `frontend/src/hooks/`)](#i-frontend-services--hooks-frontendsrcservices--frontendsrchooks)
   - [J. Configuration & Root Files](#j-configuration--root-files)
   - [K. Legacy Prototype Files (`pages/`, `utils/`, `app.py`)](#k-legacy-prototype-files-pages-utils-apppy)
5. [Event Bus & Inter-Page Synchronization](#5-event-bus--inter-page-synchronization)
6. [How to Run and Test BuildWise](#6-how-to-run-and-test-buildwise)

---

## 1. How to Access the Project Folder in macOS Finder

Your project is stored locally on your Mac at:
```
/Users/narmathan/buildwise
```

Here are 3 ways to view and bookmark it in macOS Finder:

### Method 1: Instant Terminal Command (One-Click)
Open the **Terminal** app on your Mac and run:
```bash
open /Users/narmathan/buildwise
```
*A new Finder window will immediately open displaying all project files.*

### Method 2: Via Finder "Go to Folder" Shortcut
1. Click anywhere on your desktop or open any Finder window.
2. Press the keyboard shortcut: **`Cmd + Shift + G`** (or click **Go** in the top Mac menu bar -> **Go to Folder...**).
3. Type or paste:
   ```
   ~/buildwise
   ```
   *(or `/Users/narmathan/buildwise`)*
4. Hit **Enter** (Return).

### Method 3: Pin to Finder Sidebar for Easy 1-Click Access
1. Open the `/Users/narmathan/buildwise` folder using Method 1 or 2.
2. Press **`Cmd + Up Arrow`** once to go to the parent folder (`narmathan`).
3. Drag the folder named **`buildwise`** into the **Favorites** section on the left sidebar of Finder.
4. Now `buildwise` will always be permanently visible in your Finder sidebar!

---

## 2. High-Level Architecture & Tech Stack

BuildWise is built on a decoupled, production-grade web architecture:

| Tier | Technology | Description |
|---|---|---|
| **Frontend** | React 18, Vite 6, Vanilla CSS | Single Page App (SPA) styled with custom CSS tokens (`--surface`, `--accent`, `--border`), Lucide icons, responsive layout, dual light/dark modes. |
| **Backend** | Python 3.13, FastAPI, Uvicorn | High-performance asynchronous REST & SSE backend with Pydantic v2 data validation and string error formatting. |
| **Database** | SQLite, SQLAlchemy 2.0 | Lightweight, zero-config relational database with automatic column migrations (`ensure_columns_exist`). |
| **Generative AI** | Google Gemini 3.1 Flash-Lite (`google-genai` SDK) | AI Plan Advisor for structured architectural briefings, streaming chat, and spoken voice script generation with deterministic template fallback. |
| **Speech Engine** | Web Speech API | Client-side speech synthesis (TTS) with Indian voices (`en-IN`, `ta-IN`) and speech recognition (STT) for microphone voice input. |
| **CAD Engine** | Pure Python Slicing + SVG | Deterministic, non-black-box constraint satisfaction generator rendering 2D CAD floor plans with 90° door swings and ventilation windows. |

---

## 3. End-to-End System Workflow

The entire user journey through BuildWise follows a cohesive 7-stage engineering pipeline:

```
[1. User Input in HousePlanner]
         │
         ▼
[2. FloorPlanSolver (FastAPI)] ──► Evaluates 4 Architectural Archetypes
         │
         ▼
[3. TNCDBR-MCDA v2.0 Ranking] ──► Deterministic 7-Criteria Scoring & Hard Gating
         │
         ▼
[4. GeneratedPlan Viewer] ───────► CAD SVG Rendering + "Fitness Score" + Podium Cards
         │
         ├──► [AI Plan Advisor] ──► Gemini 3.1 Summary + SSE Chat + Voice (TTS/STT)
         ├──► [Client PDF Report] ► White-label presentation dossier with print CSS
         ├──► [Shareable Link] ───► 30-day unguessable public read-only link
         └──► [Liked Portfolio] ──► Save favorite plans with custom notes & star badges
         │
         ▼
[5. Event Bus Synchronization] ──► Dispatches 'buildwise:project-updated'
         │
         ├───────────────────────────────────────────────┤
         ▼                                               ▼
[6. Construction Page]                          [7. Materials Page]
 - Dynamic duration (e.g. 350 days)              - Real-world Tamil Nadu PWD dataset
 - Day-by-Day Work Checklist                     - 6 Districts (Chennai, Madurai, etc.)
 - Manual check, postponement, task editor        - Mason/carpenter/painter daily wages
         │                                               │
         └───────────────────────┬───────────────────────┘
                                 ▼
                     [8. Reports / Bank Dossier]
                      - Consolidated project cost
                      - TNCDBR Rule 35 compliance check
                      - 8-Stage Escrow Milestone Schedule
                      - 5% 90-Day Handover Retention
```

### Detailed Workflow Step-by-Step:
1. **Step 1: Input Requirements (`HousePlanner.jsx`):**
   - User inputs plot length and width in feet (e.g., $40 \times 60\,\text{ft} = 2,400\,\text{sq.ft}$).
   - Selects road-facing orientation (North, East, South, West) and Tamil Nadu location.
   - Selects BHK configuration (1 to 5 Bedrooms), number of bathrooms, parking porch, front balcony, pooja room, and utility room.
   - Selects quality specification: Economy (₹1,800/sq.ft), Standard (₹2,200/sq.ft), or Premium (₹2,800/sq.ft).
   - Specifies capital budget and monthly cash-burn allocation.
   - Enforces authentication: If not logged in, opens `AuthModal` with Demo Builder login option.
2. **Step 2: Generation & Candidate Slicing (`solver.py`):**
   - Backend constraint solver tests candidates across 4 distinct archetypes:
     - *Archetype 0:* Traditional Vastu Courtyard Flow (quadrant zoned).
     - *Archetype 1:* Contemporary Open Great-Room (modern unified living).
     - *Archetype 2:* Split-Wing Generational Suite (maximum parent/child privacy).
     - *Archetype 3:* Compact Urban Dual-Wing (zero corridor waste).
   - Generates exact room coordinates, perimeter structural walls, 90° door swing arcs, and exterior ventilation windows.
3. **Step 3: Deterministic Plan Ranking (`ranking.py`):**
   - Ranks the candidate plans using **TNCDBR-MCDA v2.0** across 7 weighted criteria:
     - Budget Fit (25%), Vastu Alignment (15%), Ventilation & Daylight (15%), Space Efficiency (15%), Room Proportions (10%), Regulatory Margin (10%), Buildability & Plumbing (10%).
   - *Hard Rule Check:* Any plan that fails mandatory statutory setbacks or exceeds the 70% max ground coverage ceiling cannot be ranked #1.
   - Selects the top 3 best-fitting distinct plans without duplicates.
4. **Step 4: Interactive Review (`GeneratedPlan.jsx`):**
   - Topbar displays plot chip, "Report", "Share", "Branding", and "Another plan" buttons.
   - Gold/Silver/Bronze podium displays `#1 Recommended`, `#2 Alternative`, and `#3 Alternative` with live criteria score bars.
   - Preset switcher allows changing priorities to *Balanced*, *Budget-First*, *Vastu-First*, or *Comfort-First*.
   - Displays plan CAD SVG blueprint with room labels, dimensions, and area pills.
5. **Step 5: AI Plan Advisor Consultation (`AIAdvisor.jsx`):**
   - Assembles grounded DB context (never relies on client inputs).
   - Gemini 3.1 Flash-Lite generates a structured summary with headline, overview, 4 pillar cards (Vastu, Ventilation, Budget, Rule 35), strengths, watchpoints, and next steps.
   - Dual-language toggle: English or natural Tamil (தமிழ்).
   - Audience toggle: Homeowner vs Professional.
   - "🔊 Listen" button reads the spoken briefing via browser SpeechSynthesis.
   - Interactive Q&A chat tab streams answers via Server-Sent Events (SSE) with suggestion chips and speech-to-text voice input.
6. **Step 6: Construction Schedule & Checklist (`Construction.jsx`):**
   - Calculates total construction duration (e.g., 350 working days).
   - Day-by-Day Work Checklist displays granular daily activities (Day 1: Site Clearing & Boundary Pegging, etc.).
   - Users can manually check off completed tasks, click "Postpone" to push delayed items to the next day, or open the task editor to change descriptions and trade assignments.
7. **Step 7: Procurement & Bank Dossier (`Materials.jsx` & `Reports.jsx`):**
   - Materials page computes Bill of Materials (BOM) based on Tamil Nadu PWD 2025–2026 data.
   - District selector applies real regional pricing across Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, and Tirunelveli.
   - Reports page consolidates the full project into a bank appraisal dossier with 8-stage escrow milestones, 5% 90-day retention, and one-click PDF printing.

---

## 4. Complete File-by-File Catalog & Responsibilities

### A. Backend Core (`backend/app/`)

#### 1. `backend/app/main.py`
- **Role:** Main application entry point for the FastAPI backend.
- **Responsibilities:**
  - Instantiates `app = FastAPI(...)`.
  - Configures CORS middleware for frontend origins (`http://127.0.0.1:5173`, `http://localhost:5173`).
  - Registers the application lifespan context manager to auto-initialize SQLite via `init_db()`.
  - Registers global exception handler `validation_exception_handler` ensuring all validation errors return a clean string `detail` (preventing frontend `[object Object]` crashes).
  - Mounts all API routers: `auth_router`, `plans_router`, `estimates_router`, `projects_router`, `tasks_router`, `materials_router`, `assistant_router`, and `ml_router`.
  - Exposes `GET /api/health` providing real-time database, model, and `ai_service` health status.

#### 2. `backend/app/config.py`
- **Role:** Centralized configuration management using Pydantic Settings.
- **Responsibilities:**
  - Reads environment variables from `backend/.env` (and system environment).
  - Manages `DATABASE_URL` (defaults to `sqlite:///./buildwise.db`).
  - Manages `SECRET_KEY`, `ALGORITHM` (HS256), and `ACCESS_TOKEN_EXPIRE_MINUTES`.
  - Manages `GEMINI_API_KEY` and default `GEMINI_MODEL` (`gemini-3.1-flash-lite`).
  - Sets `AUTH_REQUIRED` flag (defaults to `False` allowing guest fallback).

#### 3. `backend/app/db/session.py`
- **Role:** Database engine and session lifecycle.
- **Responsibilities:**
  - Creates SQLAlchemy `engine` with `check_same_thread=False` for SQLite compatibility.
  - Configures `sessionmaker(autocommit=False, autoflush=False)`.
  - Provides `get_db()` dependency yielding a scoped database session with automatic closing.

#### 4. `backend/app/db/models.py`
- **Role:** SQLAlchemy ORM database models.
- **Models Defined:**
  - `User`: Stores user credentials (`email`, `hashed_password`, `name`, `role` [homeowner, architect, contractor], `branding_json`).
  - `Project`: Stores active project context (`name`, `location`, `budget`, `monthly_budget`, `quality`, `status`, `plot_data`, `form_data`).
  - `PlanModel`: Stores generated candidate plans (`plan_id`, `name`, `score`, `floors_json`, `ranking_json`).
  - `SavedPlan`: Stores user-liked portfolio plans (`title`, `notes`, `plan_json`, `form_json`, `built_up_area`, `estimated_cost`, `score`, `ranking_json`).
  - `MaterialItem`: Stores Bill of Materials items with category, unit, quantity, unit price, and purchase status.
  - `ConstructionTask`: Stores granular day-by-day construction activities (`day_number`, `title`, `stage_name`, `completed`, `postponed`, `cost_weight`).
  - `AISummary`: Stores hash-keyed cached AI summaries (`cache_key`, `plan_id`, `language`, `audience`, `summary_json`, `source`).
  - `ShareLink`: Stores 30-day unguessable cryptographic tokens for public read-only project sharing.

#### 5. `backend/app/db/init_db.py`
- **Role:** Idempotent database schema creation, migration, and default data seeding.
- **Responsibilities:**
  - Calls `Base.metadata.create_all(bind=engine)`.
  - Executes `ensure_columns_exist()` to safely add new columns (`role`, `branding_json`, `ranking_json`) to existing SQLite tables without breaking legacy databases.
  - Seeds default demo builder user (`guest@buildwise.local`).
  - Seeds authentic saved portfolio blueprints so new users can immediately browse and compare plans.

---

### B. Backend Services & Calculation Engines (`backend/app/services/`)

#### 6. `backend/app/services/floorplan/solver.py`
- **Role:** Pure-Python constraint satisfaction floor plan layout solver.
- **Responsibilities:**
  - Enforces statutory setbacks (Front $5\,\text{ft}$, Rear/Left/Right $3\,\text{ft}$) to calculate building envelope.
  - Slices floor plans into functional spaces across 4 distinct archetypes (Traditional Vastu, Contemporary Open, Split-Wing Privacy, Compact Urban).
  - Automatically co-locates attached bathrooms with master bedrooms.
  - Places exterior ventilation windows and calculates 90° door swings.
  - Evaluates all 4 archetypes and invokes `rank_plans()` to select exactly the 3 best-fitting distinct candidate plans without duplicates.

#### 7. `backend/app/services/ranking.py`
- **Role:** Deterministic Multi-Criteria Decision Analysis (MCDA) ranking engine (`TNCDBR-MCDA-v2.0`).
- **Responsibilities:**
  - Computes 7 individual normalized criteria scores (0–100):
    - `score_budget_fit`: Evaluates turnkey cost against user budget and monthly cash-burn feasibility.
    - `score_vastu`: Scores Agni kitchen SE, Niruthi master SW, Ishanya pooja NE, entrance orientation.
    - `score_ventilation_daylight`: Calculates percentage of rooms touching perimeter with exterior openings.
    - `score_space_efficiency`: Compares usable carpet area to built-up footprint (82%–88% benchmark).
    - `score_room_proportions`: Penalizes narrow aspect ratios outside 1.2 to 1.8.
    - `score_regulatory_margin`: Verifies setbacks, max 70% coverage, and RWH pits under TNCDBR 2019 Rule 35.
    - `score_buildability_plumbing`: Evaluates structural regularity and sanitary riser clustering.
  - Enforces Hard Compliance Rule: Any non-compliant plan is disqualified from ranking #1.
  - Supports 4 weight presets: Balanced, Budget-First, Vastu-First, and Comfort-First.

#### 8. `backend/app/services/gemini_client.py`
- **Role:** Integration wrapper for the official Google GenAI SDK (`google-genai`).
- **Responsibilities:**
  - Manages client connection using `GEMINI_API_KEY`.
  - Handles failover across candidate models (`gemini-3.1-flash-lite`, `gemini-3.8-flash`, `gemini-flash-latest`).
  - Implements `generate_plan_summary`: Returns structured JSON summary validated against Pydantic schema.
  - Implements `generate_plan_walkthrough` & `deterministic_template_walkthrough`: Analyzes spatial circulation and room-to-room connectivity (entrance -> living -> dining -> kitchen -> master suite -> stairs -> upper lounge -> balcony -> bedrooms) in English and Tamil with spoken audio scripts.
  - Implements `modify_plan_parameters`: Interprets user natural-language revision suggestions via Gemini structured JSON and an offline intelligent regex rule-based parser.
  - Implements `stream_chat_response`: Async generator streaming SSE tokens for real-time chat.
  - Implements `explain_plan_ranking`: Explains ranking decisions and trade-offs in plain language.
  - Implements `deterministic_template_summary`: Bulletproof offline fallback returning verified engineering metrics when API is unavailable (`source: "template"`).

#### 9. `backend/app/services/gemini_prompts.py`
- **Role:** System prompts and grounding rules for the AI Advisor, spatial walkthrough, and interactive revisions.
- **Responsibilities:**
  - Defines `SYSTEM_PROMPT_EN` and `SYSTEM_PROMPT_TA` (Tamil).
  - Defines `WALKTHROUGH_PROMPT_EN` and `WALKTHROUGH_PROMPT_TA` for architectural spatial circulation flow.
  - Defines `PLAN_MODIFICATION_PROMPT` for constraint recalibration from natural language instructions.
  - Enforces strict grounding rules: never invent numbers or legal clauses, format currency in Lakhs/Crores (₹), and mandate licensed architect verification disclaimers.

#### 10. `backend/app/services/cost.py`
- **Role:** Civil construction cost estimator.
- **Responsibilities:**
  - Applies base rates per sq.ft based on quality (Economy ₹1,800, Standard ₹2,200, Premium ₹2,800).
  - Applies Tamil Nadu district multipliers (Chennai 1.12, Coimbatore 1.05, Madurai 1.00, etc.).
  - Calculates 6-stage civil breakdown using Largest Remainder Rounding ensuring percentages sum to exactly 100%.

#### 11. `backend/app/services/ancillary.py`
- **Role:** Pre-construction ancillary cost calculator.
- **Responsibilities:**
  - Estimates mandatory Tamil Nadu site preparation costs: 300ft borewell (₹1.85L), TNEB 3-phase power (₹65k), DTCP sanction fee (₹1.2L), 8000L RCC sump (₹2.1L), and compound wall with gate (₹2.4L).
  - Returns total ancillary expenditure (default ₹8.20 Lakhs).

#### 12. `backend/app/services/schedule.py`
- **Role:** Discrete-event construction timeline and cash-burn simulation.
- **Responsibilities:**
  - Simulates stage durations based on built-up area and monthly budget caps.
  - Accounts for predecessor dependencies (curing times, slab settling).
  - Calculates total estimated months.

#### 13. `backend/app/services/daily_tasks.py`
- **Role:** Day-by-day construction activity generator.
- **Responsibilities:**
  - Generates realistic, sequential daily tasks spanning from Day 1 to project completion.
  - Assigns stage, trade (mason, carpenter, plumber, electrician), and cost weight to each task.

#### 14. `backend/app/services/milestones.py`
- **Role:** Escrow milestone payment scheduler.
- **Responsibilities:**
  - Generates 8 contractual escrow milestones tied to verified physical inspection checkpoints.
  - Enforces mandatory 5% handover retention withheld for 90 days post-occupancy.

#### 15. `backend/app/services/compliance.py`
- **Role:** Statutory compliance evaluator under TNCDBR 2019 Rule 35.
- **Responsibilities:**
  - Validates minimum setbacks based on plot width, depth, and road width.
  - Enforces 70% maximum ground coverage ceiling.
  - Verifies rainwater harvesting (RWH) percolation pit requirements.

#### 16. `backend/app/services/materials.py`
- **Role:** Bill of Materials (BOM) quantity and price engine.
- **Responsibilities:**
  - Applies standard civil thumb-rules per sq.ft (Cement 0.4 bags/sq.ft, Steel 3.5 kg/sq.ft, Sand 1.8 cu.ft/sq.ft, Aggregate 1.2 cu.ft/sq.ft, Bricks 18 nos/sq.ft).
  - Merges real-world district rate cards from `tamilnadu_pwd_bai_materials_dataset.json`.

#### 17. `backend/app/services/affordability.py`
- **Role:** Live Step 3 affordability quick-estimator.
- **Responsibilities:**
  - Compares monthly budget against projected burn rate and provides real-time guidance.

#### 18. `backend/app/services/auth.py`
- **Role:** Password hashing and JWT token utility.
- **Responsibilities:**
  - Uses `bcrypt` for secure salt hashing and verification.
  - Encodes and decodes signed JWT bearer tokens.

---

### C. Backend Routers & API Endpoints (`backend/app/routers/`)

#### 19. `backend/app/routers/plans.py`
- **Endpoints:**
  - `POST /api/generate`: Solves and returns 3 distinct candidate plans with MCDA ranking.
  - `POST /api/plans/rank`: Re-ranks plans via MCDA with requested preset.
  - `GET /api/plans/saved`: Lists user's saved liked blueprints.
  - `POST /api/plans/saved`: Saves a liked plan with custom title and notes.
  - `GET /api/plans/saved/{id}`: Retrieves single saved plan.
  - `PUT /api/plans/saved/{id}`: Updates saved plan notes or title.
  - `DELETE /api/plans/saved/{id}`: Deletes plan from portfolio.

#### 20. `backend/app/routers/assistant.py`
- **Endpoints:**
  - `POST /api/assistant/summarize`: Returns structured plan summary (DB-grounded context, cache check, Gemini generate, template fallback).
  - `POST /api/assistant/chat`: Streams progressive SSE tokens for Q&A.
  - `POST /api/assistant/explain-ranking`: Explains ranking tradeoffs.
  - `POST /api/assistant/walkthrough`: Generates architectural spatial circulation walkthrough explaining room-to-room transitions with spoken script.
  - `POST /api/assistant/modify-plan`: Interprets natural-language revision suggestions via Gemini, updates constraints, and re-runs the constraint solver to generate new candidate plans with MCDA ranking.

#### 21. `backend/app/routers/projects.py`
- **Endpoints:**
  - `GET /api/projects/current`: Retrieves full active project context.
  - `PUT /api/projects/current`: Saves form and plan array.
  - `PUT /api/projects/current/selected-plan`: Updates active selected plan.
  - `GET /api/projects/current/summary`: Provides dashboard summary metrics.
  - `GET /api/projects/current/construction`: Retrieves construction schedule.
  - `GET /api/projects/current/report`: Generates consolidated banking report.
  - `GET/PUT /api/projects/current/branding`: Retrieves/updates contractor white-label branding.
  - `POST /api/projects/current/share`: Generates 30-day unguessable share link.
  - `GET /api/projects/public/share/{token}`: Returns public shared project.

#### 22. `backend/app/routers/tasks.py`
- **Endpoints:**
  - `GET /api/projects/current/tasks`: Retrieves daily tasks checklist.
  - `PATCH /api/projects/current/tasks/{id}`: Updates task completion status.
  - `POST /api/projects/current/tasks/{id}/postpone`: Postpones task to next working day.
  - `POST /api/projects/current/tasks`: Creates custom task.
  - `PUT /api/projects/current/tasks/{id}`: Edits task details.
  - `DELETE /api/projects/current/tasks/{id}`: Deletes task.
  - `POST /api/projects/current/tasks/regenerate`: Recomputes schedule from updated plan.

#### 23. `backend/app/routers/materials.py`
- **Endpoints:**
  - `GET /api/projects/current/materials`: Returns Bill of Materials for active project.
  - `PATCH /api/projects/current/materials/{id}`: Toggles item purchase status.
  - `POST /api/projects/current/materials`: Adds custom procurement item.
  - `DELETE /api/projects/current/materials/{id}`: Removes material item.
  - `GET /api/materials/provenance`: Returns TN PWD data sources and labor wage tables.

#### 24. `backend/app/routers/estimates.py`
- **Endpoints:**
  - `POST /api/estimate/cost`: Calculates civil and turnkey expenditure.
  - `POST /api/estimate/schedule`: Simulates project duration in months.
  - `POST /api/estimate/affordability`: Quick check for monthly cash-flow feasibility.
  - `POST /api/estimate/compliance`: Evaluates setbacks and ground coverage under TNCDBR Rule 35.
  - `POST /api/estimate/ancillary`: Calculates pre-construction ancillaries.
  - `GET /api/estimate/districts`: Returns Tamil Nadu district list and multipliers.

#### 25. `backend/app/routers/auth.py`
- **Endpoints:**
  - `POST /api/auth/register`: Creates new user account.
  - `POST /api/auth/login`: Authenticates credentials and returns JWT token.
  - `GET /api/auth/me`: Returns current authenticated user profile and role.

#### 26. `backend/app/routers/ml.py`
- **Endpoints:**
  - `GET /api/ml/status`: Honest transparency endpoint reporting formula-based engineering status and real-world ML training criteria.

---

### D. Real-World Datasets & Rate Cards (`backend/app/data/`)

#### 27. `backend/app/data/tamilnadu_pwd_bai_materials_dataset.json` & `.csv`
- **Source:** Tamil Nadu Public Works Department (TN PWD) Schedule of Rates 2025–2026 cross-referenced with Builders Association of India (BAI) Tamil Nadu Chapter market price circulars.
- **Coverage:** Verified retail prices, benchmark rates, brands (UltraTech, Ramco, Tata Tiscon, JSW Neosteel), and technical specifications for Cement, TMT Steel, River Sand, M-Sand, Blue Metal Aggregates, Wire-Cut Red Bricks, AAC Blocks, Vitrified Tiles, Teak Wood, UPVC Windows, and Electrical/Plumbing fittings.

#### 28. `backend/app/data/tn_district_rates_2026.json`
- **Coverage:** District-specific cost multipliers and standard daily labor wages (Head Mason, Mason, Carpenter, Bar Bender, Plumber, Painter, Helper) for Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, and Tirunelveli.

#### 29. `backend/app/data/rates.json`
- Base construction rates per sq.ft across Economy, Standard, and Premium tiers.

#### 30. `backend/app/data/ancillary_costs.json`
- Standard pre-construction costs for borewell drilling, TNEB power, DTCP sanction, sumps, and compound walls.

#### 31. `backend/app/data/locations.json`
- Regional multipliers across Tamil Nadu geographic zones.

#### 32. `backend/app/data/stages.json`
- Formal definitions for all construction stages from Site Prep to Handover.

#### 33. `backend/app/data/tncdbr_rules.json`
- Codified statutory setback tables and coverage formulas under TNCDBR 2019 Rule 35.

---

### E. Backend Test Suite (`backend/tests/`)

- `backend/tests/test_api.py`: Tests general health, validation errors, and estimates API.
- `backend/tests/test_assistant.py`: Tests Gemini AI summaries, template fallback, streaming SSE chat, explain-ranking, spatial circulation walkthrough (`test_api_assistant_walkthrough`), and natural language plan revisions (`test_api_assistant_modify_plan`).
- `backend/tests/test_ranking.py`: Tests MCDA 7 criteria formulas, weights sum to 100%, preset reordering, and hard statutory failure disqualification.
- `backend/tests/test_solver.py`: Tests floor plan envelope calculation, archetypes, distinct plan generation, and multi-floor duplex room placements.
- `backend/tests/test_saved_plans.py`: Tests full CRUD lifecycle of saved liked blueprints.
- `backend/tests/test_tasks.py`: Tests construction day-by-day task endpoints, completion toggles, and postponement.
- `backend/tests/test_cost.py`: Tests cost monotonicity and largest remainder rounding summing to 100%.
- `backend/tests/test_materials.py`: Tests BOM thumb-rule calculations and numeric quantities.
- `backend/tests/test_schedule.py`: Tests cash-burn constraints and schedule simulation invariants.
- `backend/tests/test_realworld_engines.py`: Tests TNCDBR compliance, ancillary costs, and bank dossier reporting.
- `backend/tests/test_auth.py`: Tests password hashing and JWT token decoding.

---

### F. Frontend Source (`frontend/src/`)

#### 34. `frontend/src/main.jsx`
- Root entry point mounting React 18 onto `#root`.
- Wraps app in `ThemeProvider` from `ThemeContext.jsx`.

#### 35. `frontend/src/App.jsx`
- **Role:** Main navigation shell, global routing, and auth state.
- **Responsibilities:**
  - Header with navigation items: Dashboard, House Planner, Construction, Materials, Reports.
  - Profile menu, theme toggle (light/dark mode), and sign-in button.
  - Listens to `buildwise:project-updated` to trigger global state synchronization across pages.
  - Detects shared client link parameters (`?share=<token>` or `/share/<token>`) and auto-loads shared project dossiers into `GeneratedPlan`.

#### 36. `frontend/src/index.css`
- Core CSS styling containing CSS variables (`--bg`, `--surface`, `--surface-2`, `--text`, `--text-soft`, `--text-muted`, `--border`, `--accent`, `--green`).
- Complete dark mode overrides (`[data-theme="dark"]`).
- Responsive layout styling down to 360px mobile viewports.

---

### G. Frontend Pages (`frontend/src/pages/`)

#### 37. `frontend/src/pages/HousePlanner.jsx`
- 4-step wizard for inputting plot parameters, room configurations, quality, and budget.
- Features real-time TNCDBR plot feedback and "Saved Plans (N)" portfolio modal.

#### 38. `frontend/src/pages/GeneratedPlan.jsx`
- Interactive CAD floor plan viewer rendering structural walls, 90° door swings, ventilation windows, and multi-floor level switcher tabs (Ground Floor Level 0 vs First Floor Level 1).
- Features topbar theme toggle button (<kbd>Sun</kbd> / <kbd>Moon</kbd>) for instant light/dark mode adaptation.
- Integrates `AIPlanModifier` (interactive natural-language suggestion prompt that auto-solves and updates layouts with an Undo option).
- Integrates `PlanWalkthrough` (architectural spatial circulation flow with interactive breadcrumbs and voice playback).
- Integrates `PlanRanking` (TNCDBR-MCDA v2.0 transparent podium cards), `ClientReportModal`, `ShareModal`, and `BrandingModal`.
- Features "Save Plan to Liked" portfolio integration with gold star badges and confirmation toasts.

#### 39. `frontend/src/pages/Construction.jsx`
- Dynamic schedule based on user's built-up area and budget (e.g. 350 working days).
- Interactive Day-by-Day Work Checklist starting unchecked, with completion toggling, postponement, and manual task editing.

#### 40. `frontend/src/pages/Materials.jsx`
- Bill of Materials (BOM) calculator powered by TN PWD SOR 2025–2026.
- District selector for regional pricing and modal displaying PWD labor wage cards.

#### 41. `frontend/src/pages/Reports.jsx`
- Consolidated project report formatted as a formal home loan and banking dossier.
- Includes 8-stage escrow milestones, 5% 90-day retention, and one-click PDF printing.

#### 42. `frontend/src/pages/Dashboard.jsx`
- High-level overview displaying project status, estimated expenditure, timeline, and quick-start actions.

#### 43. `frontend/src/pages/CostEstimation.jsx`
- Dedicated cost breakdown inspection view.

---

### H. Frontend Components (`frontend/src/components/`)

#### 44. `frontend/src/components/PlanWalkthrough.jsx`
- **Role:** Architectural Spatial Circulation Walkthrough (Text + Voice).
- **Responsibilities:**
  - Explains room-to-room circulation flow (e.g. *"Main entrance verandah opens into formal living, living room leads into central dining hall, South-East modular kitchen with utility wash, secluded master suite in SW... staircase to Level 1 family lounge opening onto front balcony and upper bedroom wings"*).
  - Provides interactive clickable breadcrumb flow chips and detailed step-by-step transition cards.
  - Features **Voice Output** ("🔊 Listen to Walkthrough" button using browser Web Speech API `SpeechSynthesis` with Play, Pause, Resume, Stop, and Speed controls: 0.8x, 1.0x, 1.2x).
  - Supports dual language toggle (English | தமிழ்).

#### 45. `frontend/src/components/AIPlanModifier.jsx`
- **Role:** Interactive AI Plan Revisions ("Suggest Changes to Gemini").
- **Responsibilities:**
  - Provides natural language text input and microphone voice input (Web Speech API).
  - Offers 8 quick suggestion chips (*"✨ Add Pooja Room"*, *"🏡 Make G+1 Duplex"*, *"🚗 Add Car Parking"*, *"🌅 Add Front Balcony"*, *"🛏️ Add 1 More Bedroom"*).
  - Sends plain-language instructions to `POST /api/assistant/modify-plan`, which parses the intent, recalibrates constraints, re-runs `FloorPlanSolver`, and updates the blueprint, metrics, and room schedule live on screen.
  - Provides a one-click **"Undo Revision"** rollback button to revert to the previous plan.

#### 46. `frontend/src/components/PlanRanking.jsx`
- Transparent MCDA ranking section displaying #1 Recommended, #2, and #3 podium cards.
- Horizontal criteria bars, 4 weight presets, "Explain ranking with AI", and formula disclosure panel.

#### 46. `frontend/src/components/ClientReportModal.jsx`
- Client-ready presentation & comparison PDF/Print report with white-label contractor header, 3-plan table, cost breakdown, and engineer/client signature sign-off blocks.

#### 47. `frontend/src/components/ShareModal.jsx`
- Creates and copies 30-day unguessable cryptographic links for public read-only client sharing.

#### 48. `frontend/src/components/BrandingModal.jsx`
- Configures white-label contractor/architect firm name, COA/CMDA license, phone, email, and legal disclaimers.

#### 49. `frontend/src/components/AuthModal.jsx`
- Modal for user sign-in, registration, and 1-click Quick Demo Builder login.

#### 50. `frontend/src/components/ConstructionProgress.jsx`
- Visual progress bar and milestone tracking indicators.

#### 51. `frontend/src/components/ProjectOverview.jsx`, `Navbar.jsx`, `Sidebar.jsx`, `StatCard.jsx`
- Reusable UI building blocks for dashboard layouts and metric displays.

---

### I. Frontend Services & Hooks (`frontend/src/services/` & `frontend/src/hooks/`)

#### 52. `frontend/src/hooks/useSpeech.js`
- Custom React hook managing Text-to-Speech (TTS) via `SpeechSynthesis` (`en-IN`, `ta-IN`, play/pause/stop/speed) and Speech-to-Text (STT) via `SpeechRecognition` with microphone permission handling.

#### 53. `frontend/src/services/api.js`
- API client handling JWT bearer tokens, REST endpoints, and SSE stream parsing (`streamPlanChat`).

#### 54. `frontend/src/services/planApi.js`
- Transforms frontend form state into the structured payload expected by `POST /api/generate`.

#### 55. `frontend/src/context/ThemeContext.jsx`
- React context managing light and dark themes with `localStorage` persistence.

---

### J. Configuration & Root Files

- `backend/requirements.txt`: Python dependencies (`fastapi`, `uvicorn`, `google-genai>=2.30.0`, `sqlalchemy`, `bcrypt`, `pyjwt`, `pytest`, `httpx`).
- `backend/.env.example`: Template for environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`).
- `frontend/package.json`: Frontend dependencies (`react`, `react-dom`, `lucide-react`, `vite`).
- `frontend/vite.config.js`: Vite build configuration.
- `.gitignore`: Excludes `.env`, `node_modules`, `dist`, `__pycache__`, and SQLite database files.

---

### K. Legacy Prototype Files (`pages/`, `utils/`, `app.py`)

- `app.py`, `pages/*.py`, `utils/*.py`: Initial prototype files from an earlier Streamlit experiment. The production system has migrated fully to the modern React 18 + FastAPI + SQLite architecture.

---

## 5. Event Bus & Inter-Page Synchronization

BuildWise maintains state synchronization across all pages without requiring page reloads using browser CustomEvents:

- **`buildwise:project-updated`**: Dispatched when a new plan is generated, selected, or modified. Listened to by `App.jsx`, `Construction.jsx`, `Materials.jsx`, and `Reports.jsx` to immediately refresh schedules, BOMs, and financial reports.
- **`buildwise:saved-plans-updated`**: Dispatched when a plan is saved, updated, or deleted from the portfolio. Listened to by `HousePlanner.jsx` and `GeneratedPlan.jsx` to update star badges and saved counts.

---

## 6. How to Run and Test BuildWise

### 1. Start Backend Server
```bash
cd /Users/narmathan/buildwise
./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
*API Swagger Docs will be available at:* `http://127.0.0.1:8000/docs`

### 2. Start Frontend Server
```bash
cd /Users/narmathan/buildwise/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
*Web Application will be available at:* `http://127.0.0.1:5173`

### 3. Run Backend Pytest Suite
```bash
cd /Users/narmathan/buildwise
./venv/bin/pytest backend/tests/ -v
```
*(All 47 tests will execute and pass in ~10 seconds)*

### 4. Build Frontend for Production
```bash
cd /Users/narmathan/buildwise/frontend
npm run build
```
*(Builds static assets into `frontend/dist/` in ~240ms with 0 errors)*
