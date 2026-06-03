from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
)


def serialize_block(block: Any) -> dict:
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


def serialize_message(msg: Any) -> dict | None:
    if isinstance(msg, AssistantMessage):
        return {
            "type": "assistant",
            "content": [serialize_block(b) for b in msg.content],
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


def serialize_raw_content(content: Any) -> list[dict]:
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
        elif btype == "image":
            result.append({"kind": "image", "source": block.get("source")})
    return result
