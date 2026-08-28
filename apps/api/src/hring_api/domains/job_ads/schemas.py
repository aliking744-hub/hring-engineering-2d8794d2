from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Platform = Literal["linkedin", "jobboard", "instagram"]
Tone = Literal["formal", "friendly", "challenge"]
ImageFormat = Literal["16:9", "1:1", "9:16"]

IMAGE_DIMENSIONS = {
    "16:9": (1920, 1080),
    "1:1": (1080, 1080),
    "9:16": (1080, 1920),
}


class SmartAdGenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_title: str = Field(alias="jobTitle", min_length=2, max_length=240)
    company_name: str = Field(alias="companyName", min_length=2, max_length=240)
    contact_method: str = Field(alias="contactMethod", min_length=3, max_length=500)
    industry: str = Field(default="", max_length=240)
    platform: Platform
    tone: Tone
    generate_image: bool = Field(default=False, alias="generateImage")
    image_format: ImageFormat = Field(default="16:9", alias="imageFormat")
    image_width: int | None = Field(default=None, alias="imageWidth")
    image_height: int | None = Field(default=None, alias="imageHeight")

    @field_validator("job_title", "company_name", "contact_method")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Required text cannot be blank")
        return normalized

    @field_validator("industry")
    @classmethod
    def normalize_optional_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_dimensions(self) -> "SmartAdGenerateRequest":
        width, height = IMAGE_DIMENSIONS[self.image_format]
        if self.image_width is not None and self.image_width != width:
            raise ValueError("Image width does not match the selected format")
        if self.image_height is not None and self.image_height != height:
            raise ValueError("Image height does not match the selected format")
        self.image_width = width
        self.image_height = height
        return self


class SmartAdResponse(BaseModel):
    generated_text: str = Field(
        serialization_alias="generatedText",
        min_length=1,
        max_length=40_000,
    )
    image_url: str | None = Field(
        default=None,
        serialization_alias="imageUrl",
        max_length=20_000_000,
    )
