from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.compat.models import CompatRecord


router = APIRouter(prefix="/admin/platform/ai", tags=["platform-ai-quality"])


class InteractionReviewRequest(BaseModel):
    quality_status: Literal["unreviewed", "correct", "needs_review", "incorrect"]
    admin_note: str | None = Field(default=None, max_length=4000)


def _payload(record: CompatRecord) -> dict[str, Any]:
    value = dict(record.data)
    value.setdefault("id", record.record_id)
    value.setdefault("created_at", record.created_at.isoformat())
    value["updated_at"] = record.updated_at.isoformat()
    return value


@router.get("/interactions")
async def list_ai_interactions(
    feature_key: str | None = Query(default=None, max_length=120),
    request_status: Literal["success", "failure"] | None = Query(default=None),
    quality_status: Literal["unreviewed", "correct", "needs_review", "incorrect"] | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=200, ge=1, le=500),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_conversations.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(CompatRecord)
        .where(CompatRecord.table_name == "ai_interactions")
        .order_by(CompatRecord.created_at.desc())
        .limit(1000)
    )
    rows = [_payload(item) for item in result.scalars().all()]
    if feature_key:
        rows = [row for row in rows if row.get("feature_key") == feature_key]
    if request_status:
        rows = [row for row in rows if row.get("status") == request_status]
    if quality_status:
        rows = [row for row in rows if row.get("quality_status", "unreviewed") == quality_status]
    if search:
        needle = search.casefold().strip()
        rows = [
            row
            for row in rows
            if needle in str(row.get("messages") or "").casefold()
            or needle in str(row.get("response_text") or "").casefold()
        ]
    return rows[:limit]


@router.get("/feedback")
async def list_ai_feedback(
    limit: int = Query(default=500, ge=1, le=1000),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_conversations.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(CompatRecord)
        .where(CompatRecord.table_name == "site_feedback")
        .order_by(CompatRecord.created_at.desc())
        .limit(limit)
    )
    return [_payload(item) for item in result.scalars().all()]


@router.patch("/interactions/{interaction_id}/review")
async def review_ai_interaction(
    interaction_id: str,
    payload: InteractionReviewRequest,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("platform.ai_conversations.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    record = await db.scalar(
        select(CompatRecord).where(
            CompatRecord.table_name == "ai_interactions",
            CompatRecord.record_id == interaction_id,
        )
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI interaction not found")
    value = dict(record.data)
    value["quality_status"] = payload.quality_status
    value["admin_note"] = payload.admin_note.strip() if payload.admin_note else None
    value["reviewed_at"] = datetime.now(UTC).isoformat()
    value["reviewed_by"] = str(actor.user_id)
    record.data = value
    await db.commit()
    await db.refresh(record)
    return _payload(record)
