from __future__ import annotations

import logging

import httpx

from ..config import settings

logger = logging.getLogger("cc-sdk")

SUMMARY_SYSTEM_PROMPT = (
    "你是一个对话摘要助手。请根据下面的对话内容，生成一份简洁的中文摘要。\n"
    "要求：\n"
    "- 输出 3 到 5 行，每行一个要点\n"
    "- 重点描述：用户的需求是什么、AI 做了哪些关键操作、最终结论或结果\n"
    "- 使用精炼的语言，避免冗余"
)


async def summarize_text(text: str) -> str | None:
    """调用 DeepSeek API 生成摘要。返回摘要文本，失败返回 None。"""
    if not settings.deepseek_api_key:
        return None

    if not text.strip():
        return None

    # 截断过长文本（DeepSeek context 约 64k，预留 prompt 和输出空间）
    max_chars = settings.summary_max_chars
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.deepseek_base_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                    "max_tokens": settings.summary_max_tokens,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception:
        logger.warning("DeepSeek summarization failed", exc_info=True)
        return None
