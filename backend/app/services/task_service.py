import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import task_repo
from ..schemas.models import Task
from .history import extract_plain_text, get_history
from .summarizer import summarize_text


def _to_schema(t) -> Task:
    return Task(id=t.id, name=t.name, folder_id=t.folder_id, summary=t.summary)


async def get_tasks(db: AsyncSession, folder_id: str | None = None) -> list[Task]:
    tasks = await task_repo.get_all(db, folder_id=folder_id)
    return [_to_schema(t) for t in tasks]


async def create_task(db: AsyncSession, name: str, folder_id: str) -> Task:
    task = await task_repo.create(db, task_id=str(uuid.uuid4()), name=name, folder_id=folder_id)
    return _to_schema(task)


async def update_task(db: AsyncSession, task_id: str, name: str | None) -> Task:
    task = await task_repo.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if name is not None:
        task = await task_repo.update_name(db, task, name)
    return _to_schema(task)


async def delete_task(db: AsyncSession, task_id: str) -> None:
    task = await task_repo.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await task_repo.delete(db, task)


async def summarize_task(db: AsyncSession, task_id: str) -> dict:
    task = await task_repo.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    messages = await get_history(db, task_id)
    if not messages:
        raise HTTPException(status_code=400, detail="No conversation history found")

    plain_text = extract_plain_text(messages)
    summary = await summarize_text(plain_text)
    if summary:
        await task_repo.update_summary(db, task, summary)
    return {"summary": summary}
