import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from hring_api.db.session import SessionFactory
from hring_api.domains.ai.models import AiUsageEvent
from hring_api.domains.ai.repository import (
    create_rate_card_version,
    usage_summary_rows,
)
from hring_api.domains.ai.service import (
    calculate_estimated_cost_microusd,
    record_ai_usage,
)


def test_ai_metering_calculates_historical_provider_cost() -> None:
    provider = f"test-provider-{uuid4()}"
    model = "test-model"

    async def run() -> None:
        async with SessionFactory() as session:
            effective = datetime.now(UTC) - timedelta(minutes=1)
            await create_rate_card_version(
                session,
                provider=provider,
                model=model,
                metric="input_tokens",
                unit_size=1_000_000,
                cost_microusd=5_000_000,
                effective_from=effective,
                created_by=None,
            )
            await create_rate_card_version(
                session,
                provider=provider,
                model=model,
                metric="output_tokens",
                unit_size=1_000_000,
                cost_microusd=15_000_000,
                effective_from=effective,
                created_by=None,
            )
            cost = await calculate_estimated_cost_microusd(
                session,
                provider=provider,
                model=model,
                metrics={"input_tokens": 1_000, "output_tokens": 500},
            )
            assert cost == 12_500  # USD 0.0125

            event = await record_ai_usage(
                session,
                request_id=uuid4(),
                company_id=None,
                user_id=None,
                feature_key="test.feature",
                provider=provider,
                model=model,
                operation="generate",
                metrics={"input_tokens": 1_000, "output_tokens": 500},
                provider_cost_microusd=None,
                credits_charged=12,
                latency_ms=250,
                status="success",
            )
            assert event.estimated_cost_microusd == 12_500
            await session.commit()

        async with SessionFactory() as session:
            rows = await usage_summary_rows(
                session,
                since=datetime.now(UTC) - timedelta(minutes=5),
                feature_key="test.feature",
            )
            row = next(item for item in rows if item["provider"] == provider)
            assert row["requests"] == 1
            assert row["input_tokens"] == 1_000
            assert row["output_tokens"] == 500
            assert row["estimated_cost_microusd"] == 12_500
            assert row["credits_charged"] == 12

    asyncio.run(run())


def test_usage_ledger_does_not_copy_prompts_or_generated_content() -> None:
    columns = set(AiUsageEvent.__table__.columns.keys())
    assert "prompt" not in columns
    assert "messages" not in columns
    assert "content" not in columns
    assert "response" not in columns
    assert {"feature_key", "metrics_json", "estimated_cost_microusd"} <= columns
