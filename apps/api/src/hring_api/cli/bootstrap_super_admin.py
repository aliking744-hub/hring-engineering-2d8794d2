import asyncio
import os
import sys
from datetime import UTC, datetime

from sqlalchemy import select

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.identity.repository import create_user, get_user_by_email
from hring_api.domains.identity.security import hash_password
from hring_api.domains.identity.service import normalize_email


async def bootstrap() -> None:
    raw_email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip()
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
    full_name = os.getenv("BOOTSTRAP_ADMIN_NAME", "HRing Super Admin").strip()

    if not raw_email or not password:
        raise RuntimeError(
            "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required"
        )
    if len(password) < 14:
        raise RuntimeError("Bootstrap super-admin password must be at least 14 characters")

    email = normalize_email(raw_email)
    async with SessionFactory() as session:
        async with session.begin():
            user = await get_user_by_email(session, email)
            if user is None:
                user = await create_user(
                    session,
                    email=email,
                    password_hash=hash_password(password),
                    full_name=full_name or None,
                )
                user.email_verified_at = datetime.now(UTC)

            existing_role = await session.scalar(
                select(PlatformRoleAssignment.id).where(
                    PlatformRoleAssignment.user_id == user.id,
                    PlatformRoleAssignment.role == "super_admin",
                )
            )
            if existing_role is None:
                session.add(
                    PlatformRoleAssignment(
                        user_id=user.id,
                        role="super_admin",
                        created_by=user.id,
                    )
                )

    print(f"Super admin ready: {email}")


def main() -> None:
    try:
        asyncio.run(bootstrap())
    except Exception as exc:
        print(f"Bootstrap failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
