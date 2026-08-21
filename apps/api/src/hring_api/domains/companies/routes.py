from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.companies.schemas import (
    CompanyInviteResponse,
    CompanyMemberResponse,
    CompanyResponse,
    CompanyUserResponse,
    CreateCompanyUserRequest,
    CreateInviteRequest,
    InviteValidationRequest,
    InviteValidationResponse,
    JoinCompanyResponse,
    MemberProfileResponse,
    ResetCompanyUserPasswordRequest,
    UpdateCompanyUserProfileRequest,
    UpdateInvitePermissionRequest,
    UpdateMemberRoleRequest,
)
from hring_api.domains.companies.service import (
    CompanyAccessDeniedError,
    CompanyCapacityError,
    CompanyError,
    CompanyNotFoundError,
    CompanySuspendedError,
    CompanyUserExistsError,
    InviteInvalidError,
    InviteNotFoundError,
    MemberNotFoundError,
    ProtectedMemberError,
    create_company_user,
    create_invite,
    deactivate_invite,
    deactivate_member,
    get_company_for_member,
    get_company_invites,
    get_company_members,
    join_company_with_invite,
    reset_company_user_password,
    update_company_user_profile,
    update_member_invite_permission,
    update_member_role,
    validate_invite,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.identity.models import CompanyMember, Profile


router = APIRouter(tags=["companies"])


def _domain_http_error(exc: CompanyError) -> HTTPException:
    if isinstance(exc, CompanyAccessDeniedError | ProtectedMemberError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CompanyNotFoundError | MemberNotFoundError | InviteNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CompanyUserExistsError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, CompanyCapacityError | CompanySuspendedError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, InviteInvalidError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _member_response(
    member: CompanyMember,
    profile: Profile | None,
) -> CompanyMemberResponse:
    profile_response = None
    if profile is not None:
        profile_response = MemberProfileResponse(
            id=profile.id,
            email=profile.email,
            full_name=profile.full_name,
            title=profile.title,
            avatar_url=profile.avatar_url,
        )
    return CompanyMemberResponse(
        id=member.id,
        company_id=member.company_id,
        user_id=member.user_id,
        role=member.role,
        can_invite=member.can_invite,
        is_active=member.is_active,
        invited_by=member.invited_by,
        joined_at=member.joined_at,
        profile=profile_response,
    )


@router.post("/company-invites/validate", response_model=InviteValidationResponse)
async def validate_company_invite(
    payload: InviteValidationRequest,
    db: AsyncSession = Depends(get_db_session),
) -> InviteValidationResponse:
    try:
        invite, company = await validate_invite(db, invite_code=payload.invite_code)
    except CompanyError as exc:
        return InviteValidationResponse(is_valid=False, error=str(exc))
    return InviteValidationResponse(
        is_valid=True,
        invite_id=invite.id,
        role=invite.role,
        company_id=company.id,
        company_name=company.name,
    )


@router.post("/company-invites/{invite_code}/join", response_model=JoinCompanyResponse)
async def join_company(
    invite_code: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> JoinCompanyResponse:
    try:
        company, member, already_member = await join_company_with_invite(
            db,
            actor_user_id=principal.user_id,
            invite_code=invite_code,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return JoinCompanyResponse(
        company_id=company.id,
        company_name=company.name,
        member_id=member.id,
        role=member.role,
        already_member=already_member,
    )


@router.get("/companies/{company_id}", response_model=CompanyResponse)
async def read_company(
    company_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyResponse:
    try:
        company = await get_company_for_member(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
        )
    except CompanyError as exc:
        raise _domain_http_error(exc) from exc
    return CompanyResponse.model_validate(company)


@router.get("/companies/{company_id}/members", response_model=list[CompanyMemberResponse])
async def read_company_members(
    company_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CompanyMemberResponse]:
    try:
        items = await get_company_members(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
        )
    except CompanyError as exc:
        raise _domain_http_error(exc) from exc
    return [_member_response(member, profile) for member, profile in items]


@router.get("/companies/{company_id}/invites", response_model=list[CompanyInviteResponse])
async def read_company_invites(
    company_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[CompanyInviteResponse]:
    try:
        invites = await get_company_invites(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
        )
    except CompanyError as exc:
        raise _domain_http_error(exc) from exc
    return [CompanyInviteResponse.model_validate(invite) for invite in invites]


@router.post(
    "/companies/{company_id}/invites",
    response_model=CompanyInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_company_invite(
    company_id: UUID,
    payload: CreateInviteRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyInviteResponse:
    try:
        invite = await create_invite(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            role=payload.role,
            max_uses=payload.max_uses,
            expires_in_days=payload.expires_in_days,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return CompanyInviteResponse.model_validate(invite)


@router.delete("/companies/{company_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_company_invite(
    company_id: UUID,
    invite_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await deactivate_invite(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            invite_id=invite_id,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/companies/{company_id}/members/{member_id}/role",
    response_model=CompanyMemberResponse,
)
async def change_company_member_role(
    company_id: UUID,
    member_id: UUID,
    payload: UpdateMemberRoleRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyMemberResponse:
    try:
        member = await update_member_role(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            member_id=member_id,
            role=payload.role,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return _member_response(member, None)


@router.patch(
    "/companies/{company_id}/members/{member_id}/invite-permission",
    response_model=CompanyMemberResponse,
)
async def change_company_member_invite_permission(
    company_id: UUID,
    member_id: UUID,
    payload: UpdateInvitePermissionRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyMemberResponse:
    try:
        member = await update_member_invite_permission(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            member_id=member_id,
            can_invite=payload.can_invite,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return _member_response(member, None)


@router.delete("/companies/{company_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_company_member(
    company_id: UUID,
    member_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await deactivate_member(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            member_id=member_id,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/companies/{company_id}/users",
    response_model=CompanyUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def provision_company_user(
    company_id: UUID,
    payload: CreateCompanyUserRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompanyUserResponse:
    try:
        user, membership = await create_company_user(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            email=str(payload.email),
            password=payload.password,
            full_name=payload.full_name,
            role=payload.role,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return CompanyUserResponse(
        id=user.id,
        email=user.email,
        full_name=payload.full_name.strip(),
        role=membership.role,
    )


@router.post(
    "/companies/{company_id}/users/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reset_company_member_password(
    company_id: UUID,
    user_id: UUID,
    payload: ResetCompanyUserPasswordRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await reset_company_user_password(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            target_user_id=user_id,
            new_password=payload.new_password,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/companies/{company_id}/users/{user_id}/profile",
    response_model=MemberProfileResponse,
)
async def change_company_user_profile(
    company_id: UUID,
    user_id: UUID,
    payload: UpdateCompanyUserProfileRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> MemberProfileResponse:
    try:
        profile = await update_company_user_profile(
            db,
            actor_user_id=principal.user_id,
            company_id=company_id,
            target_user_id=user_id,
            full_name=payload.full_name,
            title=payload.title,
        )
    except CompanyError as exc:
        await db.rollback()
        raise _domain_http_error(exc) from exc
    await db.commit()
    return MemberProfileResponse(
        id=profile.id,
        email=profile.email,
        full_name=profile.full_name,
        title=profile.title,
        avatar_url=profile.avatar_url,
    )
