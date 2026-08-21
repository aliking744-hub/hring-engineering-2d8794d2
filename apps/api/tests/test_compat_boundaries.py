from uuid import uuid4

import pytest
from pydantic import SecretStr

from hring_api.config import Settings
from hring_api.domains.compat.schemas import CompatQueryRequest
from hring_api.domains.compat.storage import StorageCompatError, logical_key


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
            auth_security_token_pepper=SecretStr("development-security-token-pepper-change-me"),
        )
