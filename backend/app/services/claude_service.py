from typing import Any, AsyncIterator, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKError,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
    get_session_messages,
    query,
    tool,
)

from ..models import FolderORM, SessionORM, TaskORM
from ..schemas.models import Task


# --- In-process MCP tool for structured user choices ---

@tool(
    "present_options",
    "Present choices for user to select. Use this when you need the user to pick from multiple options.",
    {"question": str, "options": list[str]},
)
async def _present_options(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "Options presented. Awaiting user response."}]}


_ui_mcp = create_sdk_mcp_server("ui_tools", tools=[_present_options])


def _serialize_block(block: Any) -> dict:
    if isinstance(block, TextBlock):
        return {"kind": "text", "text": block.text}
    if isinstance(block, ThinkingBlock):
        return {"kind": "thinking", "text": block.thinking}
    if isinstance(block, ToolUseBlock):
        return {"kind": "tool_use", "name": block.name, "input": block.input}
    if isinstance(block, ToolResultBlock):
        content = block.content
        if isinstance(content, list):
            parts = []
            for c in content:
                if hasattr(c, "text"):
                    parts.append(c.text)
                else:
                    parts.append(str(c))
            content = "\n".join(parts)
        return {"kind": "tool_result", "content": str(content)}
    return {"kind": "unknown", "text": str(block)}


def _serialize_message(msg: Any) -> dict | None:
    if isinstance(msg, AssistantMessage):
        return {
            "type": "assistant",
            "content": [_serialize_block(b) for b in msg.content],
        }
    if isinstance(msg, ResultMessage):
        return {
            "type": "result",
            "session_id": msg.session_id,
            "is_error": msg.is_error,
            "total_cost_usd": msg.total_cost_usd,
        }
    return None


def _serialize_raw_content(content: Any) -> list[dict]:
    if not isinstance(content, list):
        return [{"kind": "text", "text": str(content)}]

    result = []
    for block in content:
        if not isinstance(block, dict):
            result.append({"kind": "text", "text": str(block)})
            continue
        btype = block.get("type", "")
        if btype == "text":
            result.append({"kind": "text", "text": block.get("text", "")})
        elif btype == "tool_use":
            result.append({"kind": "tool_use", "name": block.get("name", ""), "input": block.get("input", {})})
        elif btype == "tool_result":
            tc = block.get("content", "")
            if isinstance(tc, list):
                tc = "\n".join(
                    p.get("text", str(p)) if isinstance(p, dict) else str(p)
                    for p in tc
                )
            result.append({"kind": "tool_result", "content": str(tc)})
        elif btype == "thinking":
            result.append({"kind": "thinking", "text": block.get("thinking", "")})
    return result


async def get_task(db: AsyncSession, task_id: str) -> Optional[Task]:
    result = await db.execute(
        select(TaskORM).where(TaskORM.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task:
        return Task(id=task.id, name=task.name, folder_id=task.folder_id, plan_path=task.plan_path)
    return None


async def get_task_folder_path(db: AsyncSession, task_id: str) -> Optional[str]:
    result = await db.execute(
        select(TaskORM).where(TaskORM.id == task_id).options(selectinload(TaskORM.folder))
    )
    task = result.scalar_one_or_none()
    if task and task.folder:
        return task.folder.folder_path
    return None


async def get_session_id(db: AsyncSession, task_id: str) -> Optional[str]:
    result = await db.execute(
        select(SessionORM).where(SessionORM.task_id == task_id)
    )
    session = result.scalar_one_or_none()
    return session.session_id if session else None


async def get_history(db: AsyncSession, task_id: str) -> list[dict]:
    session_id = await get_session_id(db, task_id)
    if not session_id:
        return []

    directory = await get_task_folder_path(db, task_id)

    try:
        raw_messages = get_session_messages(session_id, directory=directory)
    except Exception:
        return []

    blocks: list[dict] = []
    for sm in raw_messages:
        msg = sm.message
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "")
        content = msg.get("content", [])
        if role == "user" and isinstance(content, str):
            blocks.append({"role": "user", "kind": "text", "text": content})
        elif role == "user" and isinstance(content, list):
            for b in _serialize_raw_content(content):
                blocks.append({"role": "user", **b})
        elif role == "assistant" and isinstance(content, list):
            for b in _serialize_raw_content(content):
                blocks.append({"role": "assistant", **b})

    result: list[dict] = []
    for block in blocks:
        if block["role"] == "user" and block.get("kind") == "text":
            result.append({"role": "user", "content": [{"kind": "text", "text": block["text"]}]})
        elif block["role"] == "assistant":
            kind = block.get("kind", "unknown")
            if kind == "thinking":
                continue
            if result and result[-1]["role"] == "assistant":
                result[-1]["content"].append({k: v for k, v in block.items() if k != "role"})
            else:
                result.append({"role": "assistant", "content": [{k: v for k, v in block.items() if k != "role"}]})
        elif block["role"] == "user" and block.get("kind") == "tool_result":
            if result and result[-1]["role"] == "assistant":
                result[-1]["content"].append({"kind": "tool_result", "content": block.get("content", "")})

    return result


def _detect_latest_plan(folder_path: str) -> str | None:
    """Scan .claude/plans/ for the latest .md file.

    Checks both project-local and home directory locations.
    """
    from pathlib import Path

    candidates = [
        Path(folder_path) / ".claude" / "plans",
        Path.home() / ".claude" / "plans",
    ]
    all_files: list[Path] = []
    for plans_dir in candidates:
        if plans_dir.is_dir():
            all_files.extend(plans_dir.glob("*.md"))
    if not all_files:
        return None
    latest = sorted(all_files, key=lambda p: p.stat().st_mtime, reverse=True)[0]
    return str(latest)


async def stream_query(
    db: AsyncSession,
    prompt: str,
    task_id: str,
    session_id: Optional[str] = None,
    mode: str = "code",
) -> AsyncIterator[dict]:
    task = await get_task(db, task_id)
    folder_path = await get_task_folder_path(db, task_id)
    if not task or not folder_path:
        yield {"type": "error", "message": f"Task {task_id} not found"}
        return

    options = ClaudeAgentOptions(
        cwd=folder_path,
        allowed_tools=["Read", "Glob", "Grep", "Bash", "Write", "Edit", "MultiEdit", "present_options"],
        mcp_servers={"ui_tools": _ui_mcp},
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
    if session_id:
        options.resume = session_id

    try:
        async for message in query(prompt=prompt, options=options):
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
                yield serialized

            # On final result, detect plan file in plan mode
            if isinstance(message, ResultMessage) and mode == "plan":
                plan_path = _detect_latest_plan(folder_path)
                if plan_path:
                    result = await db.execute(select(TaskORM).where(TaskORM.id == task_id))
                    task_orm = result.scalar_one_or_none()
                    if task_orm:
                        task_orm.plan_path = plan_path
                        await db.commit()
                    yield {"type": "plan_updated", "plan_path": plan_path}

    except ClaudeSDKError as e:
        yield {"type": "error", "message": str(e)}
