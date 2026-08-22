from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.integrations.repository import list_integration_providers
from hring_api.domains.integrations.schemas import (
    IntegrationConnectionTestResponse,
    IntegrationProviderCreateRequest,
    IntegrationProviderResponse,
    IntegrationProviderUpdateRequest,
    IntegrationSecretRotateRequest,
)
from hring_api.domains.integrations.service import (
    IntegrationConflictError,
    IntegrationError,
    IntegrationNotFoundError,
    IntegrationValidationError,
    create_provider,
    provider_response,
    revoke_provider_secret,
    rotate_provider_secret,
    test_provider_connection,
    update_provider,
)


router = APIRouter(prefix="/admin/platform/integrations", tags=["integration-admin"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _http_error(exc: IntegrationError) -> HTTPException:
    if isinstance(exc, IntegrationNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, IntegrationConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, IntegrationValidationError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/providers", response_model=list[IntegrationProviderResponse])
async def integration_providers(
    _: PlatformPrincipal = Depends(require_platform_permission("platform.integrations.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[IntegrationProviderResponse]:
    providers = await list_integration_providers(db)
    return [provider_response(provider) for provider in providers]


@router.post(
    "/providers",
    response_model=IntegrationProviderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_integration_provider(
    payload: IntegrationProviderCreateRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("platform.integrations.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> IntegrationProviderResponse:
    try:
        provider = await create_provider(
            db,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            settings=settings,
        )
    except IntegrationError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    await db.commit()
    await db.refresh(provider)
    return provider_response(provider)


@router.patch("/providers/{provider_id}", response_model=IntegrationProviderResponse)
async def change_integration_provider(
    provider_id: UUID,
    payload: IntegrationProviderUpdateRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("platform.integrations.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> IntegrationProviderResponse:
    try:
        provider = await update_provider(
            db,
            provider_id=provider_id,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            settings=settings,
        )
    except IntegrationError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    await db.commit()
    await db.refresh(provider)
    return provider_response(provider)


@router.post(
    "/providers/{provider_id}/rotate-secret",
    response_model=IntegrationProviderResponse,
)
async def rotate_integration_provider_secret(
    provider_id: UUID,
    payload: IntegrationSecretRotateRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("platform.integrations.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> IntegrationProviderResponse:
    try:
        provider = await rotate_provider_secret(
            db,
            provider_id=provider_id,
            secret=payload.secret.get_secret_value(),
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            settings=settings,
        )
    except IntegrationError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    await db.commit()
    await db.refresh(provider)
    return provider_response(provider)


@router.delete(
    "/providers/{provider_id}/secret",
    response_model=IntegrationProviderResponse,
)
async def delete_integration_provider_secret(
    provider_id: UUID,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("platform.integrations.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> IntegrationProviderResponse:
    try:
        provider = await revoke_provider_secret(
            db,
            provider_id=provider_id,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
        )
    except IntegrationError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    await db.commit()
    await db.refresh(provider)
    return provider_response(provider)


@router.post(
    "/providers/{provider_id}/test",
    response_model=IntegrationConnectionTestResponse,
)
async def test_integration_provider(
    provider_id: UUID,
    request: Request,
    actor: PlatformPrincipal = Depends(
        require_platform_permission("platform.integrations.manage")
    ),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> IntegrationConnectionTestResponse:
    try:
        result = await test_provider_connection(
            db,
            provider_id=provider_id,
            actor_user_id=actor.user_id,
            ip_address=_client_ip(request),
            settings=settings,
        )
    except IntegrationError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
    await db.commit()
    return IntegrationConnectionTestResponse(
        provider_id=result.provider_id,
        healthy=result.healthy,
        status=result.status,
        http_status=result.http_status,
        latency_ms=result.latency_ms,
        message=result.message,
        tested_at=result.tested_at,
    )
