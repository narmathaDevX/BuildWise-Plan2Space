# BuildWise Backend

Python FastAPI backend for BuildWise residential construction planning in Tamil Nadu, India.

---

## 1. Quickstart & Installation

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
- `DATABASE_URL`: `sqlite:///./buildwise.db` (auto-created on startup)
- `AUTH_REQUIRED`: `false` (guest default user mode enabled so existing UI works without login screens)
- `CORS_ORIGINS`: `["http://localhost:5173", "http://127.0.0.1:5173"]`

### Running the Server
```bash
uvicorn backend.app.main:app --reload --port 8000
```
OpenAPI documentation is available at:
`http://127.0.0.1:8000/docs`

### Running Tests
```bash
pytest backend/tests -v
```

---

## 2. Architecture & Modules

```
backend/
  app/
    main.py              # FastAPI app with CORS and custom 422 string error handler
    config.py            # Pydantic Settings (.env configuration)
    db/
      models.py          # SQLAlchemy ORM models (users, projects, plans, estimates, materials)
      session.py         # Database engine and session dependency
      init_db.py         # Table creation and idempotent initial seed
    services/
      floorplan/solver.py # Constraint-based geometric solver (BSP/slicing)
      cost.py            # Plinth-area rate formula with largest-remainder rounding
      schedule.py        # Month-by-month financial burn and progress simulation
      materials.py       # Thumb-rule bill-of-quantities calculator
      affordability.py   # Step 3 fast live affordability estimator
      auth.py            # Bcrypt hashing and JWT tokens
    routers/
      auth.py            # /api/auth/register, /api/auth/login, /api/auth/me
      plans.py           # POST /api/generate
      estimates.py       # /api/estimate/affordability, cost, schedule
      projects.py        # /api/projects/current/... (summary, construction, report)
      materials.py       # /api/projects/current/materials
      ml.py              # /api/ml/status
    data/
      rates.json         # CPWD & TN PWD specification benchmarks
      locations.json     # Tamil Nadu district multipliers
      materials.json     # IS 456 thumb rules and unit rates
      stages.json        # 7 construction stage milestones and dependency rules
```

---

## 3. Disclosures & Engineering Notes
- **Floor Plan Engine:** Constraint-based algorithmic solver (not machine learning). Guaranteed non-overlapping rooms, setback envelope containment, and deterministic reproducibility.
- **Cost Estimation:** Transparent civil engineering formula based on CPWD and Tamil Nadu PWD schedules of rates.
- **Authentication:** Full backend JWT/bcrypt auth is implemented. Set `AUTH_REQUIRED=true` to enforce tokens. Login UI is omitted on frontend to preserve existing interface.
- **Unused Legacy Files:** The six `pages/*.py` root stubs are leftover Streamlit files from earlier experimentation and are unused.
