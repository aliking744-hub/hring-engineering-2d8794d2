from collections.abc import Awaitable
from hashlib import sha256
from datetime import date
from typing import TypeVar
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.billing.credit_service import (
    CreditConflictError,
    CreditError,
    CreditForbiddenError,
    CreditNotFoundError,
    InsufficientCreditsError,
    feature_credit_cost,
    run_with_credit_reservation,
)
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.legal.advisor import (
    LegalAdvisorError,
    LegalAdvisorInputError,
    LegalAdvisorNoSourcesError,
    LegalAdvisorRateLimitError,
    enforce_legal_advisor_rate_limit,
    generate_legal_advice,
)
from hring_api.domains.legal.defense import (
    LegalDefenseError,
    LegalDefenseInputError,
    LegalDefenseRateLimitError,
    enforce_legal_defense_rate_limit,
    generate_legal_defense,
)
from hring_api.domains.legal.ingestion import (
    MAX_DOCUMENT_BYTES,
    LegalIngestionError,
    extract_upload,
)
from hring_api.domains.legal.schemas import (
    Category,
    LegalAdvisorRequest,
    LegalAdvisorResponse,
    LegalDefenseRequest,
    LegalDefenseResponse,
    LegalHtmlImportRequest,
    LegalImportResponse,
    LegalKnowledgeStats,
    LegalReindexRequest,
    LegalSearchRequest,
    LegalSearchResult,
    LegalSourceMetadata,
    LegalSourceResponse,
    LegalUrlImportRequest,
)
from hring_api.domains.legal.service import (
    LegalConflictError,
    LegalError,
    LegalNotFoundError,
    delete_source,
    ingest_document,
    ingest_html,
    ingest_url,
    knowledge_stats,
    reindex_source,
    search_legal_knowledge,
    source_history,
)


router = APIRouter(prefix="/legal", tags=["legal"])
ResultT = TypeVar("ResultT")


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _request_id(request: Request) -> str | None:
    value = getattr(request.state, "request_id", None) or request.headers.get("x-request-id")
    normalized = str(value or "").strip()
    return normalized[:160] or None


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InsufficientCreditsError):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    if isinstance(exc, CreditForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CreditNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CreditConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, CreditError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, LegalNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, LegalConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, LegalIngestionError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def _commit_operation(
    db: AsyncSession,
    operation: Awaitable[ResultT],
) -> ResultT:
    try:
        result = await operation
        await db.commit()
        return result
    except (LegalError, LegalIngestionError) as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Legal source changed concurrently; retry the operation",
        ) from exc


@router.post("/search", response_model=list[LegalSearchResult])
async def search_legal_sources(
    payload: LegalSearchRequest,
    _: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[LegalSearchResult]:
    return await search_legal_knowledge(db, payload=payload)


@router.post("/advisor/chat", response_model=LegalAdvisorResponse)
async def legal_advisor_chat(
    payload: LegalAdvisorRequest,
    request: Request,
    idempotency_key: str = Header(..., alias="X-Idempotency-Key", min_length=8, max_length=128),
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> LegalAdvisorResponse:
    feature_key = "legal.advisor"
    cost = await feature_credit_cost(db, feature_key=feature_key, default_cost=5)
    key_hash = sha256(idempotency_key.strip().encode()).hexdigest()

    async def operation() -> LegalAdvisorResponse:
        await enforce_legal_advisor_rate_limit(user_id=principal.user_id, settings=settings)
        return await generate_legal_advice(
            db,
            payload=payload,
            principal=principal,
            settings=settings,
            credits_charged=cost,
        )

    try:
        return await run_with_credit_reservation(
            db,
            principal=principal,
            amount=cost,
            idempotency_key=f"{feature_key}:{key_hash}",
            feature_key=feature_key,
            description="Generate legal advisor response",
            request_id=_request_id(request),
            operation=operation,
        )
    except CreditError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    except LegalAdvisorRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": "60"},
        ) from exc
    except LegalAdvisorInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except LegalAdvisorNoSourcesError as exc:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(exc),
        ) from exc
    except LegalAdvisorError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.post("/defense/analyze", response_model=LegalDefenseResponse)
