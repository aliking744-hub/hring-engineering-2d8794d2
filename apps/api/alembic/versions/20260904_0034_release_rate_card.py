"""Align public product credit prices before release.

Revision ID: 20260904_0034
Revises: 20260902_0033
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260904_0034"
down_revision: str | None = "20260902_0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


RATES = {
    "job_engineering.job_profile": 8,
    "interview.kit": 10,
    "job_ads.smart_ad_text": 5,
    "job_ads.smart_ad_image": 50,
    "development.onboarding_plan": 12,
    "development.learning_path": 12,
    "legal.advisor": 5,
    "compat.labor-complaint-assistant": 25,
    "legal.defense": 35,
    "compat.hring-support": 1,
    "costing.employee_cost_calculator": 2,
    "hr_data.dashboard_demo": 5,
    "hr_data.dashboard_upload": 15,
}


def upgrade() -> None:
    for feature_key, credit_cost in RATES.items():
        op.execute(
            "UPDATE feature_permissions SET credit_cost = "
            f"{credit_cost}, updated_at = now() WHERE feature_key = '{feature_key}'"
        )
    # AvalAI dashboard observed cost for gemini-3-pro-image: $1.9798 for
    # 437,437 output tokens => $4.525 / 1M output tokens.
    op.execute(
        """
        INSERT INTO ai_rate_cards (
            id, provider, model, metric, unit_size, cost_microusd,
            effective_from, effective_to, is_active, created_by, created_at
        ) VALUES (
            gen_random_uuid(), 'avalai.primary', 'gemini-3-pro-image',
            'output_tokens', 1000000, 4525000,
            '2026-09-04 00:00:00+00'::timestamptz, NULL, true, NULL, now()
        ) ON CONFLICT (provider, model, metric, effective_from) DO NOTHING
        """
    )


def downgrade() -> None:
    # Product prices are admin-owned commercial state and must not be silently reset.
    pass
