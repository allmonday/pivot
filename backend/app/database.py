from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def init_db():
    """建表"""
    from .models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Drop legacy plan_paths column if exists
        result = await conn.execute(text("PRAGMA table_info(tasks)"))
        columns = [row[1] for row in result]
        if "plan_paths" in columns:
            await conn.execute(text("ALTER TABLE tasks DROP COLUMN plan_paths"))
        # Add summary column if missing
        if "summary" not in columns:
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN summary TEXT"))
