"""Make the free individual plan grant zero diamonds.

Revision ID: 20260914_0049
Revises: 20260914_0048

Only untouched legacy bootstrap balances are removed. Purchased, refunded, or
admin-granted balances are preserved even if an account still has a stale free
profile projection.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260914_0049"
down_revision: str | None = "20260914_0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "profiles",
        "monthly_credits",
        existing_type=sa.Integer(),
        server_default="0",
        existing_nullable=False,
    )

    op.execute(
        """
        INSERT INTO credit_ledger_entries (
            id, account_id, reservation_id, actor_user_id, event_type, amount,
            available_delta, reserved_delta, idempotency_key, feature_key,
            reason, description, request_id, metadata_json
        )
        SELECT
            gen_random_uuid(), accounts.id, NULL, NULL, 'expire',
            accounts.available_credits, -accounts.available_credits, 0,
            'free-plan-zero:' || accounts.id::text, NULL,
            'Legacy free-plan credit removal', NULL, NULL,
            jsonb_build_object('source', 'free_plan_zero_migration')
        FROM credit_accounts AS accounts
        JOIN profiles ON profiles.id = accounts.user_id
        WHERE accounts.owner_type = 'user'
          AND profiles.subscription_tier = 'individual_free'
          AND accounts.available_credits > 0
          AND accounts.reserved_credits = 0
          AND NOT EXISTS (
              SELECT 1
              FROM credit_ledger_entries AS entries
              WHERE entries.account_id = accounts.id
                AND entries.event_type IN ('grant', 'refund', 'admin_adjustment')
                AND COALESCE(entries.metadata_json->>'source', '') <> 'legacy_projection'
          )
        ON CONFLICT (account_id, idempotency_key) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE credit_accounts AS accounts
        SET available_credits = 0,
            valid_until = NULL,
            updated_at = now()
        WHERE EXISTS (
            SELECT 1
            FROM credit_ledger_entries AS entries
            WHERE entries.account_id = accounts.id
              AND entries.idempotency_key = 'free-plan-zero:' || accounts.id::text
        )
        """
    )
    op.execute(
        """
        UPDATE profiles
        SET monthly_credits = 0,
            used_credits = 0
        WHERE subscription_tier = 'individual_free'
          AND (
              NOT EXISTS (
                  SELECT 1 FROM credit_accounts
                  WHERE credit_accounts.user_id = profiles.id
              )
              OR EXISTS (
                  SELECT 1
                  FROM credit_accounts
                  JOIN credit_ledger_entries
                    ON credit_ledger_entries.account_id = credit_accounts.id
                  WHERE credit_accounts.user_id = profiles.id
                    AND credit_ledger_entries.idempotency_key =
                        'free-plan-zero:' || credit_accounts.id::text
              )
          )
        """
    )


def downgrade() -> None:
    op.alter_column(
        "profiles",
        "monthly_credits",
        existing_type=sa.Integer(),
        server_default="50",
        existing_nullable=False,
    )
