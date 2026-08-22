from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BillingPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan_type: str
    display_name: str
    scope: str
    price_toman: int
    monthly_credits: int
    is_active: bool
    updated_at: datetime


class BillingPlanUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=160)
    price_toman: int | None = Field(default=None, ge=0)
    monthly_credits: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class PaymentInitRequest(BaseModel):
    plan_type: str = Field(min_length=1, max_length=80)


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
