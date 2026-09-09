from datetime import UTC, datetime
from html import escape
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.content.models import ContentArticle
from hring_api.domains.content.repository import (
    get_article, get_public_article, list_articles_for_admin, list_public_articles, list_runs,
)
from hring_api.domains.content.schemas import (
    ArticleStatusRequest, ContentAgentRunResponse, ContentAgentSettingsResponse,
    ContentArticleResponse, ContentSourceResponse, TriggerContentAgentResponse,
    UpdateContentAgentSettingsRequest,
)
from hring_api.domains.content.service import ensure_agent_settings
from hring_api.worker.app import celery_app


router = APIRouter(prefix="/content", tags=["content"])
admin_router = APIRouter(prefix="/admin/content-agent", tags=["content-agent-admin"])


def _article_response(row: ContentArticle) -> ContentArticleResponse:
    sources = [ContentSourceResponse.model_validate(item) for item in row.sources_json if isinstance(item, dict)]
    return ContentArticleResponse(
        id=row.id, title=row.title, slug=row.slug, excerpt=row.excerpt,
        content_markdown=row.content_markdown, seo_title=row.seo_title,
        meta_description=row.meta_description, focus_keyword=row.focus_keyword,
        related_keywords=row.related_keywords_json, image_url=row.image_url,
        author_name=row.author_name, author_disclosure=row.author_disclosure,
        status=row.status, published_at=row.published_at, sources=sources,
        credibility_score=row.credibility_score, quality_score=row.quality_score,
        created_at=row.created_at, updated_at=row.updated_at,
    )


@router.get("/posts", response_model=list[ContentArticleResponse])
async def public_posts(
    limit: int = Query(default=30, ge=1, le=100), offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
) -> list[ContentArticleResponse]:
    return [_article_response(row) for row in await list_public_articles(db, limit=limit, offset=offset)]


@router.get("/posts/{slug}", response_model=ContentArticleResponse)
async def public_post(slug: str, db: AsyncSession = Depends(get_db_session)) -> ContentArticleResponse:
    row = await get_public_article(db, slug)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _article_response(row)


@router.get("/sitemap.xml", response_class=Response)
async def content_sitemap(db: AsyncSession = Depends(get_db_session)) -> Response:
    rows = await list_public_articles(db, limit=1000, offset=0)
    static_paths = ["/", "/blog", "/faq", "/product-catalog"]
    urls = [
        f"<url><loc>https://hring.ir{path}</loc><lastmod>{datetime.now(UTC).date().isoformat()}</lastmod></url>"
        for path in static_paths
    ]
    urls.extend(
        f"<url><loc>https://hring.ir/blog/{escape(row.slug)}</loc><lastmod>{row.updated_at.date().isoformat()}</lastmod></url>"
        for row in rows
    )
    body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(urls) + "</urlset>"
    return Response(body, media_type="application/xml", headers={"Cache-Control": "public, max-age=900"})


@admin_router.get("/settings", response_model=ContentAgentSettingsResponse)
async def get_settings_for_admin(
    _: PlatformPrincipal = Depends(require_platform_permission("product.content.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> ContentAgentSettingsResponse:
    row = await ensure_agent_settings(db)
    await db.commit()
    await db.refresh(row)
    return ContentAgentSettingsResponse.model_validate(row)


@admin_router.put("/settings", response_model=ContentAgentSettingsResponse)
async def update_settings_for_admin(
    payload: UpdateContentAgentSettingsRequest, request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("product.content.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> ContentAgentSettingsResponse:
    row = await ensure_agent_settings(db)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    row.updated_by = actor.user_id
    await add_audit_log(
        db, actor_user_id=actor.user_id, company_id=None,
        action="content.agent.settings.update", resource_type="content_agent", resource_id=str(row.id),
        metadata_json={"enabled": row.enabled, "daily_article_count": row.daily_article_count, "auto_publish": row.auto_publish},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(row)
    return ContentAgentSettingsResponse.model_validate(row)


@admin_router.get("/runs", response_model=list[ContentAgentRunResponse])
async def runs_for_admin(
    limit: int = Query(default=30, ge=1, le=100),
    _: PlatformPrincipal = Depends(require_platform_permission("product.content.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[ContentAgentRunResponse]:
    return [ContentAgentRunResponse.model_validate(row) for row in await list_runs(db, limit=limit)]


@admin_router.get("/articles", response_model=list[ContentArticleResponse])
async def articles_for_admin(
    limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0),
    _: PlatformPrincipal = Depends(require_platform_permission("product.content.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[ContentArticleResponse]:
    return [_article_response(row) for row in await list_articles_for_admin(db, limit=limit, offset=offset)]


@admin_router.post("/run", response_model=TriggerContentAgentResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_agent(
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("product.content.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> TriggerContentAgentResponse:
    slot_key = f"manual:{uuid4()}"
    result = celery_app.send_task(
        "hring.content.generate_article",
        kwargs={"slot_key": slot_key, "trigger": "manual", "actor_user_id": str(actor.user_id), "force": True},
    )
    await add_audit_log(
        db, actor_user_id=actor.user_id, company_id=None,
        action="content.agent.run.trigger", resource_type="content_agent", resource_id=slot_key,
        metadata_json={"task_id": str(result.id)}, ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return TriggerContentAgentResponse(accepted=True, task_id=str(result.id))


@admin_router.patch("/articles/{article_id}/status", response_model=ContentArticleResponse)
async def change_article_status(
    article_id: UUID, payload: ArticleStatusRequest, request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("product.content.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> ContentArticleResponse:
    row = await get_article(db, article_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    row.status = payload.status
    row.published_at = datetime.now(UTC) if payload.status == "published" and row.published_at is None else row.published_at
    await add_audit_log(
        db, actor_user_id=actor.user_id, company_id=None, action="content.article.status.update",
        resource_type="content_article", resource_id=str(row.id), metadata_json={"status": payload.status},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(row)
    return _article_response(row)
