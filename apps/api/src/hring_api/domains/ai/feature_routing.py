from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.db.session import SessionFactory
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.ai.feature_catalog import AI_FEATURE_BY_KEY, AI_FEATURES, AiFeatureDefinition
from hring_api.domains.ai.feature_schemas import AiFeatureRouteResponse
from hring_api.domains.ai.models import AiFeatureRoute


logger = logging.getLogger(__name__)


class AiFeatureRouteNotFoundError(RuntimeError):
    pass


@dataclass(frozen=True)
class ResolvedAiFeatureRoute:
    provider: str
    model: str
    source: str


def _default_route(
    feature: AiFeatureDefinition,
    settings: Settings,
) -> tuple[str, str]:
    if feature.default_route == "enrichment":
        return settings.recruiting_enrichment_provider, settings.recruiting_enrichment_model
    return settings.recruiting_ai_provider, settings.recruiting_ai_model


async def _override(
    session: AsyncSession,
    feature_key: str,
    *,
    for_update: bool = False,
) -> AiFeatureRoute | None:
    statement = select(AiFeatureRoute).where(AiFeatureRoute.feature_key == feature_key)
    if for_update:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return result.scalar_one_or_none()


def feature_route_response(
    feature: AiFeatureDefinition,
    override: AiFeatureRoute | None,
    settings: Settings,
) -> AiFeatureRouteResponse:
    default_provider, default_model = _default_route(feature, settings)
    return AiFeatureRouteResponse(
        feature_key=feature.feature_key,
        display_name=feature.display_name,
        category=feature.category,
        description=feature.description,
        provider_alias=override.provider_alias if override else default_provider,
        model=override.model if override else default_model,
        source="admin_override" if override else "environment_default",
        updated_at=override.updated_at if override else None,
    )


async def list_feature_routes(
    session: AsyncSession,
    settings: Settings,
) -> list[AiFeatureRouteResponse]:
    result = await session.execute(select(AiFeatureRoute))
    overrides = {item.feature_key: item for item in result.scalars().all()}
    return [
        feature_route_response(feature, overrides.get(feature.feature_key), settings)
        for feature in AI_FEATURES
    ]


async def set_feature_route(
    session: AsyncSession,
    *,
    feature_key: str,
    provider_alias: str,
    model: str,
    actor_user_id: UUID,
    ip_address: str | None,
) -> AiFeatureRoute:
    if feature_key not in AI_FEATURE_BY_KEY:
        raise AiFeatureRouteNotFoundError("AI feature was not found")
    route = await _override(session, feature_key, for_update=True)
    if route is None:
        route = AiFeatureRoute(
            feature_key=feature_key,
            provider_alias=provider_alias,
            model=model,
            updated_by=actor_user_id,
        )
        session.add(route)
    else:
        route.provider_alias = provider_alias
        route.model = model
        route.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.feature_route.update",
        resource_type="ai_feature_route",
        resource_id=feature_key,
        metadata_json={"feature_key": feature_key, "provider_alias": provider_alias, "model": model},
        ip_address=ip_address,
    )
    return route


async def reset_feature_route(
    session: AsyncSession,
    *,
    feature_key: str,
    actor_user_id: UUID,
    ip_address: str | None,
) -> None:
    if feature_key not in AI_FEATURE_BY_KEY:
        raise AiFeatureRouteNotFoundError("AI feature was not found")
    route = await _override(session, feature_key, for_update=True)
    if route is not None:
        await session.delete(route)
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.feature_route.reset",
        resource_type="ai_feature_route",
        resource_id=feature_key,
        metadata_json={"feature_key": feature_key},
        ip_address=ip_address,
    )


async def resolve_runtime_feature_route(
    *,
    feature_key: str,
    default_provider: str,
    default_model: str,
) -> ResolvedAiFeatureRoute:
    try:
        async with SessionFactory() as session:
            route = await _override(session, feature_key)
    except SQLAlchemyError:
        logger.warning("AI feature route lookup failed; using environment default", exc_info=True)
        route = None
    if route is None:
        return ResolvedAiFeatureRoute(default_provider, default_model, "environment_default")
    return ResolvedAiFeatureRoute(route.provider_alias, route.model, "admin_override")

