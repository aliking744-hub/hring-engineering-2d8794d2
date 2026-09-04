import asyncio
import inspect
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import (
    AiGeneratedImage,
    AiGatewayError,
    AiGatewayResult,
)
from hring_api.domains.job_ads.schemas import (
    SmartAdGenerateRequest,
    SmartAdImageResponse,
    SmartAdResponse,
)
from hring_api.domains.job_ads.service import (
    SmartAdError,
    _generate_content,
    _image_prompt,
    get_smart_ad_artifact,
    list_smart_ad_artifacts,
)
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"smart-ad-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": "Smart Ad Test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _payload(*, generate_image: bool = True) -> SmartAdGenerateRequest:
    return SmartAdGenerateRequest.model_validate(
        {
            "jobTitle": "کارشناس منابع انسانی",
            "companyName": "شرکت آزمایشی",
            "contactMethod": "hr@example.com",
            "industry": "فناوری اطلاعات",
            "platform": "linkedin",
            "tone": "formal",
            "generateImage": generate_image,
            "imageFormat": "16:9",
            "imageWidth": 1920,
            "imageHeight": 1080,
        }
    )


def test_smart_ad_preserves_text_and_real_image_contract(monkeypatch) -> None:
    captured: list[dict[str, object]] = []

    async def fake_route(**kwargs: object) -> SimpleNamespace:
        feature_key = str(kwargs["feature_key"])
        return SimpleNamespace(
            provider="test",
            model="image-model" if feature_key.endswith("image") else "text-model",
            source="test",
        )

    async def fake_generate(**kwargs: Any) -> AiGatewayResult:
        captured.append(kwargs)
        if kwargs.get("modalities"):
            return AiGatewayResult(
                request_id=uuid4(),
                content="",
                provider="test",
                model="image-model",
                usage={},
                provider_cost_microusd=2,
                images=(
                    AiGeneratedImage(
                        url="data:image/png;base64,aGVsbG8=",
                        mime_type="image/png",
                    ),
                ),
            )
        return AiGatewayResult(
            request_id=uuid4(),
            content="فرصتی برای ساختن آینده؛ به تیم ما بپیوندید. #استخدام",
            provider="test",
            model="text-model",
            usage={},
            provider_cost_microusd=1,
        )

    async def fake_managed(_session: object, **kwargs: Any) -> AiGatewayResult:
        return await kwargs["fallback"]()

    monkeypatch.setattr(
        "hring_api.domains.job_ads.service.resolve_runtime_feature_route",
        fake_route,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_ads.service.generate_with_ai_gateway",
        fake_generate,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_ads.service.generate_with_managed_prompt",
        fake_managed,
    )

    result = asyncio.run(
        _generate_content(
            payload=_payload(),
            principal=SimpleNamespace(user_id=uuid4(), memberships=[]),
            text_credits=5,
            image_credits=20,
            settings=Settings(),
            session=SimpleNamespace(),
        )
    )

    assert result.generated_text.startswith("شرکت آزمایشی")
    assert "فرصتی برای ساختن آینده" in result.generated_text
    assert result.image_url == "data:image/png;base64,aGVsbG8="
    text_prompt = "\n".join(
        message["content"]
        for call in captured
        if not call.get("modalities")
        for message in call["messages"]
    )
    assert "Start with a compelling hook" in text_prompt
    assert "Use hashtags at the bottom (3-5 relevant ones)" in text_prompt
    assert "Formal and professional tone" in text_prompt
    assert "Every generation must feel newly written" in text_prompt
    assert "Do not reuse a fixed template" in text_prompt
    assert "Follow this structural profile exactly" in text_prompt
    assert "Structural variation profile:" in text_prompt

    image_call = next(call for call in captured if call.get("modalities"))
    assert image_call["modalities"] == ["image", "text"]
    assert "image_aspect_ratio" not in image_call
    assert "image_size" not in image_call
    image_prompt = "\n".join(message["content"] for message in image_call["messages"])
    assert "Create one professional 16:9 recruitment poster" in image_prompt
    assert "Do not render any text, letters, numbers, logo, brand mark" in image_prompt
    assert "will be composited later" in image_prompt
    assert len(image_prompt) < 1_200
    assert image_call["messages"] == [
        {
            "role": "user",
            "content": image_prompt,
        }
    ]
    assert "max_output_tokens" not in image_call


