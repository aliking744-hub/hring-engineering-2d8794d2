from datetime import date, datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hring_api.db.base import Base


EMBEDDING_DIMENSIONS = 384


class LegalSource(Base):
    __tablename__ = "legal_sources"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','superseded','deleted')",
            name="status",
        ),
        CheckConstraint(
            "index_status IN ('ready','pending','failed')",
            name="index_status",
        ),
        CheckConstraint("version >= 1", name="version"),
        CheckConstraint("chunk_size >= 300 AND chunk_size <= 4000", name="chunk_size"),
        CheckConstraint("chunk_overlap >= 0 AND chunk_overlap <= 500", name="chunk_overlap"),
        CheckConstraint("chunk_overlap < chunk_size", name="chunk_overlap_lt_size"),
        UniqueConstraint("checksum", name="uq_legal_sources_checksum"),
        UniqueConstraint(
            "source_key",
            "version",
            name="uq_legal_sources_source_key_version",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    source_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(160), nullable=True)
    document_text: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active", index=True)
    chunk_size: Mapped[int] = mapped_column(Integer, nullable=False, default=1400)
    chunk_overlap: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False)
    index_status: Mapped[str] = mapped_column(String(24), nullable=False, default="ready")
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    chunks: Mapped[list["LegalChunk"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class LegalChunk(Base):
    __tablename__ = "legal_chunks"
    __table_args__ = (
        CheckConstraint("chunk_index >= 0", name="chunk_index"),
        UniqueConstraint(
            "source_id",
            "chunk_index",
            name="uq_legal_chunks_source_index",
        ),
        UniqueConstraint(
            "source_id",
            "content_checksum",
            name="uq_legal_chunks_source_checksum",
        ),
        Index("ix_legal_chunks_search_vector", "search_vector", postgresql_using="gin"),
        Index(
            "ix_legal_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    source_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("legal_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    article_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS),
        nullable=True,
    )
    search_vector: Mapped[object] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('simple', content)", persisted=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    source: Mapped[LegalSource] = relationship(back_populates="chunks")
