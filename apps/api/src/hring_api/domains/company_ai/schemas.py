from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


AI_CONNECTION_MODES = {"byok", "hring_managed"}
AI_CONNECTION_AUTH_SCHEMES = {"bearer", "x-api-key", "api-key", "x-goog-api-key"}


class CompanyAiConnectionUpsertRequest(BaseModel):
    mode: Literal["byok", "hring_managed"]
    provider_key: str | None = Field(default=None, min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9_.-]+$")
    adapter: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9_.-]+$")
    base_url: str | None = Field(default=None, max_length=2048)
    default_model: str | None = Field(default=None, min_length=1, max_length=240)
    auth_scheme: str = "bearer"
    secret: SecretStr | None = Field(default=None, min_length=1, max_length=10_000)
    is_active: bool = True

    @field_validator("auth_scheme")
    @classmethod
    def validate_auth_scheme(cls, value: str) -> str:
        if value not in AI_CONNECTION_AUTH_SCHEMES:
            raise ValueError("Unsupported authentication scheme")
        return value

    @model_validator(mode="after")
    def require_byok_route_fields(self) -> "CompanyAiConnectionUpsertRequest":
        if self.mode != "byok":
            return self
        required = {
            "provider_key": self.provider_key,
            "adapter": self.adapter,
            "base_url": self.base_url,
            "default_model": self.default_model,
        }
        missing = [key for key, value in required.items() if not value or not value.strip()]
        if missing:
            raise ValueError(f"BYOK requires: {', '.join(missing)}")
        return self


class CompanyAiConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    capability_key: str
    mode: str
    provider_key: str | None
    adapter: str | None
    base_url: str | None
    default_model: str | None
    auth_scheme: str
    secret_configured: bool
    secret_hint: str | None
    is_active: bool
    status: str
    last_tested_at: datetime | None
    last_success_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class CompanyAiConnectionTestResponse(BaseModel):
    healthy: bool
    status: str
    http_status: int | None
    latency_ms: int | None
    message: str
    tested_at: datetime
