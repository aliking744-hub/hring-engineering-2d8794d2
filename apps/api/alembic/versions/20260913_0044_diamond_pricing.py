"""Finalize diamond pricing and active individual plans.

Revision ID: 20260913_0044
Revises: 20260912_0043

Commercial diamond prices are intentionally higher than raw provider-cost
diamonds. One cost diamond represents USD 0.001; customer prices below keep
at least the approved 10x floor. Non-AI tools are priced by product value.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260913_0044"
down_revision: str | None = "20260912_0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


RATES = {
    "job_engineering.job_profile": 50,
    "interview.kit": 100,
    "job_ads.smart_ad_text": 10,
    "job_ads.smart_ad_image": 1500,
    "development.onboarding_plan": 50,
    "development.learning_path": 30,
    "legal.advisor": 20,
    "compat.labor-complaint-assistant": 250,
    "legal.defense": 200,
    "compat.hring-support": 10,
    "costing.employee_cost_calculator": 20,
    "hr_data.dashboard_demo": 0,
    "hr_data.dashboard_upload": 100,
    "recruiting.headhunting": 600,
}


def upgrade() -> None:
    for feature_key, credit_cost in RATES.items():
        op.execute(
            "UPDATE feature_permissions SET credit_cost = "
            f"{credit_cost}, updated_at = now() WHERE feature_key = '{feature_key}'"
        )

    # Free users may inspect the product and use only the dashboard demo.
    op.execute(
        """
        UPDATE feature_permissions
        SET allowed_tiers = array_remove(allowed_tiers, 'individual_free'),
            updated_at = now()
        WHERE feature_key <> 'hr_data.dashboard_demo'
        """
    )
    op.execute(
        """
        UPDATE feature_permissions
        SET allowed_tiers = CASE
                WHEN 'individual_free' = ANY(allowed_tiers) THEN allowed_tiers
                ELSE array_append(allowed_tiers, 'individual_free')
            END,
            credit_cost = 0,
            updated_at = now()
        WHERE feature_key = 'hr_data.dashboard_demo'
        """
    )

    op.execute(
        """
        UPDATE billing_plans
        SET display_name = CASE plan_type
                WHEN 'individual_free' THEN 'رایگان'
                WHEN 'individual_pro' THEN 'فردی پایه'
                WHEN 'individual_plus' THEN 'فردی پلاس'
                ELSE display_name
            END,
            monthly_credits = CASE plan_type
                WHEN 'individual_free' THEN 0
                WHEN 'individual_pro' THEN 2000
                WHEN 'individual_plus' THEN 6000
                ELSE monthly_credits
            END,
            price_usd_cents = CASE plan_type
                WHEN 'individual_free' THEN NULL
                WHEN 'individual_pro' THEN 600
                WHEN 'individual_plus' THEN 1625
                ELSE price_usd_cents
            END,
            is_active = CASE
                WHEN plan_type IN ('individual_free', 'individual_pro', 'individual_plus') THEN TRUE
                WHEN scope = 'corporate' THEN FALSE
                ELSE is_active
            END,
            updated_at = now()
        WHERE plan_type IN (
            'individual_free', 'individual_pro', 'individual_plus',
            'corporate_expert', 'corporate_decision_support',
            'corporate_decision_making', 'corporate_strategic'
        )
        """
    )


def downgrade() -> None:
    # Commercial prices and plan state are product-owner data and are not reset.
    pass
