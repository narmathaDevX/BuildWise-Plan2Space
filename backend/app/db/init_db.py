import json
from datetime import date
from sqlalchemy.orm import Session

from backend.app.db.models import ConstructionTask, Estimate, Material, PlanModel, Project, SavedPlan, User
from backend.app.db.session import Base, SessionLocal, engine
from backend.app.services.auth import hash_password
from backend.app.services.cost import calculate_cost
from backend.app.services.daily_tasks import generate_default_daily_tasks
from backend.app.services.floorplan.solver import FloorPlanSolver
from backend.app.services.materials import calculate_default_materials
from backend.app.services.schedule import simulate_schedule

DEFAULT_USER_EMAIL = "guest@buildwise.local"
DEFAULT_USER_ID = "usr_guest_local"


def init_db(db: Session | None = None) -> None:
    Base.metadata.create_all(bind=engine)

    owns_session = False
    if db is None:
        db = SessionLocal()
        owns_session = True

    try:
        user = db.query(User).filter(User.email == DEFAULT_USER_EMAIL).first()
        if not user:
            user = User(
                id=DEFAULT_USER_ID,
                email=DEFAULT_USER_EMAIL,
                hashed_password=hash_password("buildwise_guest_pass_2026"),
                name="Narmathan",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Check for default project
        project = db.query(Project).filter(Project.user_id == user.id).first()
        if not project:
            default_form = {
                "width": 40,
                "length": 60,
                "facing": "North",
                "location": "Tamil Nadu",
                "bedrooms": 3,
                "bathrooms": 2,
                "floors": 1,
                "parking": True,
                "balcony": True,
                "pooja": False,
                "utility": True,
                "budget": 3500000,
                "monthlyBudget": 300000,
                "quality": "Standard",
            }

            req = {
                "units": "ft",
                "plot": {"width": 40.0, "depth": 60.0},
                "road_side": "N",
                "setbacks": {"front": 5.0, "rear": 3.0, "left": 3.0, "right": 3.0},
                "floors": 1,
                "rooms": [
                    {"id": "living", "type": "living", "min_area": 120},
                    {"id": "kitchen", "type": "kitchen", "min_area": 50},
                    {"id": "dining", "type": "dining", "min_area": 70},
                    {"id": "master", "type": "master_bedroom", "min_area": 120},
                    {"id": "master_bath", "type": "attached_bathroom", "min_area": 30, "attached_to": "master"},
                    {"id": "bedroom_2", "type": "bedroom", "min_area": 100},
                    {"id": "bedroom_3", "type": "bedroom", "min_area": 100},
                    {"id": "bathroom_1", "type": "bathroom", "min_area": 30},
                    {"id": "utility", "type": "utility", "min_area": 30},
                ],
                "solver_options": {"num_alternatives": 3, "seed": 42},
            }

            solver = FloorPlanSolver(req)
            gen_res = solver.solve()
            plans_list = gen_res.get("plans", [])
            selected_id = plans_list[0]["plan_id"] if plans_list else None

            # Built-up area and costs
            built_up = 1850.0
            cost_res = calculate_cost(
                total_built_up_area=built_up,
                quality="Standard",
                location="Tamil Nadu",
                floors=1,
                plot_area=2400.0,
                budget=3500000.0,
            )
            total_c = cost_res["total_cost"]

            sched_res = simulate_schedule(
                total_cost=total_c,
                monthly_budget=300000.0,
                breakdown=cost_res["breakdown"],
                quality="Standard",
                floors=1,
                built_up_area=built_up,
            )

            project = Project(
                id="proj_default_dream_home",
                user_id=user.id,
                name="My Dream Home",
                location="Tamil Nadu",
                form_json=json.dumps(default_form),
                selected_plan_id=selected_id,
                construction_start_date=sched_res["start_date"],
                current_month=2,  # Month 2 gives ~18% progress matching default UI
                status="Planning",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            # Persist plans
            for p in plans_list:
                db_plan = PlanModel(
                    project_id=project.id,
                    plan_id=p["plan_id"],
                    seed=42,
                    plan_json=json.dumps(p),
                    score=p.get("score", 90.0),
                )
                db.add(db_plan)

            # Persist estimates
            estimate = Estimate(
                project_id=project.id,
                plan_id=selected_id,
                cost_json=json.dumps(cost_res),
                schedule_json=json.dumps(sched_res),
            )
            db.add(estimate)

            # Persist default materials
            mat_defaults = calculate_default_materials(built_up)
            for m in mat_defaults:
                db_mat = Material(
                    project_id=project.id,
                    key=m["key"],
                    name=m["name"],
                    category=m["category"],
                    quantity=m["quantity"],
                    unit=m["unit"],
                    rate=m["rate"],
                    purchased=m["purchased"],
                    is_custom=False,
                )
                db.add(db_mat)

            # Persist default daily site tasks
            tasks_list = generate_default_daily_tasks()
            for t in tasks_list:
                db_task = ConstructionTask(
                    project_id=project.id,
                    stage_key=t["stage_key"],
                    day_number=t["day_number"],
                    title=t["title"],
                    description=t.get("description", ""),
                    trade=t.get("trade", "General Masonry"),
                    completed=t.get("completed", False),
                    is_critical=t.get("is_critical", False),
                    postponed_count=0,
                )
                db.add(db_task)

            db.commit()
        else:
            # Upgrade existing project materials if fewer than 15 items exist
            existing_mat_count = db.query(Material).filter(Material.project_id == project.id).count()
            if existing_mat_count < 15:
                # Keep purchased flags of existing items
                existing_purchased = {m.key: m.purchased for m in db.query(Material).filter(Material.project_id == project.id).all()}
                db.query(Material).filter(Material.project_id == project.id, Material.is_custom == False).delete()  # noqa: E712
                mat_defaults = calculate_default_materials(1850.0)
                for m in mat_defaults:
                    db.add(
                        Material(
                            project_id=project.id,
                            key=m["key"],
                            name=m["name"],
                            category=m["category"],
                            quantity=m["quantity"],
                            unit=m["unit"],
                            rate=m["rate"],
                            purchased=existing_purchased.get(m["key"], m["purchased"]),
                            is_custom=False,
                        )
                    )
                db.commit()

            # Seed tasks if none exist
            existing_task_count = db.query(ConstructionTask).filter(ConstructionTask.project_id == project.id).count()
            if existing_task_count == 0:
                tasks_list = generate_default_daily_tasks()
                for t in tasks_list:
                    db.add(
                        ConstructionTask(
                            project_id=project.id,
                            stage_key=t["stage_key"],
                            day_number=t["day_number"],
                            title=t["title"],
                            description=t.get("description", ""),
                            trade=t.get("trade", "General Masonry"),
                            completed=t.get("completed", False),
                            is_critical=t.get("is_critical", False),
                            postponed_count=0,
                        )
                    )
                db.commit()

        # Seed realistic saved plans for user portfolio if none exist
        if db.query(SavedPlan).filter(SavedPlan.user_id == user.id).count() == 0:
            default_form = {
                "width": 40,
                "length": 60,
                "facing": "North",
                "location": "Tamil Nadu",
                "bedrooms": 3,
                "bathrooms": 2,
                "floors": 1,
                "parking": True,
                "balcony": True,
                "pooja": False,
                "utility": True,
                "budget": 3500000,
                "monthlyBudget": 300000,
                "quality": "Standard",
            }
            req1 = {
                "units": "ft",
                "plot": {"width": 40.0, "depth": 60.0},
                "road_side": "N",
                "setbacks": {"front": 5.0, "rear": 3.0, "left": 3.0, "right": 3.0},
                "floors": 1,
                "rooms": [
                    {"id": "living", "type": "living", "min_area": 120},
                    {"id": "kitchen", "type": "kitchen", "min_area": 50},
                    {"id": "dining", "type": "dining", "min_area": 70},
                    {"id": "master", "type": "master_bedroom", "min_area": 120},
                    {"id": "master_bath", "type": "attached_bathroom", "min_area": 30, "attached_to": "master"},
                    {"id": "bedroom_2", "type": "bedroom", "min_area": 100},
                    {"id": "bedroom_3", "type": "bedroom", "min_area": 100},
                    {"id": "bathroom_1", "type": "bathroom", "min_area": 30},
                    {"id": "utility", "type": "utility", "min_area": 30},
                ],
                "solver_options": {"num_alternatives": 2, "seed": 42},
            }
            try:
                solver1 = FloorPlanSolver(req1)
                res1 = solver1.solve()
                plans1 = res1.get("plans", [])
                if plans1:
                    p1 = plans1[0]
                    db.add(
                        SavedPlan(
                            user_id=user.id,
                            project_id=project.id if project else None,
                            plan_id=p1.get("plan_id", "plan_north_3bhk_opt1"),
                            title="Layout A: Split Wing Generational Suite",
                            notes="Senior-friendly ground floor bedroom with attached bath; large east-facing kitchen and open verandah sit-out.",
                            plan_json=json.dumps(p1),
                            form_json=json.dumps(default_form),
                            plot_width=40.0,
                            plot_length=60.0,
                            built_up_area=1856.0,
                            estimated_cost=4085000.0,
                            score=89.3,
                            facing="North",
                            bedrooms=3,
                            bathrooms=2,
                            floors=1,
                            quality="Standard",
                        )
                    )

                # Second plan: East facing 3BHK with Vastu alignment
                form_east = dict(default_form, facing="East", bathrooms=3)
                req2 = dict(req1, road_side="E")
                req2["rooms"] = list(req1["rooms"]) + [{"id": "bathroom_2", "type": "bathroom", "min_area": 30}]
                solver2 = FloorPlanSolver(req2, {"seed": 108})
                res2 = solver2.solve()
                plans2 = res2.get("plans", [])
                if plans2:
                    p2 = plans2[0]
                    db.add(
                        SavedPlan(
                            user_id=user.id,
                            project_id=project.id if project else None,
                            plan_id=p2.get("plan_id", "plan_east_3bhk_vastu"),
                            title="Layout B: Traditional Vastu Courtyard Flow",
                            notes="Strict Vastu compliance: Southeast Agni kitchen with utility, Southwest master suite, and northeast entrance verandah.",
                            plan_json=json.dumps(p2),
                            form_json=json.dumps(form_east),
                            plot_width=40.0,
                            plot_length=60.0,
                            built_up_area=1820.0,
                            estimated_cost=3950000.0,
                            score=91.5,
                            facing="East",
                            bedrooms=3,
                            bathrooms=3,
                            floors=1,
                            quality="Standard",
                        )
                    )
                db.commit()
            except Exception as e:
                print(f"Warning: Failed to seed saved plans: {e}")
                db.rollback()

    finally:
        if owns_session:
            db.close()
