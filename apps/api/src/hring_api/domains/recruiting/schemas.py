from datetime import datetime
from typing import Any
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


class UpdateCandidateStatusRequest(BaseModel):
    status: str = Field(pattern=r"^(pending|approved|rejected|waiting)$")


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


class JobRequirements(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_title: str = Field(alias="jobTitle", min_length=1, max_length=240)
    city: str = Field(min_length=1, max_length=240)
    skills: str | None = Field(default=None, max_length=10_000)
    experience: str | None = Field(default=None, max_length=1_000)
    industry: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=20_000)
    seniority_level: str | None = Field(default=None, alias="seniorityLevel", max_length=120)


class CandidateAnalysisInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    name: str | None = Field(default=None, max_length=240)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    skills: str | list[str] | None = None
    experience: str | None = Field(default=None, max_length=4_000)
    education: str | None = Field(default=None, max_length=4_000)
    last_company: str | None = Field(default=None, alias="lastCompany", max_length=500)
    location: str | None = Field(default=None, max_length=500)
    linkedin: str | None = Field(default=None, max_length=2_000)
    about: str | None = Field(default=None, max_length=10_000)
    raw_data: dict[str, Any] | None = Field(default=None, alias="rawData")


class AnalyzeCandidatesRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    candidates: list[CandidateAnalysisInput] = Field(min_length=1, max_length=100)
    job_requirements: JobRequirements = Field(alias="jobRequirements")
    enable_web_search: bool = Field(default=False, alias="enableWebSearch")


class AutoSourceRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_requirements: JobRequirements = Field(alias="jobRequirements")


class AnalyzedCandidate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    email: str = ""
    phone: str = ""
    title: str = "نامشخص"
    education: str = "نامشخص"
    experience: str = "نامشخص"
    last_company: str = Field(default="نامشخص", alias="lastCompany")
    location: str = ""
    linkedin: str = ""
    skills: list[str] = Field(default_factory=list)
    match_score: int = Field(default=50, alias="matchScore", ge=0, le=100)
    candidate_temperature: str = Field(default="cold", alias="candidateTemperature")
    layer_scores: dict[str, int] = Field(default_factory=dict, alias="layerScores")
    red_flags: list[str] = Field(default_factory=list, alias="redFlags")
    green_flags: list[str] = Field(default_factory=list, alias="greenFlags")
    summary: str = ""
    recommendation: str = "در لیست انتظار"
    raw_data: dict[str, Any] | None = Field(default=None, alias="rawData")


class CandidateAnalysisStats(BaseModel):
    total: int
    excellent: int
    good: int
    average: int
    avg_score: int = Field(alias="avgScore")
    hot_candidates: int = Field(alias="hotCandidates")
    warm_candidates: int = Field(alias="warmCandidates")
    cold_candidates: int = Field(alias="coldCandidates")


class AnalyzeCandidatesResponse(BaseModel):
    candidates: list[AnalyzedCandidate]
    stats: CandidateAnalysisStats


class AutoSourceStats(BaseModel):
    total: int
    hot: int
    warm: int
    cold: int
    avg_score: int = Field(alias="avgScore")


class AutoSourceResponse(BaseModel):
    success: bool = True
    stats: AutoSourceStats
    campaign_id: UUID = Field(alias="campaignId")