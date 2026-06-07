from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..repositories import session_repo

router = APIRouter(prefix="/api")


@router.get("/sessions/{task_id}")
async def get_session(task_id: str, db: AsyncSession = Depends(get_db)):
    session_id = await session_repo.get_session_id(db, task_id)
    return {"session_id": session_id}
