from datetime import UTC, datetime, timedelta
from secrets import choice
from string import ascii_uppercase, digits
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.policy import is_company_permission_allowed
from hring_api.domains.companies.repository import (
    count_active_members,
    get_company,
    get_invite_by_code,
    get_invite_by_id,
    get_member_by_id,
    get_member_by_user,
    get_membership,
    get_profile,
    get_user,
    list_active_invites,
    list_members_with_profiles,
)
from hring_api.domains.identity.models import Company, CompanyInvite, CompanyMember, Profile, User
from hring_api.domains.identity.recovery_repository import set_password_hash
from hring_api.domains.identity.repository import create_user, get_user_by_email
from hring_api.domains.identity.security import hash_password
from hring_api.domains.identity.service import normalize_email
from hring_api.domains.identity.session_repository import revoke_all_user_sessions


class CompanyError(Exception):
    """Base company-domain error."""


class CompanyNotFoundError(CompanyError):
    pass


class CompanyAccessDeniedError(CompanyError):
    pass


class CompanySuspendedError(CompanyError):
    pass


class CompanyCapacityError(CompanyError):
    pass


class InviteInvalidError(CompanyError):
    pass


class InviteNotFoundError(CompanyError):
    pass


class MemberNotFoundError(CompanyError):
    pass


class ProtectedMemberError(CompanyError):
    pass


class CompanyUserExistsError(CompanyError):
    pass


async def get_company_for_member(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
) -> Company:
    company = await _require_company(session, company_id)
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.profile.read",
    )
    return company


async def get_company_members(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
) -> list[tuple[CompanyMember, Profile | None]]:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.read",
    )
    return await list_members_with_profiles(session, company_id)


async def get_company_invites(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
) -> list[CompanyInvite]:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.invites.read",
    )
    return await list_active_invites(session, company_id)


async def validate_invite(
    session: AsyncSession,
    *,
    invite_code: str,
) -> tuple[CompanyInvite, Company]:
    invite = await get_invite_by_code(session, invite_code.strip())
    if invite is None:
        raise InviteInvalidError("کد دعوت نامعتبر است")
    company = await _require_company(session, invite.company_id)
    _validate_invite_state(invite=invite, company=company)
    await _require_available_seat(session, company)
    return invite, company


async def create_invite(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    role: str,
    max_uses: int,
    expires_in_days: int,
) -> CompanyInvite:
    company = await _require_company(session, company_id, for_update=True)
    _require_company_writable(company)
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.invites.manage",
    )
    await _require_available_seat(session, company)

    # CEO is never granted through an ordinary invitation. Platform provisioning
    # creates the one protected CEO account for a tenant.
    if role == "ceo":
        raise CompanyAccessDeniedError("CEO role cannot be assigned through an invite")

    invite = CompanyInvite(
        company_id=company_id,
        invite_code=await _generate_unique_invite_code(session),
        role=role,
        max_uses=max_uses,
        used_count=0,
        expires_at=datetime.now(UTC) + timedelta(days=expires_in_days),
        created_by=actor_user_id,
        is_active=True,
    )
    session.add(invite)
    await session.flush()
    return invite


async def deactivate_invite(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    invite_id: UUID,
) -> None:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.invites.manage",
    )
    invite = await get_invite_by_id(session, company_id=company_id, invite_id=invite_id)
    if invite is None:
        raise InviteNotFoundError("Invite not found")
    invite.is_active = False
    await session.flush()


async def join_company_with_invite(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    invite_code: str,
) -> tuple[Company, CompanyMember, bool]:
    invite = await get_invite_by_code(session, invite_code.strip(), for_update=True)
    if invite is None:
        raise InviteInvalidError("کد دعوت نامعتبر است")
    company = await _require_company(session, invite.company_id, for_update=True)
    _validate_invite_state(invite=invite, company=company)

    existing = await get_member_by_user(
        session,
        company_id=company.id,
        user_id=actor_user_id,
    )
    if existing is not None and existing.is_active:
        return company, existing, True

    await _require_available_seat(session, company)
    if invite.role == "ceo":
        raise InviteInvalidError("CEO invitations are not supported")

    if existing is None:
        membership = CompanyMember(
            company_id=company.id,
            user_id=actor_user_id,
            role=invite.role,
            can_invite=False,
            is_active=True,
            invited_by=invite.created_by,
        )
        session.add(membership)
    else:
        membership = existing
        membership.role = invite.role
        membership.can_invite = False
        membership.is_active = True
        membership.invited_by = invite.created_by
        membership.joined_at = datetime.now(UTC)

    profile = await get_profile(session, actor_user_id)
    if profile is not None:
        profile.user_type = "corporate"
        profile.subscription_tier = company.subscription_tier

    invite.used_count += 1
    if invite.max_uses is not None and invite.used_count >= invite.max_uses:
        invite.is_active = False

    await session.flush()
    return company, membership, False


async def update_member_role(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    member_id: UUID,
    role: str,
) -> CompanyMember:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.manage",
    )
    member = await _require_managed_member(session, company_id=company_id, member_id=member_id)
    if role == "ceo":
        raise ProtectedMemberError("CEO role transfer requires a dedicated ownership workflow")
    member.role = role
    await session.flush()
    return member


async def update_member_invite_permission(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    member_id: UUID,
    can_invite: bool,
) -> CompanyMember:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.manage",
    )
    member = await _require_managed_member(session, company_id=company_id, member_id=member_id)
    member.can_invite = can_invite
    await session.flush()
    return member


async def deactivate_member(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    member_id: UUID,
) -> None:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.manage",
    )
    member = await _require_managed_member(session, company_id=company_id, member_id=member_id)
    member.is_active = False
    await revoke_all_user_sessions(session, user_id=member.user_id)
    await session.flush()


