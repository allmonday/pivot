from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import SessionORM


async def get_session_id(db: AsyncSession, task_id: str) -> Optional[str]:
    result = await db.execute(
        select(SessionORM).where(SessionORM.task_id == task_id)
    )
    session = result.scalar_one_or_none()
    return session.session_id if session else None
