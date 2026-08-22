from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


PROVIDER_TYPES = {
    "llm",
    "embedding",
    "image",
    "search",
    "crawler",
    "ocr",
    "email",
    "sms",
    "payment",
    "webhook",
}
AUTH_SCHEMES = {"none", "bearer", "x-api-key", "api-key", "x-goog-api-key"}


class IntegrationProviderCreateRequest(BaseModel):
    provider_key: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9][a-z0-9_.-]+$")
    display_name: str = Field(min_length=2, max_length=200)
    provider_type: str
    adapter: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9_.-]+$")
    base_url: str | None = Field(default=None, max_length=2048)
    default_model: str | None = Field(default=None, max_length=240)
    auth_scheme: str = "bearer"
    secret: SecretStr | None = Field(default=None, max_length=10_000)
    is_active: bool = True
    is_internal: bool = False
    priority: int = Field(default=100, ge=0, le=100_000)
    timeout_seconds: int = Field(default=15, ge=1, le=60)
    max_retries: int = Field(default=2, ge=0, le=10)
    capabilities: list[str] = Field(default_factory=list, max_length=100)
    settings: dict[str, object] = Field(default_factory=dict)
    quota: dict[str, object] = Field(default_factory=dict)

    @field_validator("provider_type")
    @classmethod
    def validate_provider_type(cls, value: str) -> str:
        if value not in PROVIDER_TYPES:
            raise ValueError("Unsupported provider type")
        return value

    @field_validator("auth_scheme")
    @classmethod
    def validate_auth_scheme(cls, value: str) -> str:
        if value not in AUTH_SCHEMES:
            raise ValueError("Unsupported authentication scheme")
        return value

    @field_validator("capabilities")
    @classmethod
    def normalize_capabilities(cls, value: list[str]) -> list[str]:
        normalized = [item.strip().lower() for item in value if item.strip()]
        if any(len(item) > 80 for item in normalized):
            raise ValueError("Capability names must not exceed 80 characters")
        return list(dict.fromkeys(normalized))


class IntegrationProviderUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=200)
    provider_type: str | None = None
    adapter: str | None = Field(
        default=None,
        min_length=2,
        max_length=80,
        pattern=r"^[a-z0-9][a-z0-9_.-]+$",
    )
    base_url: str | None = Field(default=None, max_length=2048)
    default_model: str | None = Field(default=None, max_length=240)
    auth_scheme: str | None = None
    is_active: bool | None = None
    is_internal: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=100_000)
    timeout_seconds: int | None = Field(default=None, ge=1, le=60)
    max_retries: int | None = Field(default=None, ge=0, le=10)
    capabilities: list[str] | None = Field(default=None, max_length=100)
    settings: dict[str, object] | None = None
    quota: dict[str, object] | None = None

    @field_validator("provider_type")
    @classmethod
    def validate_provider_type(cls, value: str | None) -> str | None:
        if value is not None and value not in PROVIDER_TYPES:
            raise ValueError("Unsupported provider type")
        return value

    @field_validator("auth_scheme")
    @classmethod
    def validate_auth_scheme(cls, value: str | None) -> str | None:
        if value is not None and value not in AUTH_SCHEMES:
            raise ValueError("Unsupported authentication scheme")
        return value

    @field_validator("capabilities")
    @classmethod
    def normalize_capabilities(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        normalized = [item.strip().lower() for item in value if item.strip()]
        if any(len(item) > 80 for item in normalized):
            raise ValueError("Capability names must not exceed 80 characters")
        return list(dict.fromkeys(normalized))


class IntegrationSecretRotateRequest(BaseModel):
    secret: SecretStr = Field(min_length=1, max_length=10_000)


class IntegrationProviderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider_key: str
    display_name: str
    provider_type: str
    adapter: str
    base_url: str | None
    default_model: str | None
    auth_scheme: str
    secret_configured: bool
    secret_hint: str | None
    is_active: bool
    is_internal: bool
    priority: int
    timeout_seconds: int
    max_retries: int
    capabilities: list[str]
    settings: dict[str, object]
    quota: dict[str, object]
    status: str
    last_tested_at: datetime | None
    last_success_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class IntegrationConnectionTestResponse(BaseModel):
    provider_id: UUID
    healthy: bool
    status: str
    http_status: int | None
    latency_ms: int | None
    message: str
    tested_at: datetime
