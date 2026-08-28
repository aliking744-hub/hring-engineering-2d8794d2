import asyncio

import httpx

from hring_ai_gateway.config import GatewaySettings
from hring_ai_gateway.providers import generate_openai_compatible
from hring_ai_gateway.registry import (
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
    assert result.usage == {"input_tokens": 10, "output_tokens": 3}
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
            "provider": "gemini",
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
        default_model="gemini-image-model",
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
    assert payload["modalities"] == ["image", "text"]
    assert result.content == ""
    assert [item.url for item in result.images] == [image_url]

