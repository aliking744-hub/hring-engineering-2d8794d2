import inspect
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from hring_api.domains.job_engineering.schemas import JobProfileResponse
from hring_api.domains.workspace_outputs.service import (
    delete_workspace_output,
    list_workspace_outputs,
)
from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"workspace-history-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": "Workspace History Test",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_workspace_history_requires_auth_and_is_owner_scoped() -> None:
    list_source = inspect.getsource(list_workspace_outputs)
    delete_source = inspect.getsource(delete_workspace_output)
    assert "WorkspaceOutput.owner_user_id == principal.user_id" in list_source
    assert "WorkspaceOutput.owner_user_id == principal.user_id" in delete_source

    with TestClient(app) as client:
        unauthorized = client.get(
            "/api/v1/workspace/outputs?featureKey=interview.kit"
        )
        assert unauthorized.status_code == 401

        account = _register(client)
        headers = {"Authorization": f"Bearer {account['tokens']['access_token']}"}
        response = client.get(
            "/api/v1/workspace/outputs?featureKey=interview.kit",
            headers=headers,
        )
        assert response.status_code == 200, response.text
        assert response.json() == []


def test_workspace_history_delete_does_not_leak_missing_or_foreign_rows() -> None:
    with TestClient(app) as client:
        account = _register(client)
        response = client.delete(
            f"/api/v1/workspace/outputs/{uuid4()}",
            headers={"Authorization": f"Bearer {account['tokens']['access_token']}"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "خروجی یافت نشد"


def test_job_profile_generation_persists_one_idempotent_history_row(monkeypatch) -> None:
    async def fake_generate(*_args: object, **_kwargs: object) -> JobProfileResponse:
        return JobProfileResponse(content="## ماموریت شغل\nیک پروفایل شغلی آزمایشی")

    monkeypatch.setattr(
        "hring_api.domains.job_engineering.routes.generate_job_profile",
        fake_generate,
    )
    payload = {
        "jobTitle": "مدیر محصول",
        "industry": "فناوری",
        "seniorityLevel": "manager",
        "companyName": "شرکت آزمایشی",
    }
    with TestClient(app) as client:
        account = _register(client)
        headers = {
            "Authorization": f"Bearer {account['tokens']['access_token']}",
            "X-Idempotency-Key": "workspace-history-idempotent-job-profile",
        }
        first = client.post(
            "/api/v1/job-engineering/job-profiles/generate",
            json=payload,
            headers=headers,
        )
        second = client.post(
            "/api/v1/job-engineering/job-profiles/generate",
            json=payload,
            headers=headers,
        )
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text

        history = client.get(
            "/api/v1/workspace/outputs?featureKey=job_engineering.job_profile",
            headers={"Authorization": headers["Authorization"]},
        )
        assert history.status_code == 200, history.text
        rows = history.json()
        assert len(rows) == 1
        assert rows[0]["title"] == "مدیر محصول"
        assert rows[0]["payload"]["content"].startswith("## ماموریت شغل")
