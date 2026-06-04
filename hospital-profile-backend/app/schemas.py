"""
Pydantic schemas matching the frontend types (src/types/index.ts).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class LLMConfig(BaseModel):
    apiKey: str = ""
    baseUrl: str = ""
    model: str = ""
    temperature: float = 0.1
    maxTokens: int = 2000


class Message(BaseModel):
    role: str  # 'user' | 'assistant' | 'system'
    content: str


class TagInfo(BaseModel):
    id: Optional[str] = None
    tagCategory: str
    tagName: str
    tagValue: str
    confidence: float = 0.0
    evidence: str = ""
    reasoning: Optional[str] = None
    updatedAt: Optional[str] = None


class ConversationInput(BaseModel):
    userId: str
    conversationId: Optional[str] = None
    messages: List[Message]
    metadata: Optional[Dict[str, Any]] = None


class AnalysisResult(BaseModel):
    userId: str
    extractedTags: List[TagInfo]
    summary: str = ""
    keyInsights: List[str] = Field(default_factory=list)


class MemoryInfo(BaseModel):
    memoryId: str
    content: str
    category: Optional[str] = None
    importance: float = 0.5
    createdAt: str
    lastAccessed: Optional[str] = None


class PatientProfile(BaseModel):
    userId: str
    userName: Optional[str] = None
    phone: Optional[str] = None
    profileVersion: int = 0
    lastInteraction: Optional[str] = None
    updatedAt: Optional[str] = None
    tags: List[TagInfo] = Field(default_factory=list)
    tagsByCategory: Dict[str, List[TagInfo]] = Field(default_factory=dict)
    memories: Optional[List[MemoryInfo]] = None


class UpdateProfileRequest(BaseModel):
    user_id: str
    tags: List[TagInfo]
    source_conversation_id: Optional[str] = None


class ApiResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str = "hospital-profile-backend"
    version: str = "0.1.0"
    llm_configured: bool = False
    time: Optional[str] = None


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"
