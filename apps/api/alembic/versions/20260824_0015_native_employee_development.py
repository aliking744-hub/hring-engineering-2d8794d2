"""Promote onboarding and learning paths to native typed storage.

Revision ID: 20260824_0015
Revises: 20260824_0014
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260824_0015"
down_revision: str | None = "20260824_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "development_onboarding_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("job_title", sa.Text(), nullable=False),
        sa.Column("seniority", sa.String(length=32), nullable=False),
        sa.Column("expectation", sa.String(length=48), nullable=False),
        sa.Column("mentor_role", sa.Text(), nullable=True),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("welcome_email", sa.Text(), nullable=False),
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
            "seniority IN ('junior','mid','senior','lead')",
            name="seniority",
        ),
        sa.CheckConstraint(
            "expectation IN ('quick_delivery','learning','leadership','innovation')",
            name="expectation",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_development_onboarding_plans_owner_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name="fk_development_onboarding_plans_company_id_companies",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_development_onboarding_plans"),
        sa.UniqueConstraint(
            "owner_user_id",
            "idempotency_key",
            name="uq_development_onboarding_plans_owner_idempotency",
        ),
    )
    op.create_index(
        "ix_development_onboarding_plans_owner_user_id",
        "development_onboarding_plans",
        ["owner_user_id"],
    )
    op.create_index(
        "ix_development_onboarding_plans_company_id",
        "development_onboarding_plans",
        ["company_id"],
    )
    op.create_index(
        "ix_development_onboarding_plans_created_at",
        "development_onboarding_plans",
        ["created_at"],
    )

    op.create_table(
        "development_learning_paths",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("idempotency_key", sa.String(length=80), nullable=False),
        sa.Column("employee_name", sa.Text(), nullable=False),
        sa.Column("employee_email", sa.String(length=320), nullable=True),
        sa.Column("job_title", sa.Text(), nullable=False),
        sa.Column("industry", sa.Text(), nullable=False),
        sa.Column("seniority_level", sa.String(length=40), nullable=False),
        sa.Column("education_level", sa.String(length=40), nullable=False),
        sa.Column("field_of_study", sa.Text(), nullable=True),
        sa.Column("experience_years", sa.Integer(), nullable=False),
        sa.Column("training_months", sa.Integer(), nullable=True),
        sa.Column(
            "result",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("last_emailed_at", sa.DateTime(timezone=True), nullable=True),
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
            "experience_years >= 0 AND experience_years <= 60",
            name="experience_years",
        ),
        sa.CheckConstraint(
            "training_months IS NULL OR (training_months >= 1 AND training_months <= 24)",
            name="training_months",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(result) = 'object'",
            name="result_object",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_development_learning_paths_owner_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name="fk_development_learning_paths_company_id_companies",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_development_learning_paths"),
        sa.UniqueConstraint(
            "owner_user_id",
            "idempotency_key",
            name="uq_development_learning_paths_owner_idempotency",
        ),
    )
    op.create_index(
        "ix_development_learning_paths_owner_user_id",
        "development_learning_paths",
        ["owner_user_id"],
    )
    op.create_index(
        "ix_development_learning_paths_company_id",
        "development_learning_paths",
        ["company_id"],
    )
    op.create_index(
        "ix_development_learning_paths_created_at",
        "development_learning_paths",
        ["created_at"],
    )

    # Copy legacy personal records without deleting the compatibility source.
    # Invalid/unstructured records remain in compat_records for manual recovery.
    op.execute(
        r"""
        INSERT INTO development_learning_paths (
            id, owner_user_id, company_id, idempotency_key,
            employee_name, employee_email, job_title, industry,
            seniority_level, education_level, field_of_study,
            experience_years, training_months, result, created_at, updated_at
        )
        SELECT
            CASE
                WHEN records.record_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    THEN records.record_id::uuid
                ELSE records.id
            END,
            records.owner_user_id,
            records.company_id,
            left('legacy:' || records.record_id, 80),
            COALESCE(NULLIF(records.data->>'employee_name', ''), '—'),
            left(NULLIF(records.data->>'employee_email', ''), 320),
            COALESCE(NULLIF(records.data->>'job_title', ''), 'نامشخص'),
            COALESCE(NULLIF(records.data->>'industry', ''), 'نامشخص'),
            left(COALESCE(NULLIF(records.data->>'seniority_level', ''), 'Junior'), 40),
            left(COALESCE(NULLIF(records.data->>'education_level', ''), 'Diploma'), 40),
            NULLIF(records.data->>'field_of_study', ''),
            CASE
                WHEN records.data->>'experience_years' ~ '^[0-9]{1,2}$'
                    THEN LEAST((records.data->>'experience_years')::integer, 60)
                ELSE 0
            END,
            CASE
                WHEN records.data->>'training_months' ~ '^[0-9]{1,2}$'
                    THEN GREATEST(1, LEAST((records.data->>'training_months')::integer, 24))
                ELSE NULL
            END,
            records.data->'result',
            records.created_at,
            records.updated_at
        FROM compat_records AS records
        WHERE records.table_name = 'learning_path_records'
          AND records.owner_user_id IS NOT NULL
          AND jsonb_typeof(records.data->'result') = 'object'
        ON CONFLICT (id) DO NOTHING
        """
    )

    # Preserve any admin-selected model routes and costs under the native keys.
    op.execute(
        """
        INSERT INTO ai_feature_routes (
            id, feature_key, provider_alias, model, updated_by, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            CASE feature_key
                WHEN 'compat.generate-onboarding-plan' THEN 'development.onboarding_plan'
                WHEN 'compat.generate-learning-path' THEN 'development.learning_path'
            END,
            provider_alias, model, updated_by, created_at, updated_at
        FROM ai_feature_routes
        WHERE feature_key IN (
            'compat.generate-onboarding-plan',
            'compat.generate-learning-path'
        )
        ON CONFLICT (feature_key) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO feature_permissions (
            id, feature_key, feature_name, feature_category, description,
            allowed_tiers, allowed_company_roles, allow_view, allow_edit,
            credit_cost, is_active, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            CASE feature_key
                WHEN 'compat.generate-onboarding-plan' THEN 'development.onboarding_plan'
                WHEN 'compat.generate-learning-path' THEN 'development.learning_path'
            END,
            feature_name, feature_category, description,
            allowed_tiers, allowed_company_roles, allow_view, allow_edit,
            CASE WHEN credit_cost > 0 THEN credit_cost ELSE 15 END,
            is_active, created_at, updated_at
        FROM feature_permissions
        WHERE feature_key IN (
            'compat.generate-onboarding-plan',
            'compat.generate-learning-path'
        )
        ON CONFLICT (feature_key) DO NOTHING
        """
    )


def downgrade() -> None:
    # Copy all native records back before removing typed tables. Existing legacy
    # rows are updated so a code rollback sees the latest native representation.
    op.execute(
        """
        INSERT INTO compat_records (
            id, table_name, record_id, owner_user_id, company_id,
            data, created_at, updated_at
        )
        SELECT
            gen_random_uuid(), 'learning_path_records', paths.id::text,
            paths.owner_user_id, paths.company_id,
            jsonb_build_object(
                'id', paths.id::text,
                'user_id', paths.owner_user_id::text,
                'employee_name', paths.employee_name,
                'employee_email', paths.employee_email,
                'job_title', paths.job_title,
                'industry', paths.industry,
                'seniority_level', paths.seniority_level,
                'education_level', paths.education_level,
                'field_of_study', paths.field_of_study,
                'experience_years', paths.experience_years,
                'training_months', paths.training_months,
                'result', paths.result,
                'created_at', paths.created_at
            ),
            paths.created_at, paths.updated_at
        FROM development_learning_paths AS paths
        ON CONFLICT (table_name, record_id) DO UPDATE
        SET owner_user_id = EXCLUDED.owner_user_id,
            company_id = EXCLUDED.company_id,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
        """
    )
    op.execute(
        """
        INSERT INTO compat_records (
            id, table_name, record_id, owner_user_id, company_id,
            data, created_at, updated_at
        )
        SELECT
            gen_random_uuid(), 'development_onboarding_plans_archive', plans.id::text,
            plans.owner_user_id, plans.company_id,
            jsonb_build_object(
                'id', plans.id::text,
                'user_id', plans.owner_user_id::text,
                'job_title', plans.job_title,
                'seniority', plans.seniority,
                'expectation', plans.expectation,
                'mentor_role', plans.mentor_role,
                'plan', plans.plan,
                'welcomeEmail', plans.welcome_email,
                'created_at', plans.created_at
            ),
            plans.created_at, plans.updated_at
        FROM development_onboarding_plans AS plans
        ON CONFLICT (table_name, record_id) DO UPDATE
        SET owner_user_id = EXCLUDED.owner_user_id,
            company_id = EXCLUDED.company_id,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
        """
    )

    op.execute(
        """
        INSERT INTO ai_feature_routes (
            id, feature_key, provider_alias, model, updated_by, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            CASE feature_key
                WHEN 'development.onboarding_plan' THEN 'compat.generate-onboarding-plan'
                WHEN 'development.learning_path' THEN 'compat.generate-learning-path'
            END,
            provider_alias, model, updated_by, created_at, updated_at
        FROM ai_feature_routes
        WHERE feature_key IN ('development.onboarding_plan', 'development.learning_path')
        ON CONFLICT (feature_key) DO UPDATE
        SET provider_alias = EXCLUDED.provider_alias,
            model = EXCLUDED.model,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at
        """
    )
    op.execute(
        """
        INSERT INTO feature_permissions (
            id, feature_key, feature_name, feature_category, description,
            allowed_tiers, allowed_company_roles, allow_view, allow_edit,
            credit_cost, is_active, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            CASE feature_key
                WHEN 'development.onboarding_plan' THEN 'compat.generate-onboarding-plan'
                WHEN 'development.learning_path' THEN 'compat.generate-learning-path'
            END,
            feature_name, feature_category, description,
            allowed_tiers, allowed_company_roles, allow_view, allow_edit,
            credit_cost, is_active, created_at, updated_at
        FROM feature_permissions
        WHERE feature_key IN ('development.onboarding_plan', 'development.learning_path')
        ON CONFLICT (feature_key) DO UPDATE
        SET feature_name = EXCLUDED.feature_name,
            feature_category = EXCLUDED.feature_category,
            description = EXCLUDED.description,
            allowed_tiers = EXCLUDED.allowed_tiers,
            allowed_company_roles = EXCLUDED.allowed_company_roles,
            allow_view = EXCLUDED.allow_view,
            allow_edit = EXCLUDED.allow_edit,
            credit_cost = EXCLUDED.credit_cost,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at
        """
    )
    op.execute(
        "DELETE FROM ai_feature_routes WHERE feature_key IN "
        "('development.onboarding_plan', 'development.learning_path')"
    )
    op.execute(
        "DELETE FROM feature_permissions WHERE feature_key IN "
        "('development.onboarding_plan', 'development.learning_path')"
    )

    op.drop_index(
        "ix_development_learning_paths_created_at", table_name="development_learning_paths"
    )
    op.drop_index(
        "ix_development_learning_paths_company_id", table_name="development_learning_paths"
    )
    op.drop_index(
        "ix_development_learning_paths_owner_user_id",
        table_name="development_learning_paths",
    )
    op.drop_table("development_learning_paths")
    op.drop_index(
        "ix_development_onboarding_plans_created_at",
        table_name="development_onboarding_plans",
    )
    op.drop_index(
        "ix_development_onboarding_plans_company_id",
        table_name="development_onboarding_plans",
    )
    op.drop_index(
        "ix_development_onboarding_plans_owner_user_id",
        table_name="development_onboarding_plans",
    )
    op.drop_table("development_onboarding_plans")