def test_requested_image_failure_fails_the_whole_request(monkeypatch) -> None:
    async def fake_route(**_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(provider="test", model="test-model", source="test")

    async def fake_generate(**kwargs: Any) -> AiGatewayResult:
        if kwargs.get("modalities"):
            raise AiGatewayError("image failed")
        return AiGatewayResult(
            request_id=uuid4(),
            content="متن آگهی معتبر",
            provider="test",
            model="text-model",
            usage={},
            provider_cost_microusd=1,
        )

    async def fake_managed(_session: object, **kwargs: Any) -> AiGatewayResult:
        return await kwargs["fallback"]()

    monkeypatch.setattr(
        "hring_api.domains.job_ads.service.resolve_runtime_feature_route",
        fake_route,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_ads.service.generate_with_ai_gateway",
        fake_generate,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_ads.service.generate_with_managed_prompt",
        fake_managed,
    )

    with pytest.raises(SmartAdError, match="تصویر آگهی"):
        asyncio.run(
            _generate_content(
                payload=_payload(),
                principal=SimpleNamespace(user_id=uuid4(), memberships=[]),
                text_credits=5,
                image_credits=20,
                settings=Settings(),
                session=SimpleNamespace(),
            )
        )


def test_image_prompt_changes_materially_with_selected_tone() -> None:
    formal = _image_prompt(_payload().model_copy(update={"tone": "formal"}), "seed-a")
    friendly = _image_prompt(_payload().model_copy(update={"tone": "friendly"}), "seed-b")
    challenge = _image_prompt(_payload().model_copy(update={"tone": "challenge"}), "seed-c")

    assert "formal, executive and trustworthy" in formal
    assert "no cartoon icons" in formal
    assert "warm, welcoming and energetic" in friendly
    assert "clean 3D workplace elements" in friendly
    assert "bold, ambitious and growth-oriented" in challenge
    assert "rocket, chart or upward-motion elements" in challenge
    assert len({formal, friendly, challenge}) == 3


def test_smart_ad_rejects_dimensions_that_do_not_match_format() -> None:
    with pytest.raises(ValidationError):
        SmartAdGenerateRequest.model_validate(
            {
                "jobTitle": "مدیر محصول",
                "companyName": "HRing",
                "contactMethod": "hr@example.com",
                "platform": "instagram",
                "tone": "friendly",
                "generateImage": True,
                "imageFormat": "9:16",
                "imageWidth": 1920,
                "imageHeight": 1080,
            }
        )


def test_smart_ad_route_requires_auth_and_returns_ui_aliases(monkeypatch) -> None:
    async def fake_ad(*_args: object, **_kwargs: object) -> SmartAdResponse:
        return SmartAdResponse(
            generated_text="متن آگهی",
            image_url="data:image/png;base64,aGVsbG8=",
        )

    monkeypatch.setattr(
        "hring_api.domains.job_ads.routes.generate_smart_ad",
        fake_ad,
    )
    payload = _payload().model_dump(by_alias=True)
    with TestClient(app) as client:
        unauthorized = client.post(
            "/api/v1/job-ads/generate",
            json=payload,
            headers={"X-Idempotency-Key": "smart-ad-test-1"},
        )
        assert unauthorized.status_code == 401

        account = _register(client)
        response = client.post(
            "/api/v1/job-ads/generate",
            json=payload,
            headers={
                "Authorization": f"Bearer {account['tokens']['access_token']}",
                "X-Idempotency-Key": "smart-ad-test-2",
            },
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "generatedText": "متن آگهی",
            "imageUrl": "data:image/png;base64,aGVsbG8=",
        }




def test_split_smart_ad_routes_are_independent(monkeypatch) -> None:
    async def fake_text(*_args: object, **_kwargs: object) -> SmartAdResponse:
        return SmartAdResponse(generated_text="متن مستقل", image_url=None)

    async def fake_image(*_args: object, **_kwargs: object) -> SmartAdImageResponse:
        return SmartAdImageResponse(image_url="data:image/png;base64,aGVsbG8=")

    monkeypatch.setattr(
        "hring_api.domains.job_ads.routes.generate_smart_ad",
        fake_text,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_ads.routes.generate_smart_ad_image",
        fake_image,
    )

    payload = _payload().model_dump(by_alias=True)
    with TestClient(app) as client:
        account = _register(client)
        headers = {"Authorization": f"Bearer {account['tokens']['access_token']}"}

        text_response = client.post(
            "/api/v1/job-ads/generate-text",
            json=payload,
            headers={**headers, "X-Idempotency-Key": "smart-ad-text-independent"},
        )
        assert text_response.status_code == 200, text_response.text
        assert text_response.json() == {"generatedText": "متن مستقل"}

        image_response = client.post(
            "/api/v1/job-ads/generate-image",
            json=payload,
            headers={**headers, "X-Idempotency-Key": "smart-ad-image-independent"},
        )
        assert image_response.status_code == 200, image_response.text
        assert image_response.json() == {
            "imageUrl": "data:image/png;base64,aGVsbG8="
        }


def test_smart_ad_history_requires_auth_and_is_owner_scoped() -> None:
    source = inspect.getsource(list_smart_ad_artifacts)
    assert "SmartAdArtifact.owner_user_id == principal.user_id" in source

    with TestClient(app) as client:
        unauthorized = client.get("/api/v1/job-ads/history")
        assert unauthorized.status_code == 401

        account = _register(client)
        response = client.get(
            "/api/v1/job-ads/history",
            headers={"Authorization": f"Bearer {account['tokens']['access_token']}"},
        )
        assert response.status_code == 200, response.text
        assert response.json() == []



def test_smart_ad_asset_is_private_and_owner_scoped(monkeypatch) -> None:
    source = inspect.getsource(get_smart_ad_artifact)
    assert "SmartAdArtifact.id == artifact_id" in source
    assert "SmartAdArtifact.owner_user_id == principal.user_id" in source

    async def missing_artifact(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr(
        "hring_api.domains.job_ads.routes.get_smart_ad_artifact",
        missing_artifact,
    )
    artifact_id = uuid4()
    with TestClient(app) as client:
        unauthorized = client.get(f"/api/v1/job-ads/assets/{artifact_id}")
        assert unauthorized.status_code == 401

        account = _register(client)
        response = client.get(
            f"/api/v1/job-ads/assets/{artifact_id}",
            headers={"Authorization": f"Bearer {account['tokens']['access_token']}"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "تصویر یافت نشد"


def test_smart_ad_asset_streams_private_object(monkeypatch) -> None:
    async def owned_artifact(*_args: object, **_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(storage_path="owner/image.png")

    def fake_read(*_args: object, **_kwargs: object) -> tuple[object, str]:
        return iter([b"private-image"]), "image/png"

    monkeypatch.setattr(
        "hring_api.domains.job_ads.routes.get_smart_ad_artifact",
        owned_artifact,
    )
    monkeypatch.setattr(
        "hring_api.domains.job_ads.routes.read_object",
        fake_read,
    )
    artifact_id = uuid4()
    with TestClient(app) as client:
        account = _register(client)
        response = client.get(
            f"/api/v1/job-ads/assets/{artifact_id}",
            headers={"Authorization": f"Bearer {account['tokens']['access_token']}"},
        )
        assert response.status_code == 200, response.text
        assert response.content == b"private-image"
        assert response.headers["content-type"] == "image/png"
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
