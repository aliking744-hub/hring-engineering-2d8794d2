"""Promote the legal knowledge base to typed pgvector storage.

Revision ID: 20260826_0016
Revises: 20260824_0015
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql


revision: str = "20260826_0016"
down_revision: str | None = "20260824_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pgcrypto supplies digest() for deterministic checksums during the legacy
    # copy. Both extensions remain installed on downgrade because other domains
    # may use them after this migration has run.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "legal_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_key", sa.String(length=64), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(length=40), nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(length=160), nullable=True),
        sa.Column("document_text", sa.Text(), nullable=False),
        sa.Column("published_at", sa.Date(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("chunk_size", sa.Integer(), nullable=False),
        sa.Column("chunk_overlap", sa.Integer(), nullable=False),
        sa.Column("embedding_model", sa.String(length=100), nullable=False),
        sa.Column("index_status", sa.String(length=24), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active','superseded','deleted')",
            name="status",
        ),
        sa.CheckConstraint(
            "index_status IN ('ready','pending','failed')",
            name="index_status",
        ),
        sa.CheckConstraint("version >= 1", name="version"),
        sa.CheckConstraint(
            "chunk_size >= 300 AND chunk_size <= 4000",
            name="chunk_size",
        ),
        sa.CheckConstraint(
            "chunk_overlap >= 0 AND chunk_overlap <= 500",
            name="chunk_overlap",
        ),
        sa.CheckConstraint(
            "chunk_overlap < chunk_size",
            name="chunk_overlap_lt_size",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name="fk_legal_sources_created_by_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_legal_sources"),
        sa.UniqueConstraint("checksum", name="uq_legal_sources_checksum"),
        sa.UniqueConstraint(
            "source_key",
            "version",
            name="uq_legal_sources_source_key_version",
        ),
    )
    op.create_index("ix_legal_sources_source_key", "legal_sources", ["source_key"])
    op.create_index("ix_legal_sources_category", "legal_sources", ["category"])
    op.create_index("ix_legal_sources_status", "legal_sources", ["status"])
    op.create_index("ix_legal_sources_created_by", "legal_sources", ["created_by"])
    op.create_index("ix_legal_sources_created_at", "legal_sources", ["created_at"])

    op.create_table(
        "legal_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("article_number", sa.String(length=80), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_checksum", sa.String(length=64), nullable=False),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('simple', content)", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("chunk_index >= 0", name="chunk_index"),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["legal_sources.id"],
            name="fk_legal_chunks_source_id_legal_sources",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_legal_chunks"),
        sa.UniqueConstraint(
            "source_id",
            "chunk_index",
            name="uq_legal_chunks_source_index",
        ),
        sa.UniqueConstraint(
            "source_id",
            "content_checksum",
            name="uq_legal_chunks_source_checksum",
        ),
    )
    op.create_index("ix_legal_chunks_source_id", "legal_chunks", ["source_id"])
    op.create_index(
        "ix_legal_chunks_search_vector",
        "legal_chunks",
        ["search_vector"],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_legal_chunks_embedding_hnsw",
        "legal_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    # URL imports can be reconstructed into one versioned source. Old uploaded
    # files had no batch identifier, so each legacy record becomes an isolated
    # source instead of accidentally combining unrelated documents.
    op.execute(
        r"""
        WITH legacy AS (
            SELECT
                records.record_id,
                records.created_at,
                records.updated_at,
                COALESCE(NULLIF(trim(records.data->>'content'), ''), '') AS content,
                left(COALESCE(NULLIF(trim(records.data->>'category'), ''), 'other'), 80)
                    AS category,
                NULLIF(trim(records.data->>'source_url'), '') AS source_url,
                left(
                    COALESCE(NULLIF(trim(records.data->>'source_type'), ''), 'legacy-compat'),
                    40
                ) AS source_type,
                CASE
                    WHEN COALESCE(trim(records.data->>'created_by'), '')
                        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    THEN records.data->>'created_by'
                    ELSE NULL
                END AS created_by,
                CASE
                    WHEN NULLIF(trim(records.data->>'source_url'), '') IS NULL
                      OR lower(trim(records.data->>'source_url')) = 'uploaded-document'
                    THEN 'legacy-record:' || records.record_id
                    ELSE lower(trim(records.data->>'source_url'))
                END AS identity
            FROM compat_records AS records
            WHERE records.table_name = 'legal_docs'
              AND length(COALESCE(trim(records.data->>'content'), '')) >= 20
        ), normalized AS (
            SELECT
                *,
                encode(digest(identity, 'sha256'), 'hex') AS source_key
            FROM legacy
        ), grouped AS (
            SELECT
                source_key,
                category,
                source_url,
                source_type,
                string_agg(content, E'\n\n' ORDER BY created_at, record_id) AS document_text,
                min(created_at) AS created_at,
                max(updated_at) AS updated_at,
                max(created_by) AS created_by
            FROM normalized
            GROUP BY source_key, category, source_url, source_type
        ), deduplicated AS (
            SELECT
                *,
                encode(digest(document_text, 'sha256'), 'hex') AS checksum,
                row_number() OVER (
                    PARTITION BY encode(digest(document_text, 'sha256'), 'hex')
                    ORDER BY source_key
                ) AS checksum_rank
            FROM grouped
        )
        INSERT INTO legal_sources (
            id, source_key, checksum, title, category, source_url, source_type,
            original_filename, mime_type, document_text, published_at,
            valid_from, valid_to, version, status, chunk_size, chunk_overlap,
            embedding_model, index_status, created_by, deleted_at,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), source_key, checksum,
            left(COALESCE(source_url, 'سند حقوقی انتقال‌یافته'), 500),
            category, source_url, source_type, NULL, NULL, document_text,
            NULL, NULL, NULL, 1, 'active', 1400, 180,
            'legacy-pending', 'pending',
            CASE
                WHEN created_by IS NOT NULL AND EXISTS (
                    SELECT 1 FROM users WHERE users.id = created_by::uuid
                ) THEN created_by::uuid
                ELSE NULL
            END,
            NULL,
            created_at, updated_at
        FROM deduplicated
        WHERE checksum_rank = 1
        ON CONFLICT (checksum) DO NOTHING
        """
    )

    # Preserve the existing legacy article boundaries. Duplicate chunks within
    # one source are collapsed by checksum before the unique index is enforced.
    op.execute(
        r"""
        WITH legacy AS (
            SELECT
                records.record_id,
                records.created_at,
                COALESCE(NULLIF(trim(records.data->>'content'), ''), '') AS content,
                left(NULLIF(trim(records.data->>'article_number'), ''), 80)
                    AS article_number,
                CASE
                    WHEN NULLIF(trim(records.data->>'source_url'), '') IS NULL
                      OR lower(trim(records.data->>'source_url')) = 'uploaded-document'
                    THEN 'legacy-record:' || records.record_id
                    ELSE lower(trim(records.data->>'source_url'))
                END AS identity
            FROM compat_records AS records
            WHERE records.table_name = 'legal_docs'
              AND length(COALESCE(trim(records.data->>'content'), '')) >= 20
        ), normalized AS (
            SELECT
                *,
                encode(digest(identity, 'sha256'), 'hex') AS source_key,
                encode(digest(content, 'sha256'), 'hex') AS content_checksum
            FROM legacy
        ), unique_chunks AS (
            SELECT
                *,
                row_number() OVER (
                    PARTITION BY source_key, content_checksum
                    ORDER BY created_at, record_id
                ) AS duplicate_rank
            FROM normalized
        ), numbered AS (
            SELECT
                sources.id AS source_id,
                chunks.article_number,
                chunks.content,
                chunks.content_checksum,
                chunks.created_at,
                row_number() OVER (
                    PARTITION BY sources.id
                    ORDER BY chunks.created_at, chunks.record_id
                ) - 1 AS chunk_index
            FROM unique_chunks AS chunks
            JOIN legal_sources AS sources
              ON sources.source_key = chunks.source_key
             AND sources.version = 1
            WHERE chunks.duplicate_rank = 1
        )
        INSERT INTO legal_chunks (
            id, source_id, chunk_index, article_number, content,
            content_checksum, embedding, created_at
        )
        SELECT
            gen_random_uuid(), source_id, chunk_index, article_number,
            content, content_checksum, NULL, created_at
        FROM numbered
        ON CONFLICT (source_id, content_checksum) DO NOTHING
        """
    )


def downgrade() -> None:
    # Copy native chunks back to the compatibility table. Deleted sources have
    # no vectors/chunks, so their retained document_text is emitted as one row.
    op.execute(
        r"""
        WITH export_rows AS (
            SELECT
                'native:' || sources.id::text || ':' || chunks.chunk_index::text AS record_id,
                sources.created_by AS owner_user_id,
                jsonb_build_object(
                    'id', chunks.id::text,
                    'content', chunks.content,
                    'category', sources.category,
                    'source_url', sources.source_url,
                    'article_number', chunks.article_number,
                    'embedding', NULL,
                    'source_type', sources.source_type,
                    'created_by', sources.created_by,
                    'title', sources.title,
                    'source_id', sources.id,
                    'source_version', sources.version,
                    'source_checksum', sources.checksum,
                    'source_status', sources.status
                ) AS data,
                chunks.created_at,
                sources.updated_at
            FROM legal_sources AS sources
            JOIN legal_chunks AS chunks ON chunks.source_id = sources.id

            UNION ALL

            SELECT
                'native-deleted-' || sources.id::text,
                sources.created_by,
                jsonb_build_object(
                    'id', sources.id::text,
                    'content', sources.document_text,
                    'category', sources.category,
                    'source_url', sources.source_url,
                    'article_number', NULL,
                    'embedding', NULL,
                    'source_type', sources.source_type,
                    'created_by', sources.created_by,
                    'title', sources.title,
                    'source_id', sources.id,
                    'source_version', sources.version,
                    'source_checksum', sources.checksum,
                    'source_status', sources.status
                ),
                sources.created_at,
                sources.updated_at
            FROM legal_sources AS sources
            WHERE NOT EXISTS (
                SELECT 1 FROM legal_chunks AS chunks WHERE chunks.source_id = sources.id
            )
        )
        INSERT INTO compat_records (
            id, table_name, record_id, owner_user_id, company_id,
            data, created_at, updated_at
        )
        SELECT
            gen_random_uuid(), 'legal_docs', record_id, owner_user_id,
            NULL, data, created_at, updated_at
        FROM export_rows
        ON CONFLICT (table_name, record_id) DO UPDATE
        SET owner_user_id = EXCLUDED.owner_user_id,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
        """
    )

    op.drop_index("ix_legal_chunks_embedding_hnsw", table_name="legal_chunks")
    op.drop_index("ix_legal_chunks_search_vector", table_name="legal_chunks")
    op.drop_index("ix_legal_chunks_source_id", table_name="legal_chunks")
    op.drop_table("legal_chunks")
    op.drop_index("ix_legal_sources_created_at", table_name="legal_sources")
    op.drop_index("ix_legal_sources_created_by", table_name="legal_sources")
    op.drop_index("ix_legal_sources_status", table_name="legal_sources")
    op.drop_index("ix_legal_sources_category", table_name="legal_sources")
    op.drop_index("ix_legal_sources_source_key", table_name="legal_sources")
    op.drop_table("legal_sources")
