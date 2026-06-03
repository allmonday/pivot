from claude_agent_sdk import (
    ClaudeAgentOptions,
    create_sdk_mcp_server,
    tool,
)

from ..config import settings


@tool(
    "present_options",
    "Present choices for user to select. Use this when you need the user to pick from multiple options.",
    {"question": str, "options": list[str]},
)
async def _present_options(args: dict) -> dict:
    return {"content": [{"type": "text", "text": "Options presented. Awaiting user response."}]}


ui_mcp = create_sdk_mcp_server("ui_tools", tools=[_present_options])


def build_options(folder_path: str, can_use_tool=None, mode: str = "code", session_id: str | None = None) -> ClaudeAgentOptions:
    preset = "claude_code" if mode == "code" else "plan"

    return ClaudeAgentOptions(
        cwd=folder_path,
        allowed_tools=["Read", "Glob", "Grep", "Bash", "Write", "Edit", "MultiEdit", "present_options"],
        mcp_servers={"ui_tools": ui_mcp},
        can_use_tool=can_use_tool,
        max_turns=settings.max_turns,
        session_id=session_id,
        system_prompt={
            "type": "preset",
            "preset": preset,
            "append": (
                "When you need the user to choose between multiple options or approaches, "
                "call the present_options tool with the question and option list. "
                "After calling this tool, briefly summarize and wait for the user's choice."
            ),
        },
    )
