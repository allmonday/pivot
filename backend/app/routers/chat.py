import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session, get_db
from ..schemas.models import ChatRequest, PermissionDecision
from ..services import claude_service
from ..services.history import get_full_history as fetch_full_history
from ..services.history import get_history as fetch_history
from ..services.client_manager import client_manager

router = APIRouter(prefix="/api")


@router.get("/sessions/{task_id}")
async def get_session(task_id: str, db: AsyncSession = Depends(get_db)):
    session_id = await claude_service.get_session_id(db, task_id)
    return {"session_id": session_id}


@router.get("/messages/{task_id}")
async def get_messages(task_id: str, db: AsyncSession = Depends(get_db)):
    return await fetch_history(db, task_id)


@router.get("/full-history/{task_id}")
async def get_full_history(task_id: str, db: AsyncSession = Depends(get_db)):
    return await fetch_full_history(db, task_id)


@router.post("/chat")
async def chat(req: ChatRequest):
    # 拒绝同一 task 重复提交
    if client_manager.is_active(req.task_id):
        raise HTTPException(status_code=409, detail="A stream is already active for this task")

    folder_path = await _get_folder_path(req.task_id)
    if not folder_path:
        raise HTTPException(status_code=404, detail=f"Task {req.task_id} not found")

    # 确保 client 存在
    await client_manager.get_or_create(req.task_id, folder_path)

    # 后台任务：执行 query 并将事件写入 client_manager
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
        except Exception as e:
            # send_query 内部已经处理了异常推送，这里做兜底
            pass

    asyncio.create_task(_run())

    return {"task_id": req.task_id}


@router.get("/stream/{task_id}")
async def stream_sse(task_id: str):
    if not client_manager.is_active(task_id) and not client_manager.get_cached_events(task_id):
        raise HTTPException(status_code=404, detail="No active stream for this task")

    async def event_generator():
        q = client_manager.subscribe(task_id)
        try:
            # 1. 回放缓存事件
            cached = client_manager.get_cached_events(task_id)
            last_seq = len(cached) - 1 if cached else -1

            for entry in cached:
                yield f"event: {entry['event']}\ndata: {json.dumps(entry['data'])}\n\n"

            # 如果已经结束，直接关闭
            if not client_manager.is_active(task_id):
                return

            # 2. 从队列读取新事件，跳过已回放的
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


@router.post("/interrupt/{task_id}")
async def interrupt(task_id: str):
    if not client_manager.is_active(task_id):
        raise HTTPException(status_code=404, detail="No active stream for this task")
    await client_manager.interrupt(task_id)
    return {"status": "interrupted"}


@router.post("/permission/{task_id}/{request_id}")
async def resolve_permission(task_id: str, request_id: str, body: PermissionDecision):
    ok = client_manager.resolve_permission(task_id, request_id, body.decision, body.message)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending permission request found")
    return {"status": "ok"}


async def _get_folder_path(task_id: str) -> str | None:
    async with async_session() as db:
        return await claude_service.get_task_folder_path(db, task_id)
