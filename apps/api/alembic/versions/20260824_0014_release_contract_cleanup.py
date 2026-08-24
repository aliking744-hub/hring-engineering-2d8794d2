"""Normalize deprecated plans to the live billing contract.

Revision ID: 20260824_0014
Revises: 20260823_0013
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260824_0014"
down_revision: str | None = "20260823_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The retired individual_expert plan had the same monthly credit allocation
    # as individual_pro. Normalize any legacy accounts to the closest live plan.
    op.execute(
        """
        UPDATE profiles
        SET subscription_tier = 'individual_pro'
        WHERE subscription_tier = 'individual_expert'
        """
    )
    op.execute(
        """
        UPDATE feature_permissions
        SET allowed_tiers = ARRAY(
            SELECT DISTINCT
                CASE
                    WHEN tier = 'individual_expert' THEN 'individual_pro'
                    ELSE tier
                END
            FROM unnest(feature_permissions.allowed_tiers) AS tier
        )
        WHERE 'individual_expert' = ANY(allowed_tiers)
        """
    )


def downgrade() -> None:
    # This normalization is intentionally irreversible: after upgrade there is
    # no reliable way to distinguish pre-existing individual_pro accounts from
    # normalized legacy accounts.
    pass
