from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.models import Folder, FolderCreate
from ..services import folder_service

router = APIRouter(prefix="/api")


@router.get("/folders", response_model=list[Folder])
async def get_folders(db: AsyncSession = Depends(get_db)):
    return await folder_service.get_folders(db)


@router.post("/folders", response_model=Folder, status_code=201)
async def create_folder(body: FolderCreate, db: AsyncSession = Depends(get_db)):
    return await folder_service.create_folder_with_tasks(db, body.name, body.folder_path, body.task_names)


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(folder_id: str, db: AsyncSession = Depends(get_db)):
    await folder_service.delete_folder(db, folder_id)
