import asyncio
from types import SimpleNamespace
from typing import cast
import pytest
from fastapi.testclient import TestClient

from hring_api.domains.billing.service import SepCallbackResult
from hring_api.domains.integrations.service import (
    IntegrationValidationError,
    _validate_sep_probe,
)
from hring_api.domains.integrations.models import IntegrationProvider
from hring_api.integrations.payment.base import PaymentProviderError
from hring_api.integrations.payment.providers import (
    SEP_TOKEN_URL,
    SEP_VERIFY_URL,
    SepPaymentProvider,
)
from hring_api.main import app


class _Response:
    def __init__(self, payload: object) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._payload


class _AsyncClient:
    payload: object = {}
    requests: list[tuple[str, object]] = []

    def __init__(self, **_kwargs: object) -> None:
        pass

    async def __aenter__(self) -> "_AsyncClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def post(self, url: str, *, json: object) -> _Response:
        self.requests.append((url, json))
        return _Response(self.payload)


def test_sep_requests_token_from_official_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    _AsyncClient.payload = {"status": 1, "token": "token/with+symbols"}
    _AsyncClient.requests = []
    monkeypatch.setattr(
        "hring_api.integrations.payment.providers.httpx.AsyncClient",
        _AsyncClient,
    )
    provider = SepPaymentProvider(terminal_id="12345678")

    result = asyncio.run(
        provider.request_payment(
            amount_rial=4_900_000,
            description="HRing plan",
            callback_url="https://hring.ir/api/v1/billing/payments/sep/callback",
            email="user@example.com",
            plan_type="individual_pro",
            order_id="01997a4e-d0c7-7000-8000-000000000001",
        )
    )

    assert result.authority == "token/with+symbols"
    assert result.payment_url.endswith("token=token%2Fwith%2Bsymbols")
    assert _AsyncClient.requests == [
        (
            SEP_TOKEN_URL,
            {
                "action": "token",
                "TerminalId": 12345678,
                "Amount": 4_900_000,
                "ResNum": "01997a4e-d0c7-7000-8000-000000000001",
                "RedirectUrl": "https://hring.ir/api/v1/billing/payments/sep/callback",
            },
        )
    ]


def test_sep_verify_rejects_amount_or_terminal_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _AsyncClient.payload = {
        "ResultCode": 0,
        "Success": True,
        "TransactionDetail": {
            "RefNum": "reference-1",
            "TerminalNumber": 12345678,
            "OrginalAmount": 100,
        },
    }
    _AsyncClient.requests = []
    monkeypatch.setattr(
        "hring_api.integrations.payment.providers.httpx.AsyncClient",
        _AsyncClient,
    )
    provider = SepPaymentProvider(terminal_id="12345678")

    result = asyncio.run(
        provider.verify_payment(
            amount_rial=200,
            authority="unused-token",
            reference_number="reference-1",
        )
    )

    assert not result.verified
    assert _AsyncClient.requests == [
        (
            SEP_VERIFY_URL,
            {"RefNum": "reference-1", "TerminalNumber": 12345678},
        )
    ]


def test_sep_verify_requires_provider_reference_number() -> None:
    provider = SepPaymentProvider(terminal_id="12345678")
    with pytest.raises(PaymentProviderError, match="reference number"):
        asyncio.run(provider.verify_payment(amount_rial=100, authority="token"))


def test_sep_integration_accepts_only_official_endpoint_and_numeric_terminal() -> None:
    provider = cast(
        IntegrationProvider,
        SimpleNamespace(base_url="https://sep.shaparak.ir/onlinepg/onlinepg"),
    )
    _validate_sep_probe(provider, "12345678")
    with pytest.raises(IntegrationValidationError, match="official"):
        _validate_sep_probe(
            cast(
                IntegrationProvider,
                SimpleNamespace(base_url="https://example.com/onlinepg/onlinepg"),
            ),
            "12345678",
        )
    with pytest.raises(IntegrationValidationError, match="digits"):
        _validate_sep_probe(provider, "terminal-secret")


def test_sep_callback_is_post_only_and_redirects_after_server_verification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_verify(_db: object, **kwargs: object) -> SepCallbackResult:
        captured.update(kwargs)
        return SepCallbackResult(
            authority="sep-token",
            verified=True,
            ref_id="sep-reference",
        )

    monkeypatch.setattr(
        "hring_api.domains.billing.routes.verify_sep_callback",
        fake_verify,
    )
    with TestClient(app) as client:
        assert client.get("/api/v1/billing/payments/sep/callback").status_code == 405
        response = client.post(
            "/api/v1/billing/payments/sep/callback",
            data={
                "ResNum": "01997a4e-d0c7-7000-8000-000000000001",
                "Token": "sep-token",
                "RefNum": "sep-reference",
                "State": "OK",
                "TerminalId": "12345678",
                "Amount": "4900000",
            },
            follow_redirects=False,
        )

    assert response.status_code == 303
    assert response.headers["location"].startswith("http://localhost:5173/upgrade?")
    assert "Status=OK" in response.headers["location"]
    assert captured["amount_rial"] == 4_900_000
    assert captured["ref_num"] == "sep-reference"
