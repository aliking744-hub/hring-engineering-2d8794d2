from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


OwnerType = Literal["user", "company"]
CreditEventType = Literal[
    "grant",
    "reserve",
    "consume",
    "release",
    "refund",
    "expire",
    "admin_adjustment",
]


class CreditBalanceResponse(BaseModel):
    account_id: UUID
    owner_type: OwnerType
    owner_id: UUID
    available_credits: int
    reserved_credits: int
    total_credits: int
    projection_reconciled: bool


class CreditPreflightRequest(BaseModel):
    amount: int = Field(ge=1, le=10_000_000)


class CreditPreflightResponse(BaseModel):
    allowed: bool
    available_credits: int


class AdminCreditAdjustmentRequest(BaseModel):
    owner_type: OwnerType
    owner_id: UUID
    amount: int = Field(ge=-10_000_000, le=10_000_000)
    reason: str = Field(min_length=3, max_length=500)
    idempotency_key: str = Field(
        min_length=8,
        max_length=160,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]{7,159}$",
    )

    @field_validator("amount")
    @classmethod
    def amount_must_be_nonzero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Adjustment amount must not be zero")
        return value


class AdminCreditAccountResponse(BaseModel):
    account_id: UUID | None
    owner_type: OwnerType
    owner_id: UUID
    owner_label: str
    owner_secondary_label: str | None
    available_credits: int
    reserved_credits: int
    total_credits: int
    legacy_available_credits: int
    projection_reconciled: bool


class CreditLedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    reservation_id: UUID | None
    actor_user_id: UUID | None
    event_type: CreditEventType
    amount: int
    available_delta: int
    reserved_delta: int
    feature_key: str | None
    reason: str | None
    description: str | None
    request_id: str | None
    metadata_json: dict[str, object]
    created_at: datetime


class CreditReconciliationResponse(BaseModel):
    account_id: UUID
    projected_available: int
    ledger_available: int
    projected_reserved: int
    ledger_reserved: int
    legacy_available: int
    reconciled: bool
