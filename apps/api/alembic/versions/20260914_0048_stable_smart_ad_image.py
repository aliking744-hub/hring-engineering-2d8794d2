"""Move the Smart Ad image route from the legacy preview alias to the stable model.

Revision ID: 20260914_0048
Revises: 20260913_0047
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260914_0048"
down_revision: str | None = "20260913_0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Change only the route installed by migration 0047. An explicit admin
    # selection of another model remains authoritative.
    op.execute(
        """
        UPDATE ai_feature_routes
        SET model = 'gemini-3-pro-image',
            updated_at = now()
        WHERE feature_key = 'job_ads.smart_ad_image'
          AND provider_alias = 'avalai.primary'
          AND model = 'gemini-3-pro-image-preview'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai_feature_routes
        SET model = 'gemini-3-pro-image-preview',
            updated_at = now()
        WHERE feature_key = 'job_ads.smart_ad_image'
          AND provider_alias = 'avalai.primary'
          AND model = 'gemini-3-pro-image'
        """
    )
