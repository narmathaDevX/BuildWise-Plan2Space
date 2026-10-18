"""Unit and integration tests for BuildWise MCDA Plan Ranking Engine."""

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.ranking import (
    RANKING_CONFIG,
    rank_plans,
    score_budget_fit,
    score_vastu,
    score_ventilation_daylight,
    score_space_efficiency,
    score_room_proportions,
    score_regulatory_margin,
    score_buildability_plumbing,
)

client = TestClient(app)


def test_ranking_weights_sum_to_100():
    for preset_name, weights in RANKING_CONFIG["presets"].items():
        total_weight = sum(weights.values())
        assert total_weight == 100, f"Preset {preset_name} weights sum to {total_weight}, expected 100"


def test_score_budget_fit_thresholds():
    # <= 90% of budget -> 100
    s1, exp1 = score_budget_fit(total_cost=2700000.0, budget=3000000.0)
    assert s1 == 100.0

    # 100% of budget -> 85
    s2, exp2 = score_budget_fit(total_cost=3000000.0, budget=3000000.0)
    assert s2 == 85.0

    # Over budget 120%
    s3, exp3 = score_budget_fit(total_cost=3600000.0, budget=3000000.0)
    assert 0.0 < s3 < 85.0

    # Severe overrun > 130%
    s4, exp4 = score_budget_fit(total_cost=4500000.0, budget=3000000.0)
    assert s4 == 0.0


def test_score_regulatory_margin_and_hard_non_compliant_rule():
    # Compliant case
    comp_ok = {
        "is_compliant": True,
        "stats": {"ground_coverage_pct": 62.0, "max_allowed_coverage_pct": 70.0},
    }
    s_ok, exp_ok, hard_ok = score_regulatory_margin(comp_ok)
    assert s_ok >= 90.0
    assert hard_ok is True

    # Non-compliant case
    comp_fail = {
        "is_compliant": False,
        "stats": {"ground_coverage_pct": 74.0, "max_allowed_coverage_pct": 70.0},
    }
    s_fail, exp_fail, hard_fail = score_regulatory_margin(comp_fail)
    assert s_fail <= 40.0
    assert hard_fail is False


def test_non_compliant_plan_cannot_be_rank_1():
    plan_a = {
        "plan_id": "plan_compliant_a",
        "name": "Layout A",
        "score": 85.0,
        "built_up_area": 1600.0,
        "details": {"ground_built_up": 1600.0, "total_built_up": 1600.0},
        "rooms": [
            {"id": "living", "type": "living", "width": 16.0, "height": 14.0, "x": 0, "y": 0},
            {"id": "kitchen", "type": "kitchen", "width": 12.0, "height": 10.0, "x": 20, "y": 30},
            {"id": "master", "type": "master_bedroom", "width": 14.0, "height": 14.0, "x": 0, "y": 30},
        ],
    }

    # Plan B has huge built up violating 70% coverage on a 2400 sq ft plot
    plan_b = {
        "plan_id": "plan_non_compliant_b",
        "name": "Layout B",
        "score": 99.0,  # artificially high score
        "built_up_area": 2200.0,
        "details": {"ground_built_up": 2200.0, "total_built_up": 2200.0},  # 2200/2400 = 91.6% > 70%
        "rooms": [
            {"id": "living", "type": "living", "width": 20.0, "height": 20.0, "x": 0, "y": 0},
            {"id": "kitchen", "type": "kitchen", "width": 14.0, "height": 14.0, "x": 20, "y": 30},
        ],
    }

    form_ctx = {
        "width": 40.0,
        "length": 60.0,  # plot area = 2400
        "budget": 5000000.0,
        "quality": "Standard",
        "location": "Tamil Nadu",
        "floors": 1,
    }

    ranked = rank_plans([plan_b, plan_a], form_context=form_ctx, preset="Balanced")
    # Even though plan_b had higher raw score, it failed statutory compliance and cannot be #1
    assert ranked[0]["plan_id"] == "plan_compliant_a"
    assert ranked[0]["rank"] == 1
    assert ranked[1]["plan_id"] == "plan_non_compliant_b"
    assert ranked[1]["rank"] == 2


def test_ranking_preset_reordering():
    plan_cheap = {
        "plan_id": "plan_cheap",
        "name": "Budget Saver",
        "built_up_area": 1400.0,
        "details": {"ground_built_up": 1400.0},
        "rooms": [{"id": "living", "type": "living", "width": 12.0, "height": 12.0, "x": 0, "y": 0}],
    }
    plan_vastu = {
        "plan_id": "plan_vastu",
        "name": "Vastu Haven",
        "built_up_area": 1900.0,
        "details": {"ground_built_up": 1900.0},
        "rooms": [
            {"id": "kitchen", "type": "kitchen", "width": 14.0, "height": 12.0, "x": 25.0, "y": 35.0},
            {"id": "master", "type": "master_bedroom", "width": 15.0, "height": 14.0, "x": 2.0, "y": 35.0},
            {"id": "pooja", "type": "pooja", "width": 8.0, "height": 8.0, "x": 25.0, "y": 2.0},
        ],
    }

    form_ctx = {"width": 40.0, "length": 60.0, "budget": 3000000.0}

    # Under Budget-First preset, plan_cheap should score higher on budget_fit
    ranked_budget = rank_plans([plan_cheap, plan_vastu], form_context=form_ctx, preset="Budget-First")
    assert ranked_budget[0]["plan_id"] == "plan_cheap"

    # Under Vastu-First preset, plan_vastu should achieve highest rank
    ranked_vastu = rank_plans([plan_cheap, plan_vastu], form_context=form_ctx, preset="Vastu-First")
    assert ranked_vastu[0]["plan_id"] == "plan_vastu"


def test_api_plans_rank_endpoint():
    res = client.post(
        "/api/plans/rank",
        json={
            "preset": "Comfort-First",
            "form": {"width": 40.0, "length": 60.0, "budget": 4000000.0},
            "plans": [
                {
                    "plan_id": "p1",
                    "name": "Option 1",
                    "built_up_area": 1700.0,
                    "details": {"ground_built_up": 1700.0},
                    "rooms": [{"id": "living", "type": "living", "width": 15.0, "height": 15.0, "x": 0, "y": 0}],
                }
            ],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["preset"] == "Comfort-First"
    assert "ranking" in data
    assert len(data["ranking"]) == 1
    assert data["ranking"][0]["rank"] == 1
