import asyncio

import httpx

from hring_ai_gateway.config import GatewaySettings
from hring_ai_gateway.providers import generate_openai_compatible
from hring_ai_gateway.registry import ProviderConfig, parse_registry_provider
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
