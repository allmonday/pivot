import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .exceptions import unhandled_exception_handler
from .routers import chat, files, folders, messages, permissions, sessions, tasks
from .services.client_manager import client_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cc-sdk")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CC-SDK Dashboard")
    await init_db()
    yield
    logger.info("Shutting down, cleaning up %d client(s)", len(client_manager._clients))
    await client_manager.shutdown_all()


app = FastAPI(title="CC-SDK Dashboard", lifespan=lifespan)
app.add_exception_handler(Exception, unhandled_exception_handler)

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
