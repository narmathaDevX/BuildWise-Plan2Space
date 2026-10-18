# BuildWise: End-to-End System Functioning & Architecture Specification

> **Version:** 2.0.0 (October 2026 Commercial Release)
> **Target Audience:** Architects, Structural Engineers, Builders, Contractors, Financial Institutions, and Homeowners in Tamil Nadu, India.
> **Regulatory Foundation:** Tamil Nadu Combined Development and Building Rules (TNCDBR 2019) & Tamil Nadu PWD Schedule of Rates (SOR 2025–2026).

---

## 1. Executive Summary & Architecture Overview

BuildWise is a full-stack, enterprise-grade residential construction planning and architectural optimization platform. It automates the transition from raw homeowner requirements (plot dimensions, orientation, BHK configuration, quality tier, and budget) to verifiable, construction-feasible floor plans, statutory compliance dossiers, transparent multi-criteria plan rankings, an AI Plan Advisor (text + voice), day-to-day construction scheduling, and material procurement budgets.

### System Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                       FRONTEND (React 18 + Vite)                                  |
|                                                                                                   |
|  [HousePlanner]   [GeneratedPlan]     [Construction]       [Materials]       [Reports / Dossier]  |
|         │                │                   │                  │                     │           |
|         │         ┌──────┴─────────┐         │                  │                     │           |
|         │         │ [PlanRanking]  │         │                  │                     │           |
|         │         │ [AIAdvisor]    │         │                  │                     │           |
|         │         │ [ClientReport] │         │                  │                     │           |
|         │         │ [ShareModal]   │         │                  │                     │           |
|         │         │ [BrandingModal]│         │                  │                     │           |
|         │         └────────────────┘         │                  │                     │           |
+---------┼────────────────┼───────────────────┼──────────────────┼─────────────────────┼-----------+
          │                │                   │                  │                     │
          ▼                ▼                   ▼                  ▼                     ▼
