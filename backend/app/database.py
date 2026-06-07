from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def init_db():
    """Run Alembic migrations to create/update schema."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    from alembic.command import upgrade
    from alembic.config import Config

    alembic_cfg = Config("alembic.ini")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(ThreadPoolExecutor(1), upgrade, alembic_cfg, "head")
