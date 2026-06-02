import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import FolderORM, TaskORM
from ..schemas.models import Folder, FolderCreate

router = APIRouter(prefix="/api")


@router.get("/folders", response_model=list[Folder])
async def get_folders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FolderORM))
    folders = result.scalars().all()
    return [Folder(id=f.id, name=f.name, folder_path=f.folder_path) for f in folders]


@router.post("/folders", response_model=Folder, status_code=201)
async def create_folder(body: FolderCreate, db: AsyncSession = Depends(get_db)):
    folder = FolderORM(id=str(uuid.uuid4()), name=body.name, folder_path=body.folder_path)
    db.add(folder)

    for task_name in body.task_names:
        task = TaskORM(id=str(uuid.uuid4()), name=task_name, folder_id=folder.id)
        db.add(task)

    await db.commit()
    await db.refresh(folder)
    return Folder(id=folder.id, name=folder.name, folder_path=folder.folder_path)


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(folder_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FolderORM).where(FolderORM.id == folder_id))
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    await db.delete(folder)
    await db.commit()
