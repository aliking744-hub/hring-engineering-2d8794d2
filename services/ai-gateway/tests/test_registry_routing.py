import asyncio

import httpx

from hring_ai_gateway.config import GatewaySettings
from hring_ai_gateway.providers import ProviderUnavailableError, generate_openai_compatible
from hring_ai_gateway.registry import (
    CompanyAiRouteError,
    ProviderConfig,
    fetch_registry_provider_names,
    parse_registry_provider,
)
from hring_ai_gateway.schemas import GenerateRequest


def test_registry_payload_supports_keyless_local_openai_compatibility() -> None:
    provider = parse_registry_provider(
        {
            "provider_key": "ollama.qwen",
            "adapter": "ollama",
            "base_url": "http://ollama:11434/v1",
            "default_model": "qwen3:8b",
            "auth_scheme": "none",
            "secret": None,
            "timeout_seconds": 30,
            "max_retries": 1,
            "endpoint_path": "/chat/completions",
        }
    )
    assert provider is not None
    assert provider.name == "ollama.qwen"
    assert provider.api_key is None
    assert provider.default_model == "qwen3:8b"
    assert provider.max_tokens_field == "max_tokens"


def test_registry_payload_supports_native_anthropic_defaults() -> None:
    provider = parse_registry_provider(
        {
            "provider_key": "anthropic.primary",
            "adapter": "anthropic",
            "base_url": "https://api.anthropic.com",
            "default_model": "claude-test-model",
            "auth_scheme": "x-api-key",
            "secret": "anthropic-secret",
            "timeout_seconds": 30,
            "max_retries": 1,
        }
    )
    assert provider is not None
    assert provider.endpoint_path == "/v1/messages"
    assert provider.max_tokens_field == "max_tokens"


def test_registry_health_inventory_fails_closed_on_invalid_json(monkeypatch) -> None:
    class FakeAsyncClient:
        def __init__(self, **_kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _traceback) -> None:
            return None

        async def get(self, url: str, *, headers: dict) -> httpx.Response:
            _ = headers
            return httpx.Response(
                200,
                request=httpx.Request("GET", url),
                content=b"not-json",
            )

    monkeypatch.setattr(
        "hring_ai_gateway.registry.httpx.AsyncClient",
        FakeAsyncClient,
    )
    settings = GatewaySettings(hring_api_base_url="http://api:8000/api/v1")

    assert asyncio.run(fetch_registry_provider_names(settings)) == []


def test_gateway_falls_back_and_uses_each_provider_default_model(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    class FakeAsyncClient:
        def __init__(self, **_kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _traceback) -> None:
            return None

        async def post(self, url: str, *, json: dict, headers: dict) -> httpx.Response:
            _ = headers
            calls.append((url, str(json["model"])))
            request = httpx.Request("POST", url)
            if "primary.example" in url:
                return httpx.Response(503, request=request, json={"error": "unavailable"})
            return httpx.Response(
                200,
                request=request,
                headers={"x-request-id": "fallback-request"},
                json={
                    "id": "result-1",
                    "choices": [{"message": {"content": "fallback ok"}}],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 3},
                    "citations": ["https://example.com/report"],
                    "search_results": [
                        {
                            "url": "https://example.com/report",
                            "title": "Official report",
                        }
                    ],
                },
            )

    monkeypatch.setattr(
        "hring_ai_gateway.providers.httpx.AsyncClient",
        FakeAsyncClient,
    )
    request = GenerateRequest.model_validate(
        {
            "request_id": "00000000-0000-0000-0000-000000000101",
            "provider": "gemini",
            "model": "legacy-request-model",
            "messages": [{"role": "user", "content": "hello"}],
        }
    )
    routes = [
        ProviderConfig(
            name="gemini.primary",
            adapter="gemini_openai",
            base_url="https://primary.example/v1",
            api_key="primary-secret",
            auth_scheme="bearer",
            endpoint_path="/chat/completions",
            max_tokens_field="max_completion_tokens",
            default_model="gemini-primary-model",
            timeout_seconds=10,
            max_retries=0,
        ),
        ProviderConfig(
            name="ollama.qwen",
            adapter="ollama",
            base_url="http://fallback.example/v1",
            api_key=None,
            auth_scheme="none",
            endpoint_path="/chat/completions",
            max_tokens_field="max_tokens",
            default_model="qwen-fallback-model",
            timeout_seconds=10,
            max_retries=0,
        ),
    ]

    result = asyncio.run(
        generate_openai_compatible(
            settings=GatewaySettings(),
            request=request,
            resolved_providers=routes,
        )
    )
    assert calls == [
        ("https://primary.example/v1/chat/completions", "gemini-primary-model"),
        ("http://fallback.example/v1/chat/completions", "qwen-fallback-model"),
    ]
    assert result.provider == "ollama.qwen"
    assert result.model == "qwen-fallback-model"
    assert result.content == "fallback ok"
    assert result.usage == {"input_tokens": 10, "output_tokens": 3, "total_tokens": 13}
    assert len(result.citations) == 1
    assert result.citations[0].url == "https://example.com/report"
    assert result.citations[0].title == "Official report"


