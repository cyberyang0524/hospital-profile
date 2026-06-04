"""
LLM client – talks to any OpenAI-compatible /chat/completions endpoint.

The frontend passes the configuration in `metadata.llm_config`; the backend
falls back to environment variables when the frontend didn't supply one.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from .schemas import LLMConfig, Message, TagInfo
from . import store as store_module
from .schemas_tag import TagCategoriesConfig, TagCategoryItem

logger = logging.getLogger(__name__)


def _build_candidates_block(categories: Dict[str, TagCategoryItem]) -> str:
    if not categories:
        return ""
    lines = []
    for key, info in categories.items():
        names = "、".join(info.tags) if info.tags else "（暂无候选）"
        lines.append(f"- {key}（{info.name}）：{names}")
    return "\n".join(lines)


def _build_system_prompt(categories: Optional[Dict[str, TagCategoryItem]] = None) -> str:
    candidates = _build_candidates_block(categories or {})
    candidates_block = (
        f"候选标签分类（key 必须从这些中选用；若用户改了候选标签，请以最新列表为准）：\n{candidates}"
        if candidates
        else "你可以自行扩展 tagCategory 和 tagName，但必须放在 personality/consumption/health/preference 这 4 个类别下。"
    )
    return f"""你是一名医院客服对话分析师。请基于医患/客户对话内容，
输出严格符合以下 JSON 结构的标签提取结果（不要输出任何额外文字、Markdown 代码块或注释）：

{{
  "summary": "string – 一句话总结整段对话（不超过 80 字）",
  "keyInsights": ["string", "..."],
  "tags": [
    {{
      "tagCategory": "personality" | "consumption" | "health" | "preference",
      "tagName": "string – 特征名（尽量与候选列表一致）",
      "tagValue": "string – 特征值（尽量与候选列表一致）",
      "confidence": 0.0,
      "evidence": "string – 引用对话原文（不超过 30 字）",
      "reasoning": "string – 简要分析（不超过 40 字）"
    }}
  ]
}}

{candidates_block}

要求：
1. tagCategory 必须是 "personality" / "consumption" / "health" / "preference" 之一（key 必须是英文小写）。
2. tagName / tagValue 优先从上述候选标签中选用。
3. 只输出与对话内容真实相关的标签；不确定的标签不要输出。
4. confidence 范围 0~1，证据越充分数值越高。
5. keyInsights 至少 1 条、最多 3 条。
"""


def _resolve_config(metadata: Optional[Dict[str, Any]]) -> LLMConfig:
    if metadata and isinstance(metadata.get("llm_config"), dict):
        try:
            cfg = LLMConfig.model_validate(metadata["llm_config"])
            if cfg.baseUrl and cfg.model:
                return cfg
        except Exception as exc:
            logger.warning("Invalid llm_config in metadata: %s", exc)
    return LLMConfig(
        apiKey=os.getenv("LLM_API_KEY", ""),
        baseUrl=os.getenv("LLM_BASE_URL", ""),
        model=os.getenv("LLM_MODEL", ""),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.1")),
        maxTokens=int(os.getenv("LLM_MAX_TOKENS", "2000")),
    )


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
    return text.strip()


def _extract_first_json_object(text: str) -> Optional[str]:
    """Locate the first balanced JSON object in a string."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _safe_json_loads(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    # Strip reasoning / thinking blocks (DeepSeek, Qwen, etc.)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<\|think\\|.*?\\|think\\|>", "", text, flags=re.DOTALL)
    text = _strip_code_fence(text)
    if text.startswith("{") and text.endswith("}"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    snippet = _extract_first_json_object(text)
    if snippet:
        try:
            return json.loads(snippet)
        except json.JSONDecodeError:
            pass
    return None


async def chat_complete(
    messages: List[Message],
    metadata: Optional[Dict[str, Any]] = None,
    timeout: float = 60.0,
) -> Optional[Dict[str, Any]]:
    """Call the configured LLM /chat/completions endpoint and return parsed JSON."""
    cfg = _resolve_config(metadata)
    if not cfg.baseUrl or not cfg.model:
        logger.warning("LLM not configured (baseUrl/model missing).")
        return None

    # Pull the latest user-defined tag categories so the prompt reflects them.
    try:
        cfg_doc = store_module.get_tag_config()
        categories = cfg_doc.categories
    except Exception:
        categories = None
    system_prompt = _build_system_prompt(categories)

    url = cfg.baseUrl.rstrip("/") + "/chat/completions"
    payload = {
        "model": cfg.model,
        "temperature": cfg.temperature,
        "max_tokens": cfg.maxTokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            *[{"role": m.role, "content": m.content} for m in messages],
        ],
    }
    headers = {"Content-Type": "application/json"}
    if cfg.apiKey:
        headers["Authorization"] = f"Bearer {cfg.apiKey}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("LLM HTTP error: %s", exc)
        return None

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        logger.error("Unexpected LLM response shape: %s", data)
        return None

    return _safe_json_loads(content)


_CATEGORY_ALIASES = {
    "personality": "personality",
    "性格": "personality",
    "性格特征": "personality",
    "consumption": "consumption",
    "消费": "consumption",
    "消费能力": "consumption",
    "health": "health",
    "健康": "health",
    "健康状况": "health",
    "preference": "preference",
    "偏好": "preference",
    "服务偏好": "preference",
}


def _normalize_category(value: Any) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip().lower()
    if not raw:
        return None
    return _CATEGORY_ALIASES.get(raw)


def extract_tags(parsed: Optional[Dict[str, Any]]) -> List[TagInfo]:
    if not parsed or not isinstance(parsed, dict):
        return []
    out: List[TagInfo] = []
    dropped = 0
    for t in parsed.get("tags", []) or []:
        if not isinstance(t, dict):
            dropped += 1
            continue
        cat = _normalize_category(t.get("tagCategory"))
        name = str(t.get("tagName", "")).strip()
        if not cat or not name:
            logger.warning("Drop tag without category/name: %s", t)
            dropped += 1
            continue
        try:
            value = str(t.get("tagValue", "")).strip() or name
            conf = float(t.get("confidence", 0.0) or 0.0)
            out.append(
                TagInfo(
                    tagCategory=cat,
                    tagName=name,
                    tagValue=value,
                    confidence=max(0.0, min(1.0, conf)),
                    evidence=str(t.get("evidence", "")).strip(),
                    reasoning=str(t.get("reasoning", "")).strip() or None,
                )
            )
        except Exception as exc:
            logger.warning("Skip invalid tag: %s (%s)", t, exc)
            dropped += 1
    if dropped:
        logger.info("extract_tags: kept %d, dropped %d", len(out), dropped)
    return out


def is_configured(metadata: Optional[Dict[str, Any]] = None) -> bool:
    cfg = _resolve_config(metadata)
    return bool(cfg.baseUrl and cfg.model)