async def create_company_user(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    email: str,
    password: str,
    full_name: str,
    role: str,
) -> tuple[User, CompanyMember]:
    company = await _require_company(session, company_id, for_update=True)
    _require_company_writable(company)
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.manage",
    )
    await _require_available_seat(session, company)
    if role == "ceo":
        raise ProtectedMemberError("CEO role cannot be provisioned by a company administrator")

    normalized_email = normalize_email(email)
    if await get_user_by_email(session, normalized_email) is not None:
        raise CompanyUserExistsError("این ایمیل قبلاً ثبت شده است")

    user = await create_user(
        session,
        email=normalized_email,
        password_hash=hash_password(password),
        full_name=full_name.strip(),
    )
    user.email_verified_at = datetime.now(UTC)
    profile = await get_profile(session, user.id)
    if profile is not None:
        profile.user_type = "corporate"
        profile.subscription_tier = company.subscription_tier

    membership = CompanyMember(
        company_id=company_id,
        user_id=user.id,
        role=role,
        can_invite=False,
        is_active=True,
        invited_by=actor_user_id,
    )
    session.add(membership)
    await session.flush()
    return user, membership


async def reset_company_user_password(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    target_user_id: UUID,
    new_password: str,
) -> None:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.manage",
    )
    target_member = await get_member_by_user(
        session, company_id=company_id, user_id=target_user_id
    )
    if target_member is None or not target_member.is_active:
        raise MemberNotFoundError("Target user not found in company")
    if target_member.role == "ceo":
        raise ProtectedMemberError("Cannot reset CEO password through this method")
    user = await get_user(session, target_user_id)
    if user is None:
        raise MemberNotFoundError("Target user not found")
    await set_password_hash(session, user=user, password_hash=hash_password(new_password))
    await revoke_all_user_sessions(session, user_id=target_user_id)


async def update_company_user_profile(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    target_user_id: UUID,
    full_name: str | None,
    title: str | None,
) -> Profile:
    await _require_permission(
        session,
        actor_user_id=actor_user_id,
        company_id=company_id,
        permission_key="company.members.manage",
    )
    target_member = await get_member_by_user(
        session, company_id=company_id, user_id=target_user_id
    )
    if target_member is None or not target_member.is_active:
        raise MemberNotFoundError("Target user not found in company")
    profile = await get_profile(session, target_user_id)
    if profile is None:
        raise MemberNotFoundError("Target profile not found")
    if full_name is not None:
        profile.full_name = full_name.strip() or None
    if title is not None:
        profile.title = title.strip() or None
    await session.flush()
    return profile


async def require_company_ceo(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
) -> CompanyMember:
    membership = await _require_active_membership(
        session,
        company_id=company_id,
        user_id=actor_user_id,
    )
    if membership.role != "ceo":
        raise CompanyAccessDeniedError("Only the company CEO can perform this action")
    return membership


async def _require_company(
    session: AsyncSession,
    company_id: UUID,
    *,
    for_update: bool = False,
) -> Company:
    company = await get_company(session, company_id, for_update=for_update)
    if company is None:
        raise CompanyNotFoundError("Company not found")
    return company


def _require_company_writable(company: Company) -> None:
    if company.status == "suspended":
        raise CompanySuspendedError("این شرکت در حال حاضر غیرفعال است")


async def _require_active_membership(
    session: AsyncSession,
    *,
    company_id: UUID,
    user_id: UUID,
) -> CompanyMember:
    membership = await get_membership(
        session,
        company_id=company_id,
        user_id=user_id,
        active_only=True,
    )
    if membership is None:
        raise CompanyAccessDeniedError("Forbidden")
    return membership


async def _require_permission(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    company_id: UUID,
    permission_key: str,
) -> CompanyMember:
    membership = await _require_active_membership(
        session,
        company_id=company_id,
        user_id=actor_user_id,
    )
    if not await is_company_permission_allowed(
        session,
        membership=membership,
        permission_key=permission_key,
    ):
        raise CompanyAccessDeniedError("Forbidden")
    return membership


async def _require_managed_member(
    session: AsyncSession,
    *,
    company_id: UUID,
    member_id: UUID,
) -> CompanyMember:
    member = await get_member_by_id(session, company_id=company_id, member_id=member_id)
    if member is None or not member.is_active:
        raise MemberNotFoundError("Member not found")
    if member.role == "ceo":
        raise ProtectedMemberError("CEO membership is protected")
    return member


async def _require_available_seat(session: AsyncSession, company: Company) -> None:
    active_count = await count_active_members(session, company.id)
    if active_count >= company.max_members:
        raise CompanyCapacityError("ظرفیت اعضای شرکت تکمیل شده است")


def _validate_invite_state(*, invite: CompanyInvite, company: Company) -> None:
    now = datetime.now(UTC)
    if not invite.is_active:
        raise InviteInvalidError("کد دعوت نامعتبر است")
    if invite.expires_at is not None and invite.expires_at <= now:
        raise InviteInvalidError("کد دعوت منقضی شده است")
    if invite.max_uses is not None and invite.used_count >= invite.max_uses:
        raise InviteInvalidError("ظرفیت استفاده از این کد دعوت پر شده است")
    _require_company_writable(company)


async def _generate_unique_invite_code(session: AsyncSession) -> str:
    alphabet = ascii_uppercase + digits
    for _ in range(10):
        candidate = "".join(choice(alphabet) for _ in range(10))
        if await get_invite_by_code(session, candidate) is None:
            return candidate
    raise CompanyError("Could not allocate a unique invite code")
