"""
Tag category schemas – stored separately from profiles, configurable by the user.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class TagCategoryItem(BaseModel):
    name: str          # 展示名称，如 "性格特征"
    icon: str           # emoji 图标，如 "👤"
    tags: List[str]     # 候选标签列表


class TagCategoriesConfig(BaseModel):
    """All tag categories exposed as a single editable document."""

    # key = category key, value = category definition
    categories: dict[str, TagCategoryItem] = Field(default_factory=dict)

    @classmethod
    def default(cls) -> "TagCategoriesConfig":
        return cls(
            categories={
                "personality": TagCategoryItem(
                    name="性格特征",
                    icon="👤",
                    tags=[
                        "脾气大","脾气温和","容易急躁","有耐心","易怒",
                        "配合度高","不配合","挑剔","随和","固执","健谈",
                        "内向","表达清晰","表达含糊","积极","消极","焦虑","乐观",
                    ],
                ),
                "consumption": TagCategoryItem(
                    name="消费能力",
                    icon="💰",
                    tags=[
                        "高消费","中消费","低消费","价格敏感",
                        "主动咨询高端服务","无所谓","自费","医保","商业保险",
                        "专家号需求","普通门诊",
                    ],
                ),
                "health": TagCategoryItem(
                    name="健康状况",
                    icon="🏥",
                    tags=[
                        "腿脚不便","轮椅需求","行动正常","行动受限",
                        "需要陪同","独自就诊","子女代为咨询",
                        "了解病情","不了解病情","常客","新患者",
                    ],
                ),
                "preference": TagCategoryItem(
                    name="服务偏好",
                    icon="⭐",
                    tags=[
                        "VIP需求","需要特别关注","普通服务即可",
                        "快速响应","正常响应","不着急",
                        "高投诉风险","低投诉风险",
                        "高复诊意愿","低复诊意愿",
                    ],
                ),
            }
        )