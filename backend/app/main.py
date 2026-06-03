from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import chat, files, folders, messages, permissions, sessions, tasks
from .services.client_manager import client_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await client_manager.shutdown_all()


app = FastAPI(title="CC-SDK Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(folders.router)
app.include_router(files.router)
app.include_router(sessions.router)
app.include_router(messages.router)
app.include_router(chat.router)
app.include_router(permissions.router)
