"""
FastAPI entry point – exposes the same /api/v1 surface the frontend expects.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import llm, store as store_module
from .schemas import (
    AnalysisResult,
    ApiResponse,
    ConversationInput,
    HealthResponse,
    PatientProfile,
    TagInfo,
    UpdateProfileRequest,
    now_iso,
)
from .schemas_tag import TagCategoriesConfig, TagCategoryItem
from .store import BaseStore
from fastapi import HTTPException
from pydantic import BaseModel


class StatsResponse(BaseModel):
    totalUsers: int = 0
    totalTags: int = 0
    totalMemories: int = 0
    analyzedToday: int = 0

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hospital-profile-backend")

DATA_PATH = os.getenv("DATA_PATH", "./data/profiles.json")
os.makedirs(os.path.dirname(DATA_PATH) or ".", exist_ok=True)

store: BaseStore = BaseStore.from_env()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Backend ready, data file: %s", DATA_PATH)
    yield


app = FastAPI(
    title="医院客户画像分析系统 - 后端",
    version="0.1.0",
    lifespan=lifespan,
)

# Permissive CORS – the frontend is a Vite dev server on :5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- root ----------
@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "service": "hospital-profile-backend",
        "version": "0.1.0",
        "docs": "/docs",
        "api_prefix": "/api/v1",
    }


# ---------- /api/v1/health ----------
@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        time=now_iso(),
        llm_configured=llm.is_configured(),
    )


# ---------- /api/v1/analyze ----------
@app.post("/api/v1/analyze", response_model=AnalysisResult)
async def analyze(payload: ConversationInput) -> AnalysisResult:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")
    if not payload.userId.strip():
        raise HTTPException(status_code=400, detail="userId 不能为空")

    parsed = await llm.chat_complete(payload.messages, payload.metadata)
    tags: list[TagInfo] = llm.extract_tags(parsed)

    summary = ""
    insights: list[str] = []
    if parsed and isinstance(parsed, dict):
        summary = str(parsed.get("summary", "")).strip()
        raw_insights = parsed.get("keyInsights", []) or []
        insights = [str(x).strip() for x in raw_insights if str(x).strip()]

    # Always remember the conversation as a memory
    conversation_text = "\n".join(
        f"{m.role}: {m.content}" for m in payload.messages if m.content.strip()
    )
    if conversation_text:
        store.add_memory(
            payload.userId,
            content=conversation_text,
            category="conversation",
            importance=0.6,
        )

    # Always create-or-update the profile so /stats reflects this user
    store.update_profile(
        user_id=payload.userId,
        tags=tags,
        source_conversation_id=payload.conversationId,
    )

    return AnalysisResult(
        userId=payload.userId,
        extractedTags=tags,
        summary=summary,
        keyInsights=insights,
    )


# ---------- /api/v1/stats ----------
@app.get("/api/v1/stats", response_model=StatsResponse)
def get_stats() -> StatsResponse:
    all_profiles = store.list_all_profiles()
    all_memories = store.list_all_memories()
    total_users = len(all_profiles)
    total_tags = sum(len(p.tags) for p in all_profiles.values())
    total_memories = sum(len(m) for m in all_memories.values())
    today = now_iso()[:10]
    analyzed_today = sum(
        1 for p in all_profiles.values()
        if p.lastInteraction and p.lastInteraction[:10] == today
    )
    return StatsResponse(
        totalUsers=total_users,
        totalTags=total_tags,
        totalMemories=total_memories,
        analyzedToday=analyzed_today,
    )


# ---------- /api/v1/tags/categories ----------
@app.get("/api/v1/tags/categories", response_model=TagCategoriesConfig)
def get_tag_categories() -> TagCategoriesConfig:
    return store_module.get_tag_config()


class UpdateTagCategoriesRequest(BaseModel):
    categories: dict[str, TagCategoryItem]


@app.put("/api/v1/tags/categories", response_model=TagCategoriesConfig)
def update_tag_categories(req: UpdateTagCategoriesRequest) -> TagCategoriesConfig:
    return store_module.update_tag_categories(req.categories)


@app.get("/api/v1/profiles/{user_id}", response_model=PatientProfile)
def get_profile(user_id: str, include_memories: bool = False) -> PatientProfile:
    prof = store.get_or_create_profile(user_id)
    if include_memories:
        prof.memories = store.get_memories(user_id)
    return prof


@app.post("/api/v1/profiles/update", response_model=ApiResponse)
def update_profile(req: UpdateProfileRequest) -> ApiResponse:
    prof = store.update_profile(
        user_id=req.user_id,
        tags=req.tags,
        source_conversation_id=req.source_conversation_id,
    )
    return ApiResponse(success=True, data=prof)


@app.get("/api/v1/profiles/{user_id}/tags")
def get_profile_tags(user_id: str, category: str | None = None) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "tags": [t.model_dump() for t in store.get_tags(user_id, category)],
    }


@app.get("/api/v1/profiles/{user_id}/similar")
def get_similar_patients(user_id: str, limit: int = 5) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "similar_patients": store.find_similar_patients(user_id, limit=limit),
    }


@app.delete("/api/v1/profiles/{user_id}/tags/{tag_id}", response_model=ApiResponse)
def delete_tag(user_id: str, tag_id: str) -> ApiResponse:
    ok = store.delete_tag(user_id, tag_id)
    if not ok:
        return ApiResponse(success=False, error="标签不存在")
    prof = store.get_profile(user_id)
    return ApiResponse(success=True, data=prof)
