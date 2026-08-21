from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


SUPPORTED_USAGE_METRICS = {
    "input_tokens",
    "output_tokens",
    "cached_input_tokens",
    "reasoning_tokens",
    "characters",
    "audio_seconds",
    "video_seconds",
    "images",
    "requests",
}


class AiUsageEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    request_id: UUID
    company_id: UUID | None
    user_id: UUID | None
    feature_key: str
    provider: str
    model: str
    operation: str
    metrics_json: dict[str, int]
    provider_cost_microusd: int | None
    estimated_cost_microusd: int
    credits_charged: int
    latency_ms: int | None
    status: str
    error_code: str | None
    metadata_json: dict[str, object]
    created_at: datetime


class AiUsageSummaryRow(BaseModel):
    feature_key: str
    provider: str
    model: str
    requests: int
    failures: int
    input_tokens: int
    output_tokens: int
    cached_input_tokens: int
    reasoning_tokens: int
    credits_charged: int
    estimated_cost_microusd: int
    provider_cost_microusd: int


class AiUsageSummaryResponse(BaseModel):
    since: datetime
    rows: list[AiUsageSummaryRow]
    total_requests: int
    total_failures: int
    total_estimated_cost_microusd: int
    total_provider_cost_microusd: int
    total_credits_charged: int


class AiCompanyUsageSummaryRow(BaseModel):
    company_id: UUID | None
    requests: int
    failures: int
    input_tokens: int
    output_tokens: int
    cached_input_tokens: int
    reasoning_tokens: int
    credits_charged: int
    estimated_cost_microusd: int
    provider_cost_microusd: int


class AiCompanyUsageSummaryResponse(BaseModel):
    since: datetime
    rows: list[AiCompanyUsageSummaryRow]
    total_requests: int
    total_failures: int
    total_estimated_cost_microusd: int
    total_provider_cost_microusd: int
    total_credits_charged: int


class AiRateCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    model: str
    metric: str
    unit_size: int
    cost_microusd: int
    effective_from: datetime
    effective_to: datetime | None
    is_active: bool
    created_by: UUID | None
    created_at: datetime


class CreateAiRateCardRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=160)
    metric: str = Field(min_length=1, max_length=64)
    unit_size: int = Field(default=1, ge=1, le=1_000_000_000)
    cost_microusd: int = Field(ge=0, le=10_000_000_000_000)
    effective_from: datetime | None = None

    @field_validator("provider", "model", "metric")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("metric")
    @classmethod
    def validate_metric(cls, value: str) -> str:
        if value not in SUPPORTED_USAGE_METRICS:
            raise ValueError("Unsupported AI usage metric")
        return value