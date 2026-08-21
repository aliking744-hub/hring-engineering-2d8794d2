from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.identity.recovery_service import (
    CurrentPasswordInvalidError,
    InvalidSecurityTokenError,
    RecoveryUnavailableError,
    SessionNotFoundError,
    change_password,
    confirm_email_verification,
    get_sessions,
    logout_all_sessions,
    request_email_verification,
    request_password_reset,
    reset_password_with_token,
    revoke_owned_session,
)
from hring_api.domains.identity.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    SecurityTokenRequest,
    SessionResponse,
)


router = APIRouter(prefix="/auth", tags=["auth-security"])


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        async with db.begin():
            await request_password_reset(db, email=str(payload.email), settings=settings)
    except RecoveryUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        async with db.begin():
            await reset_password_with_token(
                db,
                raw_token=payload.token,
                new_password=payload.new_password,
                settings=settings,
            )
    except InvalidSecurityTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
async def change_current_password(
    payload: ChangePasswordRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await change_password(
            db,
            user=principal.user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except CurrentPasswordInvalidError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/email-verification/request", status_code=status.HTTP_202_ACCEPTED)
async def request_verification_email(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        await request_email_verification(db, user=principal.user, settings=settings)
    except RecoveryUnavailableError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    await db.commit()
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post("/email-verification/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_verification_email(
    payload: SecurityTokenRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        async with db.begin():
            await confirm_email_verification(db, raw_token=payload.token, settings=settings)
    except InvalidSecurityTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[SessionResponse]:
    sessions = await get_sessions(db, user_id=principal.user_id)
    return [
        SessionResponse(
            id=item.id,
            is_current=item.id == principal.session_id,
            user_agent=item.user_agent,
            ip_address=item.ip_address,
            expires_at=item.expires_at,
            revoked_at=item.revoked_at,
            last_seen_at=item.last_seen_at,
            created_at=item.created_at,
        )
        for item in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await revoke_owned_session(db, user_id=principal.user_id, session_id=session_id)
    except SessionNotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found") from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_everywhere(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await logout_all_sessions(db, user_id=principal.user_id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
