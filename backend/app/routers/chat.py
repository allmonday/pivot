import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session, get_db
from ..schemas.models import ChatRequest
from ..services import claude_service
from ..services.stream_cache import stream_cache

router = APIRouter(prefix="/api")


@router.get("/sessions/{task_id}")
async def get_session(task_id: str, db: AsyncSession = Depends(get_db)):
    session_id = await claude_service.get_session_id(db, task_id)
    return {"session_id": session_id}


@router.get("/messages/{task_id}")
async def get_messages(task_id: str, db: AsyncSession = Depends(get_db)):
    return await claude_service.get_history(db, task_id)


@router.post("/chat")
async def chat(req: ChatRequest):
    # 拒绝同一 task 重复提交
    active = stream_cache.get_active_stream_for_task(req.task_id)
    if active:
        raise HTTPException(status_code=409, detail="A stream is already active for this task")

    stream_id = uuid.uuid4().hex
    await stream_cache.start(stream_id, req.task_id)

    # 后台任务：执行 query 并将事件写入 StreamCache
    async def _run():
        try:
            async with async_session() as db:
                async for message in claude_service.stream_query(
                    db=db,
                    prompt=req.message,
                    task_id=req.task_id,
                    session_id=req.session_id,
                    mode=req.mode,
                ):
                    event_type = message.get("type", "unknown")
                    stream_cache.append(stream_id, event_type, message)
        except Exception as e:
            stream_cache.append(stream_id, "error", {"type": "error", "message": str(e)})
        finally:
            stream_cache.end(stream_id)
            # 延迟 60s 清理缓存
            await asyncio.sleep(60)
            stream_cache.cleanup(stream_id)

    asyncio.create_task(_run())

    return {"stream_id": stream_id}


@router.get("/stream/{stream_id}")
async def stream_sse(stream_id: str):
    if not stream_cache.has_stream(stream_id):
        raise HTTPException(status_code=404, detail="Stream not found")

    async def event_generator():
        # 1. 先订阅，防止回放期间新事件丢失
        q = await stream_cache.subscribe(stream_id)
        try:
            cached = stream_cache.get_cached_events(stream_id)
            last_seq = len(cached) - 1 if cached else -1

            for entry in cached:
                yield f"event: {entry['event']}\ndata: {json.dumps(entry['data'])}\n\n"

            # 如果已经结束，直接关闭
            if not stream_cache.is_active(stream_id):
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
            stream_cache.unsubscribe(stream_id, q)

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
    stream_id = stream_cache.get_active_stream_for_task(task_id)
    return {"active": stream_id is not None, "stream_id": stream_id}
