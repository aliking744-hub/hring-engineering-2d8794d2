from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.identity.schemas import (
    AuthResponse,
    CurrentUserResponse,
    LoginRequest,
    LogoutRequest,
    MembershipResponse,
    RefreshRequest,
    RegisterRequest,
    SmsChallengeResponse,
    SmsLoginRequest,
    SmsLoginVerifyRequest,
    TokenPairResponse,
    UserResponse,
)
from hring_api.domains.identity.service import (
    AuthResult,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    login,
    logout,
    refresh,
    register,
)
from hring_api.domains.identity.sms_service import (
    InvalidSmsChallengeError,
    SmsRateLimitedError,
    SmsUnavailableError,
    request_login_otp,
    verify_login_otp,
)


router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _auth_response(result: AuthResult) -> AuthResponse:
    return AuthResponse(
        user=UserResponse.model_validate(result.user),
        tokens=TokenPairResponse(
            access_token=result.tokens.access_token,
            refresh_token=result.tokens.refresh_token,
            access_expires_at=result.tokens.access_expires_at,
            refresh_expires_at=result.tokens.refresh_expires_at,
        ),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_account(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        async with db.begin():
            result = await register(
                db,
                email=str(payload.email),
                password=payload.password,
                full_name=payload.full_name,
                settings=settings,
                user_agent=request.headers.get("user-agent"),
                ip_address=_client_ip(request),
            )
    except EmailAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _auth_response(result)


@router.post("/login", response_model=AuthResponse)
async def login_account(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        async with db.begin():
            result = await login(
                db,
                email=str(payload.email),
                password=payload.password,
                settings=settings,
                user_agent=request.headers.get("user-agent"),
                ip_address=_client_ip(request),
            )
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc
    return _auth_response(result)


@router.post("/sms/request", response_model=SmsChallengeResponse, status_code=status.HTTP_202_ACCEPTED)
async def request_sms_login(
    payload: SmsLoginRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SmsChallengeResponse:
    try:
        async with db.begin():
            challenge = await request_login_otp(db, phone=payload.phone, settings=settings)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SmsRateLimitedError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except SmsUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return SmsChallengeResponse(
        challenge_id=challenge.challenge_id,
        expires_at=challenge.expires_at,
    )


@router.post("/sms/verify", response_model=AuthResponse)
async def verify_sms_login(
    payload: SmsLoginVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        async with db.begin():
            result = await verify_login_otp(
                db,
                challenge_id=payload.challenge_id,
                code=payload.code,
                settings=settings,
                user_agent=request.headers.get("user-agent"),
                ip_address=_client_ip(request),
            )
    except InvalidSmsChallengeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        ) from exc
    return _auth_response(result)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_session(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        async with db.begin():
            result = await refresh(db, refresh_token=payload.refresh_token, settings=settings)
    except InvalidRefreshTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired",
        ) from exc
    return _auth_response(result)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_session(
    payload: LogoutRequest,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    async with db.begin():
        await logout(db, refresh_token=payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=CurrentUserResponse)
async def current_user(
    principal: Principal = Depends(get_current_principal),
) -> CurrentUserResponse:
    return CurrentUserResponse(
        **UserResponse.model_validate(principal.user).model_dump(),
        app_roles=principal.app_roles,
        memberships=[
            MembershipResponse(
                company_id=membership.company_id,
                role=membership.role,
                can_invite=membership.can_invite,
                is_active=membership.is_active,
            )
            for membership in principal.memberships
        ],
    )
