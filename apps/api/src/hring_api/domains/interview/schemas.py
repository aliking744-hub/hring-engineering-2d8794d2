from collections import Counter
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


SectionIcon = Literal["technical", "behavioral", "intelligence", "cultural"]
SeniorityLevel = Literal["junior", "senior", "lead", "manager"]
FocusArea = Literal["general", "technical", "leadership", "cultural"]

EXPECTED_SECTION_COUNTS = {
    "technical": 4,
    "behavioral": 3,
    "intelligence": 2,
    "cultural": 2,
}


class InterviewKitGenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_title: str = Field(alias="jobTitle", min_length=2, max_length=240)
    industry: str = Field(default="", max_length=240)
    seniority_level: SeniorityLevel = Field(alias="seniorityLevel")
    focus_area: FocusArea = Field(default="general", alias="focusArea")

    @field_validator("job_title")
    @classmethod
    def normalize_job_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Job title cannot be blank")
        return normalized

    @field_validator("industry")
    @classmethod
    def normalize_industry(cls, value: str) -> str:
        return value.strip()


class InterviewQuestion(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=3, max_length=120)
    section: str = Field(min_length=2, max_length=240)
    section_icon: SectionIcon = Field(alias="sectionIcon")
    question: str = Field(min_length=10, max_length=4000)
    good_signs: list[str] = Field(alias="goodSigns", min_length=1, max_length=12)
    red_flags: list[str] = Field(alias="redFlags", min_length=1, max_length=12)

    @field_validator("id", "section", "question")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Required text cannot be blank")
        return normalized

    @field_validator("good_signs", "red_flags")
    @classmethod
    def normalize_evaluation_items(cls, values: list[str]) -> list[str]:
        normalized = [item.strip() for item in values if item.strip()]
        if not normalized:
            raise ValueError("Evaluation lists cannot be empty")
        return normalized


class InterviewKitResponse(BaseModel):
    questions: list[InterviewQuestion] = Field(min_length=11, max_length=11)

    @model_validator(mode="after")
    def validate_exact_lovable_contract(self) -> "InterviewKitResponse":
        counts = Counter(question.section_icon for question in self.questions)
        if counts != Counter(EXPECTED_SECTION_COUNTS):
            raise ValueError(
                "Interview kit must contain exactly 4 technical, 3 behavioral, "
                "2 intelligence, and 2 cultural questions"
            )
        ids = [question.id for question in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("Interview question identifiers must be unique")
        return self
