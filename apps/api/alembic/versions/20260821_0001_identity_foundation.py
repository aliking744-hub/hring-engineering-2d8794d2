"""Independent identity, tenancy, and RBAC foundation.

Revision ID: 20260821_0001
Revises:
Create Date: 2026-08-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "user_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_sessions_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_user_sessions"),
        sa.UniqueConstraint("refresh_token_hash", name="uq_user_sessions_refresh_token_hash"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"], unique=False)

    op.create_table(
        "external_identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_subject", sa.String(length=255), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_external_identities_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_external_identities"),
        sa.UniqueConstraint("provider", "provider_subject", name="uq_external_identities_provider_subject"),
        sa.UniqueConstraint("user_id", "provider", name="uq_external_identities_user_provider"),
    )
    op.create_index("ix_external_identities_user_id", "external_identities", ["user_id"], unique=False)

    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=True),
        sa.Column("full_name", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("user_type", sa.String(length=40), server_default="individual", nullable=False),
        sa.Column("subscription_tier", sa.String(length=64), server_default="individual_free", nullable=True),
        sa.Column("monthly_credits", sa.Integer(), server_default="50", nullable=False),
        sa.Column("used_credits", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_credit_reset", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id"], ["users.id"], name="fk_profiles_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_profiles"),
    )

    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("domain", postgresql.CITEXT(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("subscription_tier", sa.String(length=64), server_default="corporate_expert", nullable=False),
        sa.Column("monthly_credits", sa.Integer(), server_default="100", nullable=False),
        sa.Column("used_credits", sa.Integer(), server_default="0", nullable=False),
        sa.Column("max_members", sa.Integer(), server_default="10", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_credit_reset", sa.DateTime(timezone=True), nullable=True),
        sa.Column("credit_pool", sa.Integer(), server_default="0", nullable=True),
        sa.Column("credit_pool_enabled", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.CheckConstraint("status IN ('active','suspended','trial')", name="ck_companies_status"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_companies_created_by_users", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_companies"),
        sa.UniqueConstraint("domain", name="uq_companies_domain"),
    )

    op.create_table(
        "company_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="employee", nullable=False),
        sa.Column("can_invite", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('ceo','deputy','manager','employee')", name="ck_company_members_role"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name="fk_company_members_company_id_companies", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_company_members_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], name="fk_company_members_invited_by_users", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_company_members"),
        sa.UniqueConstraint("company_id", "user_id", name="uq_company_members_company_user"),
    )
    op.create_index("ix_company_members_company_id", "company_members", ["company_id"], unique=False)
    op.create_index("ix_company_members_user_id", "company_members", ["user_id"], unique=False)

    op.create_table(
        "company_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invite_code", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="employee", nullable=False),
        sa.Column("max_uses", sa.Integer(), server_default="1", nullable=True),
        sa.Column("used_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.CheckConstraint("role IN ('ceo','deputy','manager','employee')", name="ck_company_invites_role"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name="fk_company_invites_company_id_companies", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_company_invites_created_by_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_company_invites"),
        sa.UniqueConstraint("invite_code", name="uq_company_invites_invite_code"),
    )
    op.create_index("ix_company_invites_company_id", "company_invites", ["company_id"], unique=False)

    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('admin','moderator','user')", name="ck_user_roles_role"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_roles_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_user_roles"),
        sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"], unique=False)

    op.create_table(
        "feature_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feature_key", sa.String(length=120), nullable=False),
        sa.Column("feature_name", sa.Text(), nullable=False),
        sa.Column("feature_category", sa.String(length=80), server_default="general", nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("allowed_tiers", postgresql.ARRAY(sa.String(length=64)), server_default=sa.text("'{}'::varchar[]"), nullable=False),
        sa.Column("allowed_company_roles", postgresql.ARRAY(sa.String(length=20)), nullable=True),
        sa.Column("allow_view", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("allow_edit", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("credit_cost", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_feature_permissions"),
        sa.UniqueConstraint("feature_key", name="uq_feature_permissions_feature_key"),
    )

    op.create_table(
        "compass_user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="manager", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("full_name", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("diamonds", sa.Integer(), server_default="100", nullable=False),
        sa.Column("accessible_sections", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("can_edit", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.CheckConstraint("role IN ('ceo','deputy','manager','expert')", name="ck_compass_user_roles_role"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_compass_user_roles_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_compass_user_roles"),
        sa.UniqueConstraint("user_id", name="uq_compass_user_roles_user_id"),
    )


def downgrade() -> None:
    op.drop_table("compass_user_roles")
    op.drop_table("feature_permissions")
    op.drop_index("ix_user_roles_user_id", table_name="user_roles")
    op.drop_table("user_roles")
    op.drop_index("ix_company_invites_company_id", table_name="company_invites")
    op.drop_table("company_invites")
    op.drop_index("ix_company_members_user_id", table_name="company_members")
    op.drop_index("ix_company_members_company_id", table_name="company_members")
    op.drop_table("company_members")
    op.drop_table("companies")
    op.drop_table("profiles")
    op.drop_index("ix_external_identities_user_id", table_name="external_identities")
    op.drop_table("external_identities")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