async def analyze_legal_defense(
    payload: LegalDefenseRequest,
    request: Request,
    idempotency_key: str = Header(..., alias="X-Idempotency-Key", min_length=8, max_length=128),
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> LegalDefenseResponse:
    feature_key = "legal.defense"
    cost = await feature_credit_cost(db, feature_key=feature_key, default_cost=20)
    key_hash = sha256(idempotency_key.strip().encode()).hexdigest()

    async def operation() -> LegalDefenseResponse:
        await enforce_legal_defense_rate_limit(user_id=principal.user_id, settings=settings)
        return await generate_legal_defense(
            db,
            payload=payload,
            principal=principal,
            settings=settings,
            credits_charged=cost,
        )

    try:
        return await run_with_credit_reservation(
            db,
            principal=principal,
            amount=cost,
            idempotency_key=f"{feature_key}:{key_hash}",
            feature_key=feature_key,
            description="Generate legal defense analysis",
            request_id=_request_id(request),
            operation=operation,
        )
    except CreditError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    except LegalDefenseRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": "60"},
        ) from exc
    except LegalDefenseInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except LegalDefenseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/admin/stats", response_model=LegalKnowledgeStats)
async def legal_knowledge_stats(
    _: PlatformPrincipal = Depends(require_platform_permission("product.legal.read")),
    db: AsyncSession = Depends(get_db_session),
) -> LegalKnowledgeStats:
    return await knowledge_stats(db)


@router.get("/admin/sources", response_model=list[LegalSourceResponse])
async def list_legal_sources(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    include_deleted: bool = Query(default=False),
    _: PlatformPrincipal = Depends(require_platform_permission("product.legal.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[LegalSourceResponse]:
    return await source_history(
        db,
        limit=limit,
        offset=offset,
        include_deleted=include_deleted,
    )


@router.post(
    "/admin/sources/upload",
    response_model=LegalImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_legal_source(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(..., min_length=2, max_length=500),
    category: Category = Form(...),
    source_url: str | None = Form(default=None, max_length=2_000),
    published_at: date | None = Form(default=None),
    valid_from: date | None = Form(default=None),
    valid_to: date | None = Form(default=None),
    chunk_size: int = Form(default=1400, ge=300, le=4000),
    chunk_overlap: int = Form(default=180, ge=0, le=500),
    actor: PlatformPrincipal = Depends(
        require_platform_permission("product.legal.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> LegalImportResponse:
    try:
        raw = await file.read(MAX_DOCUMENT_BYTES + 1)
        document = await extract_upload(
            file.filename or "document",
            raw,
            file.content_type,
        )
        metadata = LegalSourceMetadata(
            title=title,
            category=category,
            source_url=source_url,
            published_at=published_at,
            valid_from=valid_from,
            valid_to=valid_to,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
    except LegalIngestionError as exc:
        raise _http_error(exc) from exc

    return await _commit_operation(
        db,
        ingest_document(
            db,
            document=document,
            metadata=metadata,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            request_id=_request_id(request),
        ),
    )


@router.post(
    "/admin/sources/html",
    response_model=LegalImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_legal_html(
    payload: LegalHtmlImportRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("product.legal.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> LegalImportResponse:
    return await _commit_operation(
        db,
        ingest_html(
            db,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            request_id=_request_id(request),
        ),
    )


@router.post(
    "/admin/sources/url",
    response_model=LegalImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_legal_url(
    payload: LegalUrlImportRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("product.legal.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> LegalImportResponse:
    return await _commit_operation(
        db,
        ingest_url(
            db,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            request_id=_request_id(request),
        ),
    )


@router.post(
    "/admin/sources/{source_id}/reindex",
    response_model=LegalSourceResponse,
)
async def reindex_legal_source(
    source_id: UUID,
    payload: LegalReindexRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("product.legal.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> LegalSourceResponse:
    return await _commit_operation(
        db,
        reindex_source(
            db,
            source_id=source_id,
            actor_user_id=actor.user_id,
            chunk_size=payload.chunk_size,
            chunk_overlap=payload.chunk_overlap,
            ip_address=_client_ip(request),
            request_id=_request_id(request),
        ),
    )


@router.delete("/admin/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_legal_source(
    source_id: UUID,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("product.legal.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await _commit_operation(
        db,
        delete_source(
            db,
            source_id=source_id,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            request_id=_request_id(request),
        ),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
