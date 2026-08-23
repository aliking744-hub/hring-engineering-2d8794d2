from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.ai.feature_catalog import AI_FEATURE_BY_KEY
from hring_api.domains.ai.feature_routing import (
    AiFeatureRouteNotFoundError,
    feature_route_response,
    list_feature_routes,
    reset_feature_route,
    set_feature_route,
)
from hring_api.domains.ai.feature_schemas import (
    AiFeatureRouteResponse,
    AiFeatureRouteUpdateRequest,
)


router = APIRouter(prefix="/admin/platform/ai/routes", tags=["platform-ai-routes"])


def _ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    return request.client.host[:64] if request.client else None


@router.get("", response_model=list[AiFeatureRouteResponse])
async def ai_feature_route_list(
    _: PlatformPrincipal = Depends(require_platform_permission("platform.ai_routes.read")),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> list[AiFeatureRouteResponse]:
    return await list_feature_routes(db, settings)


@router.put("/{feature_key}", response_model=AiFeatureRouteResponse)
async def ai_feature_route_update(
    payload: AiFeatureRouteUpdateRequest,
    request: Request,
    feature_key: str = Path(min_length=1, max_length=120, pattern=r"^[a-z0-9_.-]+$"),
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.ai_routes.manage")),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AiFeatureRouteResponse:
    try:
        route = await set_feature_route(
            db,
            feature_key=feature_key,
            provider_alias=payload.provider_alias,
            model=payload.model,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(route)
        return feature_route_response(AI_FEATURE_BY_KEY[feature_key], route, settings)
    except AiFeatureRouteNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{feature_key}", response_model=AiFeatureRouteResponse)
async def ai_feature_route_reset(
    request: Request,
    feature_key: str = Path(min_length=1, max_length=120, pattern=r"^[a-z0-9_.-]+$"),
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.ai_routes.manage")),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AiFeatureRouteResponse:
    try:
        await reset_feature_route(
            db,
            feature_key=feature_key,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        return feature_route_response(AI_FEATURE_BY_KEY[feature_key], None, settings)
    except AiFeatureRouteNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

