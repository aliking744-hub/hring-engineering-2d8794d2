from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AiFeatureRouteUpdateRequest(BaseModel):
    provider_alias: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_.-]+$")
    model: str = Field(min_length=1, max_length=240)

    @field_validator("provider_alias", "model")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized


class AiFeatureRouteResponse(BaseModel):
    feature_key: str
    display_name: str
    category: str
    description: str
    provider_alias: str
    model: str
    source: str
    updated_at: datetime | None
