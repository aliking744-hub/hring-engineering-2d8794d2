import asyncio
from uuid import uuid4

from hring_api.config import Settings
from hring_api.domains.ai.gateway_client import AiGatewayResult
from hring_api.domains.recruiting.ai_service import analyze_candidates
from hring_api.domains.recruiting.schemas import CandidateAnalysisInput, JobRequirements


def test_analysis_preserves_source_identity_and_does_not_send_raw_data(monkeypatch) -> None:
    captured_messages: list[dict[str, str]] = []

    async def fake_generate(**kwargs) -> AiGatewayResult:
        captured_messages.extend(kwargs["messages"])
        return AiGatewayResult(
            request_id=uuid4(),
            content=(
                '[{"sourceIndex":1,"name":"SPOOFED","email":"bad@example.com",'
                '"matchScore":99,"candidateTemperature":"hot","layerScores":{},'
                '"redFlags":[],"greenFlags":[],"summary":"B","recommendation":"تماس"},'
                '{"sourceIndex":0,"name":"ALSO SPOOFED","phone":"000",'
                '"matchScore":75,"candidateTemperature":"warm","layerScores":{},'
                '"redFlags":[],"greenFlags":[],"summary":"A","recommendation":"بررسی"}]'
            ),
            provider="test",
            model="test-model",
            usage={"input_tokens": 10, "output_tokens": 5},
            provider_cost_microusd=1,
        )

    monkeypatch.setattr(
        "hring_api.domains.recruiting.ai_service.generate_with_ai_gateway",
        fake_generate,
    )

    result = asyncio.run(
        analyze_candidates(
            candidates=[
                CandidateAnalysisInput(
                    name="Alice Source",
                    email="alice@example.com",
                    phone="09120000001",
                    skills="Python, FastAPI",
                    rawData={"salary": "PRIVATE-SALARY-123"},
                ),
                CandidateAnalysisInput(
                    name="Bob Source",
                    email="bob@example.com",
                    phone="09120000002",
                    skills=["React", "TypeScript"],
                    rawData={"internal_note": "PRIVATE-NOTE-456"},
                ),
            ],
            job=JobRequirements(jobTitle="Engineer", city="Tehran"),
            enable_web_search=False,
            user_id=uuid4(),
            company_id=uuid4(),
            settings=Settings(recruiting_web_enrichment_enabled=False),
        )
    )

    assert [item.match_score for item in result.candidates] == [99, 75]
    assert result.candidates[0].name == "Bob Source"
    assert result.candidates[0].email == "bob@example.com"
    assert result.candidates[0].phone == "09120000002"
    assert result.candidates[0].skills == ["React", "TypeScript"]
    assert result.candidates[1].name == "Alice Source"
    assert result.candidates[1].email == "alice@example.com"
    assert result.candidates[1].phone == "09120000001"
    assert result.candidates[1].skills == ["Python", "FastAPI"]

    provider_payload = "\n".join(message["content"] for message in captured_messages)
    assert "PRIVATE-SALARY-123" not in provider_payload
    assert "PRIVATE-NOTE-456" not in provider_payload
