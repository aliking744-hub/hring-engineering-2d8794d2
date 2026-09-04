from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import (
    COMPANY_PERMISSION_CATALOG,
    is_company_permission_allowed,
)
from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.identity.models import Company, Profile
from hring_api.domains.identity.schemas import (
    AuthResponse,
    CurrentUserContextResponse,
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
from hring_api.domains.identity.sms_repository import get_phone_identity_by_user
from hring_api.domains.identity.sms_service import (
    InvalidSmsChallengeError,
    PhoneUnavailableError,
    SmsRateLimitedError,
    SmsUnavailableError,
    request_login_otp,
    request_phone_verification_otp,
    verify_login_otp,
    verify_phone_otp,
)


router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
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
        mfa_required=result.mfa_required,
        mfa_enrollment_required=result.mfa_enrollment_required,
        mfa_verified=result.mfa_verified,
    )


def _set_refresh_cookie(response: Response, result: AuthResult, settings: Settings) -> None:
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=result.tokens.refresh_token,
        max_age=settings.auth_refresh_token_days * 24 * 60 * 60,
        expires=result.tokens.refresh_expires_at,
        path=settings.auth_refresh_cookie_path,
        domain=settings.auth_refresh_cookie_domain,
        secure=settings.environment.lower() == "production",
        httponly=True,
        samesite="lax",
    )


def _clear_refresh_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        path=settings.auth_refresh_cookie_path,
        domain=settings.auth_refresh_cookie_domain,
        secure=settings.environment.lower() == "production",
        httponly=True,
        samesite="lax",
    )


def _request_refresh_token(
    request: Request,
    payload: RefreshRequest | LogoutRequest | None,
    settings: Settings,
) -> str | None:
    if payload is not None:
        return payload.refresh_token
    return request.cookies.get(settings.auth_refresh_cookie_name)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_account(
    payload: RegisterRequest,
    request: Request,
    response: Response,
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
    _set_refresh_cookie(response, result, settings)
    return _auth_response(result)


@router.post("/login", response_model=AuthResponse)
async def login_account(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        result = await login(
            db,
            email=str(payload.email),
            password=payload.password,
            settings=settings,
            user_agent=request.headers.get("user-agent"),
            ip_address=_client_ip(request),
        )
    except InvalidCredentialsError as exc:
        # Login failures intentionally commit lockout state and non-sensitive audit evidence.
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc
    await db.commit()
    _set_refresh_cookie(response, result, settings)
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
    response: Response,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        result = await verify_login_otp(
            db,
            challenge_id=payload.challenge_id,
            code=payload.code,
            settings=settings,
            user_agent=request.headers.get("user-agent"),
            ip_address=_client_ip(request),
        )
    except InvalidSmsChallengeError as exc:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        ) from exc
    await db.commit()
    _set_refresh_cookie(response, result, settings)
    return _auth_response(result)


@router.post(
    "/phone/request-verification",
    response_model=SmsChallengeResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_phone_verification(
    payload: SmsLoginRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> SmsChallengeResponse:
    try:
        challenge = await request_phone_verification_otp(
            db,
            user_id=principal.user_id,
            phone=payload.phone,
            settings=settings,
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except PhoneUnavailableError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SmsRateLimitedError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except SmsUnavailableError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    await db.commit()
    return SmsChallengeResponse(
        challenge_id=challenge.challenge_id,
        expires_at=challenge.expires_at,
    )


@router.post("/phone/verify", status_code=status.HTTP_204_NO_CONTENT)
async def verify_phone(
    payload: SmsLoginVerifyRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    try:
        await verify_phone_otp(
            db,
            user_id=principal.user_id,
            challenge_id=payload.challenge_id,
            code=payload.code,
            settings=settings,
        )
    except InvalidSmsChallengeError as exc:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        ) from exc
    except PhoneUnavailableError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_session(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    refresh_token = _request_refresh_token(request, payload, settings)
    if refresh_token is None:
        _clear_refresh_cookie(response, settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session not found")
    try:
        async with db.begin():
            result = await refresh(db, refresh_token=refresh_token, settings=settings)
    except InvalidRefreshTokenError as exc:
        _clear_refresh_cookie(response, settings)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired",
        ) from exc
    _set_refresh_cookie(response, result, settings)
    return _auth_response(result)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_session(
    request: Request,
    response: Response,
    payload: LogoutRequest | None = None,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    refresh_token = _request_refresh_token(request, payload, settings)
    if refresh_token is not None:
        async with db.begin():
            await logout(db, refresh_token=refresh_token)
    _clear_refresh_cookie(response, settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


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


@router.get("/context", response_model=CurrentUserContextResponse)
async def current_user_context(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CurrentUserContextResponse:
    profile = await db.get(Profile, principal.user_id)
    membership = next((item for item in principal.memberships if item.is_active), None)
    company = await db.get(Company, membership.company_id) if membership is not None else None
    platform_roles = await list_platform_roles(db, principal.user_id)
    phone_identity = await get_phone_identity_by_user(db, principal.user_id)

    effective_permissions: list[str] = []
    if membership is not None:
        for permission_key in COMPANY_PERMISSION_CATALOG:
            if await is_company_permission_allowed(
                db,
                membership=membership,
                permission_key=permission_key,
            ):
                effective_permissions.append(permission_key)

    return CurrentUserContextResponse(
        user_id=principal.user_id,
        email=principal.user.email,
        user_type=profile.user_type if profile is not None else "individual",
        subscription_tier=profile.subscription_tier if profile is not None else None,
        is_admin=bool(platform_roles) or "admin" in principal.app_roles,
        platform_roles=platform_roles,
        app_roles=principal.app_roles,
        company_id=membership.company_id if membership is not None else None,
        company_role=membership.role if membership is not None else None,
        company_can_invite=membership.can_invite if membership is not None else False,
        company_permissions=effective_permissions,
        company_tier=company.subscription_tier if company is not None else None,
        credits=profile.monthly_credits if profile is not None else 50,
        used_credits=profile.used_credits if profile is not None else 0,
        company_credit_pool=int(company.credit_pool or 0) if company is not None else 0,
        company_credit_pool_enabled=bool(company.credit_pool_enabled) if company is not None else False,
        full_name=profile.full_name if profile is not None else None,
        title=profile.title if profile is not None else None,
        avatar_url=profile.avatar_url if profile is not None else None,
        phone_e164=phone_identity.phone_e164 if phone_identity is not None else None,
        phone_verified_at=phone_identity.verified_at if phone_identity is not None else None,
    )
