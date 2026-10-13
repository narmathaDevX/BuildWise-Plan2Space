from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_construction_tasks_endpoints():
    # 1. Fetch current tasks
    res = client.get("/api/projects/current/tasks")
    assert res.status_code == 200
    data = res.json()
    assert data["has_project"] is True
    assert data["total_tasks"] >= 40
    assert len(data["tasks"]) > 0

    task = data["tasks"][0]
    task_id = task["id"]
    initial_completed = task["completed"]
    initial_postponed = task["postponed_count"]
    initial_day = task["day_number"]

    # 2. Toggle completion
    patch_res = client.patch(
        f"/api/projects/current/tasks/{task_id}",
        json={"completed": not initial_completed},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["completed"] is (not initial_completed)

    # Revert completion
    client.patch(
        f"/api/projects/current/tasks/{task_id}",
        json={"completed": initial_completed},
    )

    # 3. Postpone task to next day
    postpone_res = client.post(f"/api/projects/current/tasks/{task_id}/postpone")
    assert postpone_res.status_code == 200
    postponed_data = postpone_res.json()
    assert postponed_data["day_number"] == initial_day + 1
    assert postponed_data["postponed_count"] == initial_postponed + 1
    assert postponed_data["completed"] is False

    # 4. Create custom task
    create_res = client.post(
        "/api/projects/current/tasks",
        json={
            "title": "Sample test inspection by structural engineer",
            "description": "Inspect reinforcement cover blocks and column verticality",
            "day_number": 5,
            "stage_key": "foundation",
            "trade": "Structural Engineer",
            "is_critical": True,
        },
    )
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["title"] == "Sample test inspection by structural engineer"
    assert created["day_number"] == 5
