from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.models import Task, TaskCreate, TaskUpdate
from ..services import task_service
from ..services.client_manager import client_manager

router = APIRouter(prefix="/api")


@router.get("/tasks", response_model=list[Task])
async def get_tasks(
    folder_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await task_service.get_tasks(db, folder_id=folder_id)


@router.post("/tasks", response_model=Task, status_code=201)
async def create_task(body: TaskCreate, db: AsyncSession = Depends(get_db)):
    return await task_service.create_task(db, body.name, body.folder_id)


@router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate, db: AsyncSession = Depends(get_db)):
    return await task_service.update_task(db, task_id, body.name)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    await task_service.delete_task(db, task_id)


@router.get("/plans/{task_id}", response_model=list[str])
async def get_plans(task_id: str):
    return client_manager.get_plans(task_id)


@router.post("/tasks/{task_id}/summarize")
async def summarize_task(task_id: str, db: AsyncSession = Depends(get_db)):
    return await task_service.summarize_task(db, task_id)
