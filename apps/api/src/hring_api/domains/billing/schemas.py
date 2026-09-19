from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BillingPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan_type: str
    display_name: str
    scope: str
    price_toman: int
    price_usd_cents: int | None
    monthly_credits: int
    is_active: bool
    updated_at: datetime


class BillingPlanUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=160)
    price_toman: int | None = Field(default=None, ge=0)
    price_usd_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    monthly_credits: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ExchangeRateResponse(BaseModel):
    market_rate_toman: int | None
    manual_rate_toman: int | None
    markup_toman: int
    effective_rate_toman: int | None
    mode: str
    source: str
    source_url: str
    source_fetched_at: datetime | None
    stale: bool
    stale_after_hours: int
    auto_refresh_enabled: bool
    last_error: str | None


class ExchangeRateUpdateRequest(BaseModel):
    manual_rate_toman: int | None = Field(default=None, ge=10_000, le=10_000_000)
    markup_toman: int | None = Field(default=None, ge=0, le=1_000_000)
    stale_after_hours: int | None = Field(default=None, ge=1, le=168)
    auto_refresh_enabled: bool | None = None


class ExchangeRateHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: str
    rate_toman: int
    source_fetched_at: datetime
    created_at: datetime


class PaymentInitRequest(BaseModel):
    plan_type: str = Field(min_length=1, max_length=80)


class ProductPaymentInitRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=160)


class PaymentInitResponse(BaseModel):
    success: bool = True
    authority: str
    payment_url: str


class PaymentVerifyRequest(BaseModel):
    authority: str = Field(min_length=1, max_length=160)


class PaymentVerifyResponse(BaseModel):
    success: bool = True
    ref_id: str | None
    already_verified: bool = False


class PaymentTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount_toman: int
    plan_type: str | None
    purpose: str
    product_id: str | None
    status: str
    ref_id: str | None
    description: str | None
    created_at: datetime
    verified_at: datetime | None
