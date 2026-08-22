from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings
from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.compat.models import CompatRecord
from hring_api.domains.identity.dependencies import Principal


DOWNLOAD_TTL_SECONDS = 120
DOWNLOAD_ADMIN_ROLES = frozenset({"super_admin", "platform_admin"})


class ProductDownloadError(RuntimeError):
    pass


class ProductDownloadForbiddenError(ProductDownloadError):
    pass


def _record_payload(record: CompatRecord) -> dict[str, Any]:
    return dict(record.data)


async def _find_record(
    db: AsyncSession,
    *,
    table_name: str,
    record_id: str | None = None,
) -> list[CompatRecord]:
    statement = select(CompatRecord).where(CompatRecord.table_name == table_name)
    if record_id is not None:
        statement = statement.where(CompatRecord.record_id == record_id)
    result = await db.execute(statement)
    return list(result.scalars().all())


async def create_product_download_url(
    db: AsyncSession,
    *,
    principal: Principal,
    product_id: str,
    settings: Settings,
) -> str:
    products = await _find_record(db, table_name="digital_products", record_id=product_id)
    if not products:
        raise ProductDownloadError("فایلی برای دانلود وجود ندارد")
    product = products[0]
    payload = _record_payload(product)
    file_path = payload.get("file_path")
    if not isinstance(file_path, str) or not file_path:
        raise ProductDownloadError("فایلی برای دانلود وجود ندارد")

    platform_roles = set(await list_platform_roles(db, principal.user_id))
    is_admin = bool(platform_roles.intersection(DOWNLOAD_ADMIN_ROLES)) or "admin" in principal.app_roles
    allowed = is_admin
    if not allowed:
        purchases = await _find_record(db, table_name="user_purchases")
        allowed = any(
            record.owner_user_id == principal.user_id
            and str(record.data.get("product_id")) == product_id
            for record in purchases
        ) and bool(payload.get("is_active", True))
    if not allowed:
        raise ProductDownloadForbiddenError("شما این محصول را خریداری نکرده‌اید")

    now = datetime.now(UTC).replace(microsecond=0)
    expires_at = now + timedelta(seconds=DOWNLOAD_TTL_SECONDS)
    token_payload = {
        "sub": str(principal.user_id),
        "iss": settings.auth_jwt_issuer,
        "typ": "product-download",
        "product_id": product_id,
        "file_path": file_path,
        "file_name": str(payload.get("name") or "download"),
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(
        token_payload,
        settings.auth_jwt_secret.get_secret_value(),
        algorithm=settings.auth_jwt_algorithm,
    )

    current_count = payload.get("download_count")
    payload["download_count"] = int(current_count) + 1 if isinstance(current_count, int) else 1
    product.data = payload
    await db.commit()
    return f"{settings.api_v1_prefix.rstrip('/')}/compat/downloads/{token}"


def decode_product_download_token(token: str, settings: Settings) -> tuple[str, str]:
    try:
        payload = jwt.decode(
            token,
            settings.auth_jwt_secret.get_secret_value(),
            algorithms=[settings.auth_jwt_algorithm],
            issuer=settings.auth_jwt_issuer,
            options={"require": ["sub", "iss", "typ", "file_path", "file_name", "iat", "exp"]},
        )
        if payload.get("typ") != "product-download":
            raise InvalidTokenError("Unexpected token type")
        UUID(str(payload["sub"]))
        file_path = str(payload["file_path"])
        file_name = str(payload["file_name"])
        if not file_path or not file_name:
            raise InvalidTokenError("Missing download claims")
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise ProductDownloadError("Download link is invalid or expired") from exc
    return file_path, file_name
