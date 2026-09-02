from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _default_modalities() -> list[Literal["text", "image"]]:
    return ["text"]


class GatewayMessage(BaseModel):
    role: str = Field(pattern=r"^(system|developer|user|assistant)$")
    content: str = Field(min_length=1, max_length=500_000)


class GenerateRequest(BaseModel):
    request_id: UUID
    feature_key: str | None = Field(default=None, min_length=1, max_length=120, pattern=r"^[a-z0-9_.-]+$")
    company_id: UUID | None = None
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=160)
    messages: list[GatewayMessage] = Field(min_length=1, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_output_tokens: int | None = Field(default=None, ge=1, le=200_000)
    response_format: str = Field(default="text", pattern=r"^(text|json_object)$")
    modalities: list[Literal["text", "image"]] = Field(
        default_factory=_default_modalities,
        min_length=1,
        max_length=2,
    )

    @field_validator("provider", "model")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("modalities")
    @classmethod
    def unique_modalities(
        cls,
        value: list[Literal["text", "image"]],
    ) -> list[Literal["text", "image"]]:
        if len(value) != len(set(value)):
            raise ValueError("Modalities must be unique")
        return value


class GatewayCitation(BaseModel):
    url: str = Field(min_length=1, max_length=4096)
    title: str | None = Field(default=None, max_length=500)
    published_at: str | None = Field(default=None, max_length=120)
    snippet: str | None = Field(default=None, max_length=2000)


MAX_GENERATED_IMAGE_URL_LENGTH = 64_000_000


class GatewayImage(BaseModel):
    # AvalAI Gemini image models return the binary as a data URL. A 4K JPEG can
    # exceed the former 20 MB character cap even though the provider response is valid.
    url: str = Field(min_length=1, max_length=MAX_GENERATED_IMAGE_URL_LENGTH)
    mime_type: str | None = Field(default=None, max_length=120)

    @field_validator("url")
    @classmethod
    def safe_image_url(cls, value: str) -> str:
        if value.startswith(
            (
                "data:image/png;base64,",
                "data:image/jpeg;base64,",
                "data:image/webp;base64,",
            )
        ):
            return value
        parsed = urlsplit(value)
        if (
            parsed.scheme == "https"
            and parsed.netloc
            and parsed.username is None
            and parsed.password is None
        ):
            return value
        raise ValueError("Generated image URL must be safe")


class GenerateResponse(BaseModel):
    content: str
    provider: str
    model: str
    usage: dict[str, int]
    provider_request_id: str | None = None
    provider_cost_microusd: int | None = None
    citations: list[GatewayCitation] = Field(default_factory=list, max_length=100)
    images: list[GatewayImage] = Field(default_factory=list, max_length=4)


class HealthResponse(BaseModel):
    status: str = "ok"
    enabled_providers: list[str]
