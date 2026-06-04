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

logger = logging.getLogger(__name__)


SYSTEM_PROMPT_ZH = """你是一名医院客服对话分析师。请基于医患/客户对话内容，
输出严格符合以下 JSON 结构的标签提取结果（不要输出任何额外文字、Markdown 代码块或注释）：

{
  "summary": "string – 一句话总结整段对话（不超过 80 字）",
  "keyInsights": ["string", "..."],
  "tags": [
    {
      "tagCategory": "personality" | "consumption" | "health" | "preference",
      "tagName": "string – 特征名（尽量与候选列表一致）",
      "tagValue": "string – 特征值（尽量与候选列表一致）",
      "confidence": 0.0,
      "evidence": "string – 引用对话原文（不超过 30 字）",
      "reasoning": "string – 简要分析（不超过 40 字）"
    }
  ]
}

候选标签（请优先从这些中选用，未出现的标签可自行扩展）：
- personality (性格特征): 脾气大、脾气温和、容易急躁、有耐心、易怒、配合度高、不配合、挑剔、随和、固执、健谈、内向、表达清晰、表达含糊、积极、消极、焦虑、乐观
- consumption (消费能力): 高消费、中消费、低消费、价格敏感、主动咨询高端服务、无所谓、自费、医保、商业保险、专家号需求、普通门诊
- health (健康状况): 腿脚不便、轮椅需求、行动正常、行动受限、需要陪同、独自就诊、子女代为咨询、了解病情、不了解病情、常客、新患者
- preference (服务偏好): VIP需求、需要特别关注、普通服务即可、快速响应、正常响应、不着急、高投诉风险、低投诉风险、高复诊意愿、低复诊意愿

要求：
1. 只输出与对话内容真实相关的标签；不确定的标签不要输出。
2. confidence 范围 0~1，证据越充分数值越高。
3. keyInsights 至少给出 1 条、最多 3 条。
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


def _safe_json_loads(text: str) -> Optional[Dict[str, Any]]:
    text = _strip_code_fence(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
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

    url = cfg.baseUrl.rstrip("/") + "/chat/completions"
    payload = {
        "model": cfg.model,
        "temperature": cfg.temperature,
        "max_tokens": cfg.maxTokens,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_ZH},
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


def extract_tags(parsed: Optional[Dict[str, Any]]) -> List[TagInfo]:
    if not parsed or not isinstance(parsed, dict):
        return []
    out: List[TagInfo] = []
    for t in parsed.get("tags", []) or []:
        if not isinstance(t, dict):
            continue
        try:
            out.append(
                TagInfo(
                    tagCategory=str(t.get("tagCategory", "")).strip() or "personality",
                    tagName=str(t.get("tagName", "")).strip() or "未命名",
                    tagValue=str(t.get("tagValue", "")).strip()
                    or str(t.get("tagName", "")).strip(),
                    confidence=float(t.get("confidence", 0.0) or 0.0),
                    evidence=str(t.get("evidence", "")).strip(),
                    reasoning=str(t.get("reasoning", "")).strip() or None,
                )
            )
        except Exception as exc:
            logger.warning("Skip invalid tag: %s (%s)", t, exc)
    return out


def is_configured(metadata: Optional[Dict[str, Any]] = None) -> bool:
    cfg = _resolve_config(metadata)
    return bool(cfg.baseUrl and cfg.model)
