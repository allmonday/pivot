from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claude_agent_sdk import get_session_messages

from ..models import SessionORM, TaskORM
from ..schemas.models import Task
from .serializers import serialize_raw_content


def _is_visible_entry(entry: dict) -> bool:
    """Filter: keep only user/assistant, skip isMeta/isSidechain/team."""
    if entry.get("type") not in ("user", "assistant"):
        return False
    if entry.get("isMeta") or entry.get("isSidechain") or entry.get("teamName"):
        return False
    return True


def _find_main_chain(
    entries: list[dict],
    by_uuid: dict[str, dict],
    entry_index: dict[str, int],
) -> list[dict]:
    """Find the main conversation chain by tracing from the last user/assistant
    leaf back to the root. Only considers parent-child links within *entries*."""
    if not entries:
        return []

    subset_uuids = {e["uuid"] for e in entries}
    parent_uuids: set[str] = set()
    for entry in entries:
        p = entry.get("parentUuid")
        if p and p in subset_uuids:
            parent_uuids.add(p)
    terminals = [e for e in entries if e["uuid"] not in parent_uuids]

    leaves: list[dict] = []
    for terminal in terminals:
        cur = terminal
        seen: set[str] = set()
        while cur is not None:
            uid = cur["uuid"]
            if uid in seen:
                break
            seen.add(uid)
            if cur.get("type") in ("user", "assistant"):
                leaves.append(cur)
                break
            p = cur.get("parentUuid")
            cur = by_uuid.get(p) if p else None

    if not leaves:
        return []

    main_leaves = [
        l
        for l in leaves
        if not l.get("isSidechain") and not l.get("teamName") and not l.get("isMeta")
    ]
    pool = main_leaves or leaves
    leaf = max(pool, key=lambda e: entry_index.get(e["uuid"], -1))

    chain: list[dict] = []
    seen: set[str] = set()
    cur: dict | None = leaf
    while cur is not None:
        uid = cur["uuid"]
        if uid in seen:
            break
        seen.add(uid)
        chain.append(cur)
        p = cur.get("parentUuid")
        cur = by_uuid.get(p) if p else None

    chain.reverse()
    return chain


def _build_full_chain(entries: list[dict]) -> list[dict]:
    """Build conversation chain, expanding compact summaries into original messages."""
    if not entries:
        return []

    by_uuid: dict[str, dict] = {}
    for entry in entries:
        by_uuid[entry["uuid"]] = entry

    entry_index: dict[str, int] = {}
    for i, entry in enumerate(entries):
        entry_index[entry["uuid"]] = i

    chain = _find_main_chain(entries, by_uuid, entry_index)

    result: list[dict] = []
    for entry in chain:
        if entry.get("isCompactSummary"):
            _expand_compact(entry, entries, by_uuid, entry_index, result)
        else:
            result.append(entry)

    return result


def _expand_compact(
    entry: dict,
    all_entries: list[dict],
    by_uuid: dict[str, dict],
    entry_index: dict[str, int],
    result: list[dict],
) -> None:
    """Expand a compact summary, appending recovered original messages to *result*."""
    logical_parent = entry.get("logicalParentUuid")
    if logical_parent and logical_parent in by_uuid:
        pre_chain: list[dict] = []
        pre_seen: set[str] = set()
        pre_cur = by_uuid[logical_parent]
        while pre_cur is not None:
            uid = pre_cur["uuid"]
            if uid in pre_seen:
                break
            pre_seen.add(uid)
            if _is_visible_entry(pre_cur) and not pre_cur.get("isCompactSummary"):
                pre_chain.append(pre_cur)
            p = pre_cur.get("parentUuid")
            pre_cur = by_uuid.get(p) if p else None
        result.extend(reversed(pre_chain))
        return

    # No logicalParentUuid — the compact's parent is a system entry that marks
    # the boundary between pre-compact and post-compact conversation.
    parent_uuid = entry.get("parentUuid")
    boundary_idx = entry_index.get(parent_uuid) if parent_uuid else None
    if boundary_idx is None:
        boundary_idx = entry_index.get(entry["uuid"], -1)

    if boundary_idx <= 0:
        return

    # Include ALL visible entries in chronological order.  Tool-use creates
    # multiple branches at fork points; _find_main_chain only follows one.
    # For full-history we want the complete picture.
    for e in all_entries[:boundary_idx]:
        if _is_visible_entry(e) and not e.get("isCompactSummary"):
            result.append(e)


