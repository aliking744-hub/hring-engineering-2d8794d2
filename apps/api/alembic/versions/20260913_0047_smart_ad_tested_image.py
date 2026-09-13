"""Select the level-two-available, field-tested Smart Ad image model.

Revision ID: 20260913_0047
Revises: 20260913_0046
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260913_0047"
down_revision: str | None = "20260913_0046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Replace only the temporary model selected by the preceding release.
    # Any explicit later admin selection remains authoritative.
    op.execute(
        """
        UPDATE ai_feature_routes
        SET provider_alias = 'avalai.primary',
            model = 'gemini-3-pro-image-preview',
            updated_at = now()
        WHERE feature_key = 'job_ads.smart_ad_image'
          AND provider_alias = 'avalai.primary'
          AND model = 'gpt-image-2.5-flare'
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
            'gemini-3-pro-image-preview',
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
