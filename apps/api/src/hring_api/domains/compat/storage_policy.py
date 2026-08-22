from __future__ import annotations

from pathlib import PurePosixPath
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.identity.dependencies import Principal


STORAGE_ADMIN_ROLES = frozenset({"super_admin", "platform_admin", "content_admin"})
USER_MUTABLE_BUCKETS = frozenset({"avatars"})
ADMIN_MUTABLE_BUCKETS = frozenset({"products"})

AVATAR_MAX_BYTES = 5 * 1024 * 1024
PRODUCT_MAX_BYTES = 25 * 1024 * 1024

AVATAR_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
PRODUCT_EXTENSIONS = frozenset(
    {
        ".pdf",
        ".xls",
        ".xlsx",
        ".csv",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
        ".ttf",
        ".otf",
        ".woff",
        ".woff2",
    }
)

AVATAR_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
DANGEROUS_PUBLIC_CONTENT_TYPES = frozenset(
    {
        "text/html",
        "application/xhtml+xml",
        "image/svg+xml",
        "application/javascript",
        "text/javascript",
        "application/xml",
        "text/xml",
    }
)


class StoragePolicyError(RuntimeError):
    pass


class StoragePolicyForbiddenError(StoragePolicyError):
    pass


async def is_storage_admin(db: AsyncSession, principal: Principal) -> bool:
    roles = set(await list_platform_roles(db, principal.user_id))
    return bool(roles.intersection(STORAGE_ADMIN_ROLES)) or "admin" in principal.app_roles


def _owner_prefix(user_id: UUID) -> str:
    return f"{user_id}/"


def authorize_storage_object(
    *,
    logical_bucket: str,
    object_path: str,
    user_id: UUID,
    is_admin: bool,
) -> str:
    path = object_path.strip().lstrip("/")
    if not path:
        raise StoragePolicyError("Object path is required")

    if logical_bucket in USER_MUTABLE_BUCKETS:
        if not path.startswith(_owner_prefix(user_id)):
            raise StoragePolicyForbiddenError("Storage object is outside the current user scope")
        return path

    if logical_bucket in ADMIN_MUTABLE_BUCKETS:
        if not is_admin:
            raise StoragePolicyForbiddenError("Storage bucket requires content-admin access")
        return path

    raise StoragePolicyForbiddenError("Generic access to this storage bucket is not allowed")


def authorize_storage_list_prefix(
    *,
    logical_bucket: str,
    prefix: str,
    user_id: UUID,
    is_admin: bool,
) -> str:
    normalized = prefix.strip().lstrip("/")
    if logical_bucket in USER_MUTABLE_BUCKETS:
        owner_prefix = _owner_prefix(user_id)
        if not normalized:
            return owner_prefix
        if normalized == str(user_id) or normalized.startswith(owner_prefix):
            return normalized
        raise StoragePolicyForbiddenError("Storage listing is outside the current user scope")

    if logical_bucket in ADMIN_MUTABLE_BUCKETS:
        if not is_admin:
            raise StoragePolicyForbiddenError("Storage bucket requires content-admin access")
        return normalized

    raise StoragePolicyForbiddenError("Generic access to this storage bucket is not allowed")


def validate_storage_upload(
    *,
    logical_bucket: str,
    object_path: str,
    content_type: str | None,
    size_bytes: int,
) -> None:
    if size_bytes <= 0:
        raise StoragePolicyError("Uploaded file is empty")

    suffix = PurePosixPath(object_path).suffix.lower()
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()

    if normalized_type in DANGEROUS_PUBLIC_CONTENT_TYPES:
        raise StoragePolicyError("Active web content is not allowed in public storage")

    if logical_bucket == "avatars":
        if size_bytes > AVATAR_MAX_BYTES:
            raise StoragePolicyError("Avatar exceeds the 5 MB limit")
        if suffix not in AVATAR_EXTENSIONS or normalized_type not in AVATAR_CONTENT_TYPES:
            raise StoragePolicyError("Avatar must be JPEG, PNG, or WebP")
        return

    if logical_bucket == "products":
        if size_bytes > PRODUCT_MAX_BYTES:
            raise StoragePolicyError("Public product asset exceeds the 25 MB limit")
        if suffix not in PRODUCT_EXTENSIONS:
            raise StoragePolicyError("Unsupported public product asset type")
        return

    raise StoragePolicyForbiddenError("Generic upload to this storage bucket is not allowed")
