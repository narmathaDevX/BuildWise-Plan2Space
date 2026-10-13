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
