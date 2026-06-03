from __future__ import annotations

import json

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    ToolPermissionContext,
    create_sdk_mcp_server,
    tool,
)

from ..models import SessionORM, TaskORM
from .claude_service import _serialize_message, _detect_new_plans

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


# --- In-process MCP tool ---
@tool(
    "present_options",
    "Present choices for user to select. Use this when you need the user to pick from multiple options.",
    {"question": str, "options": list[str]},
)
async def _present_options(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "Options presented. Awaiting user response."}]}


_ui_mcp = create_sdk_mcp_server("ui_tools", tools=[_present_options])


def _build_options(folder_path: str, can_use_tool=None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        cwd=folder_path,
        allowed_tools=["Read", "Glob", "Grep", "Bash", "Write", "Edit", "MultiEdit", "present_options"],
        mcp_servers={"ui_tools": _ui_mcp},
        can_use_tool=can_use_tool,
        system_prompt={
            "type": "preset",
            "preset": "claude_code",
            "append": (
                "When you need the user to choose between multiple options or approaches, "
                "call the present_options tool with the question and option list. "
                "After calling this tool, briefly summarize and wait for the user's choice."
            ),
        },
    )


@dataclass
class PendingPermission:
    request_id: str
    tool_name: str
    title: str | None
    description: str | None
    blocked_path: str | None
    event: asyncio.Event = field(default_factory=asyncio.Event)
    result: PermissionResultAllow | PermissionResultDeny | None = None


@dataclass
class ClientState:
    client: ClaudeSDKClient | None
    folder_path: str
    events: list[dict] = field(default_factory=list)
    queues: list[asyncio.Queue] = field(default_factory=list)
    active_query: bool = False
    done: asyncio.Event = field(default_factory=asyncio.Event)
    mode: str = "code"
    pending_permissions: dict[str, PendingPermission] = field(default_factory=dict)


class TaskClientManager:
    """每个 task 持有一个持久 ClaudeSDKClient，多轮对话复用同一子进程。"""

    def __init__(self) -> None:
        self._clients: dict[str, ClientState] = {}

    def _make_can_use_tool(self, task_id: str):
        async def _can_use_tool(
            tool_name: str,
            tool_input: dict,
            context: ToolPermissionContext,
        ) -> PermissionResultAllow | PermissionResultDeny:
            state = self._clients.get(task_id)
            if state is None:
                return PermissionResultDeny(behavior="deny", message="Client disconnected")

            request_id = context.tool_use_id or uuid.uuid4().hex
            pending = PendingPermission(
                request_id=request_id,
                tool_name=tool_name,
                title=context.title,
                description=context.description,
                blocked_path=context.blocked_path,
            )
            state.pending_permissions[request_id] = pending

            self._push_event(state, {
                "type": "permission_request",
                "request_id": request_id,
                "tool_name": tool_name,
                "tool_input": tool_input,
                "title": context.title,
                "display_name": context.display_name,
                "description": context.description,
                "blocked_path": context.blocked_path,
                "decision_reason": context.decision_reason,
            })

            try:
                await asyncio.wait_for(pending.event.wait(), timeout=300)
            except asyncio.TimeoutError:
                state.pending_permissions.pop(request_id, None)
                return PermissionResultDeny(behavior="deny", message="Permission request timed out")

            state.pending_permissions.pop(request_id, None)
            return pending.result

        return _can_use_tool

    async def get_or_create(
        self,
        task_id: str,
        folder_path: str,
    ) -> ClientState:
        if task_id in self._clients:
            state = self._clients[task_id]
            if state.client is not None:
                return state

        # 先创建 state 占位，闭包通过 task_id 延迟查找
        state = ClientState(client=None, folder_path=folder_path)
        self._clients[task_id] = state

        can_use_tool = self._make_can_use_tool(task_id)
        client = ClaudeSDKClient(options=_build_options(folder_path, can_use_tool))
        await client.connect()
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

        # 清空旧事件缓冲
        state.events.clear()
        state.done.clear()
        state.active_query = True
        state.mode = mode

        try:
            if images:
                # Build AsyncIterable with image content blocks
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
                # 持久化 session_id
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

                serialized = _serialize_message(message)
                if serialized is not None:
                    self._push_event(state, serialized)

                # Plan mode: detect new plan files on result
                if isinstance(message, ResultMessage) and mode == "plan":
                    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
                    task_orm = result.scalar_one_or_none()
                    if task_orm:
                        existing = json.loads(task_orm.plan_paths or "[]")
                        new_plans = _detect_new_plans(state.folder_path, existing)
                        if new_plans:
                            updated = existing + new_plans
                            task_orm.plan_paths = json.dumps(updated, ensure_ascii=False)
                            await db.commit()
                            self._push_event(state, {"type": "plan_updated", "plan_paths": updated})

        except Exception as e:
            self._push_event(state, {"type": "error", "message": str(e)})
        finally:
            state.active_query = False
            state.done.set()
            # 向订阅者发送结束哨兵
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
            # 清理所有 pending permissions
            for pending in state.pending_permissions.values():
                pending.result = PermissionResultDeny(behavior="deny", message="Interrupted")
                pending.event.set()

    def resolve_permission(self, task_id: str, request_id: str,
                           decision: str, message: str = "") -> bool:
        state = self._clients.get(task_id)
        if state is None:
            return False
        pending = state.pending_permissions.get(request_id)
        if pending is None:
            return False
        if decision == "allow":
            pending.result = PermissionResultAllow(behavior="allow")
        else:
            pending.result = PermissionResultDeny(behavior="deny", message=message)
        pending.event.set()
        return True

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


# 全局单例
client_manager = TaskClientManager()
