from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class ContentAgentSetting(Base):
    __tablename__ = "content_agent_settings"
    __table_args__ = (
        CheckConstraint("daily_article_count BETWEEN 1 AND 2", name="content_agent_daily_count"),
        CheckConstraint("minimum_credibility_score BETWEEN 60 AND 100", name="content_agent_credibility"),
        CheckConstraint("minimum_quality_score BETWEEN 60 AND 100", name="content_agent_quality"),
        CheckConstraint("lookback_days BETWEEN 1 AND 30", name="content_agent_lookback"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_publish: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    daily_article_count: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    publishing_times_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Tehran")
    source_domains_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    topic_keywords_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    lookback_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    minimum_credibility_score: Mapped[int] = mapped_column(Integer, nullable=False, default=75)
    minimum_quality_score: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    author_name: Mapped[str] = mapped_column(String(160), nullable=False, default="تحریریه HRing")
    author_disclosure: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ContentArticle(Base):
    __tablename__ = "content_articles"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published','rejected','archived')", name="content_article_status"),
        CheckConstraint("credibility_score BETWEEN 0 AND 100", name="content_article_credibility"),
        CheckConstraint("quality_score BETWEEN 0 AND 100", name="content_article_quality"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    seo_title: Mapped[str] = mapped_column(String(300), nullable=False)
    meta_description: Mapped[str] = mapped_column(String(320), nullable=False)
    focus_keyword: Mapped[str] = mapped_column(String(160), nullable=False)
    related_keywords_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    author_name: Mapped[str] = mapped_column(String(160), nullable=False)
    author_disclosure: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    sources_json: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    credibility_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    origin: Mapped[str] = mapped_column(String(40), nullable=False, default="ai_editorial_agent")
    generation_metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ContentAgentRun(Base):
    __tablename__ = "content_agent_runs"
    __table_args__ = (
        CheckConstraint("status IN ('running','published','drafted','rejected','skipped','failed')", name="content_agent_run_status"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slot_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="running", index=True)
    trigger: Mapped[str] = mapped_column(String(24), nullable=False, default="schedule")
    article_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("content_articles.id", ondelete="SET NULL"), nullable=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    provider: Mapped[str | None] = mapped_column(String(120), nullable=True)
    model: Mapped[str | None] = mapped_column(String(160), nullable=True)
    sources_checked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    credibility_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

