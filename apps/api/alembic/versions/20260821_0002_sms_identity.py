"""Add phone identities and SMS OTP challenges.

Revision ID: 20260821_0002
Revises: 20260821_0001
Create Date: 2026-08-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0002"
down_revision: str | None = "20260821_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "phone_identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone_e164", sa.String(length=24), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_phone_identities_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_phone_identities"),
        sa.UniqueConstraint("user_id", name="uq_phone_identities_user_id"),
        sa.UniqueConstraint("phone_e164", name="uq_phone_identities_phone_e164"),
    )
    op.create_index("ix_phone_identities_user_id", "phone_identities", ["user_id"], unique=False)
    op.create_index("ix_phone_identities_phone_e164", "phone_identities", ["phone_e164"], unique=False)

    op.create_table(
        "sms_otp_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone_e164", sa.String(length=24), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purpose", sa.String(length=32), server_default="login", nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_sms_otp_challenges_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_sms_otp_challenges"),
    )
    op.create_index("ix_sms_otp_challenges_phone_e164", "sms_otp_challenges", ["phone_e164"], unique=False)
    op.create_index("ix_sms_otp_challenges_user_id", "sms_otp_challenges", ["user_id"], unique=False)
    op.create_index("ix_sms_otp_challenges_created_at", "sms_otp_challenges", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sms_otp_challenges_created_at", table_name="sms_otp_challenges")
    op.drop_index("ix_sms_otp_challenges_user_id", table_name="sms_otp_challenges")
    op.drop_index("ix_sms_otp_challenges_phone_e164", table_name="sms_otp_challenges")
    op.drop_table("sms_otp_challenges")
    op.drop_index("ix_phone_identities_phone_e164", table_name="phone_identities")
    op.drop_index("ix_phone_identities_user_id", table_name="phone_identities")
    op.drop_table("phone_identities")
