import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.main import app


def _production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "production",
        "public_app_url": "https://hring.ir",
        "trusted_hosts": ["hring.ir", "www.hring.ir"],
        "cors_origins": ["https://hring.ir"],
        "object_storage_secret_key": "storage-secret-that-is-not-a-default",
        "ai_api_key": "ai-secret-that-is-not-a-default",
        "auth_jwt_secret": "jwt-secret-that-is-not-a-default-and-is-long",
        "sms_otp_pepper": "sms-pepper-that-is-not-a-default",
        "auth_security_token_pepper": "security-pepper-that-is-not-a-default",
    }
    values.update(overrides)
    return Settings(**values)


def test_production_configuration_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError):
        _production_settings(cors_origins=["*"])


def test_production_configuration_rejects_wildcard_trusted_hosts() -> None:
    with pytest.raises(ValidationError):
        _production_settings(trusted_hosts=["*"])


def test_production_configuration_requires_https_public_url() -> None:
    with pytest.raises(ValidationError):
        _production_settings(public_app_url="http://hring.ir")


def test_valid_production_security_configuration_is_accepted() -> None:
    settings = _production_settings()
    assert settings.environment == "production"
    assert settings.public_app_url == "https://hring.ir"


def test_api_responses_include_security_and_request_id_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-request-id"]
