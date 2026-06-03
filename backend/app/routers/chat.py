import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..database import async_session
from ..schemas.models import ChatRequest
from ..services import claude_service
from ..services.client_manager import client_manager

logger = logging.getLogger("cc-sdk")
router = APIRouter(prefix="/api")


@router.post("/chat")
async def chat(req: ChatRequest):
    if client_manager.is_active(req.task_id):
        raise HTTPException(status_code=409, detail="A stream is already active for this task")

    folder_path = await _get_folder_path(req.task_id)
    if not folder_path:
        raise HTTPException(status_code=404, detail=f"Task {req.task_id} not found")

    await client_manager.get_or_create(req.task_id, folder_path)

    async def _run():
        try:
            async with async_session() as db:
                await client_manager.send_query(
                    task_id=req.task_id,
                    prompt=req.message,
                    mode=req.mode,
                    db=db,
                    images=[img.model_dump() for img in req.images],
                )
        except Exception:
            logger.exception("Background query failed for task %s", req.task_id)

    asyncio.create_task(_run())
    return {"task_id": req.task_id}


@router.get("/stream/{task_id}")
async def stream_sse(task_id: str):
    if not client_manager.is_active(task_id) and not client_manager.get_cached_events(task_id):
        raise HTTPException(status_code=404, detail="No active stream for this task")

    async def event_generator():
        q = client_manager.subscribe(task_id)
        try:
            cached = client_manager.get_cached_events(task_id)
            last_seq = len(cached) - 1 if cached else -1

            for entry in cached:
                yield f"event: {entry['event']}\ndata: {json.dumps(entry['data'])}\n\n"

            if not client_manager.is_active(task_id):
                return

            while True:
                entry = await q.get()
                if entry is None:
                    break
                if entry["seq"] <= last_seq:
                    continue
                yield f"event: {entry['event']}\ndata: {json.dumps(entry['data'])}\n\n"
        finally:
            client_manager.unsubscribe(task_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/active-stream/{task_id}")
async def active_stream(task_id: str):
    return {"active": client_manager.is_active(task_id)}


@router.get("/active-streams")
async def active_streams(ids: str = ""):
    if not ids:
        return {"active_ids": []}
    task_ids = [tid.strip() for tid in ids.split(",") if tid.strip()]
    active = [tid for tid in task_ids if client_manager.is_active(tid)]
    return {"active_ids": active}


@router.post("/interrupt/{task_id}")
async def interrupt(task_id: str):
    if not client_manager.is_active(task_id):
        raise HTTPException(status_code=404, detail="No active stream for this task")
    await client_manager.interrupt(task_id)
    return {"status": "interrupted"}


async def _get_folder_path(task_id: str) -> str | None:
    async with async_session() as db:
        return await claude_service.get_task_folder_path(db, task_id)
