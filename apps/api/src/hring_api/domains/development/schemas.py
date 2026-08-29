from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OnboardingGenerateRequest(BaseModel):
    employee_name: str | None = Field(default=None, max_length=240)
    employee_email: str | None = Field(default=None, max_length=320)
    starts_on: date | None = None
    job_title: str = Field(min_length=2, max_length=240)
    seniority: Literal["junior", "mid", "senior", "lead"]
    expectation: Literal["quick_delivery", "learning", "leadership", "innovation"]
    mentor_role: str | None = Field(default=None, max_length=240)

    @field_validator("employee_name", "mentor_role")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("job_title")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Job title is required")
        return normalized

    @field_validator("employee_email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        local, separator, domain = normalized.rpartition("@")
        if not separator or not local or "." not in domain or any(char.isspace() for char in normalized):
            raise ValueError("Employee email is invalid")
        return normalized


class OnboardingTaskCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    details: str | None = Field(default=None, max_length=4_000)
    assignee_label: str | None = Field(default=None, max_length=240)
    due_on: date | None = None
    status: Literal["todo", "in_progress", "completed", "blocked"] = "todo"
    sort_order: int = Field(default=0, ge=0, le=10_000)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Task title is required")
        return normalized

    @field_validator("details", "assignee_label")
    @classmethod
    def normalize_task_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class OnboardingTaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=500)
    details: str | None = Field(default=None, max_length=4_000)
    assignee_label: str | None = Field(default=None, max_length=240)
    due_on: date | None = None
    status: Literal["todo", "in_progress", "completed", "blocked"] | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)

    @field_validator("title")
    @classmethod
    def normalize_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Task title is required")
        return normalized

    @field_validator("details", "assignee_label")
    @classmethod
    def normalize_update_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class OnboardingTaskEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    summary: str
    actor_user_id: UUID | None
    created_at: datetime


class OnboardingTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    title: str
    details: str | None
    assignee_label: str | None
    due_on: date | None
    status: str
    sort_order: int
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    events: list[OnboardingTaskEventResponse] = Field(default_factory=list)


class OnboardingPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    employee_name: str | None
    employee_email: str | None
    starts_on: date | None
    job_title: str
    seniority: str
    expectation: str
    mentor_role: str | None
    plan: str
    welcome_email: str = Field(serialization_alias="welcomeEmail")
    created_at: datetime
    tasks: list[OnboardingTaskResponse] = Field(default_factory=list)


class SkillRecommendation(BaseModel):
    skill: str = Field(min_length=1, max_length=240)
    reason: str = Field(min_length=1, max_length=2_000)


class RoadmapMonth(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    month: str = Field(min_length=1, max_length=120)
    focus: str = Field(min_length=1, max_length=500)
    action_items: list[str] = Field(alias="actionItems", min_length=1, max_length=12)

    @field_validator("action_items")
    @classmethod
    def validate_actions(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value if item.strip()]
        if not normalized:
            raise ValueError("At least one roadmap action is required")
        if any(len(item) > 1_000 for item in normalized):
            raise ValueError("Roadmap action is too long")
        return normalized


class LearningPathResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    skill_gap_analysis: str = Field(alias="skillGapAnalysis", min_length=1, max_length=8_000)
    hard_skills: list[SkillRecommendation] = Field(alias="hardSkills", min_length=1, max_length=20)
    soft_skills: list[SkillRecommendation] = Field(alias="softSkills", min_length=1, max_length=20)
    roadmap: list[RoadmapMonth] = Field(min_length=1, max_length=24)
    training_note: str | None = Field(
        default=None,
        alias="trainingNote",
        max_length=4_000,
    )


class LearningPathGenerateRequest(BaseModel):
    employee_name: str | None = Field(default=None, max_length=240)
    employee_email: str | None = Field(default=None, max_length=320)
    job_title: str = Field(min_length=2, max_length=240)
    industry: str = Field(min_length=2, max_length=240)
    seniority_level: Literal["Junior", "Mid-Level", "Senior", "Lead", "Manager"]
    education_level: Literal["ZirDiplom", "Diploma", "Bachelor", "Master", "PhD"]
    field_of_study: str | None = Field(default=None, max_length=240)
    experience_years: int = Field(ge=0, le=60)
    training_months: int | None = Field(default=None, ge=1, le=24)

    @field_validator("employee_name", "employee_email", "field_of_study")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("job_title", "industry")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Required text field is empty")
        return normalized

    @field_validator("employee_email")
    @classmethod
    def validate_learning_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        local, separator, domain = value.rpartition("@")
        if not separator or not local or "." not in domain or any(char.isspace() for char in value):
            raise ValueError("Employee email is invalid")
        return value.lower()


class LearningPathResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    employee_name: str
    employee_email: str | None
    job_title: str
    industry: str
    seniority_level: str
    education_level: str
    field_of_study: str | None
    experience_years: int
    training_months: int | None
    result: LearningPathResult
    last_emailed_at: datetime | None
    created_at: datetime


class LearningPathEmailResponse(BaseModel):
    success: bool = True
    id: str | None
    sent_at: datetime
