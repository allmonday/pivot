import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import TaskORM
from ..repositories import folder_repo
from ..schemas.models import Folder


def _to_schema(f) -> Folder:
    return Folder(id=f.id, name=f.name, folder_path=f.folder_path)


async def get_folders(db: AsyncSession) -> list[Folder]:
    folders = await folder_repo.get_all(db)
    return [_to_schema(f) for f in folders]


async def create_folder_with_tasks(
    db: AsyncSession, name: str, folder_path: str, task_names: list[str]
) -> Folder:
    folder_id = str(uuid.uuid4())
    folder = folder_repo.add(db, folder_id=folder_id, name=name, folder_path=folder_path)

    for task_name in task_names:
        db.add(TaskORM(id=str(uuid.uuid4()), name=task_name, folder_id=folder.id))
    await db.commit()
    await db.refresh(folder)

    return _to_schema(folder)


async def delete_folder(db: AsyncSession, folder_id: str) -> None:
    folder = await folder_repo.get_by_id(db, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    await folder_repo.delete(db, folder)