def test_gateway_translates_native_anthropic_messages_and_usage(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeAsyncClient:
        def __init__(self, **_kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _traceback) -> None:
            return None

        async def post(self, url: str, *, json: dict, headers: dict) -> httpx.Response:
            captured.update({"url": url, "json": json, "headers": headers})
            request = httpx.Request("POST", url)
            return httpx.Response(
                200,
                request=request,
                headers={"request-id": "anthropic-request"},
                json={
                    "id": "msg_test",
                    "content": [
                        {"type": "text", "text": '{"ok":'},
                        {"type": "text", "text": "true}"},
                    ],
                    "usage": {"input_tokens": 11, "output_tokens": 4},
                },
            )

    monkeypatch.setattr(
        "hring_ai_gateway.providers.httpx.AsyncClient",
        FakeAsyncClient,
    )
    request = GenerateRequest.model_validate(
        {
            "request_id": "00000000-0000-0000-0000-000000000102",
            "provider": "anthropic",
            "model": "legacy-model",
            "messages": [
                {"role": "system", "content": "You are careful."},
                {"role": "developer", "content": "Use the supplied evidence."},
                {"role": "user", "content": "Return JSON."},
            ],
            "max_output_tokens": 512,
            "response_format": "json_object",
        }
    )
    route = ProviderConfig(
        name="anthropic.primary",
        adapter="anthropic",
        base_url="https://api.anthropic.com",
        api_key="anthropic-secret",
        auth_scheme="x-api-key",
        endpoint_path="/v1/messages",
        max_tokens_field="max_tokens",
        default_model="claude-test-model",
        timeout_seconds=10,
        max_retries=0,
    )

    result = asyncio.run(
        generate_openai_compatible(
            settings=GatewaySettings(),
            request=request,
            resolved_providers=[route],
        )
    )
    assert captured["url"] == "https://api.anthropic.com/v1/messages"
    assert captured["headers"] == {
        "Content-Type": "application/json",
        "X-API-Key": "anthropic-secret",
        "anthropic-version": "2023-06-01",
    }
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["model"] == "claude-test-model"
    assert payload["max_tokens"] == 512
    assert payload["messages"] == [{"role": "user", "content": "Return JSON."}]
    assert "You are careful." in str(payload["system"])
    assert "valid JSON object" in str(payload["system"])
    assert "response_format" not in payload
    assert result.content == '{"ok":true}'
    assert result.usage == {"input_tokens": 11, "output_tokens": 4}
    assert result.provider_request_id == "anthropic-request"


def test_gateway_forwards_image_modalities_and_extracts_image(monkeypatch) -> None:
    captured: dict[str, object] = {}
    image_url = "data:image/png;base64,aGVsbG8="

    class FakeAsyncClient:
        def __init__(self, **_kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _traceback) -> None:
            return None

        async def post(self, url: str, *, json: dict, headers: dict) -> httpx.Response:
            captured.update({"url": url, "json": json, "headers": headers})
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "id": "image-result",
                    "choices": [
                        {
                            "message": {
                                "content": "",
                                "images": [{"image_url": {"url": image_url}}],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 20, "completion_tokens": 2},
                },
            )

    monkeypatch.setattr(
        "hring_ai_gateway.providers.httpx.AsyncClient",
        FakeAsyncClient,
    )
    request = GenerateRequest.model_validate(
        {
            "request_id": "00000000-0000-0000-0000-000000000103",
            "provider": "avalai.image",
            "model": "gemini-image-model",
            "messages": [{"role": "user", "content": "Create an image"}],
            "modalities": ["image", "text"],
        }
    )
    route = ProviderConfig(
        name="avalai.image",
        adapter="openai_compatible",
        base_url="https://image.example/v1",
        api_key="image-secret",
        auth_scheme="bearer",
        endpoint_path="/chat/completions",
        max_tokens_field="max_completion_tokens",
        default_model="gemini-2.5-flash",
        timeout_seconds=30,
        max_retries=0,
    )

    result = asyncio.run(
        generate_openai_compatible(
            settings=GatewaySettings(),
            request=request,
            resolved_providers=[route],
        )
    )
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["model"] == "gemini-image-model"
    assert payload["modalities"] == ["image", "text"]
    assert "extra_body" not in payload
    assert "stream" not in payload
    assert result.content == ""
    assert [item.url for item in result.images] == [image_url]



def test_gateway_prefers_healthy_company_byok_route(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def company_route(_settings, *, company_id, feature_key):
        assert str(company_id) == "00000000-0000-0000-0000-000000000707"
        assert feature_key == "job_engineering.job_profile"
        return ProviderConfig(
            name="company.openai",
            adapter="openai",
            base_url="https://company-provider.example/v1",
            api_key="company-secret",
            auth_scheme="bearer",
            endpoint_path="/chat/completions",
            max_tokens_field="max_completion_tokens",
            default_model="company-model",
            timeout_seconds=20,
            max_retries=0,
        )

    class FakeAsyncClient:
        def __init__(self, **_kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _traceback) -> None:
            return None

        async def post(self, url: str, *, json: dict, headers: dict) -> httpx.Response:
            captured.update({"url": url, "json": json, "headers": headers})
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "id": "company-result",
                    "choices": [{"message": {"content": "company output"}}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 2},
                },
            )

    monkeypatch.setattr(
        "hring_ai_gateway.providers.fetch_company_ai_provider",
        company_route,
    )
    monkeypatch.setattr(
        "hring_ai_gateway.providers.httpx.AsyncClient",
        FakeAsyncClient,
    )
    request = GenerateRequest.model_validate(
        {
            "request_id": "00000000-0000-0000-0000-000000000708",
            "company_id": "00000000-0000-0000-0000-000000000707",
            "feature_key": "job_engineering.job_profile",
            "provider": "gemini",
            "model": "platform-model",
            "messages": [{"role": "user", "content": "Create profile"}],
        }
    )

    result = asyncio.run(generate_openai_compatible(settings=GatewaySettings(), request=request))

    assert captured["url"] == "https://company-provider.example/v1/chat/completions"
    assert captured["headers"] == {
        "Content-Type": "application/json",
        "Authorization": "Bearer company-secret",
        "X-Client-Request-Id": "00000000-0000-0000-0000-000000000708",
    }
    assert result.provider == "company.openai"
    assert result.model == "company-model"


