from fastapi.testclient import TestClient

from hring_ai_gateway.config import get_settings
from hring_ai_gateway.main import app
from hring_ai_gateway.providers import normalize_usage


def test_gateway_requires_internal_bearer_key() -> None:
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.post(
            "/v1/generate",
            json={
                "request_id": "00000000-0000-0000-0000-000000000001",
                "provider": "gemini",
                "model": "example-model",
                "messages": [{"role": "user", "content": "hello"}],
            },
        )
    assert response.status_code == 401


def test_unconfigured_provider_fails_without_exposing_secret(monkeypatch) -> None:
    monkeypatch.setenv("INTERNAL_API_KEY", "test-internal-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.post(
            "/v1/generate",
            headers={"Authorization": "Bearer test-internal-key"},
            json={
                "request_id": "00000000-0000-0000-0000-000000000002",
                "provider": "gemini",
                "model": "example-model",
                "messages": [{"role": "user", "content": "hello"}],
            },
        )
    assert response.status_code == 503
    assert "key" not in response.text.lower()
    get_settings.cache_clear()


def test_health_only_reports_provider_names(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret-provider-value")
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["enabled_providers"] == ["gemini"]
    assert "super-secret-provider-value" not in response.text
    get_settings.cache_clear()


def test_openai_compatible_usage_is_normalized() -> None:
    assert normalize_usage(
        {
            "usage": {
                "prompt_tokens": 120,
                "completion_tokens": 30,
                "prompt_tokens_details": {"cached_tokens": 40},
                "completion_tokens_details": {"reasoning_tokens": 5},
            }
        }
    ) == {
        "input_tokens": 120,
        "output_tokens": 30,
        "cached_input_tokens": 40,
        "reasoning_tokens": 5,
    }
