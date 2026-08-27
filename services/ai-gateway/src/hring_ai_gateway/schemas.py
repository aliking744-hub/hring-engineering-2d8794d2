from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class GatewayMessage(BaseModel):
    role: str = Field(pattern=r"^(system|developer|user|assistant)$")
    content: str = Field(min_length=1, max_length=500_000)


class GenerateRequest(BaseModel):
    request_id: UUID
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=160)
    messages: list[GatewayMessage] = Field(min_length=1, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_output_tokens: int | None = Field(default=None, ge=1, le=200_000)
    response_format: str = Field(default="text", pattern=r"^(text|json_object)$")

    @field_validator("provider", "model")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class GatewayCitation(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    title: str | None = Field(default=None, max_length=500)
    published_at: str | None = Field(default=None, max_length=120)
    snippet: str | None = Field(default=None, max_length=2000)


class GenerateResponse(BaseModel):
    content: str
    provider: str
    model: str
    usage: dict[str, int]
    provider_request_id: str | None = None
    provider_cost_microusd: int | None = None
    citations: list[GatewayCitation] = Field(default_factory=list, max_length=100)


class HealthResponse(BaseModel):
    status: str = "ok"
    enabled_providers: list[str]
