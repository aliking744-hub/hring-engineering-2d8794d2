from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


Category = Literal["labor_law", "social_security", "court_rulings", "other"]


class LegalSourceMetadata(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    category: Category
    source_url: str | None = Field(default=None, max_length=2_000)
    published_at: date | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    chunk_size: int = Field(default=1400, ge=300, le=4000)
    chunk_overlap: int = Field(default=180, ge=0, le=500)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        return value.strip()

    @field_validator("source_url")
    @classmethod
    def normalize_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_ranges(self) -> "LegalSourceMetadata":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("valid_to cannot be before valid_from")
        return self


class LegalHtmlImportRequest(LegalSourceMetadata):
    html_content: str = Field(min_length=20, max_length=10_000_000)


class LegalUrlImportRequest(LegalSourceMetadata):
    source_url: str = Field(min_length=8, max_length=2_000)


class LegalReindexRequest(BaseModel):
    chunk_size: int | None = Field(default=None, ge=300, le=4000)
    chunk_overlap: int | None = Field(default=None, ge=0, le=500)

    @model_validator(mode="after")
    def validate_pair(self) -> "LegalReindexRequest":
        if (
            self.chunk_size is not None
            and self.chunk_overlap is not None
            and self.chunk_overlap >= self.chunk_size
        ):
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self


class LegalSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    checksum: str
    title: str
    category: str
    source_url: str | None
    source_type: str
    original_filename: str | None
    mime_type: str | None
    published_at: date | None
    valid_from: date | None
    valid_to: date | None
    version: int
    status: str
    chunk_size: int
    chunk_overlap: int
    embedding_model: str
    index_status: str
    chunk_count: int = 0
    created_at: datetime
    updated_at: datetime


class LegalImportResponse(BaseModel):
    success: bool = True
    duplicate: bool
    ocr_used: bool
    source: LegalSourceResponse
    logs: list[str]


class LegalSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2_000)
    category: Category | None = None
    match_count: int = Field(default=15, ge=1, le=50)
    match_threshold: float = Field(default=0.12, ge=0, le=1)

    @field_validator("query")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Search query is required")
        return normalized


class LegalSearchResult(BaseModel):
    id: UUID
    source_id: UUID
    title: str
    content: str
    category: str
    source_url: str | None
    article_number: str | None
    similarity: float
    source_version: int
    published_at: date | None


class LegalConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)

    @field_validator("content")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        return value.strip()


class LegalAdvisorRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query: str = Field(min_length=2, max_length=20_000)
    images: list[str] = Field(default_factory=list, max_length=5)
    pdfs: list[str] = Field(default_factory=list, max_length=5)
    conversation_history: list[LegalConversationMessage] = Field(
        default_factory=list,
        alias="conversationHistory",
        max_length=6,
    )

    @field_validator("query")
    @classmethod
    def normalize_advisor_query(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Legal question is required")
        return normalized


class LegalAdvisorSource(BaseModel):
    article_number: str | None = Field(serialization_alias="articleNumber")
    category: str
    similarity: float
    title: str
    source_url: str | None = Field(default=None, serialization_alias="sourceUrl")


class LegalAdvisorResponse(BaseModel):
    success: bool = True
    answer: str = Field(min_length=1, max_length=40_000)
    sources: list[LegalAdvisorSource] = Field(default_factory=list, max_length=3)


class LegalDefenseEvidenceInput(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    type: Literal["pdf", "image"]
    content: str = Field(min_length=16, max_length=20_000_000)


class LegalDefenseRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    complaint: str | None = Field(default=None, max_length=20_000_000)
    evidence: list[LegalDefenseEvidenceInput] = Field(default_factory=list, max_length=10)
    additional_info: str = Field(default="", alias="additionalInfo", max_length=20_000)
    conversation_history: list[LegalConversationMessage] = Field(
        default_factory=list,
        alias="conversationHistory",
        max_length=6,
    )

    @model_validator(mode="after")
    def require_case_context(self) -> "LegalDefenseRequest":
        if not self.complaint and not self.conversation_history:
            raise ValueError("Complaint document or conversation history is required")
        self.additional_info = self.additional_info.strip()
        return self


class LegalDefenseClaim(BaseModel):
    claim_type: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1, max_length=4_000)
    amount_claimed: str | None = Field(default=None, max_length=500)


class LegalDefenseRelevantLaw(BaseModel):
    claim_type: str
    article_number: str | None
    category: str
    content: str
    similarity: float = Field(ge=0, le=1)


class LegalDefenseEvidenceAnalysis(BaseModel):
    claim_type: str
    required_evidence: list[str] = Field(default_factory=list)
    provided_evidence: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    legal_basis: str = ""


class LegalDefenseFollowUpQuestion(BaseModel):
    question: str
    reason: str
    related_article: str = ""


class LegalDefenseGapAnalysis(BaseModel):
    evidence_analysis: list[LegalDefenseEvidenceAnalysis] = Field(
        default_factory=list,
        serialization_alias="evidenceAnalysis",
    )
    follow_up_questions: list[LegalDefenseFollowUpQuestion] = Field(
        default_factory=list,
        serialization_alias="followUpQuestions",
    )
    can_proceed: bool = Field(serialization_alias="canProceed")


class LegalDefenseVerdict(BaseModel):
    risk_score: float = Field(ge=0, le=100, serialization_alias="riskScore")
    risk_level: Literal["low", "medium", "high", "critical"] = Field(
        serialization_alias="riskLevel"
    )
    recommendation: Literal["fight", "settle", "needs_more_info"]
    reasoning: str = Field(min_length=1, max_length=20_000)
    key_strengths: list[str] = Field(
        default_factory=list,
        serialization_alias="keyStrengths",
    )
    key_weaknesses: list[str] = Field(
        default_factory=list,
        serialization_alias="keyWeaknesses",
    )
    defense_bill: str | None = Field(default=None, serialization_alias="defenseBill")
    settlement_advice: str | None = Field(
        default=None,
        serialization_alias="settlementAdvice",
    )


class LegalDefenseResponse(BaseModel):
    success: bool = True
    claims: list[LegalDefenseClaim]
    relevant_laws: list[LegalDefenseRelevantLaw] = Field(
        serialization_alias="relevantLaws"
    )
    gap_analysis: LegalDefenseGapAnalysis = Field(serialization_alias="gapAnalysis")
    verdict: LegalDefenseVerdict


class LegalStatsCategory(BaseModel):
    category: str
    sources: int
    chunks: int


class LegalKnowledgeStats(BaseModel):
    active_sources: int
    indexed_chunks: int
    pending_sources: int
    categories: list[LegalStatsCategory]
    embedding_model: str
