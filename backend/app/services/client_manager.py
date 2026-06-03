from __future__ import annotations

import json
import asyncio
from dataclasses import dataclass, field
from typing import Any

from claude_agent_sdk import (
    ClaudeSDKClient,
    PermissionResultDeny,
    ResultMessage,
)

from ..models import SessionORM, TaskORM
from .mcp_tools import build_options
from .permissions import make_can_use_tool, resolve_permission as _resolve_permission
from .plan import detect_new_plans
from .serializers import serialize_message

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class ClientState:
    client: ClaudeSDKClient | None
    folder_path: str
    events: list[dict] = field(default_factory=list)
    queues: list[asyncio.Queue] = field(default_factory=list)
    active_query: bool = False
    done: asyncio.Event = field(default_factory=asyncio.Event)
    mode: str = "code"
    pending_permissions: dict = field(default_factory=dict)


class TaskClientManager:
    """每个 task 持有一个持久 ClaudeSDKClient，多轮对话复用同一子进程。"""

    def __init__(self) -> None:
        self._clients: dict[str, ClientState] = {}

    def _get_state(self, task_id: str) -> ClientState | None:
        return self._clients.get(task_id)

    async def get_or_create(
        self,
        task_id: str,
        folder_path: str,
        session_id: str | None = None,
    ) -> ClientState:
        if task_id in self._clients:
            state = self._clients[task_id]
            if state.client is not None:
                return state

        state = ClientState(client=None, folder_path=folder_path)
        self._clients[task_id] = state

        can_use_tool = make_can_use_tool(
            task_id,
            get_state=self._get_state,
            push_event=self._push_event,
        )
        client = ClaudeSDKClient(options=build_options(folder_path, can_use_tool, mode="code"))
        await client.connect(session_id=session_id)
        state.client = client
        return state

    async def send_query(
        self,
        task_id: str,
        prompt: str,
        mode: str,
        db: AsyncSession,
        images: list[dict] | None = None,
    ) -> None:
        state = self._clients.get(task_id)
        if state is None:
            raise ValueError(f"No client for task {task_id}")

        if state.active_query:
            raise RuntimeError(f"Query already active for task {task_id}")

        state.events.clear()
        state.done.clear()
        state.active_query = True
        state.mode = mode

        try:
            if images:
                async def _prompt_iterable():
                    content: list[dict[str, Any]] = []
                    if prompt:
                        content.append({"type": "text", "text": prompt})
                    for img in images:
                        content.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": img["media_type"],
                                "data": img["data"],
                            },
                        })
                    yield {
                        "type": "user",
                        "message": {"role": "user", "content": content},
                        "parent_tool_use_id": None,
                    }
                await state.client.query(_prompt_iterable())
            else:
                await state.client.query(prompt)

            async for message in state.client.receive_response():
                if isinstance(message, ResultMessage) and message.session_id:
                    result = await db.execute(
                        select(SessionORM).where(SessionORM.task_id == task_id)
                    )
                    existing = result.scalar_one_or_none()
                    if existing:
                        existing.session_id = message.session_id
                    else:
                        db.add(SessionORM(task_id=task_id, session_id=message.session_id))
                    await db.commit()

                serialized = serialize_message(message)
                if serialized is not None:
                    self._push_event(state, serialized)

                if isinstance(message, ResultMessage) and mode == "plan":
                    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
                    task_orm = result.scalar_one_or_none()
                    if task_orm:
                        existing_paths = json.loads(task_orm.plan_paths or "[]")
                        new_plans = detect_new_plans(state.folder_path, existing_paths)
                        if new_plans:
                            updated = existing_paths + new_plans
                            task_orm.plan_paths = json.dumps(updated, ensure_ascii=False)
                            await db.commit()
                            self._push_event(state, {"type": "plan_updated", "plan_paths": updated})

        except Exception as e:
            self._push_event(state, {"type": "error", "message": str(e)})
        finally:
            state.active_query = False
            state.done.set()
            for q in state.queues:
                q.put_nowait(None)

    def _push_event(self, state: ClientState, data: dict) -> None:
        event_type = data.get("type", "unknown")
        entry = {"event": event_type, "data": data, "seq": len(state.events)}
        state.events.append(entry)
        for q in state.queues:
            q.put_nowait(entry)

    async def interrupt(self, task_id: str) -> None:
        state = self._clients.get(task_id)
        if state and state.client and state.active_query:
            await state.client.interrupt()
            for pending in state.pending_permissions.values():
                pending.result = PermissionResultDeny(behavior="deny", message="Interrupted")
                pending.event.set()

    def resolve_permission(self, task_id: str, request_id: str,
                           decision: str, message: str = "") -> bool:
        state = self._clients.get(task_id)
        if state is None:
            return False
        return _resolve_permission(state.pending_permissions, request_id, decision, message)

    def subscribe(self, task_id: str) -> asyncio.Queue:
        state = self._clients.get(task_id)
        if state is None:
            raise KeyError(f"No client for task {task_id}")
        q: asyncio.Queue = asyncio.Queue()
        state.queues.append(q)
        return q

    def unsubscribe(self, task_id: str, q: asyncio.Queue) -> None:
        state = self._clients.get(task_id)
        if state is None:
            return
        if q in state.queues:
            state.queues.remove(q)

    def get_cached_events(self, task_id: str) -> list[dict]:
        state = self._clients.get(task_id)
        if state is None:
            return []
        return list(state.events)

    def is_active(self, task_id: str) -> bool:
        state = self._clients.get(task_id)
        if state is None:
            return False
        return state.active_query

    async def disconnect(self, task_id: str) -> None:
        state = self._clients.pop(task_id, None)
        if state and state.client:
            await state.client.disconnect()

    async def shutdown_all(self) -> None:
        """Disconnect all active clients. Call on app shutdown."""
        task_ids = list(self._clients.keys())
        for tid in task_ids:
            await self.disconnect(tid)


# 全局单例
client_manager = TaskClientManager()
