from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class HrDataUploadCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    records: list[dict[str, Any]] = Field(min_length=1, max_length=2000)
    is_demo: bool = False

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Upload name is required")
        return normalized

    @model_validator(mode="after")
    def reject_oversized_payload(self) -> "HrDataUploadCreateRequest":
        if len(json.dumps(self.records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) > 5_000_000:
            raise ValueError("HR upload payload exceeds 5 MB")
        return self


class HrDataUploadSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    employee_count: int
    is_demo: bool
    created_at: datetime


class HrDataUploadResponse(HrDataUploadSummary):
    records: list[dict[str, Any]]
