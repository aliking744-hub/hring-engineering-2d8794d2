"""Align runtime AI routes and seed metered product features.

Revision ID: 20260902_0032
Revises: 20260831_0031
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260902_0032"
down_revision: str | None = "20260831_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Only replace obsolete aliases when their independent AvalAI providers are active.
    # Admin-selected routes using any other alias remain untouched.
    op.execute(
        """
        UPDATE ai_prompt_versions
        SET provider_alias = 'avalai.primary',
            model = CASE
                WHEN model = 'gemini-2.5-flash-lite' THEN 'gemini-2.5-flash'
                ELSE model
            END
        WHERE provider_alias = 'gemini'
          AND EXISTS (
              SELECT 1 FROM integration_providers
              WHERE provider_key = 'avalai.primary' AND is_active = true
          )
        """
    )
    op.execute(
        """
        UPDATE ai_prompt_versions
        SET provider_alias = 'avalai.search'
        WHERE provider_alias = 'perplexity'
          AND EXISTS (
              SELECT 1 FROM integration_providers
              WHERE provider_key = 'avalai.search' AND is_active = true
          )
        """
    )
    op.execute(
        """
        UPDATE ai_feature_routes
        SET provider_alias = 'avalai.primary',
            model = CASE
                WHEN model = 'gemini-2.5-flash-lite' THEN 'gemini-2.5-flash'
                ELSE model
            END,
            updated_at = now()
        WHERE provider_alias = 'gemini'
          AND EXISTS (
              SELECT 1 FROM integration_providers
              WHERE provider_key = 'avalai.primary' AND is_active = true
          )
        """
    )
    op.execute(
        """
        UPDATE ai_feature_routes
        SET provider_alias = 'avalai.search', updated_at = now()
        WHERE provider_alias = 'perplexity'
          AND EXISTS (
              SELECT 1 FROM integration_providers
              WHERE provider_key = 'avalai.search' AND is_active = true
          )
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
            gen_random_uuid(), seed.feature_key, seed.feature_name, seed.category,
            seed.description,
            ARRAY[
                'individual_free', 'individual_pro', 'individual_plus',
                'corporate_expert', 'corporate_decision_support', 'corporate_strategic'
            ]::varchar[],
            ARRAY['owner', 'admin', 'hr_manager', 'member']::varchar[],
            true, false, seed.credit_cost, true, now(), now()
        FROM (
            VALUES
                ('costing.employee_cost_calculator', 'ماشین‌حساب هزینه نیروی انسانی', 'hr', 'محاسبه نهایی با نرخ‌های قانونی جاری', 5),
                ('hr_data.dashboard_demo', 'داشبورد منابع انسانی دمو', 'analytics', 'تولید داشبورد با داده نمونه', 25),
                ('hr_data.dashboard_upload', 'داشبورد منابع انسانی اکسل', 'analytics', 'تولید داشبورد از فایل اکسل', 50),
                ('legal.advisor', 'مشاور حقوقی', 'legal', 'پاسخ هوشمند حقوق کار', 5),
                ('legal.defense', 'دفاعیه حقوقی', 'legal', 'تحلیل چندمرحله‌ای دفاعیه', 20),
                ('compat.hring-support', 'پشتیبانی هوشمند', 'support', 'گفتگوی پشتیبانی هوشمند', 5),
                ('compat.labor-complaint-assistant', 'تنظیم شکایت کار', 'legal', 'تحلیل و تنظیم شکایت اداره کار', 20),
                ('development.onboarding_plan', 'برنامه آنبوردینگ', 'development', 'برنامه ورود نودروزه', 15),
                ('development.learning_path', 'مسیر یادگیری', 'development', 'مسیر رشد شخصی‌سازی‌شده', 15)
        ) AS seed(feature_key, feature_name, category, description, credit_cost)
        ON CONFLICT (feature_key) DO NOTHING
        """
    )

    # Provider list-price baselines. Super Admin can supersede them with a newer
    # effective_from version when the AvalAI invoice rate differs.
    op.execute(
        """
        INSERT INTO ai_rate_cards (
            id, provider, model, metric, unit_size, cost_microusd,
            effective_from, effective_to, is_active, created_by, created_at
        )
        SELECT
            gen_random_uuid(), seed.provider, seed.model, seed.metric,
            1000000, seed.cost_microusd,
            '2026-09-02 00:00:00+00'::timestamptz, NULL, true, NULL, now()
        FROM (
            VALUES
                ('avalai.search', 'sonar', 'input_tokens', 1000000::bigint),
                ('avalai.search', 'sonar', 'output_tokens', 1000000::bigint),
                ('avalai.primary', 'gemini-2.5-flash', 'input_tokens', 300000::bigint),
                ('avalai.primary', 'gemini-2.5-flash', 'output_tokens', 2500000::bigint)
        ) AS seed(provider, model, metric, cost_microusd)
        ON CONFLICT (provider, model, metric, effective_from) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM ai_rate_cards
        WHERE effective_from = '2026-09-02 00:00:00+00'::timestamptz
          AND (provider, model, metric, cost_microusd) IN (
              ('avalai.search', 'sonar', 'input_tokens', 1000000),
              ('avalai.search', 'sonar', 'output_tokens', 1000000),
              ('avalai.primary', 'gemini-2.5-flash', 'input_tokens', 300000),
              ('avalai.primary', 'gemini-2.5-flash', 'output_tokens', 2500000)
          )
        """
    )
    op.execute(
        """
        DELETE FROM feature_permissions
        WHERE feature_key IN (
            'costing.employee_cost_calculator',
            'hr_data.dashboard_demo',
            'hr_data.dashboard_upload',
            'legal.advisor',
            'legal.defense',
            'compat.hring-support',
            'compat.labor-complaint-assistant'
        )
        """
    )
    # Runtime alias remapping is intentionally not reversed: later admin choices may
    # use the same aliases and must not be overwritten by a code rollback.
