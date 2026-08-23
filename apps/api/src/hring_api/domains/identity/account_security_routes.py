from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.identity.account_security_service import (
    AccountSecurityError,
    CurrentPasswordInvalidError,
    InvalidMfaCodeError,
    MfaAlreadyEnabledError,
    MfaEnrollmentNotFoundError,
    MfaRequiredForRoleError,
    SecurityUserNotFoundError,
    admin_reset_mfa,
    admin_unlock_account,
    begin_mfa_enrollment,
    confirm_mfa_enrollment,
    disable_mfa,
    get_mfa_requirement,
    verify_session_mfa,
)
from hring_api.domains.identity.dependencies import (
    Principal,
    get_current_authenticated_principal,
    get_current_principal,
)
from hring_api.domains.identity.schemas import (
    MfaCodeRequest,
    MfaConfirmationResponse,
    MfaDisableRequest,
    MfaEnrollmentResponse,
    MfaStatusResponse,
)


router = APIRouter(tags=["account-security"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    return request.client.host[:64] if request.client else None


async def _status_response(
    db: AsyncSession,
    principal: Principal,
) -> MfaStatusResponse:
    requirement = await get_mfa_requirement(
        db,
        user_id=principal.user_id,
        session_id=principal.session_id,
    )
    return MfaStatusResponse(
        required=requirement.required,
        enrollment_required=requirement.enrollment_required,
        verification_required=requirement.required and not requirement.verified,
        enabled=requirement.enabled,
        verified=requirement.verified,
        recovery_codes_remaining=requirement.recovery_codes_remaining,
        locked_until=principal.user.locked_until,
    )


@router.get("/auth/mfa/status", response_model=MfaStatusResponse)
async def mfa_status(
    principal: Principal = Depends(get_current_authenticated_principal),
    db: AsyncSession = Depends(get_db_session),
) -> MfaStatusResponse:
    return await _status_response(db, principal)


@router.post("/auth/mfa/enroll", response_model=MfaEnrollmentResponse)
async def enroll_mfa(
    request: Request,
    principal: Principal = Depends(get_current_authenticated_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MfaEnrollmentResponse:
    try:
        enrollment = await begin_mfa_enrollment(
            db,
            user=principal.user,
            settings=settings,
            ip_address=_client_ip(request),
        )
    except MfaAlreadyEnabledError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await db.commit()
    return MfaEnrollmentResponse(
        secret=enrollment.secret,
        otpauth_uri=enrollment.otpauth_uri,
    )


@router.post("/auth/mfa/confirm", response_model=MfaConfirmationResponse)
async def confirm_mfa(
    payload: MfaCodeRequest,
    request: Request,
    principal: Principal = Depends(get_current_authenticated_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MfaConfirmationResponse:
    try:
        confirmation = await confirm_mfa_enrollment(
            db,
            user=principal.user,
            session_id=principal.session_id,
            code=payload.code.strip(),
            settings=settings,
            ip_address=_client_ip(request),
        )
    except InvalidMfaCodeError as exc:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except MfaEnrollmentNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await db.commit()
    return MfaConfirmationResponse(
        status=await _status_response(db, principal),
        recovery_codes=confirmation.recovery_codes,
    )


@router.post("/auth/mfa/verify", response_model=MfaStatusResponse)
async def verify_mfa(
    payload: MfaCodeRequest,
    request: Request,
    principal: Principal = Depends(get_current_authenticated_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MfaStatusResponse:
    try:
        await verify_session_mfa(
            db,
            user=principal.user,
            session_id=principal.session_id,
            code=payload.code.strip(),
            settings=settings,
            ip_address=_client_ip(request),
        )
    except InvalidMfaCodeError as exc:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except MfaEnrollmentNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except AccountSecurityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    await db.commit()
    return await _status_response(db, principal)


@router.delete("/auth/mfa", status_code=status.HTTP_204_NO_CONTENT)
async def remove_mfa(
    payload: MfaDisableRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await disable_mfa(
            db,
            user=principal.user,
            session_id=principal.session_id,
            current_password=payload.current_password,
            ip_address=_client_ip(request),
        )
    except CurrentPasswordInvalidError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except MfaRequiredForRoleError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/admin/platform/users/{user_id}/unlock",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["platform-admin"],
)
async def unlock_platform_user(
    user_id: UUID,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.security.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await admin_unlock_account(
            db,
            actor_user_id=actor.user_id,
            target_user_id=user_id,
            ip_address=_client_ip(request),
        )
    except SecurityUserNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found") from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/admin/platform/users/{user_id}/mfa",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["platform-admin"],
)
async def reset_platform_user_mfa(
    user_id: UUID,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.security.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await admin_reset_mfa(
            db,
            actor_user_id=actor.user_id,
            target_user_id=user_id,
            ip_address=_client_ip(request),
        )
    except SecurityUserNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found") from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
