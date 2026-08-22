from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.ai.models import AiPromptVersion
from hring_api.domains.ai.prompt_repository import get_prompt_version
from hring_api.domains.ai.prompt_schemas import (
    PromptCreateDraftRequest,
    PromptCreateRequest,
    PromptDetailResponse,
    PromptPatchRequest,
    PromptResponse,
    PromptRollbackRequest,
    PromptTestRequest,
    PromptTestResponse,
    PromptVersionPatchRequest,
    PromptVersionResponse,
)
from hring_api.domains.ai.prompt_service import (
    PromptConflictError,
    PromptNotFoundError,
    PromptRegistryError,
    PromptValidationError,
    create_draft,
    create_prompt,
    list_prompt_responses,
    prompt_detail,
    publish_draft,
    require_prompt,
    rollback_prompt,
    test_prompt_version,
    update_draft,
    update_prompt,
)


router = APIRouter(prefix="/admin/platform/ai/prompts", tags=["platform-ai-prompts"])


def _ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    return request.client.host[:64] if request.client else None


def _http_error(exc: PromptRegistryError) -> HTTPException:
    if isinstance(exc, PromptNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, PromptConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, PromptValidationError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def _version_or_404(
    session: AsyncSession,
    *,
    prompt_id: UUID,
    version_id: UUID,
) -> AiPromptVersion:
    version = await get_prompt_version(
        session,
        prompt_id=prompt_id,
        version_id=version_id,
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt version not found")
    return version


@router.get("", response_model=list[PromptResponse])
async def prompt_registry_list(
    _: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[PromptResponse]:
    return await list_prompt_responses(db)


@router.post("", response_model=PromptDetailResponse, status_code=status.HTTP_201_CREATED)
async def prompt_registry_create(
    payload: PromptCreateRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptDetailResponse:
    try:
        prompt = await create_prompt(
            db,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(prompt)
        return await prompt_detail(db, prompt)
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.get("/{prompt_id}", response_model=PromptDetailResponse)
async def prompt_registry_detail(
    prompt_id: UUID,
    _: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.read")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptDetailResponse:
    try:
        return await prompt_detail(db, await require_prompt(db, prompt_id))
    except PromptRegistryError as exc:
        raise _http_error(exc) from exc


@router.patch("/{prompt_id}", response_model=PromptDetailResponse)
async def prompt_registry_update(
    prompt_id: UUID,
    payload: PromptPatchRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptDetailResponse:
    try:
        prompt = await require_prompt(db, prompt_id)
        await update_prompt(
            db,
            prompt=prompt,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(prompt)
        return await prompt_detail(db, prompt)
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.post(
    "/{prompt_id}/drafts",
    response_model=PromptVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def prompt_registry_create_draft(
    prompt_id: UUID,
    payload: PromptCreateDraftRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptVersionResponse:
    try:
        prompt = await require_prompt(db, prompt_id)
        version = await create_draft(
            db,
            prompt=prompt,
            source_version_id=payload.source_version_id,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(version)
        return PromptVersionResponse.model_validate(
            {
                **version.__dict__,
                "input_variables": version.input_variables_json,
                "output_schema": version.output_schema_json,
            }
        )
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.patch(
    "/{prompt_id}/versions/{version_id}",
    response_model=PromptVersionResponse,
)
async def prompt_registry_update_draft(
    prompt_id: UUID,
    version_id: UUID,
    payload: PromptVersionPatchRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptVersionResponse:
    try:
        prompt = await require_prompt(db, prompt_id)
        version = await _version_or_404(db, prompt_id=prompt_id, version_id=version_id)
        await update_draft(
            db,
            prompt=prompt,
            version=version,
            payload=payload,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(version)
        return PromptVersionResponse.model_validate(
            {
                **version.__dict__,
                "input_variables": version.input_variables_json,
                "output_schema": version.output_schema_json,
            }
        )
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.post(
    "/{prompt_id}/versions/{version_id}/test",
    response_model=PromptTestResponse,
)
async def prompt_registry_test(
    prompt_id: UUID,
    version_id: UUID,
    payload: PromptTestRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.test")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptTestResponse:
    try:
        prompt = await require_prompt(db, prompt_id)
        version = await _version_or_404(db, prompt_id=prompt_id, version_id=version_id)
        result = await test_prompt_version(
            db,
            prompt=prompt,
            version=version,
            variables=payload.variables,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        return result
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.post(
    "/{prompt_id}/versions/{version_id}/publish",
    response_model=PromptDetailResponse,
)
async def prompt_registry_publish(
    prompt_id: UUID,
    version_id: UUID,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.publish")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptDetailResponse:
    try:
        prompt = await require_prompt(db, prompt_id)
        version = await _version_or_404(db, prompt_id=prompt_id, version_id=version_id)
        await publish_draft(
            db,
            prompt=prompt,
            version=version,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(prompt)
        return await prompt_detail(db, prompt)
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc


@router.post("/{prompt_id}/rollback", response_model=PromptDetailResponse)
async def prompt_registry_rollback(
    prompt_id: UUID,
    payload: PromptRollbackRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.prompts.publish")),
    db: AsyncSession = Depends(get_db_session),
) -> PromptDetailResponse:
    try:
        prompt, _restored = await rollback_prompt(
            db,
            prompt_id=prompt_id,
            target_version_id=payload.target_version_id,
            actor_user_id=actor.user_id,
            ip_address=_ip(request),
        )
        await db.commit()
        await db.refresh(prompt)
        return await prompt_detail(db, prompt)
    except PromptRegistryError as exc:
        await db.rollback()
        raise _http_error(exc) from exc
