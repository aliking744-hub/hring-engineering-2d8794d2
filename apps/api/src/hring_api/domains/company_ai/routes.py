from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import require_company_permission
from hring_api.domains.company_ai.repository import list_company_ai_connections
from hring_api.domains.company_ai.schemas import (
    CompanyAiConnectionResponse,
    CompanyAiConnectionTestResponse,
    CompanyAiConnectionUpsertRequest,
)
from hring_api.domains.company_ai.service import (
    CompanyAiConnectionError,
    CompanyAiConnectionNotFoundError,
    connection_response,
    delete_company_ai_connection,
    test_company_ai_connection,
    upsert_company_ai_connection,
)
from hring_api.domains.companies.repository import get_membership
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/companies/{company_id}/ai-connections", tags=["company-ai-connections"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    return request.client.host[:64] if request.client else None


async def _authorize_company(
    *,
    db: AsyncSession,
    principal: Principal,
    company_id: UUID,
    permission_key: str,
) -> None:
    membership = await get_membership(
        db, company_id=company_id, user_id=principal.user_id, active_only=True
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    await require_company_permission(db, membership=membership, permission_key=permission_key)


def _connection_error(exc: CompanyAiConnectionError) -> HTTPException:
    if isinstance(exc, CompanyAiConnectionNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=list[CompanyAiConnectionResponse])
async def company_ai_connection_list(
    company_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CompanyAiConnectionResponse]:
    await _authorize_company(
        db=db, principal=principal, company_id=company_id, permission_key="company.integrations.read"
    )
    return [connection_response(item) for item in await list_company_ai_connections(db, company_id=company_id)]


@router.put("/{capability_key}", response_model=CompanyAiConnectionResponse)
async def company_ai_connection_upsert(
    company_id: UUID,
    capability_key: str = Path(min_length=1, max_length=120, pattern=r"^[a-z0-9_.-]+$"),
    payload: CompanyAiConnectionUpsertRequest = ...,
    request: Request = ...,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> CompanyAiConnectionResponse:
    await _authorize_company(
        db=db, principal=principal, company_id=company_id, permission_key="company.integrations.manage"
    )
    try:
        connection = await upsert_company_ai_connection(
            db,
            company_id=company_id,
            capability_key=capability_key,
            payload=payload,
            actor_user_id=principal.user_id,
            ip_address=_client_ip(request),
            settings=settings,
        )
        await db.commit()
        await db.refresh(connection)
        return connection_response(connection)
    except CompanyAiConnectionError as exc:
        await db.rollback()
        raise _connection_error(exc) from exc


@router.post("/{capability_key}/test", response_model=CompanyAiConnectionTestResponse)
async def company_ai_connection_test(
    company_id: UUID,
    capability_key: str = Path(min_length=1, max_length=120, pattern=r"^[a-z0-9_.-]+$"),
    request: Request = ...,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> CompanyAiConnectionTestResponse:
    await _authorize_company(
        db=db, principal=principal, company_id=company_id, permission_key="company.integrations.manage"
    )
    try:
        result = await test_company_ai_connection(
            db,
            company_id=company_id,
            capability_key=capability_key,
            actor_user_id=principal.user_id,
            ip_address=_client_ip(request),
            settings=settings,
        )
        await db.commit()
        return result
    except CompanyAiConnectionError as exc:
        await db.rollback()
        raise _connection_error(exc) from exc


@router.delete("/{capability_key}", status_code=status.HTTP_204_NO_CONTENT)
async def company_ai_connection_delete(
    company_id: UUID,
    capability_key: str = Path(min_length=1, max_length=120, pattern=r"^[a-z0-9_.-]+$"),
    request: Request = ...,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await _authorize_company(
        db=db, principal=principal, company_id=company_id, permission_key="company.integrations.manage"
    )
    try:
        await delete_company_ai_connection(
            db,
            company_id=company_id,
            capability_key=capability_key,
            actor_user_id=principal.user_id,
            ip_address=_client_ip(request),
        )
        await db.commit()
    except CompanyAiConnectionError as exc:
        await db.rollback()
        raise _connection_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
