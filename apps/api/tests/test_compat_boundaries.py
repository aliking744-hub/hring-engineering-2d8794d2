from uuid import uuid4

import pytest
from pydantic import SecretStr

from hring_api.config import Settings
from hring_api.domains.compat.schemas import CompatQueryRequest
from hring_api.domains.compat.storage import PUBLIC_LOGICAL_BUCKETS, StorageCompatError, logical_key
from hring_api.domains.compat.storage_policy import (
    StoragePolicyError,
    StoragePolicyForbiddenError,
    authorize_storage_list_prefix,
    authorize_storage_object,
    validate_storage_upload,
)


def test_compat_query_rejects_invalid_table_names() -> None:
    with pytest.raises(ValueError):
        CompatQueryRequest(table="posts;drop table users", operation="select")


def test_storage_compat_rejects_path_traversal() -> None:
    with pytest.raises(StorageCompatError):
        logical_key("avatars", "../secret")
    with pytest.raises(StorageCompatError):
        logical_key("../bucket", "safe.jpg")


def test_storage_compat_keeps_logical_buckets_inside_one_private_bucket_prefix() -> None:
    assert logical_key("avatars", f"{uuid4()}/avatar.jpg").startswith("compat/avatars/")
    assert logical_key("product-files", "digital-assets/example.pdf") == (
        "compat/product-files/digital-assets/example.pdf"
    )


def test_only_real_legacy_public_buckets_are_exposed() -> None:
    assert PUBLIC_LOGICAL_BUCKETS == frozenset({"avatars", "products"})


def test_avatar_storage_is_scoped_to_current_user() -> None:
    user_id = uuid4()
    assert (
        authorize_storage_object(
            logical_bucket="avatars",
            object_path=f"{user_id}/avatar.jpg",
            user_id=user_id,
            is_admin=False,
        )
        == f"{user_id}/avatar.jpg"
    )
    with pytest.raises(StoragePolicyForbiddenError):
        authorize_storage_object(
            logical_bucket="avatars",
            object_path=f"{uuid4()}/avatar.jpg",
            user_id=user_id,
            is_admin=False,
        )


def test_avatar_listing_cannot_escape_user_prefix() -> None:
    user_id = uuid4()
    assert (
        authorize_storage_list_prefix(
            logical_bucket="avatars",
            prefix="",
            user_id=user_id,
            is_admin=False,
        )
        == f"{user_id}/"
    )
    with pytest.raises(StoragePolicyForbiddenError):
        authorize_storage_list_prefix(
            logical_bucket="avatars",
            prefix=f"{uuid4()}/",
            user_id=user_id,
            is_admin=False,
        )


def test_products_storage_requires_admin_boundary() -> None:
    user_id = uuid4()
    with pytest.raises(StoragePolicyForbiddenError):
        authorize_storage_object(
            logical_bucket="products",
            object_path="blog/example.jpg",
            user_id=user_id,
            is_admin=False,
        )
    assert (
        authorize_storage_object(
            logical_bucket="products",
            object_path="blog/example.jpg",
            user_id=user_id,
            is_admin=True,
        )
        == "blog/example.jpg"
    )


def test_unknown_private_bucket_is_not_available_through_generic_storage() -> None:
    with pytest.raises(StoragePolicyForbiddenError):
        authorize_storage_object(
            logical_bucket="product-files",
            object_path="digital-assets/example.pdf",
            user_id=uuid4(),
            is_admin=True,
        )


def test_public_storage_rejects_active_web_content_and_oversized_avatars() -> None:
    with pytest.raises(StoragePolicyError):
        validate_storage_upload(
            logical_bucket="products",
            object_path="logos/unsafe.svg",
            content_type="image/svg+xml",
            size_bytes=100,
        )
    with pytest.raises(StoragePolicyError):
        validate_storage_upload(
            logical_bucket="products",
            object_path="unsafe.html",
            content_type="text/html",
            size_bytes=100,
        )
    with pytest.raises(StoragePolicyError):
        validate_storage_upload(
            logical_bucket="avatars",
            object_path=f"{uuid4()}/avatar.jpg",
            content_type="image/jpeg",
            size_bytes=5 * 1024 * 1024 + 1,
        )


def test_valid_legacy_public_assets_remain_supported() -> None:
    validate_storage_upload(
        logical_bucket="avatars",
        object_path=f"{uuid4()}/avatar.jpg",
        content_type="image/jpeg",
        size_bytes=250_000,
    )
    validate_storage_upload(
        logical_bucket="products",
        object_path="fonts/font_custom.woff2",
        content_type="font/woff2",
        size_bytes=500_000,
    )
    validate_storage_upload(
        logical_bucket="products",
        object_path="catalog.xlsx",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size_bytes=2_000_000,
    )


def test_production_settings_still_require_real_independent_secrets() -> None:
    with pytest.raises(ValueError):
        Settings(
            environment="production",
            public_app_url="https://hring.ir",
            trusted_hosts=["hring.ir"],
            cors_origins=["https://hring.ir"],
            object_storage_secret_key=SecretStr("change-me"),
            ai_api_key=SecretStr("local-development"),
            auth_jwt_secret=SecretStr("development-only-change-me"),
            sms_otp_pepper=SecretStr("development-sms-otp-pepper-change-me"),
            auth_security_token_pepper=SecretStr(
                "development-security-token-pepper-change-me"
            ),
        )
