import json
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claude_agent_sdk import (
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
    get_session_messages,
)

from ..models import FolderORM, SessionORM, TaskORM
from ..schemas.models import Task


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
            "duration_ms": msg.duration_ms,
            "duration_api_ms": msg.duration_api_ms,
            "num_turns": msg.num_turns,
            "usage": msg.usage,
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
        plan_paths = json.loads(task.plan_paths or "[]")
        return Task(id=task.id, name=task.name, folder_id=task.folder_id, plan_paths=plan_paths)
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


def _detect_new_plans(folder_path: str, existing_paths: list[str]) -> list[str]:
    """Scan .claude/plans/ for .md files not yet in existing_paths."""
    candidates = [
        Path(folder_path) / ".claude" / "plans",
        Path.home() / ".claude" / "plans",
    ]
    all_files: list[Path] = []
    for plans_dir in candidates:
        if plans_dir.is_dir():
            all_files.extend(plans_dir.glob("*.md"))
    existing_set = set(existing_paths)
    new_files = [str(f) for f in all_files if str(f) not in existing_set]
    return sorted(new_files, key=lambda p: Path(p).stat().st_mtime)