def test_gateway_never_falls_back_to_platform_when_company_byok_route_is_invalid(monkeypatch) -> None:
    async def invalid_company_route(_settings, *, company_id, feature_key):
        _ = company_id, feature_key
        raise CompanyAiRouteError("Company BYOK connection is unavailable")

    async def platform_routes_should_not_run(*_args, **_kwargs):
        raise AssertionError("platform provider fallback must not run for a failed company BYOK route")

    monkeypatch.setattr(
        "hring_ai_gateway.providers.fetch_company_ai_provider",
        invalid_company_route,
    )
    monkeypatch.setattr(
        "hring_ai_gateway.providers.provider_configs",
        platform_routes_should_not_run,
    )
    request = GenerateRequest.model_validate(
        {
            "request_id": "00000000-0000-0000-0000-000000000709",
            "company_id": "00000000-0000-0000-0000-000000000707",
            "feature_key": "development.learning_path",
            "provider": "gemini",
            "model": "platform-model",
            "messages": [{"role": "user", "content": "Create learning path"}],
        }
    )

    try:
        asyncio.run(generate_openai_compatible(settings=GatewaySettings(), request=request))
    except ProviderUnavailableError as exc:
        assert "Company BYOK connection is unavailable" in str(exc)
    else:
        raise AssertionError("company BYOK route failure must be fail-closed")
