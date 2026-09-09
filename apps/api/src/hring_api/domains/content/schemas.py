from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


DEFAULT_SOURCE_DOMAINS = [
    "shrm.org", "cipd.org", "ilo.org", "oecd.org", "weforum.org",
    "gallup.com", "mckinsey.com", "deloitte.com", "worklab.microsoft.com",
]
DEFAULT_TOPIC_KEYWORDS = [
    "آینده کار", "جذب و استخدام", "تجربه کارکنان", "مدیریت عملکرد",
    "هوش مصنوعی در منابع انسانی", "یادگیری و توسعه", "رهبری", "سلامت سازمانی",
]


class ContentAgentSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    enabled: bool
    auto_publish: bool
    daily_article_count: int
    publishing_times_json: list[str]
    timezone: str
    source_domains_json: list[str]
    topic_keywords_json: list[str]
    lookback_days: int
    minimum_credibility_score: int
    minimum_quality_score: int
    author_name: str
    author_disclosure: str
    updated_at: datetime


class UpdateContentAgentSettingsRequest(BaseModel):
    enabled: bool
    auto_publish: bool = True
    daily_article_count: int = Field(default=2, ge=1, le=2)
    publishing_times_json: list[str] = Field(min_length=1, max_length=2)
    timezone: str = Field(default="Asia/Tehran", pattern=r"^Asia/Tehran$")
    source_domains_json: list[str] = Field(min_length=3, max_length=20)
    topic_keywords_json: list[str] = Field(min_length=3, max_length=30)
    lookback_days: int = Field(default=7, ge=1, le=30)
    minimum_credibility_score: int = Field(default=75, ge=60, le=100)
    minimum_quality_score: int = Field(default=80, ge=60, le=100)
    author_name: str = Field(default="تحریریه HRing", min_length=3, max_length=160)
    author_disclosure: str = Field(min_length=10, max_length=500)

    @field_validator("publishing_times_json")
    @classmethod
    def validate_times(cls, values: list[str]) -> list[str]:
        import re
        normalized = list(dict.fromkeys(value.strip() for value in values))
        if any(re.fullmatch(r"(?:[01]\d|2[0-3]):(?:00|15|30|45)", value) is None for value in normalized):
            raise ValueError("Publishing times must use HH:MM and 15-minute intervals")
        return normalized

    @field_validator("source_domains_json")
    @classmethod
    def validate_domains(cls, values: list[str]) -> list[str]:
        import re
        normalized = list(dict.fromkeys(value.lower().strip().removeprefix("www.") for value in values))
        if any(re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", value) is None for value in normalized):
            raise ValueError("Only bare HTTPS source domains are allowed")
        return normalized


class ContentSourceResponse(BaseModel):
    url: str
    title: str | None = None
    published_at: str | None = None


class ContentArticleResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    excerpt: str
    content_markdown: str
    seo_title: str
    meta_description: str
    focus_keyword: str
    related_keywords: list[str]
    image_url: str | None
    author_name: str
    author_disclosure: str
    status: str
    published_at: datetime | None
    sources: list[ContentSourceResponse]
    credibility_score: int
    quality_score: int
    created_at: datetime
    updated_at: datetime


class ContentAgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    slot_key: str
    status: str
    trigger: str
    article_id: UUID | None
    provider: str | None
    model: str | None
    sources_checked: int
    credibility_score: int | None
    quality_score: int | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None


class ArticleStatusRequest(BaseModel):
    status: str = Field(pattern=r"^(draft|published|archived)$")


class TriggerContentAgentResponse(BaseModel):
    accepted: bool
    task_id: str
