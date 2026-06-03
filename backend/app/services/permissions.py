from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field

from claude_agent_sdk import (
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)

from ..config import settings


@dataclass
class PendingPermission:
    request_id: str
    tool_name: str
    title: str | None
    description: str | None
    blocked_path: str | None
    event: asyncio.Event = field(default_factory=asyncio.Event)
    result: PermissionResultAllow | PermissionResultDeny | None = None


def make_can_use_tool(
    task_id: str,
    get_state,
    push_event,
):
    """Create a can_use_tool callback for a specific task.

    Args:
        task_id: The task ID this callback is for.
        get_state: Callable that returns ClientState for the task_id.
        push_event: Callable(state, data) to push events to subscribers.
    """

    async def _can_use_tool(
        tool_name: str,
        tool_input: dict,
        context: ToolPermissionContext,
    ) -> PermissionResultAllow | PermissionResultDeny:
        state = get_state(task_id)
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

        push_event(state, {
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
            await asyncio.wait_for(pending.event.wait(), timeout=settings.permission_timeout)
        except asyncio.TimeoutError:
            state.pending_permissions.pop(request_id, None)
            return PermissionResultDeny(behavior="deny", message="Permission request timed out")

        state.pending_permissions.pop(request_id, None)
        return pending.result

    return _can_use_tool


def resolve_permission(
    pending_permissions: dict[str, PendingPermission],
    request_id: str,
    decision: str,
    message: str = "",
) -> bool:
    """Resolve a pending permission request.

    Args:
        pending_permissions: The pending_permissions dict from ClientState.
        request_id: The permission request ID.
        decision: "allow" or "deny".
        message: Optional denial message.

    Returns:
        True if the permission was found and resolved.
    """
    pending = pending_permissions.get(request_id)
    if pending is None:
        return False
    if decision == "allow":
        pending.result = PermissionResultAllow(behavior="allow")
    else:
        pending.result = PermissionResultDeny(behavior="deny", message=message)
    pending.event.set()
    return True
