import json
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import SessionORM, TaskORM
from ..schemas.models import Task


async def get_task(db: AsyncSession, task_id: str) -> Optional[Task]:
    result = await db.execute(
        select(TaskORM).where(TaskORM.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task:
        plan_paths = json.loads(task.plan_paths or "[]")
        return Task(id=task.id, name=task.name, folder_id=task.folder_id, plan_paths=plan_paths)
    return None


async def get_task_folder_path(db: AsyncSession, task_id: str) -> Optional[str]:
    result = await db.execute(
        select(TaskORM).where(TaskORM.id == task_id).options(selectinload(TaskORM.folder))
    )
    task = result.scalar_one_or_none()
    if task and task.folder:
        return task.folder.folder_path
    return None


async def get_session_id(db: AsyncSession, task_id: str) -> Optional[str]:
    result = await db.execute(
        select(SessionORM).where(SessionORM.task_id == task_id)
    )
    session = result.scalar_one_or_none()
    return session.session_id if session else None
