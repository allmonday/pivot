import pytest


@pytest.mark.asyncio
async def test_create_and_get_folders(client):
    resp = await client.post("/api/folders", json={
        "name": "Folder A",
        "folder_path": "/tmp/a",
        "task_names": [],
    })
    assert resp.status_code == 201
    folder = resp.json()
    assert folder["name"] == "Folder A"
    assert folder["folder_path"] == "/tmp/a"
    folder_id = folder["id"]

    resp = await client.get("/api/folders")
    assert resp.status_code == 200
    folders = resp.json()
    assert any(f["id"] == folder_id for f in folders)


@pytest.mark.asyncio
async def test_create_folder_with_tasks(client):
    resp = await client.post("/api/folders", json={
        "name": "Folder",
        "folder_path": "/tmp/b",
        "task_names": ["Task 1", "Task 2"],
    })
    assert resp.status_code == 201
    folder_id = resp.json()["id"]

    resp = await client.get(f"/api/tasks?folder_id={folder_id}")
    tasks = resp.json()
    assert len(tasks) == 2
    names = {t["name"] for t in tasks}
    assert names == {"Task 1", "Task 2"}


@pytest.mark.asyncio
async def test_delete_folder(client):
    resp = await client.post("/api/folders", json={
        "name": "ToDelete",
        "folder_path": "/tmp/c",
        "task_names": ["Orphan Task"],
    })
    folder_id = resp.json()["id"]

    resp = await client.delete(f"/api/folders/{folder_id}")
    assert resp.status_code == 204

    # Verify tasks are also deleted (cascade)
    resp = await client.get("/api/tasks")
    assert not any(t["folder_id"] == folder_id for t in resp.json())


@pytest.mark.asyncio
async def test_delete_nonexistent_folder(client):
    resp = await client.delete("/api/folders/nonexistent")
    assert resp.status_code == 404
