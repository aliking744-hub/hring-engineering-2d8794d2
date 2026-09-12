"""Correct content-agent draft classification.

Revision ID: 20260912_0043
Revises: 20260909_0042
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260912_0043"
down_revision: str | None = "20260909_0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE content_articles AS article
        SET status = 'draft',
            generation_metadata_json =
                COALESCE(article.generation_metadata_json, '{}'::jsonb)
                || '{"status_reclassified_by":"20260912_0043"}'::jsonb
        FROM content_agent_settings AS settings
        WHERE article.status = 'rejected'
          AND article.origin = 'ai_editorial_agent'
          AND article.credibility_score >= settings.minimum_credibility_score
          AND article.quality_score >= settings.minimum_quality_score
        """
    )
    op.execute(
        """
        UPDATE content_agent_runs AS run
        SET status = 'drafted',
            metadata_json =
                COALESCE(run.metadata_json, '{}'::jsonb)
                || '{"status_reclassified_by":"20260912_0043"}'::jsonb
        FROM content_articles AS article
        WHERE run.article_id = article.id
          AND run.status = 'rejected'
          AND article.status = 'draft'
          AND article.generation_metadata_json->>'status_reclassified_by' = '20260912_0043'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE content_agent_runs
        SET status = 'rejected',
            metadata_json = metadata_json - 'status_reclassified_by'
        WHERE status = 'drafted'
          AND metadata_json->>'status_reclassified_by' = '20260912_0043'
        """
    )
    op.execute(
        """
        UPDATE content_articles
        SET status = 'rejected',
            generation_metadata_json =
                generation_metadata_json - 'status_reclassified_by'
        WHERE status = 'draft'
          AND generation_metadata_json->>'status_reclassified_by' = '20260912_0043'
        """
    )