+---------------------------------------------------------------------------------------------------+
|                                    REST & SSE API (FastAPI / Uvicorn)                             |
|                                                                                                   |
|  /api/auth/*     /api/generate     /api/assistant/*   /api/projects/*   /api/ml/status            |
|  /api/plans/*    /api/estimates/*  /api/tasks/*       /api/materials/*  /api/health               |
+---------┬────────────────┬───────────────────┬──────────────────┬─────────────────────┬-----------+
          │                │                   │                  │                     │
          ▼                ▼                   ▼                  ▼                     ▼
+---------------------------------------------------------------------------------------------------+
|                                      CORE ENGINEERING ENGINES                                     |
|                                                                                                   |
|  1. FloorPlanSolver (Pure Python Slicing & 4 Architectural Archetypes)                            |
|  2. TNCDBR-MCDA v2.0 Multi-Criteria Ranking Engine (7 Deterministic Criteria)                    |
|  3. Gemini AI Plan Advisor (Google GenAI SDK, Structured Output, Voice TTS/STT, Fallback)         |
|  4. Cost Calculation Engine (TN PWD SOR 2025-26 + Ancillaries + Largest Remainder Rounding)      |
|  5. Milestone & Cash-Burn Schedule Engine (8 Milestones + Day-by-Day Construction Tasks)          |
|  6. Statutory Compliance Engine (TNCDBR 2019 Rule 35 Setbacks, 70% Max Coverage, RWH Pits)       |
+---------┬─────────────────────────────────────────────────────────────────────────────┬-----------+
          │                                                                             │
          ▼                                                                             ▼
+-------------------------------------------------------------+ +-----------------------------------+
|               DATABASE (SQLite + SQLAlchemy 2.0)            | |      EXTERNAL SERVICES & APIS     |
|                                                             | |                                   |
|  - users (roles: homeowner, architect, contractor, branding)| |  - Google Gemini 3.1 Flash-Lite   |
|  - projects, plans, saved_plans                             | |  - Web Speech API (TTS/STT)       |
|  - ai_summaries (hash-keyed deterministic cache)            | |  - TN PWD Price Feeds             |
|  - share_links (30-day unguessable client tokens)           | |                                   |
|  - construction_tasks, materials                            | |                                   |
+-------------------------------------------------------------+ +-----------------------------------+
```

---

## 2. Core Engineering Engines & Algorithmic Models

### A. FloorPlanSolver (Pure-Python Constraint Generator)
- **Zero Black-Box Bias:** Operates without ungrounded neural hallucinations. Slices plots into structural grids, enforcing non-overlap, minimum habitable room dimensions, aspect ratios, and statutory setbacks.
- **4 Distinct Architectural Archetypes:**
  1. *Traditional Vastu Courtyard Layout:* Quadrant-zoned for maximum cardinal alignment (SE Agni kitchen, SW Niruthi master, NE Ishanya pooja).
  2. *Contemporary Open Great-Room Layout:* Merges kitchen, dining, and living into a seamless great room with private rear sleeping quarters.
  3. *Split-Wing Generational Suite Layout:* Separates master bedroom from secondary suites via central family living for optimal privacy.
  4. *Compact Urban Dual-Wing Layout:* Maximizes space utilization on narrow frontages, reducing circulation corridor wastage below 12%.
- **Architectural Detailing:** Computes exact 2D SVG coordinates with structural wall thicknesses, 90° door swings, ventilation window placements, and interior fixtures (EWC, washbasins, kitchen slabs, beds).

### B. Transparent Plan Ranking Engine (TNCDBR-MCDA v2.0)
Deterministic Weighted Multi-Criteria Decision Analysis (no LLM involved in scoring):
1. **Budget Fit (25%):** Evaluates turnkey civil + ancillary cost vs user budget. 100 score if $\le 90\%$ of budget, decreasing linearly to 0 at $130\%$. Incorporates physical monthly cash-burn feasibility.
2. **Vastu Shastra Alignment (15%):** Validates cardinal positions (Kitchen SE +35, Master Bed SW +35, Pooja NE +20, Entrance facing road +10, penalties for toilets in NE or central Brahmasthan).
3. **Ventilation & Daylight (15%):** Share of habitable rooms touching external perimeter walls with dedicated exterior windows and dual-wall cross ventilation.
4. **Space Efficiency (15%):** Usable room carpet area / total built-up footprint (82%–88% benchmark) with corridor waste penalties.
5. **Room Proportions & Sizing (10%):** Aspect ratio bounds ($1.2 \text{ to } 1.8$) ensuring functional living flow without narrow, awkward spaces.
6. **Regulatory Headroom (10%):** Margin under TNCDBR 2019 Rule 35. *Strict Rule:* Any hard non-compliance (setback intrusion or ground coverage $> 70\%$) automatically disqualifies a plan from ranking #1.
7. **Buildability & Plumbing (10%):** Evaluates regular column structural grids and clustered wet areas (bathrooms stacked or back-to-back to minimize drainage piping).
- **Tie-breaker:** Lower total turnkey cost breaks identical scores.
- **4 Weight Presets:** Balanced (default), Budget-First, Vastu-First, Comfort-First.

### C. Gemini AI Plan Advisor (`services/gemini_client.py` & `routers/assistant.py`)
- **Model:** Google Gemini (`gemini-3.1-flash-lite`, failover to `gemini-3.8-flash`, `gemini-flash-latest`).
- **Grounded DB Context Assembly:** Assembles all verified metrics directly from the DB before calling the model (never trusts client numbers): room dimensions, plot area, built-up area, coverage %, setbacks, turnkey costs, ancillary breakdown, timeline months, Vastu checklist, ventilation scores, and MCDA ranking data.
- **System Prompt Rules:**
  - Strict grounding: Answer strictly from supplied context; never invent numbers or legal clauses.
  - Indian currency format: Lakhs/Crores, ₹.
  - Dual language: English or natural Tamil (தமிழ்).
  - Audience adaptation: Homeowner (plain, intuitive language) vs Professional (architectural spans, statutory rules).
  - Statutory disclaimer: Always notes that output is preliminary planning guidance requiring licensed structural engineer certification and municipal DTCP/CMDA sanction.
- **Streaming Chat:** Server-Sent Events (SSE) streaming progressive tokens for interactive Q&A.
- **Spoken Briefing Script:** Generates a concise spoken summary for voice playback.
- **Resilience & Offline Fallback:**
  - Per-user rate limiting (20 requests/minute).
  - SQLite cache (`ai_summaries`) keyed by `(plan_id + content_hash + language + audience)`.
  - Deterministic template fallback: If the Gemini API key is missing, network is offline, or rate limits are reached, the system falls back to an audited deterministic engineering template flagged `source: "template"` so the UI never displays a dead box.

### D. Cost Calculation & Ancillaries Engine (`services/cost.py` & `ancillary.py`)
- **Data Provenance:** Tamil Nadu PWD Schedule of Rates 2025–2026.
- **Stage Breakdown (Sums to Exactly 100%):**
  - Substructure & Footings: 14%
  - Superstructure RCC Columns & Slabs: 34%
  - Solid Brick Masonry & Plastering: 18%
  - Vitrified Flooring & Wall Dadoing: 12%
  - Concealed Plumbing & Electrical: 14%
  - Weathercoat Painting & Finishing: 8%
- **Pre-Construction Ancillary Costs:**
  - 300ft Rotary Borewell + 1.5HP Submersible: ₹1,85,000
  - TNEB 3-Phase Permanent Power Service: ₹65,000
  - DTCP / CMDA Municipal Sanction Fee: ₹1,20,000
  - 8,000-Litre RCC Sump & Rainwater Harvesting Tank: ₹2,10,000
  - Compound Wall (5ft RCC) with 12ft MS Gate: ₹2,40,000
  - Total Ancillaries: ₹8,20,000

### E. Schedule Simulation & Day-by-Day Task Governance (`schedule.py` & `tasks.py`)
- **Milestone Escrow:** 8 milestones with a mandatory 5% (₹1.5L–₹2.5L) 90-day handover retention to guarantee structural integrity before final contractor settlement.
- **Day-by-Day Work Checklist:** Tracks daily tasks from Day 1 (Site Clearing) through completion. Homeowners and site supervisors can manually mark tasks completed or postpone delayed tasks to the next day.

---

## 3. Frontend Architecture & Commercial Features

### 1. Transparent Plan Ranking (`components/PlanRanking.jsx`)
- Renders gold, silver, and bronze podium cards (`#1 Recommended`, `#2 Option`, `#3 Option`).
- Displays live criteria score breakdown bars for each plan.
- Preset Switcher: Allows homeowners and builders to toggle between Balanced, Budget-First, Vastu-First, and Comfort-First.
- "Explain ranking with AI" button: Triggers Gemini to explain tradeoffs between candidate layouts with one-click voice read.
- Expandable mathematical formula panel explaining TNCDBR-MCDA v2.0 algorithms.

### 2. AI Plan Advisor (`components/AIAdvisor.jsx`)
- **Header:** Gemini badge, English | தமிழ் toggle, Homeowner | Professional toggle, and mobile collapse control.
- **Plan Summary Tab:**
  - Auto-loads structured summary with skeleton loader.
  - Headline, Overview, 4 Pillar Cards (Vastu, Ventilation, Budget, TNCDBR Rule 35).
  - Key Design Strengths (green badges) vs Practical Watchpoints (amber warnings).
  - Recommended Next Action Steps.
  - **Voice Output:** "🔊 Listen" button with Play/Pause/Resume/Stop and speed selector (0.8x–1.5x) using browser SpeechSynthesis (`en-IN` / `ta-IN`).
- **Ask About This Plan (Chat) Tab:**
  - 5 suggestion chips tailored to selected language.
  - Streaming SSE chat response with live typing effect.
  - Copy response button with visual confirmation.
  - **Voice Input:** Web Speech API microphone button with real-time speech-to-text transcript and permission error handling.
- **Disclaimer Footer:** Statutory municipal approval notice.

### 3. Client Presentation & Comparison Report (`components/ClientReportModal.jsx`)
- Client-ready presentation report viewable in-app and styled with `@media print`.
- White-label firm header (Company Name, CMDA/COA License, Phone, Email, Reference ID).
- 3-Plan MCDA Comparison Table with fitness scores, turnkey totals, and compliance status.
- Stage-by-stage civil cost breakdown and pre-construction ancillary cost table.
- 8-stage escrow milestone governance and 90-day retention terms.
- Official engineer and client signature sign-off blocks.
- One-click "Print / Save as PDF" button.

### 4. Shareable Read-Only Client Link (`components/ShareModal.jsx`)
- Generates 30-day unguessable cryptographic tokens (`/api/projects/current/share`).
- Allows clients and family members to inspect plans, room schedules, and estimates without authentication.
- URL-driven auto-load in `App.jsx` (`/?share=<token>` or `/share/<token>`).

### 5. White-Label Contractor & Architect Branding (`components/BrandingModal.jsx`)
- Enables building firms to customize client reports with their company name, registration number, phone, email, and custom legal disclaimers.
- Persisted to user profile via `PUT /api/projects/current/branding`.

---

## 4. API Endpoints Specification

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/generate` | Generates exactly 3 distinct candidate floor plans evaluated across 4 archetypes | No |
| `POST` | `/api/plans/rank` | Re-ranks plans via MCDA with requested preset | No |
| `POST` | `/api/assistant/summarize` | Returns grounded structured plan summary with fallback | Yes (JWT) |
| `POST` | `/api/assistant/chat` | Streams progressive SSE Q&A regarding the active plan | Yes (JWT) |
| `POST` | `/api/assistant/explain-ranking` | Explains tradeoffs between candidate layouts | Yes (JWT) |
| `GET` | `/api/projects/current/branding` | Fetches active user's white-label branding | Yes (JWT) |
| `PUT` | `/api/projects/current/branding` | Updates company name, license, contact, and footer | Yes (JWT) |
| `POST` | `/api/projects/current/share` | Creates 30-day unguessable public read-only link | Yes (JWT) |
| `GET` | `/api/projects/public/share/{token}` | Retrieves public shared project dossier | No |
| `GET` | `/api/health` | System health check including `ai_service` status | No |

---

## 5. Verification & Compliance Evidence

- **Pytest Suite:** 44 / 44 tests passing (`backend/tests/`).
- **Frontend Build:** 0 errors, 0 warnings under Vite production build.
- **Headless Chrome E2E Verification:** Automated CDP script executed in headless Chrome (1440x960), testing ranking presets, Gemini summary generation, Tamil toggle, streaming chat, client presentation PDF report, share link generation, and white-label branding modal.
- **Visual Artifacts:** Captured and archived in `docs/screenshots/after/`:
  - `commercial_ranking_podium.png`
  - `commercial_ranking_budget_preset.png`
  - `commercial_ai_advisor_summary.png`
  - `commercial_ai_advisor_tamil.png`
  - `commercial_ai_advisor_chat.png`
  - `commercial_client_report.png`
  - `commercial_share_modal.png`
  - `commercial_branding_modal.png`
