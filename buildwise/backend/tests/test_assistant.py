"""Tests for BuildWise AI Plan Advisor Router and Gemini Client."""

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.gemini_client import (
    deterministic_template_summary,
    explain_plan_ranking,
    compute_plan_content_hash,
)

client = TestClient(app)

SAMPLE_PLAN = {
    "plan_id": "test_plan_001",
    "name": "Layout A: Traditional Vastu Courtyard",
    "score": 91.5,
    "built_up_area": 1820.0,
    "details": {"ground_built_up": 1820.0, "total_built_up": 1820.0},
    "rooms": [
        {"id": "living", "name": "Formal Living", "type": "living", "width": 16.0, "height": 14.0, "x": 0, "y": 0, "area": 224.0},
        {"id": "kitchen", "name": "Agni Kitchen", "type": "kitchen", "width": 12.0, "height": 11.0, "x": 24, "y": 30, "area": 132.0},
        {"id": "master", "name": "Master Suite", "type": "master_bedroom", "width": 14.0, "height": 14.0, "x": 0, "y": 30, "area": 196.0},
    ],
}

SAMPLE_FORM = {
    "width": 40.0,
    "length": 60.0,
    "facing": "North",
    "budget": 3800000.0,
    "quality": "Standard",
    "location": "Tamil Nadu",
}


def test_deterministic_template_summary_en():
    ctx = {
        "plan_name": SAMPLE_PLAN["name"],
        "plot_width": 40.0,
        "plot_depth": 60.0,
        "facing": "North",
        "built_up_area": 1820.0,
        "total_cost": 3950000.0,
        "budget": 3800000.0,
        "rooms": SAMPLE_PLAN["rooms"],
        "score": 91.5,
        "ground_coverage_pct": 65.0,
    }
    summary = deterministic_template_summary(ctx, language="en", audience="homeowner")

    assert summary["source"] == "template"
    assert "headline" in summary
    assert "overview" in summary
    assert len(summary["strengths"]) >= 3
    assert "spoken_script" in summary
    assert "disclaimer" in summary
    assert "₹39.50 Lakhs" in summary["spoken_script"] or "39.50" in summary["spoken_script"]


def test_deterministic_template_summary_ta():
    ctx = {
        "plan_name": SAMPLE_PLAN["name"],
        "plot_width": 40.0,
        "plot_depth": 60.0,
        "facing": "North",
        "built_up_area": 1820.0,
        "total_cost": 3950000.0,
        "budget": 3800000.0,
        "rooms": SAMPLE_PLAN["rooms"],
        "score": 91.5,
        "ground_coverage_pct": 65.0,
    }
    summary = deterministic_template_summary(ctx, language="ta", audience="homeowner")

    assert summary["source"] == "template"
    assert "சதுர அடி" in summary["overview"]
    assert "வாஸ்து" in summary["vastu_notes"]
    assert "வணக்கம்" in summary["spoken_script"]


def test_api_assistant_summarize():
    res = client.post(
        "/api/assistant/summarize",
        json={
            "plan_id": "test_plan_001",
            "language": "en",
            "audience": "homeowner",
            "plan_data": SAMPLE_PLAN,
            "form_data": SAMPLE_FORM,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "headline" in data
    assert "strengths" in data
    assert "spoken_script" in data
    assert data["source"] in ("gemini", "template")


def test_api_assistant_chat_streaming():
    res = client.post(
        "/api/assistant/chat",
        json={
            "plan_id": "test_plan_001",
            "message": "Why is the kitchen in the south-east?",
            "language": "en",
            "plan_data": SAMPLE_PLAN,
            "form_data": SAMPLE_FORM,
        },
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    content = res.text
    assert "data:" in content
    assert "[DONE]" in content


def test_api_assistant_explain_ranking():
    res = client.post(
        "/api/assistant/explain-ranking",
        json={
            "plans": [SAMPLE_PLAN],
            "form": SAMPLE_FORM,
            "language": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "explanation" in data
    assert "spoken_script" in data


def test_api_assistant_walkthrough():
    res = client.post(
        "/api/assistant/walkthrough",
        json={
            "plan_id": "test_plan_001",
            "language": "en",
            "plan_data": SAMPLE_PLAN,
            "form_data": SAMPLE_FORM,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "walkthrough" in data
    wt = data["walkthrough"]
    assert "headline" in wt
    assert "walkthrough_steps" in wt
    assert len(wt["walkthrough_steps"]) >= 3
    assert "spoken_script" in wt


def test_api_assistant_modify_plan():
    res = client.post(
        "/api/assistant/modify-plan",
        json={
            "instruction": "Add a pooja room and make it a duplex with 2 floors",
            "current_form": {
                "width": 40.0,
                "length": 60.0,
                "facing": "North",
                "bedrooms": 3,
                "bathrooms": 2,
                "floors": 1,
                "pooja": False,
                "budget": 4000000.0,
            },
            "language": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "updated_form" in data
    assert data["updated_form"]["pooja"] is True
    assert data["updated_form"]["floors"] == 2
    assert "plans" in data
    assert len(data["plans"]) >= 1
