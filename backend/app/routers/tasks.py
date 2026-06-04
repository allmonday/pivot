import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import TaskORM
from ..schemas.models import Task, TaskCreate, TaskUpdate
from ..services.client_manager import client_manager
from ..services.history import get_history, extract_plain_text
from ..services.summarizer import summarize_text

router = APIRouter(prefix="/api")


def _task_from_orm(t: TaskORM) -> Task:
    return Task(id=t.id, name=t.name, folder_id=t.folder_id, summary=t.summary)


@router.get("/tasks", response_model=list[Task])
async def get_tasks(
    folder_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TaskORM)
    if folder_id is not None:
        stmt = stmt.where(TaskORM.folder_id == folder_id)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [_task_from_orm(t) for t in tasks]


@router.post("/tasks", response_model=Task, status_code=201)
async def create_task(body: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = TaskORM(id=str(uuid.uuid4()), name=body.name, folder_id=body.folder_id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _task_from_orm(task)


@router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if body.name is not None:
        task.name = body.name

    await db.commit()
    await db.refresh(task)
    return _task_from_orm(task)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()


@router.get("/plans/{task_id}", response_model=list[str])
async def get_plans(task_id: str):
    return client_manager.get_plans(task_id)


@router.post("/tasks/{task_id}/summarize")
async def summarize_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    messages = await get_history(db, task_id)
    if not messages:
        raise HTTPException(status_code=400, detail="No conversation history found")

    plain_text = extract_plain_text(messages)
    summary = await summarize_text(plain_text)
    if summary:
        task.summary = summary
        await db.commit()
    return {"summary": summary}
