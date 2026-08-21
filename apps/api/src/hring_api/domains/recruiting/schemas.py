from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateCampaignRequest(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    city: str | None = Field(default=None, max_length=240)
    job_title: str | None = Field(default=None, max_length=240)
    industry: str | None = Field(default=None, max_length=240)
    experience_range: str | None = Field(default=None, max_length=240)
    education_level: str | None = Field(default=None, max_length=240)
    skills: list[str] | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=20_000)
    auto_headhunting: bool = False


class UpdateCampaignRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=240)
    city: str | None = Field(default=None, max_length=240)
    status: str | None = Field(default=None, max_length=24)
    progress: int | None = Field(default=None, ge=0, le=100)
    job_title: str | None = Field(default=None, max_length=240)
    industry: str | None = Field(default=None, max_length=240)
    experience_range: str | None = Field(default=None, max_length=240)
    education_level: str | None = Field(default=None, max_length=240)
    skills: list[str] | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=20_000)
    auto_headhunting: bool | None = None


class CandidateCreate(BaseModel):
    name: str | None = Field(default=None, max_length=240)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    skills: str | None = Field(default=None, max_length=10_000)
    experience: str | None = Field(default=None, max_length=4_000)
    education: str | None = Field(default=None, max_length=4_000)
    last_company: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=500)
    match_score: int = Field(default=0, ge=0, le=100)
    candidate_temperature: str = Field(default="cold", max_length=20)
    status: str = Field(default="pending", pattern=r"^(pending|approved|rejected|waiting)$")
    recommendation: str | None = Field(default=None, max_length=20_000)
    green_flags: list[str] | None = Field(default=None, max_length=100)
    red_flags: list[str] | None = Field(default=None, max_length=100)
    layer_scores: dict[str, object] | None = None
    raw_data: dict[str, object] | None = None


class AddCandidatesRequest(BaseModel):
    candidates: list[CandidateCreate] = Field(min_length=1, max_length=500)


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    campaign_id: UUID
    name: str | None
    email: str | None
    phone: str | None
    skills: str | None
    experience: str | None
    education: str | None
    last_company: str | None
    location: str | None
    title: str | None
    match_score: int
    candidate_temperature: str
    status: str
    recommendation: str | None
    green_flags: list[str] | None
    red_flags: list[str] | None
    layer_scores: dict[str, object] | None
    raw_data: dict[str, object] | None
    created_at: datetime
    updated_at: datetime


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_user_id: UUID
    company_id: UUID | None
    name: str
    city: str | None
    status: str
    progress: int
    job_title: str | None
    industry: str | None
    experience_range: str | None
    education_level: str | None
    skills: list[str] | None
    description: str | None
    auto_headhunting: bool
    created_at: datetime
    updated_at: datetime
    candidates_count: int = 0
    avg_match_score: int = 0


class CampaignDetailResponse(CampaignResponse):
    candidates: list[CandidateResponse]