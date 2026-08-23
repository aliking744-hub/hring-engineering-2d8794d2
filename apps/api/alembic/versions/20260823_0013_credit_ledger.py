"""Append-only credit ledger and reservation projection.

Revision ID: 20260823_0013
Revises: 20260823_0012
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260823_0013"
down_revision: str | None = "20260823_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "credit_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_type", sa.String(length=16), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("available_credits", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("reserved_credits", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(owner_type = 'user' AND user_id IS NOT NULL AND company_id IS NULL) "
            "OR (owner_type = 'company' AND company_id IS NOT NULL AND user_id IS NULL)",
            name="ck_credit_accounts_owner_scope",
        ),
        sa.CheckConstraint(
            "available_credits >= 0",
            name="ck_credit_accounts_available_nonnegative",
        ),
        sa.CheckConstraint(
            "reserved_credits >= 0",
            name="ck_credit_accounts_reserved_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_credit_accounts_user_id_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name="fk_credit_accounts_company_id_companies",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_credit_accounts"),
        sa.UniqueConstraint("user_id", name="uq_credit_accounts_user_id"),
        sa.UniqueConstraint("company_id", name="uq_credit_accounts_company_id"),
    )
    op.create_index("ix_credit_accounts_owner_type", "credit_accounts", ["owner_type"])

    op.create_table(
        "credit_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("feature_key", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=160), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active','consumed','released','expired')",
            name="ck_credit_reservations_status",
        ),
        sa.CheckConstraint("amount > 0", name="ck_credit_reservations_amount_positive"),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["credit_accounts.id"],
            name="fk_credit_reservations_account_id_credit_accounts",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_credit_reservations_created_by_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_credit_reservations"),
        sa.UniqueConstraint(
            "account_id",
            "idempotency_key",
            name="uq_credit_reservations_account_idempotency_key",
        ),
    )
    op.create_index("ix_credit_reservations_account_id", "credit_reservations", ["account_id"])
    op.create_index("ix_credit_reservations_status", "credit_reservations", ["status"])
    op.create_index("ix_credit_reservations_request_id", "credit_reservations", ["request_id"])

    op.create_table(
        "credit_ledger_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reservation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=24), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("available_delta", sa.BigInteger(), nullable=False),
        sa.Column("reserved_delta", sa.BigInteger(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=200), nullable=False),
        sa.Column("feature_key", sa.String(length=120), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=160), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "event_type IN "
            "('grant','reserve','consume','release','refund','expire','admin_adjustment')",
            name="ck_credit_ledger_entries_event_type",
        ),
        sa.CheckConstraint("amount > 0", name="ck_credit_ledger_entries_amount_positive"),
        sa.CheckConstraint(
            "available_delta <> 0 OR reserved_delta <> 0",
            name="ck_credit_ledger_entries_nonzero_delta",
        ),
        sa.CheckConstraint(
            "event_type <> 'admin_adjustment' "
            "OR (reason IS NOT NULL AND length(trim(reason)) >= 3 "
            "AND actor_user_id IS NOT NULL)",
            name="ck_credit_ledger_entries_admin_reason",
        ),
        sa.CheckConstraint(
            "(event_type IN ('grant','refund') AND available_delta = amount "
            "AND reserved_delta = 0) "
            "OR (event_type = 'reserve' AND available_delta = -amount "
            "AND reserved_delta = amount) "
            "OR (event_type = 'consume' AND available_delta = 0 "
            "AND reserved_delta = -amount) "
            "OR (event_type = 'release' AND available_delta = amount "
            "AND reserved_delta = -amount) "
            "OR (event_type = 'expire' AND "
            "((available_delta = -amount AND reserved_delta = 0) "
            "OR (available_delta = amount AND reserved_delta = -amount))) "
            "OR (event_type = 'admin_adjustment' AND reserved_delta = 0 "
            "AND (available_delta = amount OR available_delta = -amount))",
            name="ck_credit_ledger_entries_event_deltas",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["credit_accounts.id"],
            name="fk_credit_ledger_entries_account_id_credit_accounts",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["credit_reservations.id"],
            name="fk_credit_ledger_entries_reservation_id_credit_reservations",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name="fk_credit_ledger_entries_actor_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_credit_ledger_entries"),
        sa.UniqueConstraint(
            "account_id",
            "idempotency_key",
            name="uq_credit_ledger_entries_account_idempotency_key",
        ),
    )
    op.create_index("ix_credit_ledger_entries_account_id", "credit_ledger_entries", ["account_id"])
    op.create_index(
        "ix_credit_ledger_entries_reservation_id", "credit_ledger_entries", ["reservation_id"]
    )
    op.create_index("ix_credit_ledger_entries_event_type", "credit_ledger_entries", ["event_type"])
    op.create_index(
        "ix_credit_ledger_entries_feature_key", "credit_ledger_entries", ["feature_key"]
    )
    op.create_index("ix_credit_ledger_entries_request_id", "credit_ledger_entries", ["request_id"])
    op.create_index("ix_credit_ledger_entries_created_at", "credit_ledger_entries", ["created_at"])
    op.create_index(
        "ix_credit_ledger_entries_account_created",
        "credit_ledger_entries",
        ["account_id", "created_at"],
    )

    op.execute(
        """
        INSERT INTO credit_accounts (
            id, owner_type, user_id, company_id, available_credits, reserved_credits
        )
        SELECT
            gen_random_uuid(), 'user', profiles.id, NULL,
            GREATEST(profiles.monthly_credits - profiles.used_credits, 0), 0
        FROM profiles
        """
    )
    op.execute(
        """
        INSERT INTO credit_accounts (
            id, owner_type, user_id, company_id, available_credits, reserved_credits
        )
        SELECT
            gen_random_uuid(), 'company', NULL, companies.id,
            CASE
                WHEN COALESCE(companies.credit_pool_enabled, false)
                    THEN GREATEST(COALESCE(companies.credit_pool, 0), 0)
                ELSE GREATEST(companies.monthly_credits - companies.used_credits, 0)
            END,
            0
        FROM companies
        """
    )
    op.execute(
        """
        INSERT INTO credit_ledger_entries (
            id, account_id, reservation_id, actor_user_id, event_type, amount,
            available_delta, reserved_delta, idempotency_key, feature_key,
            reason, description, request_id, metadata_json
        )
        SELECT
            gen_random_uuid(), accounts.id, NULL, NULL, 'grant', accounts.available_credits,
            accounts.available_credits, 0,
            'backfill:' || accounts.owner_type || ':' ||
                COALESCE(accounts.user_id::text, accounts.company_id::text),
            NULL, 'Legacy credit projection backfill', NULL, NULL,
            jsonb_build_object('source', 'legacy_projection')
        FROM credit_accounts AS accounts
        WHERE accounts.available_credits > 0
        """
    )

    op.execute(
        """
        CREATE FUNCTION hring_prevent_credit_ledger_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'credit_ledger_entries is append-only';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER credit_ledger_entries_append_only
        BEFORE UPDATE OR DELETE ON credit_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION hring_prevent_credit_ledger_mutation()
        """
    )
    op.execute(
        """
        CREATE TRIGGER credit_ledger_entries_no_truncate
        BEFORE TRUNCATE ON credit_ledger_entries
        FOR EACH STATEMENT EXECUTE FUNCTION hring_prevent_credit_ledger_mutation()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS credit_ledger_entries_no_truncate ON credit_ledger_entries")
    op.execute("DROP TRIGGER IF EXISTS credit_ledger_entries_append_only ON credit_ledger_entries")
    op.execute("DROP FUNCTION IF EXISTS hring_prevent_credit_ledger_mutation()")
    op.drop_index("ix_credit_ledger_entries_account_created", table_name="credit_ledger_entries")
    op.drop_index("ix_credit_ledger_entries_created_at", table_name="credit_ledger_entries")
    op.drop_index("ix_credit_ledger_entries_request_id", table_name="credit_ledger_entries")
    op.drop_index("ix_credit_ledger_entries_feature_key", table_name="credit_ledger_entries")
    op.drop_index("ix_credit_ledger_entries_event_type", table_name="credit_ledger_entries")
    op.drop_index("ix_credit_ledger_entries_reservation_id", table_name="credit_ledger_entries")
    op.drop_index("ix_credit_ledger_entries_account_id", table_name="credit_ledger_entries")
    op.drop_table("credit_ledger_entries")
    op.drop_index("ix_credit_reservations_request_id", table_name="credit_reservations")
    op.drop_index("ix_credit_reservations_status", table_name="credit_reservations")
    op.drop_index("ix_credit_reservations_account_id", table_name="credit_reservations")
    op.drop_table("credit_reservations")
    op.drop_index("ix_credit_accounts_owner_type", table_name="credit_accounts")
    op.drop_table("credit_accounts")
