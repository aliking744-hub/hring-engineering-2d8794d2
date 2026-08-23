from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.identity.account_security_models import MfaFactor
from hring_api.domains.identity.account_security_repository import (
    add_login_attempt,
    clear_session_mfa_state,
    consume_recovery_code,
    count_available_recovery_codes,
    delete_mfa_credentials,
    get_mfa_factor,
    lock_user_for_account_security,
    mark_session_mfa_verified,
    prune_login_attempts_before,
    replace_recovery_codes,
    save_pending_mfa_factor,
)
from hring_api.domains.identity.mfa_security import (
    build_totp_uri,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_recovery_codes,
    generate_totp_secret,
    hash_login_identifier,
    hash_recovery_code,
    match_totp_step,
)
from hring_api.domains.identity.models import User, UserSession
from hring_api.domains.identity.repository import get_user_by_id, list_user_roles
from hring_api.domains.identity.security import verify_password
from hring_api.domains.identity.session_repository import revoke_all_user_sessions


class AccountSecurityError(Exception):
    """Base account-security error."""


class MfaAlreadyEnabledError(AccountSecurityError):
    pass


class MfaEnrollmentNotFoundError(AccountSecurityError):
    pass


class InvalidMfaCodeError(AccountSecurityError):
    pass


class MfaRequiredForRoleError(AccountSecurityError):
    pass


class CurrentPasswordInvalidError(AccountSecurityError):
    pass


class SecurityUserNotFoundError(AccountSecurityError):
    pass


@dataclass(frozen=True)
class MfaRequirement:
    required: bool
    enrollment_required: bool
    verified: bool
    enabled: bool
    recovery_codes_remaining: int


@dataclass(frozen=True)
class MfaEnrollment:
    secret: str
    otpauth_uri: str


@dataclass(frozen=True)
class MfaConfirmation:
    recovery_codes: list[str]
    requirement: MfaRequirement


async def get_mfa_requirement(
    session: AsyncSession,
    *,
    user_id: UUID,
    session_id: UUID,
) -> MfaRequirement:
    factor = await get_mfa_factor(session, user_id)
    enabled = factor is not None and factor.status == "enabled"
    platform_roles = await list_platform_roles(session, user_id)
    app_roles = await list_user_roles(session, user_id)
    privileged = bool(platform_roles) or "admin" in app_roles
    user_session = await session.get(UserSession, session_id)
    verified = user_session is not None and user_session.mfa_verified_at is not None
    return MfaRequirement(
        required=enabled or privileged,
        enrollment_required=privileged and not enabled,
        verified=verified,
        enabled=enabled,
        recovery_codes_remaining=(
            await count_available_recovery_codes(session, user_id) if enabled else 0
        ),
    )


async def begin_mfa_enrollment(
    session: AsyncSession,
    *,
    user: User,
    settings: Settings,
    ip_address: str | None,
) -> MfaEnrollment:
    # A user-row lock serializes first-time enrollment when no factor row exists yet.
    await lock_user_for_account_security(session, user.id)
    factor = await get_mfa_factor(session, user.id, for_update=True)
    if factor is not None and factor.status == "enabled":
        raise MfaAlreadyEnabledError("MFA is already enabled")

    secret = generate_totp_secret()
    await save_pending_mfa_factor(
        session,
        user_id=user.id,
        secret_ciphertext=encrypt_totp_secret(secret, settings),
    )
    await add_audit_log(
        session,
        actor_user_id=user.id,
        company_id=None,
        action="auth.mfa.enroll.start",
        resource_type="user",
        resource_id=str(user.id),
        metadata_json={"method": "totp"},
        ip_address=ip_address,
    )
    return MfaEnrollment(
        secret=secret,
        otpauth_uri=build_totp_uri(
            secret=secret,
            account_name=user.email,
            issuer=settings.auth_mfa_issuer,
        ),
    )


async def confirm_mfa_enrollment(
    session: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    code: str,
    settings: Settings,
    ip_address: str | None,
) -> MfaConfirmation:
    factor = await get_mfa_factor(session, user.id, for_update=True)
    if factor is None or factor.status != "pending":
        raise MfaEnrollmentNotFoundError("MFA enrollment is not pending")

    secret = decrypt_totp_secret(factor.secret_ciphertext, settings)
    step = match_totp_step(secret, code)
    if step is None:
        await _audit_mfa_failure(
            session,
            user_id=user.id,
            action="auth.mfa.enroll.failure",
            ip_address=ip_address,
        )
        raise InvalidMfaCodeError("Invalid MFA code")

    now = datetime.now(UTC)
    factor.status = "enabled"
    factor.verified_at = now
    factor.last_used_step = step
    recovery_codes = generate_recovery_codes(settings.auth_mfa_recovery_code_count)
    await replace_recovery_codes(
        session,
        user_id=user.id,
        code_hashes=[hash_recovery_code(item, settings) for item in recovery_codes],
    )
    await mark_session_mfa_verified(
        session,
        session_id=session_id,
        method="totp",
    )
    await revoke_all_user_sessions(session, user_id=user.id, except_session_id=session_id)
    await add_audit_log(
        session,
        actor_user_id=user.id,
        company_id=None,
        action="auth.mfa.enable",
        resource_type="user",
        resource_id=str(user.id),
        metadata_json={"method": "totp", "recovery_code_count": len(recovery_codes)},
        ip_address=ip_address,
    )
    requirement = await get_mfa_requirement(
        session,
        user_id=user.id,
        session_id=session_id,
    )
    return MfaConfirmation(recovery_codes=recovery_codes, requirement=requirement)


