from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.identity.models import CompanyMember, User
from hring_api.domains.identity.repository import (
    get_session_by_id,
    get_user_by_id,
    list_company_memberships,
    list_user_roles,
)
from hring_api.domains.identity.security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user: User
    app_roles: list[str]
    memberships: list[CompanyMember]

    @property
    def user_id(self) -> UUID:
        return self.user.id


async def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> Principal:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized

    try:
        claims = decode_access_token(credentials.credentials, settings)
    except ValueError as exc:
        raise unauthorized from exc

    user = await get_user_by_id(db, claims.user_id)
    user_session = await get_session_by_id(db, claims.session_id)
    now = datetime.now(UTC)
    if (
        user is None
        or not user.is_active
        or user_session is None
        or user_session.user_id != user.id
        or user_session.revoked_at is not None
        or user_session.expires_at <= now
    ):
        raise unauthorized

    return Principal(
        user=user,
        app_roles=await list_user_roles(db, user.id),
        memberships=await list_company_memberships(db, user.id),
    )


def require_app_role(*allowed_roles: str):
    async def dependency(
        principal: Principal = Depends(get_current_principal),
    ) -> Principal:
        if not set(principal.app_roles).intersection(allowed_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return principal

    return dependency


def require_company_role(company_id: UUID, *allowed_roles: str):
    async def dependency(
        principal: Principal = Depends(get_current_principal),
    ) -> Principal:
        authorized = any(
            membership.company_id == company_id
            and membership.is_active
            and membership.role in allowed_roles
            for membership in principal.memberships
        )
        if not authorized:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return principal

    return dependency
