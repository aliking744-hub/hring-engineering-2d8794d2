from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.access.policy import PlatformPrincipal, require_platform_permission
from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.admin.repository import (
    get_profile_for_admin,
    list_audit_logs,
    list_companies_for_admin,
    list_site_settings,
    list_users_for_admin,
    platform_counts,
)
from hring_api.domains.admin.schemas import (
    AdminCompanyResponse,
    AdminPlatformRolesRequest,
    AdminUserResponse,
    AdminUserStatusRequest,
    AuditLogResponse,
    BulkUpsertSiteSettingsRequest,
    CreateManagedCompanyRequest,
    ManagedCompanyCreatedResponse,
    PlatformOverviewResponse,
    PublicSettingsResponse,
    SiteSettingResponse,
    UpdateManagedCompanyRequest,
    UpsertSiteSettingRequest,
)
from hring_api.domains.admin.service import (
    AdminConflictError,
    AdminError,
    AdminNotFoundError,
    AdminSafetyError,
    SensitiveSettingKeyError,
    create_managed_company,
    save_site_setting,
    set_user_active_state,
    set_user_platform_roles,
    update_managed_company,
)
from hring_api.domains.identity.models import User
from hring_api.domains.identity.account_security_repository import get_mfa_factor
from hring_api.domains.identity.repository import list_user_roles


router = APIRouter()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _admin_error(exc: AdminError) -> HTTPException:
    if isinstance(exc, AdminNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, AdminSafetyError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, AdminConflictError | SensitiveSettingKeyError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def _user_response(session: AsyncSession, user: User) -> AdminUserResponse:
    profile = await get_profile_for_admin(session, user.id)
    factor = await get_mfa_factor(session, user.id)
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else None,
        is_active=user.is_active,
        email_verified_at=user.email_verified_at,
        platform_roles=await list_platform_roles(session, user.id),
        app_roles=await list_user_roles(session, user.id),
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        mfa_enabled=factor is not None and factor.status == "enabled",
        created_at=user.created_at,
    )


@router.get("/public/settings", response_model=PublicSettingsResponse, tags=["public-settings"])
async def public_settings(
    db: AsyncSession = Depends(get_db_session),
) -> PublicSettingsResponse:
    rows = await list_site_settings(db, public_only=True)
    return PublicSettingsResponse(settings={row.key: row.value for row in rows})


@router.get(
    "/admin/platform/overview",
    response_model=PlatformOverviewResponse,
    tags=["platform-admin"],
)
async def platform_overview(
    _: PlatformPrincipal = Depends(require_platform_permission("platform.dashboard.read")),
    db: AsyncSession = Depends(get_db_session),
) -> PlatformOverviewResponse:
    counts = await platform_counts(db)
    return PlatformOverviewResponse(
        total_users=counts[0],
        active_users=counts[1],
        total_companies=counts[2],
        active_companies=counts[3],
        trial_companies=counts[4],
        suspended_companies=counts[5],
    )


@router.get("/admin/platform/users", response_model=list[AdminUserResponse], tags=["platform-admin"])
async def platform_users(
    search: str | None = Query(default=None, max_length=160),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.users.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AdminUserResponse]:
    rows = await list_users_for_admin(db, search=search, limit=limit, offset=offset)
    return [await _user_response(db, user) for user, _profile in rows]


