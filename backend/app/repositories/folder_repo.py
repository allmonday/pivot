from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FolderORM


async def get_by_id(db: AsyncSession, folder_id: str) -> Optional[FolderORM]:
    result = await db.execute(select(FolderORM).where(FolderORM.id == folder_id))
    return result.scalar_one_or_none()


async def get_all(db: AsyncSession) -> list[FolderORM]:
    result = await db.execute(select(FolderORM))
    return list(result.scalars().all())


def add(db: AsyncSession, folder_id: str, name: str, folder_path: str) -> FolderORM:
    """Add folder to session without committing. Caller is responsible for commit."""
    folder = FolderORM(id=folder_id, name=name, folder_path=folder_path)
    db.add(folder)
    return folder


async def create(db: AsyncSession, folder_id: str, name: str, folder_path: str) -> FolderORM:
    folder = add(db, folder_id, name, folder_path)
    await db.commit()
    await db.refresh(folder)
    return folder


async def delete(db: AsyncSession, folder: FolderORM) -> None:
    await db.delete(folder)
    await db.commit()
