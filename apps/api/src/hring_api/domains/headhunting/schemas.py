from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


CampaignStatus = Literal["processing", "active", "paused"]
CandidateTemperature = Literal["hot", "warm", "cold"]


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=200)
    job_title: str | None = Field(default=None, max_length=300)
    industry: str | None = Field(default=None, max_length=300)
    experience_range: str | None = Field(default=None, max_length=200)
    education_level: str | None = Field(default=None, max_length=200)
    skills: list[str] | None = Field(default=None, max_length=100)
    auto_headhunting: bool = False
    company_id: UUID | None = None

    @field_validator("name", "city")
    @classmethod
    def strip_required(cls, value: str) -> str:
        return value.strip()


class CampaignUpdate(BaseModel):
    status: CampaignStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    name: str | None = Field(default=None, min_length=1, max_length=300)
    city: str | None = Field(default=None, min_length=1, max_length=200)
    job_title: str | None = Field(default=None, max_length=300)
    industry: str | None = Field(default=None, max_length=300)
    experience_range: str | None = Field(default=None, max_length=200)
    education_level: str | None = Field(default=None, max_length=200)
    skills: list[str] | None = Field(default=None, max_length=100)
    auto_headhunting: bool | None = None


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    company_id: UUID | None
    name: str
    city: str | None
    status: CampaignStatus
    progress: int
    job_title: str | None
    industry: str | None
    experience_range: str | None
    education_level: str | None
    skills: list[str] | None
    auto_headhunting: bool
    created_at: datetime
    updated_at: datetime
    candidates_count: int = 0
    avg_match_score: int = 0


class CandidateInput(BaseModel):
    name: str | None = Field(default=None, max_length=300)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    skills: str | None = Field(default=None, max_length=10_000)
    experience: str | None = Field(default=None, max_length=10_000)
    education: str | None = Field(default=None, max_length=10_000)
    last_company: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=500)
    linkedin: str | None = Field(default=None, max_length=2_000)
    past_companies: str | None = Field(default=None, max_length=10_000)
    about: str | None = Field(default=None, max_length=30_000)
    raw_data: dict[str, Any] | None = None


class CandidateCreate(CandidateInput):
    match_score: int = Field(default=0, ge=0, le=100)
    candidate_temperature: CandidateTemperature = "cold"
    recommendation: str | None = Field(default=None, max_length=10_000)
    green_flags: list[str] | None = Field(default=None, max_length=100)
    red_flags: list[str] | None = Field(default=None, max_length=100)
    layer_scores: dict[str, Any] | None = None


class CandidateBatchCreate(BaseModel):
    candidates: list[CandidateCreate] = Field(min_length=1, max_length=100)


class CandidateOut(BaseModel):
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
    candidate_temperature: CandidateTemperature
    recommendation: str | None
    green_flags: list[str] | None
    red_flags: list[str] | None
    layer_scores: dict[str, Any] | None
    raw_data: dict[str, Any] | None
    created_at: datetime


class CampaignDetail(BaseModel):
    campaign: CampaignOut
    candidates: list[CandidateOut]


class JobRequirements(BaseModel):
    job_title: str = Field(min_length=1, max_length=300)
    city: str = Field(min_length=1, max_length=200)
    skills: str | None = Field(default=None, max_length=10_000)
    experience: str | None = Field(default=None, max_length=2_000)
    industry: str | None = Field(default=None, max_length=2_000)
    description: str | None = Field(default=None, max_length=30_000)
    seniority_level: str | None = Field(default=None, max_length=300)


class AnalyzeCandidatesRequest(BaseModel):
    candidates: list[CandidateInput] = Field(min_length=1, max_length=20)
    job_requirements: JobRequirements
    enable_web_search: bool = True
    campaign_id: UUID | None = None


class AnalysisStats(BaseModel):
    total: int
    excellent: int
    good: int
    average: int
    avg_score: int
    hot_candidates: int
    warm_candidates: int
    cold_candidates: int


class AnalyzeCandidatesResponse(BaseModel):
    candidates: list[CandidateCreate]
    stats: AnalysisStats
