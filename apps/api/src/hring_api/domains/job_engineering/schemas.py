from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobProfileGenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_title: str = Field(alias="jobTitle", min_length=2, max_length=240)
    industry: str = Field(min_length=2, max_length=240)
    seniority_level: str = Field(alias="seniorityLevel", min_length=1, max_length=120)
    company_name: str | None = Field(default=None, alias="companyName", max_length=240)

    @field_validator("job_title", "industry", "seniority_level")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Required text cannot be blank")
        return normalized

    @field_validator("company_name")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class JobProfileResponse(BaseModel):
    content: str = Field(min_length=1, max_length=60_000)
