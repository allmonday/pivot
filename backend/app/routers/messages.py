from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.history import get_full_history, get_history

router = APIRouter(prefix="/api")


@router.get("/messages/{task_id}")
async def get_messages(task_id: str, db: AsyncSession = Depends(get_db)):
    return await get_history(db, task_id)


@router.get("/full-history/{task_id}")
async def get_full_history_endpoint(task_id: str, db: AsyncSession = Depends(get_db)):
    return await get_full_history(db, task_id)
