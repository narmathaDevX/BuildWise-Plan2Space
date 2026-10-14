import pytest
from backend.app.services.floorplan.solver import FloorPlanSolver, compute_envelope


def test_envelope_computation():
    plot = {"width": 40.0, "depth": 60.0}
    setbacks = {"front": 5.0, "rear": 3.0, "left": 3.0, "right": 3.0}

    # Road North: front at Y=0
    env_n = compute_envelope(plot, "N", setbacks)
    assert env_n.min_x == 3.0
    assert env_n.max_x == 37.0
    assert env_n.min_y == 5.0
    assert env_n.max_y == 57.0
    assert env_n.width == 34.0
    assert env_n.height == 52.0
    assert env_n.area == 34.0 * 52.0
    assert env_n.is_valid is True

    # Road South: front at Y=depth
    env_s = compute_envelope(plot, "S", setbacks)
    assert env_s.min_y == 3.0
    assert env_s.max_y == 55.0


def test_solver_determinism_and_distinct_plan_ids():
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
        ],
        "solver_options": {"num_alternatives": 3, "seed": 42},
    }

    # Determinism: same seed gives identical plan_ids
    solver1 = FloorPlanSolver(req, {"seed": 42})
    res1 = solver1.solve()
    solver2 = FloorPlanSolver(req, {"seed": 42})
    res2 = solver2.solve()

    assert len(res1["plans"]) == len(res2["plans"])
    ids1 = [p["plan_id"] for p in res1["plans"]]
    ids2 = [p["plan_id"] for p in res2["plans"]]
    assert ids1 == ids2

    # Different seeds yield different plans
    solver3 = FloorPlanSolver(req, {"seed": 999})
    res3 = solver3.solve()
    ids3 = [p["plan_id"] for p in res3["plans"]]
    assert ids1[0] != ids3[0]


def test_solver_invariants():
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
            {"id": "bed2", "type": "bedroom", "min_area": 100},
        ],
        "solver_options": {"num_alternatives": 3, "seed": 42},
    }

    solver = FloorPlanSolver(req)
    res = solver.solve()
    assert len(res["plans"]) >= 1

    env = compute_envelope(req["plot"], req["road_side"], req["setbacks"])

    for plan in res["plans"]:
        rooms = plan["floors"][0]["rooms"]
        for r in rooms:
            # 1. Inside envelope boundary
            assert r["x"] >= env.min_x - 0.1
            assert r["y"] >= env.min_y - 0.1
            assert r["x"] + r["width"] <= env.max_x + 0.1
            assert r["y"] + r["height"] <= env.max_y + 0.1
            # 2. Minimum area satisfied
            assert r["area"] >= 20.0
            # 3. Minimum width satisfied
            assert r["width"] >= 4.0
            assert r["height"] >= 4.0


def test_infeasible_request_returns_conflicts():
    req = {
        "units": "ft",
        "plot": {"width": 15.0, "depth": 20.0},
        "road_side": "N",
        "setbacks": {"front": 5.0, "rear": 3.0, "left": 3.0, "right": 3.0},
        "floors": 1,
        "rooms": [
            {"id": "living", "type": "living", "min_area": 120},
            {"id": "kitchen", "type": "kitchen", "min_area": 50},
            {"id": "master", "type": "master_bedroom", "min_area": 120},
            {"id": "bedroom_2", "type": "bedroom", "min_area": 100},
            {"id": "bedroom_3", "type": "bedroom", "min_area": 100},
        ],
    }

    solver = FloorPlanSolver(req)
    res = solver.solve()
    assert len(res["plans"]) == 0
    assert len(res["conflicts"]) >= 1
    assert "shortfall" in res["conflicts"][0]["message"].lower() or "envelope" in res["conflicts"][0]["message"].lower()


def test_syntax_validation_errors():
    with pytest.raises(ValueError, match="Plot dimensions"):
        FloorPlanSolver({"plot": {"width": 5.0, "depth": 10.0}}).validate_request_syntax()

    with pytest.raises(ValueError, match="Unsupported room type"):
        FloorPlanSolver({
            "plot": {"width": 40.0, "depth": 60.0},
            "floors": 1,
            "rooms": [{"id": "r1", "type": "swimming_pool", "min_area": 100}],
        }).validate_request_syntax()


def test_architectural_archetypes_distinct_layouts():
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
            {"id": "bed2", "type": "bedroom", "min_area": 100},
            {"id": "bath2", "type": "bathroom", "min_area": 30},
            {"id": "pooja", "type": "pooja", "min_area": 25},
            {"id": "utility", "type": "utility", "min_area": 30},
        ],
        "solver_options": {"num_alternatives": 3, "seed": 42},
    }

    # Generate initial alternatives with seed 42
    res1 = FloorPlanSolver(req, {"seed": 42}).solve()
    assert len(res1["plans"]) == 3

    # Generate next alternative with seed 43 (simulating "Generate another option")
    res2 = FloorPlanSolver(req, {"seed": 43}).solve()
    assert len(res2["plans"]) == 3

    # All plans in res1 have distinct plan_ids and titles
    plan_names = [p["name"] for p in res1["plans"]]
    assert len(set(plan_names)) == len(plan_names)

    # Cross-check that plans feature archetype names
    for p in res1["plans"] + res2["plans"]:
        assert any(keyword in p["name"] for keyword in ["Vastu", "Great-Room", "Generational", "Breezeway"])


def test_user_reported_floorplan_requirements_3baths_balcony_kitchen():
    """Verify that when user requests 3 bathrooms and balcony on a 1-floor plan:

    1. Exactly 3 bathrooms are placed in every plan (none dropped).
    2. Balcony (Front Balcony / Sit-Out) is placed on Floor 0.
    3. Kitchen is spacious and practical (> 120 sq ft).
    4. Bathrooms have realistic dimensions (width & height <= 10 ft).
    """
    req = {
        "units": "ft",
        "plot": {"width": 50.0, "depth": 60.0},
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
            {"id": "bathroom_2", "type": "bathroom", "min_area": 30},
            {"id": "parking", "type": "parking", "min_area": 150},
            {"id": "balcony", "type": "balcony", "min_area": 50},
            {"id": "utility", "type": "utility", "min_area": 30},
        ],
        "solver_options": {"num_alternatives": 3, "seed": 42},
    }

    solver = FloorPlanSolver(req, {"seed": 42})
    res = solver.solve()
    assert len(res["plans"]) == 3

    for plan in res["plans"]:
        floor0_rooms = plan["floors"][0]["rooms"]
        room_types = [r["type"] for r in floor0_rooms]

        # 1. Exactly 3 bathrooms must be present
        bathrooms = [r for r in floor0_rooms if "bath" in r["type"]]
        assert len(bathrooms) == 3, f"Expected 3 bathrooms in {plan['name']}, got {len(bathrooms)}"

        # 2. Balcony must be present on Floor 0
        balconies = [r for r in floor0_rooms if r["type"] == "balcony"]
        assert len(balconies) >= 1, f"Expected balcony in {plan['name']}, got {len(balconies)}"

        # 3. Kitchen must be practical and spacious (> 120 sq ft)
        kitchen = next(r for r in floor0_rooms if r["type"] == "kitchen")
        assert kitchen["area"] >= 120.0, f"Kitchen in {plan['name']} was too small: {kitchen['area']} sq ft"

        # 4. Bathrooms must NOT be bowling alleys (dimensions <= 10 ft)
        for b in bathrooms:
            assert b["width"] <= 10.0 and b["height"] <= 10.0, f"Bathroom {b['name']} in {plan['name']} had unrealistic dimension: {b['width']}x{b['height']}"

