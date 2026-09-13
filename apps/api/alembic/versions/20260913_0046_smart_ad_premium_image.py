"""Move Smart Ad image generation to the reviewed premium AvalAI route.

Revision ID: 20260913_0046
Revises: 20260913_0045
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260913_0046"
down_revision: str | None = "20260913_0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Change only known legacy/default image routes. A later explicit admin
    # selection remains authoritative and is never overwritten by this release.
    op.execute(
        """
        UPDATE ai_feature_routes
        SET provider_alias = 'avalai.primary',
            model = 'gpt-image-2.5-flare',
            updated_at = now()
        WHERE feature_key = 'job_ads.smart_ad_image'
          AND provider_alias IN ('avalai.primary', 'gemini', 'gemini.primary')
          AND model IN (
              'gemini-3-pro-image',
              'gemini-3-pro-image-preview',
              'gemini-3-pro-image-preview-preview'
          )
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
            'job_ads.smart_ad_image',
            'avalai.primary',
            'gpt-image-2.5-flare',
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
    # Runtime routes are admin-owned state; never overwrite a later selection.
    pass
