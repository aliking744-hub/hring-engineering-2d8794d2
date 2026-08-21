"""Platform admin, product settings, tenant permission overrides, and audit log.

Revision ID: 20260821_0004
Revises: 20260821_0003
Create Date: 2026-08-21
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0004"
down_revision: str | None = "20260821_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "platform_role_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "role IN ('super_admin','platform_admin','content_admin','support_admin')",
            name="ck_platform_role_assignments_role",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role", name="uq_platform_role_assignments_user_role"),
    )
    op.create_index(
        "ix_platform_role_assignments_user_id",
        "platform_role_assignments",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "company_role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("permission_key", sa.String(length=120), nullable=False),
        sa.Column("allowed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "role IN ('ceo','deputy','manager','employee')",
            name="ck_company_role_permissions_role",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "company_id",
            "role",
            "permission_key",
            name="uq_company_role_permissions_company_role_permission",
        ),
    )
    op.create_index(
        "ix_company_role_permissions_company_id",
        "company_role_permissions",
        ["company_id"],
        unique=False,
    )

    op.create_table(
        "site_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=160), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=80), server_default="general", nullable=False),
        sa.Column("value_type", sa.String(length=20), server_default="text", nullable=False),
        sa.Column("is_public", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "value_type IN ('text','boolean','number','json','url')",
            name="ck_site_settings_value_type",
        ),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_site_settings_key"),
    )
    op.create_index("ix_site_settings_key", "site_settings", ["key"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=False),
        sa.Column("resource_id", sa.String(length=160), nullable=True),
        sa.Column("outcome", sa.String(length=20), server_default="success", nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "outcome IN ('success','denied','failure')",
            name="ck_audit_logs_outcome",
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"], unique=False)
    op.create_index("ix_audit_logs_company_id", "audit_logs", ["company_id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)

    settings_table = sa.table(
        "site_settings",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("key", sa.String()),
        sa.column("value", sa.Text()),
        sa.column("label", sa.Text()),
        sa.column("category", sa.String()),
        sa.column("value_type", sa.String()),
        sa.column("is_public", sa.Boolean()),
    )
    op.bulk_insert(
        settings_table,
        [
            {
                "id": uuid4(),
                "key": "site_name",
                "value": "HRing",
                "label": "نام نرم‌افزار",
                "category": "branding",
                "value_type": "text",
                "is_public": True,
            },
            {
                "id": uuid4(),
                "key": "seo_title",
                "value": "HRing - نرم افزار جامع منابع انسانی",
                "label": "عنوان پیش‌فرض سئو",
                "category": "seo",
                "value_type": "text",
                "is_public": True,
            },
            {
                "id": uuid4(),
                "key": "seo_description",
                "value": "HRing سیستم مدیریت منابع انسانی نسل جدید؛ استخدام، تحلیل و تصمیم‌یار منابع انسانی با هوش مصنوعی.",
                "label": "توضیحات پیش‌فرض سئو",
                "category": "seo",
                "value_type": "text",
                "is_public": True,
            },
            {
                "id": uuid4(),
                "key": "seo_canonical_base_url",
                "value": "https://hring.ir",
                "label": "دامنه canonical",
                "category": "seo",
                "value_type": "url",
                "is_public": True,
            },
            {
                "id": uuid4(),
                "key": "seo_og_image",
                "value": "https://hring.ir/og-image.png",
                "label": "تصویر Open Graph",
                "category": "seo",
                "value_type": "url",
                "is_public": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_company_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_site_settings_key", table_name="site_settings")
    op.drop_table("site_settings")
    op.drop_index("ix_company_role_permissions_company_id", table_name="company_role_permissions")
    op.drop_table("company_role_permissions")
    op.drop_index("ix_platform_role_assignments_user_id", table_name="platform_role_assignments")
    op.drop_table("platform_role_assignments")