def _entries_to_messages(chain: list[dict]) -> list[dict]:
    """Convert full-chain entries to frontend ChatMessage format."""
    blocks: list[dict] = []
    for entry in chain:
        msg = entry.get("message")
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "")
        content = msg.get("content", [])
        if role == "user" and isinstance(content, str):
            blocks.append({"role": "user", "kind": "text", "text": content})
        elif role == "user" and isinstance(content, list):
            for b in serialize_raw_content(content):
                blocks.append({"role": "user", **b})
        elif role == "assistant" and isinstance(content, list):
            for b in serialize_raw_content(content):
                blocks.append({"role": "assistant", **b})

    return _merge_blocks_to_messages(blocks)


def _merge_blocks_to_messages(blocks: list[dict]) -> list[dict]:
    """Merge consecutive same-role blocks into ChatMessage format."""
    result: list[dict] = []
    for block in blocks:
        if block["role"] == "user":
            kind = block.get("kind", "unknown")
            if kind == "text":
                result.append({"role": "user", "content": [{"kind": "text", "text": block["text"]}]})
            elif kind == "image":
                if result and result[-1]["role"] == "user":
                    result[-1]["content"].append({"kind": "image", "source": block.get("source")})
                else:
                    result.append({"role": "user", "content": [{"kind": "image", "source": block.get("source")}]})
            elif kind == "tool_result":
                if result and result[-1]["role"] == "assistant":
                    result[-1]["content"].append({"kind": "tool_result", "content": block.get("content", "")})
        elif block["role"] == "assistant":
            kind = block.get("kind", "unknown")
            if result and result[-1]["role"] == "assistant":
                result[-1]["content"].append({k: v for k, v in block.items() if k != "role"})
            else:
                result.append({"role": "assistant", "content": [{k: v for k, v in block.items() if k != "role"}]})

    return result


async def get_history(db: AsyncSession, task_id: str) -> list[dict]:
    from .claude_service import get_session_id, get_task_folder_path

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
            for b in serialize_raw_content(content):
                blocks.append({"role": "user", **b})
        elif role == "assistant" and isinstance(content, list):
            for b in serialize_raw_content(content):
                blocks.append({"role": "assistant", **b})

    return _merge_blocks_to_messages(blocks)


def extract_plain_text(messages: list[dict]) -> str:
    """从 ChatMessage 格式的消息列表中提取纯文本，用于摘要生成。"""
    lines: list[str] = []
    for msg in messages:
        role = msg.get("role", "")
        content_blocks = msg.get("content", [])
        if not isinstance(content_blocks, list):
            continue
        for block in content_blocks:
            if not isinstance(block, dict):
                continue
            kind = block.get("kind", "")
            if kind == "text":
                text = block.get("text", "").strip()
                if text:
                    lines.append(f"[{role}] {text}")
    return "\n".join(lines)


async def get_full_history(db: AsyncSession, task_id: str) -> list[dict]:
    # NOTE: Uses internal SDK API (underscore-prefixed modules).
    # These are not part of the public API and may break on SDK upgrades.
    # If public alternatives become available, migrate immediately.
    # Tracked in GitHub Issue #14.
    from claude_agent_sdk._internal.sessions import (
        _parse_transcript_entries,
        _read_session_file,
    )

    from .claude_service import get_session_id, get_task_folder_path

    session_id = await get_session_id(db, task_id)
    if not session_id:
        return []

    directory = await get_task_folder_path(db, task_id)

    try:
        content = _read_session_file(session_id, directory)
        if not content:
            return []
        entries = _parse_transcript_entries(content)
        chain = _build_full_chain(entries)
        return _entries_to_messages(chain)
    except Exception:
        return []
