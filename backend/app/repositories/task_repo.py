from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import TaskORM


async def get_by_id(db: AsyncSession, task_id: str) -> Optional[TaskORM]:
    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
    return result.scalar_one_or_none()


async def get_all(db: AsyncSession, folder_id: Optional[str] = None) -> list[TaskORM]:
    stmt = select(TaskORM)
    if folder_id is not None:
        stmt = stmt.where(TaskORM.folder_id == folder_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, task_id: str, name: str, folder_id: str) -> TaskORM:
    task = TaskORM(id=task_id, name=name, folder_id=folder_id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def update_name(db: AsyncSession, task: TaskORM, name: str) -> TaskORM:
    task.name = name
    await db.commit()
    await db.refresh(task)
    return task


async def update_summary(db: AsyncSession, task: TaskORM, summary: str) -> None:
    task.summary = summary
    await db.commit()


async def delete(db: AsyncSession, task: TaskORM) -> None:
    await db.delete(task)
    await db.commit()


async def get_folder_path(db: AsyncSession, task_id: str) -> Optional[str]:
    result = await db.execute(
        select(TaskORM).where(TaskORM.id == task_id).options(selectinload(TaskORM.folder))
    )
    task = result.scalar_one_or_none()
    if task and task.folder:
        return task.folder.folder_path
    return None
