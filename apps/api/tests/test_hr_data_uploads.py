from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from hring_api.main import app


PASSWORD = "correct horse battery staple"


def _register(client: TestClient, prefix: str) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{prefix}-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": prefix,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(account: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['tokens']['access_token']}"}


def test_hr_uploads_are_private_and_the_history_omits_records() -> None:
    with TestClient(app) as client:
        owner = _register(client, "hr-upload-owner")
        other = _register(client, "hr-upload-other")
        payload = {
            "name": "اطلاعات واقعی HR",
            "is_demo": False,
            "records": [{"fullName": "کاربر خصوصی", "department": "منابع انسانی"}],
        }

        created = client.post(
            "/api/v1/hr-data/uploads",
            json=payload,
            headers={**_auth(owner), "X-Idempotency-Key": "test-hr-upload-create"},
        )
        assert created.status_code == 201, created.text
        upload_id = created.json()["id"]
        assert created.json()["records"] == payload["records"]

        history = client.get("/api/v1/hr-data/uploads", headers=_auth(owner))
        assert history.status_code == 200, history.text
        assert history.json()[0]["id"] == upload_id
        assert "records" not in history.json()[0]

        latest = client.get("/api/v1/hr-data/uploads/latest", headers=_auth(owner))
        assert latest.status_code == 200, latest.text
        assert latest.json()["id"] == upload_id

        assert client.get(f"/api/v1/hr-data/uploads/{upload_id}", headers=_auth(other)).status_code == 404
        assert client.delete(f"/api/v1/hr-data/uploads/{upload_id}", headers=_auth(other)).status_code == 404

        assert client.delete(f"/api/v1/hr-data/uploads/{upload_id}", headers=_auth(owner)).status_code == 204
        assert client.get("/api/v1/hr-data/uploads/latest", headers=_auth(owner)).json() is None


def test_hr_upload_payload_has_bounded_record_count_and_size() -> None:
    with TestClient(app) as client:
        account = _register(client, "hr-upload-validation")
        too_many = client.post(
            "/api/v1/hr-data/uploads",
            json={"name": "زیاد", "records": [{"i": index} for index in range(2001)]},
            headers=_auth(account),
        )
        assert too_many.status_code == 422

        oversized = client.post(
            "/api/v1/hr-data/uploads",
            json={"name": "بزرگ", "records": [{"content": "x" * 5_000_001}]},
            headers=_auth(account),
        )
        assert oversized.status_code == 422