@router.patch(
    "/admin/platform/users/{user_id}/status",
    response_model=AdminUserResponse,
    tags=["platform-admin"],
)
async def platform_user_status(
    user_id: UUID,
    payload: AdminUserStatusRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.users.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> AdminUserResponse:
    try:
        user = await set_user_active_state(
            db,
            actor_user_id=actor.user_id,
            target_user_id=user_id,
            is_active=payload.is_active,
            ip_address=_client_ip(request),
        )
    except AdminError as exc:
        await db.rollback()
        raise _admin_error(exc) from exc
    await db.commit()
    return await _user_response(db, user)


@router.put(
    "/admin/platform/users/{user_id}/roles",
    response_model=AdminUserResponse,
    tags=["platform-admin"],
)
async def platform_user_roles(
    user_id: UUID,
    payload: AdminPlatformRolesRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.roles.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> AdminUserResponse:
    try:
        await set_user_platform_roles(
            db,
            actor_user_id=actor.user_id,
            target_user_id=user_id,
            roles=payload.roles,
            ip_address=_client_ip(request),
        )
    except AdminError as exc:
        await db.rollback()
        raise _admin_error(exc) from exc
    await db.commit()
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await _user_response(db, user)


@router.get(
    "/admin/platform/companies",
    response_model=list[AdminCompanyResponse],
    tags=["platform-admin"],
)
async def platform_companies(
    search: str | None = Query(default=None, max_length=160),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.companies.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AdminCompanyResponse]:
    rows = await list_companies_for_admin(db, search=search, limit=limit, offset=offset)
    return [AdminCompanyResponse.model_validate(company) for company in rows]


@router.post(
    "/admin/platform/companies",
    response_model=ManagedCompanyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["platform-admin"],
)
async def create_platform_company(
    payload: CreateManagedCompanyRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.companies.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> ManagedCompanyCreatedResponse:
    try:
        company, owner = await create_managed_company(
            db,
            actor_user_id=actor.user_id,
            name=payload.name,
            domain=payload.domain,
            status=payload.status,
            subscription_tier=payload.subscription_tier,
            monthly_credits=payload.monthly_credits,
            max_members=payload.max_members,
            owner_email=str(payload.owner.email),
            owner_password=payload.owner.password,
            owner_full_name=payload.owner.full_name,
            ip_address=_client_ip(request),
        )
    except AdminError as exc:
        await db.rollback()
        raise _admin_error(exc) from exc
    await db.commit()
    if not isinstance(owner, User):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Owner creation failed")
    return ManagedCompanyCreatedResponse(
        company=AdminCompanyResponse.model_validate(company),
        owner=await _user_response(db, owner),
    )


@router.patch(
    "/admin/platform/companies/{company_id}",
    response_model=AdminCompanyResponse,
    tags=["platform-admin"],
)
async def change_platform_company(
    company_id: UUID,
    payload: UpdateManagedCompanyRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("platform.companies.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> AdminCompanyResponse:
    try:
        company = await update_managed_company(
            db,
            actor_user_id=actor.user_id,
            company_id=company_id,
            values=payload.model_dump(exclude_unset=True),
            ip_address=_client_ip(request),
        )
    except AdminError as exc:
        await db.rollback()
        raise _admin_error(exc) from exc
    await db.commit()
    return AdminCompanyResponse.model_validate(company)


@router.get(
    "/admin/product/settings",
    response_model=list[SiteSettingResponse],
    tags=["product-admin"],
)
async def product_settings(
    _: PlatformPrincipal = Depends(require_platform_permission("product.settings.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[SiteSettingResponse]:
    return [SiteSettingResponse.model_validate(row) for row in await list_site_settings(db)]


@router.put(
    "/admin/product/settings/bulk",
    response_model=list[SiteSettingResponse],
    tags=["product-admin"],
)
async def change_product_settings_bulk(
    payload: BulkUpsertSiteSettingsRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("product.settings.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[SiteSettingResponse]:
    try:
        rows = [
            await save_site_setting(
                db,
                actor_user_id=actor.user_id,
                key=item.key,
                value=item.value,
                label=item.label,
                category=item.category,
                value_type=item.value_type,
                is_public=item.is_public,
                ip_address=_client_ip(request),
            )
            for item in payload.settings
        ]
    except AdminError as exc:
        await db.rollback()
        raise _admin_error(exc) from exc
    await db.commit()
    for row in rows:
        await db.refresh(row)
    return [SiteSettingResponse.model_validate(row) for row in rows]


@router.put(
    "/admin/product/settings/{key}",
    response_model=SiteSettingResponse,
    tags=["product-admin"],
)
async def change_product_setting(
    key: str,
    payload: UpsertSiteSettingRequest,
    request: Request,
    actor: PlatformPrincipal = Depends(require_platform_permission("product.settings.manage")),
    db: AsyncSession = Depends(get_db_session),
) -> SiteSettingResponse:
    try:
        row = await save_site_setting(
            db,
            actor_user_id=actor.user_id,
            key=key,
            value=payload.value,
            label=payload.label,
            category=payload.category,
            value_type=payload.value_type,
            is_public=payload.is_public,
            ip_address=_client_ip(request),
        )
    except AdminError as exc:
        await db.rollback()
        raise _admin_error(exc) from exc
    await db.commit()
    return SiteSettingResponse.model_validate(row)


@router.get(
    "/admin/platform/audit-logs",
    response_model=list[AuditLogResponse],
    tags=["platform-admin"],
)
async def platform_audit_logs(
    company_id: UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: PlatformPrincipal = Depends(require_platform_permission("platform.audit.read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AuditLogResponse]:
    rows = await list_audit_logs(db, company_id=company_id, limit=limit, offset=offset)
    return [AuditLogResponse.model_validate(row) for row in rows]
