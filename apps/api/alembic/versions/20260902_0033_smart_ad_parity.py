"""Correct Smart Ad runtime model routes without locking admin controls.

Revision ID: 20260902_0033
Revises: 20260902_0032
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260902_0033"
down_revision: str | None = "20260902_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Sonar is a search model and produced template-like job ads. Move only that
    # known-bad override to AvalAI Gemini; later admin edits remain fully supported.
    op.execute(
        """
        UPDATE ai_feature_routes
        SET provider_alias = 'avalai.primary',
            model = 'gemini-2.5-flash',
            updated_at = now()
        WHERE feature_key = 'job_ads.smart_ad_text'
          AND provider_alias = 'avalai.search'
          AND model = 'sonar'
          AND EXISTS (
              SELECT 1
              FROM integration_providers
              WHERE provider_key = 'avalai.primary'
                AND is_active = true
          )
        """
    )
    op.execute(
        """
        INSERT INTO ai_feature_routes (
            id, feature_key, provider_alias, model, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'job_ads.smart_ad_text',
            'avalai.primary',
            'gemini-2.5-flash',
            now(),
            now()
        WHERE EXISTS (
            SELECT 1
            FROM integration_providers
            WHERE provider_key = 'avalai.primary'
              AND is_active = true
        )
        ON CONFLICT (feature_key) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO ai_feature_routes (
            id, feature_key, provider_alias, model, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            'job_ads.smart_ad_image',
            'avalai.primary',
            'gemini-3-pro-image',
            now(),
            now()
        WHERE EXISTS (
            SELECT 1
            FROM integration_providers
            WHERE provider_key = 'avalai.primary'
              AND is_active = true
        )
        ON CONFLICT (feature_key) DO NOTHING
        """
    )


def downgrade() -> None:
    # Runtime routes are admin-owned state. Do not erase or overwrite later choices.
    pass
