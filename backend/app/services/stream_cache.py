from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field


@dataclass
class StreamState:
    events: list[dict] = field(default_factory=list)
    queues: list[asyncio.Queue] = field(default_factory=list)
    done: asyncio.Event = field(default_factory=asyncio.Event)
    task_id: str = ""


class StreamCache:
    """管理活跃的流式查询，缓存事件以支持断线重连。"""

    def __init__(self) -> None:
        self._streams: dict[str, StreamState] = {}
        self._task_map: dict[str, str] = {}

    async def start(self, stream_id: str, task_id: str) -> None:
        state = StreamState(task_id=task_id)
        self._streams[stream_id] = state
        self._task_map[task_id] = stream_id

    def append(self, stream_id: str, event_type: str, data: dict) -> None:
        state = self._streams.get(stream_id)
        if state is None:
            return
        entry = {"event": event_type, "data": data, "seq": len(state.events)}
        state.events.append(entry)
        for q in state.queues:
            q.put_nowait(entry)

    def end(self, stream_id: str) -> None:
        state = self._streams.get(stream_id)
        if state is None:
            return
        state.done.set()
        # 向所有订阅者发送结束哨兵
        for q in state.queues:
            q.put_nowait(None)

    def is_active(self, stream_id: str) -> bool:
        state = self._streams.get(stream_id)
        if state is None:
            return False
        return not state.done.is_set()

    def get_active_stream_for_task(self, task_id: str) -> str | None:
        stream_id = self._task_map.get(task_id)
        if stream_id is None:
            return None
        if self.is_active(stream_id):
            return stream_id
        return None

    def get_cached_events(self, stream_id: str) -> list[dict]:
        state = self._streams.get(stream_id)
        if state is None:
            return []
        return list(state.events)

    async def subscribe(self, stream_id: str) -> asyncio.Queue:
        """返回一个 Queue，后续 append 的事件会推送到此队列。"""
        state = self._streams.get(stream_id)
        if state is None:
            raise KeyError(f"Stream {stream_id} not found")
        q: asyncio.Queue = asyncio.Queue()
        state.queues.append(q)
        return q

    def unsubscribe(self, stream_id: str, queue: asyncio.Queue) -> None:
        state = self._streams.get(stream_id)
        if state is None:
            return
        if queue in state.queues:
            state.queues.remove(queue)

    def cleanup(self, stream_id: str) -> None:
        state = self._streams.get(stream_id)
        if state is None:
            return
        task_id = state.task_id
        del self._streams[stream_id]
        if self._task_map.get(task_id) == stream_id:
            del self._task_map[task_id]

    def has_stream(self, stream_id: str) -> bool:
        return stream_id in self._streams


# 全局单例
stream_cache = StreamCache()
