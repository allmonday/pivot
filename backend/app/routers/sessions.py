from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services import claude_service

router = APIRouter(prefix="/api")


@router.get("/sessions/{task_id}")
async def get_session(task_id: str, db: AsyncSession = Depends(get_db)):
    session_id = await claude_service.get_session_id(db, task_id)
    return {"session_id": session_id}
