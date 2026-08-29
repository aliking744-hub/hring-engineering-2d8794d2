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
PRODUCT_CONTENT_TYPES: dict[str, frozenset[str]] = {
    ".pdf": frozenset({"application/pdf"}),
    ".xls": frozenset({"application/vnd.ms-excel", "application/octet-stream"}),
    ".xlsx": frozenset({
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
    }),
    ".csv": frozenset({"text/csv", "text/plain", "application/vnd.ms-excel"}),
    ".jpg": frozenset({"image/jpeg"}),
    ".jpeg": frozenset({"image/jpeg"}),
    ".png": frozenset({"image/png"}),
    ".webp": frozenset({"image/webp"}),
    ".gif": frozenset({"image/gif"}),
    ".ttf": frozenset({"font/ttf", "application/x-font-ttf", "application/octet-stream"}),
    ".otf": frozenset({"font/otf", "application/x-font-opentype", "application/octet-stream"}),
    ".woff": frozenset({"font/woff", "application/font-woff", "application/octet-stream"}),
    ".woff2": frozenset({"font/woff2", "application/octet-stream"}),
}

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


def _looks_like_active_web_content(header_bytes: bytes) -> bool:
    sample = header_bytes[:512].lstrip().lower()
    return sample.startswith((b"<!doctype html", b"<html", b"<?xml", b"<svg")) or b"<script" in sample


def _signature_matches(suffix: str, header_bytes: bytes) -> bool:
    if not header_bytes:
        return False
    signatures: dict[str, tuple[bytes, ...]] = {
        ".jpg": (b"\xff\xd8\xff",),
        ".jpeg": (b"\xff\xd8\xff",),
        ".png": (b"\x89PNG\r\n\x1a\n",),
        ".gif": (b"GIF87a", b"GIF89a"),
        ".pdf": (b"%PDF-",),
        ".xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
        ".xlsx": (b"PK\x03\x04",),
        ".ttf": (b"\x00\x01\x00\x00", b"true"),
        ".otf": (b"OTTO",),
        ".woff": (b"wOFF",),
        ".woff2": (b"wOF2",),
    }
    if suffix == ".webp":
        return (
            len(header_bytes) >= 12
            and header_bytes.startswith(b"RIFF")
            and header_bytes[8:12] == b"WEBP"
        )
    if suffix == ".csv":
        return b"\x00" not in header_bytes
    return any(header_bytes.startswith(signature) for signature in signatures.get(suffix, ()))




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
    header_bytes: bytes | None = None,
) -> None:
    if size_bytes <= 0:
        raise StoragePolicyError("Uploaded file is empty")

    suffix = PurePosixPath(object_path).suffix.lower()
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()

    if normalized_type in DANGEROUS_PUBLIC_CONTENT_TYPES:
        raise StoragePolicyError("Active web content is not allowed in public storage")
    if header_bytes is not None and _looks_like_active_web_content(header_bytes):
        raise StoragePolicyError("Uploaded content contains active web markup")

    if logical_bucket == "avatars":
        if size_bytes > AVATAR_MAX_BYTES:
            raise StoragePolicyError("Avatar exceeds the 5 MB limit")
        if suffix not in AVATAR_EXTENSIONS or normalized_type not in AVATAR_CONTENT_TYPES:
            raise StoragePolicyError("Avatar must be JPEG, PNG, or WebP")
        if header_bytes is not None and not _signature_matches(suffix, header_bytes):
            raise StoragePolicyError("Avatar content does not match its file type")
        return

    if logical_bucket == "products":
        if size_bytes > PRODUCT_MAX_BYTES:
            raise StoragePolicyError("Public product asset exceeds the 25 MB limit")
        if suffix not in PRODUCT_EXTENSIONS:
            raise StoragePolicyError("Unsupported public product asset type")
        if normalized_type not in PRODUCT_CONTENT_TYPES[suffix]:
            raise StoragePolicyError("Product content type does not match its extension")
        if header_bytes is not None and not _signature_matches(suffix, header_bytes):
            raise StoragePolicyError("Product content does not match its file type")
        return

    raise StoragePolicyForbiddenError("Generic upload to this storage bucket is not allowed")
