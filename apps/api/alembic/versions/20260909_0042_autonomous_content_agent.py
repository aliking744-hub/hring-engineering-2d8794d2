"""Add the autonomous HR editorial content agent.

Revision ID: 20260909_0042
Revises: 20260908_0041
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260909_0042"
down_revision: str | None = "20260908_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SETTINGS_ID = UUID("d40bc9db-4726-54f2-8ad6-1f9d4322604c")


def upgrade() -> None:
    op.create_table(
        "content_agent_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("auto_publish", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("daily_article_count", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("publishing_times_json", postgresql.JSONB(), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Asia/Tehran"),
        sa.Column("source_domains_json", postgresql.JSONB(), nullable=False),
        sa.Column("topic_keywords_json", postgresql.JSONB(), nullable=False),
        sa.Column("lookback_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("minimum_credibility_score", sa.Integer(), nullable=False, server_default="75"),
        sa.Column("minimum_quality_score", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("author_name", sa.String(160), nullable=False, server_default="تحریریه HRing"),
        sa.Column("author_disclosure", sa.Text(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("daily_article_count BETWEEN 1 AND 2", name="content_agent_daily_count"),
        sa.CheckConstraint("minimum_credibility_score BETWEEN 60 AND 100", name="content_agent_credibility"),
        sa.CheckConstraint("minimum_quality_score BETWEEN 60 AND 100", name="content_agent_quality"),
        sa.CheckConstraint("lookback_days BETWEEN 1 AND 30", name="content_agent_lookback"),
    )
    op.create_table(
        "content_articles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(180), nullable=False, unique=True),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("seo_title", sa.String(300), nullable=False),
        sa.Column("meta_description", sa.String(320), nullable=False),
        sa.Column("focus_keyword", sa.String(160), nullable=False),
        sa.Column("related_keywords_json", postgresql.JSONB(), nullable=False),
        sa.Column("image_url", sa.Text()),
        sa.Column("author_name", sa.String(160), nullable=False),
        sa.Column("author_disclosure", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("sources_json", postgresql.JSONB(), nullable=False),
        sa.Column("credibility_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quality_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("origin", sa.String(40), nullable=False, server_default="ai_editorial_agent"),
        sa.Column("generation_metadata_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('draft','published','rejected','archived')", name="content_article_status"),
        sa.CheckConstraint("credibility_score BETWEEN 0 AND 100", name="content_article_credibility"),
        sa.CheckConstraint("quality_score BETWEEN 0 AND 100", name="content_article_quality"),
    )
    op.create_index("ix_content_articles_slug", "content_articles", ["slug"])
    op.create_index("ix_content_articles_status", "content_articles", ["status"])
    op.create_index("ix_content_articles_published_at", "content_articles", ["published_at"])
    op.create_table(
        "content_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slot_key", sa.String(120), nullable=False, unique=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="running"),
        sa.Column("trigger", sa.String(24), nullable=False, server_default="schedule"),
        sa.Column("article_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("content_articles.id", ondelete="SET NULL")),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("provider", sa.String(120)),
        sa.Column("model", sa.String(160)),
        sa.Column("sources_checked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credibility_score", sa.Integer()),
        sa.Column("quality_score", sa.Integer()),
        sa.Column("error_message", sa.Text()),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('running','published','drafted','rejected','skipped','failed')", name="content_agent_run_status"),
    )
    op.create_index("ix_content_agent_runs_slot_key", "content_agent_runs", ["slot_key"])
    op.create_index("ix_content_agent_runs_status", "content_agent_runs", ["status"])
    op.execute(
        sa.text("""
        INSERT INTO content_agent_settings (
            id, enabled, auto_publish, daily_article_count, publishing_times_json,
            timezone, source_domains_json, topic_keywords_json, lookback_days,
            minimum_credibility_score, minimum_quality_score, author_name, author_disclosure
        ) VALUES (
            CAST(:id AS uuid), FALSE, TRUE, 2, '["09:00", "17:00"]'::jsonb,
            'Asia/Tehran',
            '["shrm.org","cipd.org","ilo.org","oecd.org","weforum.org","gallup.com","mckinsey.com","deloitte.com","worklab.microsoft.com"]'::jsonb,
            '["آینده کار","جذب و استخدام","تجربه کارکنان","مدیریت عملکرد","هوش مصنوعی در منابع انسانی","یادگیری و توسعه","رهبری","سلامت سازمانی"]'::jsonb,
            7, 75, 80, 'تحریریه HRing',
            'این مقاله توسط تحریریه HRing و با کمک هوش مصنوعی، بر پایه منابع معتبر و با کنترل خودکار کیفیت تهیه شده است.'
        )
        """),
        {"id": str(SETTINGS_ID)},
    )
    # Preserve legacy articles when the old Supabase-compatible posts table was
    # previously copied into this PostgreSQL database. On clean installs this is
    # deliberately a no-op.
    op.execute(
        """
        DO $migration$
        BEGIN
          IF to_regclass('public.posts') IS NOT NULL
             AND (
               SELECT count(*) = 7
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'posts'
                 AND column_name IN ('id','title','slug','content','image_url','published','created_at')
             ) THEN
            EXECUTE $copy$
              INSERT INTO content_articles (
                id, title, slug, excerpt, content_markdown, seo_title,
                meta_description, focus_keyword, related_keywords_json,
                image_url, author_name, author_disclosure, status, published_at,
                sources_json, credibility_score, quality_score, content_hash,
                origin, generation_metadata_json, created_at, updated_at
              )
              SELECT
                id, title, slug,
                LEFT(COALESCE(NULLIF(content, ''), title), 500),
                COALESCE(content, ''), title,
                LEFT(COALESCE(NULLIF(content, ''), title), 300),
                title, '[]'::jsonb, image_url,
                'تحریریه HRing',
                'این مقاله از آرشیو پیشین HRing منتقل شده است.',
                CASE WHEN published THEN 'published' ELSE 'draft' END,
                CASE WHEN published THEN created_at ELSE NULL END,
                '[]'::jsonb, 0, 0,
                md5(id::text || COALESCE(content, '')),
                'legacy_import', '{}'::jsonb, created_at, created_at
              FROM posts
              ON CONFLICT (slug) DO NOTHING
            $copy$;
          END IF;
        END
        $migration$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_content_agent_runs_status", table_name="content_agent_runs")
    op.drop_index("ix_content_agent_runs_slot_key", table_name="content_agent_runs")
    op.drop_table("content_agent_runs")
    op.drop_index("ix_content_articles_published_at", table_name="content_articles")
    op.drop_index("ix_content_articles_status", table_name="content_articles")
    op.drop_index("ix_content_articles_slug", table_name="content_articles")
    op.drop_table("content_articles")
    op.drop_table("content_agent_settings")