async def verify_session_mfa(
    session: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    code: str,
    settings: Settings,
    ip_address: str | None,
) -> MfaRequirement:
    factor = await get_mfa_factor(session, user.id, for_update=True)
    if factor is None or factor.status != "enabled":
        raise MfaEnrollmentNotFoundError("MFA is not enabled")

    method: str | None = None
    secret = decrypt_totp_secret(factor.secret_ciphertext, settings)
    step = match_totp_step(secret, code, after_step=factor.last_used_step)
    if step is not None:
        factor.last_used_step = step
        method = "totp"
    elif await consume_recovery_code(
        session,
        user_id=user.id,
        code_hash=hash_recovery_code(code, settings),
    ):
        method = "recovery_code"

    if method is None:
        await _audit_mfa_failure(
            session,
            user_id=user.id,
            action="auth.mfa.verify.failure",
            ip_address=ip_address,
        )
        raise InvalidMfaCodeError("Invalid MFA code")

    marked = await mark_session_mfa_verified(
        session,
        session_id=session_id,
        method=method,
    )
    if marked is None:
        raise AccountSecurityError("Session is no longer active")
    await add_audit_log(
        session,
        actor_user_id=user.id,
        company_id=None,
        action="auth.mfa.verify",
        resource_type="user_session",
        resource_id=str(session_id),
        metadata_json={"method": method},
        ip_address=ip_address,
    )
    return await get_mfa_requirement(session, user_id=user.id, session_id=session_id)


async def disable_mfa(
    session: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    ip_address: str | None,
) -> None:
    platform_roles = await list_platform_roles(session, user.id)
    app_roles = await list_user_roles(session, user.id)
    if platform_roles or "admin" in app_roles:
        raise MfaRequiredForRoleError("MFA is mandatory for privileged accounts")
    if user.password_hash is None or not verify_password(current_password, user.password_hash):
        raise CurrentPasswordInvalidError("Current password is incorrect")

    await delete_mfa_credentials(session, user_id=user.id)
    await clear_session_mfa_state(session, user_id=user.id)
    await revoke_all_user_sessions(session, user_id=user.id, except_session_id=session_id)
    await add_audit_log(
        session,
        actor_user_id=user.id,
        company_id=None,
        action="auth.mfa.disable",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip_address,
    )


async def admin_reset_mfa(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    target_user_id: UUID,
    ip_address: str | None,
) -> None:
    user = await get_user_by_id(session, target_user_id)
    if user is None:
        raise SecurityUserNotFoundError("User not found")
    await delete_mfa_credentials(session, user_id=target_user_id)
    await clear_session_mfa_state(session, user_id=target_user_id)
    await revoke_all_user_sessions(session, user_id=target_user_id)
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="platform.user.mfa.reset",
        resource_type="user",
        resource_id=str(target_user_id),
        ip_address=ip_address,
    )


async def admin_unlock_account(
    session: AsyncSession,
    *,
    actor_user_id: UUID,
    target_user_id: UUID,
    ip_address: str | None,
) -> User:
    user = await get_user_by_id(session, target_user_id)
    if user is None:
        raise SecurityUserNotFoundError("User not found")
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_failed_login_at = None
    await revoke_all_user_sessions(session, user_id=target_user_id)
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="platform.user.unlock",
        resource_type="user",
        resource_id=str(target_user_id),
        ip_address=ip_address,
    )
    await session.flush()
    return user


async def record_login_outcome(
    session: AsyncSession,
    *,
    user: User | None,
    normalized_email: str,
    outcome: str,
    settings: Settings,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    if outcome == "success":
        await prune_login_attempts_before(
            session,
            cutoff=datetime.now(UTC)
            - timedelta(days=settings.auth_login_attempt_retention_days),
        )
    await add_login_attempt(
        session,
        user_id=user.id if user is not None else None,
        email_hash=hash_login_identifier(normalized_email, settings),
        outcome=outcome,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await add_audit_log(
        session,
        actor_user_id=user.id if outcome == "success" and user is not None else None,
        company_id=None,
        action=f"auth.login.{outcome}",
        resource_type="user",
        resource_id=str(user.id) if user is not None else None,
        metadata_json={},
        ip_address=ip_address,
        outcome="success" if outcome == "success" else "failure",
    )


async def register_failed_login(
    session: AsyncSession,
    *,
    user: User,
    settings: Settings,
) -> bool:
    now = datetime.now(UTC)
    if user.locked_until is not None and user.locked_until <= now:
        user.failed_login_attempts = 0
        user.locked_until = None
    user.failed_login_attempts += 1
    user.last_failed_login_at = now
    locked = user.failed_login_attempts >= settings.auth_login_lockout_threshold
    if locked:
        user.locked_until = now + timedelta(minutes=settings.auth_login_lockout_minutes)
        await revoke_all_user_sessions(session, user_id=user.id)
    await session.flush()
    return locked


def reset_failed_login_state(user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_failed_login_at = None


def is_account_locked(user: User, *, now: datetime | None = None) -> bool:
    moment = now or datetime.now(UTC)
    return user.locked_until is not None and user.locked_until > moment


async def _audit_mfa_failure(
    session: AsyncSession,
    *,
    user_id: UUID,
    action: str,
    ip_address: str | None,
) -> None:
    await add_audit_log(
        session,
        actor_user_id=user_id,
        company_id=None,
        action=action,
        resource_type="user",
        resource_id=str(user_id),
        outcome="failure",
        ip_address=ip_address,
    )


def mfa_factor_is_enabled(factor: MfaFactor | None) -> bool:
    return factor is not None and factor.status == "enabled"
