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


def test_multi_floor_duplex_3bed_3bath_user_requirements():
    """Verify that when user requests 3 bedrooms, 3 bathrooms, and 2 floors (G+1):

    1. Candidate plans have 2 distinct floor levels (0 and 1).
    2. Ground floor has 1 bedroom (Master Suite) and 1 bathroom (Master Attached Bath).
    3. Upper floor has 2 bedrooms (Bedroom 2, Bedroom 3) and 2 bathrooms (Attached Bath 2, Attached Bath 3).
    4. Total bedrooms across all floors = 3 (none dropped, dressing suites not counted as beds).
    5. Total bathrooms across all floors = 3 (none dropped).
    6. Both floors include a Staircase Core for vertical circulation.
    """
    req = {
        "units": "ft",
        "plot": {"width": 50.0, "depth": 60.0},
        "road_side": "N",
        "setbacks": {"front": 5.0, "rear": 3.0, "left": 3.0, "right": 3.0},
        "floors": 2,
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
        floors = plan["floors"]
        assert len(floors) == 2, f"Expected 2 floors, got {len(floors)}"

        fl0_rooms = floors[0]["rooms"]
        fl1_rooms = floors[1]["rooms"]

        # Ground floor checks
        fl0_beds = [r for r in fl0_rooms if r["type"] in ("bedroom", "master_bedroom")]
        fl0_baths = [r for r in fl0_rooms if "bath" in r["type"]]
        assert len(fl0_beds) == 1, f"Expected 1 bed on ground floor, got {len(fl0_beds)}"
        assert len(fl0_baths) == 1, f"Expected 1 bath on ground floor, got {len(fl0_baths)}"

        # Upper floor checks
        fl1_beds = [r for r in fl1_rooms if r["type"] in ("bedroom", "master_bedroom")]
        fl1_baths = [r for r in fl1_rooms if "bath" in r["type"]]
        assert len(fl1_beds) == 2, f"Expected 2 beds on upper floor, got {len(fl1_beds)}"
        assert len(fl1_baths) == 2, f"Expected 2 baths on upper floor, got {len(fl1_baths)}"

        # Total across house
        all_rooms = fl0_rooms + fl1_rooms
        total_beds = [r for r in all_rooms if r["type"] in ("bedroom", "master_bedroom")]
        total_baths = [r for r in all_rooms if "bath" in r["type"]]
        assert len(total_beds) == 3, f"Expected exactly 3 bedrooms total, got {len(total_beds)}"
        assert len(total_baths) == 3, f"Expected exactly 3 bathrooms total, got {len(total_baths)}"

        # Staircase core present on both levels
        assert any(r["type"] == "staircase" for r in fl0_rooms), "Staircase missing on ground floor"
        assert any(r["type"] == "staircase" for r in fl1_rooms), "Staircase missing on upper floor"
