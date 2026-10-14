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
    created_id = created["id"]
    assert created["title"] == "Sample test inspection by structural engineer"
    assert created["day_number"] == 5

    # 5. Edit task (PUT)
    edit_res = client.put(
        f"/api/projects/current/tasks/{created_id}",
        json={
            "title": "Updated Engineer Inspection",
            "description": "Updated notes on cover blocks",
            "trade": "Lead Structural Consultant",
            "day_number": 6,
            "is_critical": False,
        },
    )
    assert edit_res.status_code == 200
    edited = edit_res.json()
    assert edited["title"] == "Updated Engineer Inspection"
    assert edited["trade"] == "Lead Structural Consultant"
    assert edited["day_number"] == 6

    # 6. Delete task (DELETE)
    del_res = client.delete(f"/api/projects/current/tasks/{created_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # 7. Regenerate tasks (POST /regenerate)
    regen_res = client.post("/api/projects/current/tasks/regenerate")
    assert regen_res.status_code == 200
    assert regen_res.json()["status"] == "regenerated"
    assert regen_res.json()["total_tasks"] >= 30
