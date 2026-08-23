from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PROMPT_KEY_PATTERN = r"^[a-z][a-z0-9_.-]{0,119}$"


class PromptVersionDraftRequest(BaseModel):
    provider_alias: str = Field(min_length=1, max_length=120, pattern=PROMPT_KEY_PATTERN)
    model: str = Field(min_length=1, max_length=240)
    system_template: str | None = Field(default=None, max_length=40_000)
    user_template: str = Field(min_length=1, max_length=80_000)
    input_variables: list[str] = Field(default_factory=list, max_length=100)
    response_format: str = Field(default="text", pattern=r"^(text|json_object)$")
    output_schema: dict[str, object] | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_output_tokens: int | None = Field(default=None, ge=1, le=200_000)

    @field_validator("provider_alias", "model")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("system_template")
    @classmethod
    def normalize_optional_template(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("user_template")
    @classmethod
    def normalize_user_template(cls, value: str) -> str:
        return value.strip()

    @field_validator("input_variables")
    @classmethod
    def normalize_input_variables(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in value:
            key = item.strip()
            if not key or len(key) > 80:
                raise ValueError("Prompt variable names must be between 1 and 80 characters")
            if not key.replace("_", "a").isalnum() or key[0].isdigit():
                raise ValueError("Prompt variable names must be simple identifiers")
            if key not in seen:
                normalized.append(key)
                seen.add(key)
        return normalized

    @model_validator(mode="after")
    def validate_output_contract(self) -> PromptVersionDraftRequest:
        if self.response_format == "json_object" and not self.output_schema:
            raise ValueError("JSON output requires a non-empty output schema")
        if self.response_format == "text" and self.output_schema is not None:
            raise ValueError("Output schema is only supported for json_object responses")
        return self


class PromptVersionPatchRequest(BaseModel):
    provider_alias: str | None = Field(default=None, min_length=1, max_length=120)
    model: str | None = Field(default=None, min_length=1, max_length=240)
    system_template: str | None = Field(default=None, max_length=40_000)
    user_template: str | None = Field(default=None, min_length=1, max_length=80_000)
    input_variables: list[str] | None = Field(default=None, max_length=100)
    response_format: str | None = Field(default=None, pattern=r"^(text|json_object)$")
    output_schema: dict[str, object] | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_output_tokens: int | None = Field(default=None, ge=1, le=200_000)


class PromptCreateRequest(BaseModel):
    prompt_key: str = Field(min_length=1, max_length=120, pattern=PROMPT_KEY_PATTERN)
    feature_key: str = Field(min_length=1, max_length=120, pattern=PROMPT_KEY_PATTERN)
    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4_000)
    version: PromptVersionDraftRequest

    @field_validator("prompt_key", "feature_key", "display_name")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class PromptPatchRequest(BaseModel):
    feature_key: str | None = Field(default=None, min_length=1, max_length=120)
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4_000)
    is_active: bool | None = None


class PromptCreateDraftRequest(BaseModel):
    source_version_id: UUID | None = None


class PromptTestRequest(BaseModel):
    variables: dict[str, str] = Field(default_factory=dict)

    @field_validator("variables")
    @classmethod
    def validate_variables(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 100:
            raise ValueError("Too many prompt variables")
        normalized: dict[str, str] = {}
        for key, raw in value.items():
            name = key.strip()
            if not name or len(name) > 80:
                raise ValueError("Invalid prompt variable name")
            if len(raw) > 40_000:
                raise ValueError("Prompt test variable is too large")
            normalized[name] = raw
        return normalized


class PromptRollbackRequest(BaseModel):
    target_version_id: UUID


class PromptVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    prompt_id: UUID
    version: int
    status: str
    provider_alias: str
    model: str
    system_template: str | None
    user_template: str
    input_variables: list[str]
    response_format: str
    output_schema: dict[str, object] | None
    temperature: float | None
    max_output_tokens: int | None
    test_status: str
    last_tested_at: datetime | None
    last_test_error: str | None
    created_by: UUID | None
    published_by: UUID | None
    created_at: datetime
    published_at: datetime | None


class PromptResponse(BaseModel):
    id: UUID
    prompt_key: str
    feature_key: str
    display_name: str
    description: str | None
    is_active: bool
    published_version: int | None
    published_provider_alias: str | None
    published_model: str | None
    draft_version: int | None
    draft_provider_alias: str | None
    draft_model: str | None
    version_count: int
    created_at: datetime
    updated_at: datetime


class PromptDetailResponse(PromptResponse):
    versions: list[PromptVersionResponse]


class PromptTestResponse(BaseModel):
    passed: bool
    schema_valid: bool | None
    rendered_system: str | None
    rendered_user: str
    content: str | None
    provider: str | None
    model: str | None
    usage: dict[str, int]
    error: str | None
    tested_at: datetime
