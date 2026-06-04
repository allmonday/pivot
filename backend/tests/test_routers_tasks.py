import pytest


@pytest.mark.asyncio
async def test_create_and_get_task(client):
    # Create a folder first
    resp = await client.post("/api/folders", json={
        "name": "Test Folder",
        "folder_path": "/tmp/test",
        "task_names": [],
    })
    assert resp.status_code == 201
    folder_id = resp.json()["id"]

    # Create a task
    resp = await client.post("/api/tasks", json={
        "name": "Test Task",
        "folder_id": folder_id,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Task"
    assert data["folder_id"] == folder_id
    task_id = data["id"]

    # Get all tasks
    resp = await client.get("/api/tasks")
    assert resp.status_code == 200
    tasks = resp.json()
    assert any(t["id"] == task_id for t in tasks)

    # Get tasks by folder
    resp = await client.get(f"/api/tasks?folder_id={folder_id}")
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id


@pytest.mark.asyncio
async def test_update_task(client):
    resp = await client.post("/api/folders", json={
        "name": "Folder",
        "folder_path": "/tmp",
        "task_names": [],
    })
    folder_id = resp.json()["id"]

    resp = await client.post("/api/tasks", json={
        "name": "Original",
        "folder_id": folder_id,
    })
    task_id = resp.json()["id"]

    resp = await client.put(f"/api/tasks/{task_id}", json={"name": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


@pytest.mark.asyncio
async def test_delete_task(client):
    resp = await client.post("/api/folders", json={
        "name": "Folder",
        "folder_path": "/tmp",
        "task_names": [],
    })
    folder_id = resp.json()["id"]

    resp = await client.post("/api/tasks", json={
        "name": "ToDelete",
        "folder_id": folder_id,
    })
    task_id = resp.json()["id"]

    resp = await client.delete(f"/api/tasks/{task_id}")
    assert resp.status_code == 204

    resp = await client.get("/api/tasks")
    assert not any(t["id"] == task_id for t in resp.json())


@pytest.mark.asyncio
async def test_update_nonexistent_task(client):
    resp = await client.put("/api/tasks/nonexistent", json={"name": "X"})
    assert resp.status_code == 404
