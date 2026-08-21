from uuid import uuid4

from fastapi.testclient import TestClient

from hring_api.config import get_settings
from hring_api.domains.identity import sms_service
from hring_api.main import app


TEST_PHONE = "09121234567"
TEST_OTP = "123456"


def _register(client: TestClient) -> tuple[str, str]:
    email = f"sms-{uuid4()}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct horse battery staple",
            "full_name": "SMS Test User",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["tokens"]["access_token"], email


def test_phone_enrollment_then_sms_login(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "sms_provider", "development")
    monkeypatch.setattr(settings, "sms_otp_resend_cooldown_seconds", 0)
    monkeypatch.setattr(sms_service, "generate_otp_code", lambda: TEST_OTP)

    with TestClient(app) as client:
        access_token, email = _register(client)
        auth_header = {"Authorization": f"Bearer {access_token}"}

        request_verification = client.post(
            "/api/v1/auth/phone/request-verification",
            json={"phone": TEST_PHONE},
            headers=auth_header,
        )
        assert request_verification.status_code == 202, request_verification.text
        verification_challenge = request_verification.json()["challenge_id"]

        verify_phone = client.post(
            "/api/v1/auth/phone/verify",
            json={"challenge_id": verification_challenge, "code": TEST_OTP},
            headers=auth_header,
        )
        assert verify_phone.status_code == 204, verify_phone.text

        request_login = client.post(
            "/api/v1/auth/sms/request",
            json={"phone": "+989121234567"},
        )
        assert request_login.status_code == 202, request_login.text
        login_challenge = request_login.json()["challenge_id"]

        verify_login = client.post(
            "/api/v1/auth/sms/verify",
            json={"challenge_id": login_challenge, "code": TEST_OTP},
        )
        assert verify_login.status_code == 200, verify_login.text
        sms_access_token = verify_login.json()["tokens"]["access_token"]

        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {sms_access_token}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["email"] == email


def test_sms_failed_attempt_limit_is_persisted(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "sms_provider", "development")
    monkeypatch.setattr(settings, "sms_otp_resend_cooldown_seconds", 0)
    monkeypatch.setattr(settings, "sms_otp_max_attempts", 3)
    monkeypatch.setattr(sms_service, "generate_otp_code", lambda: TEST_OTP)

    with TestClient(app) as client:
        access_token, _ = _register(client)
        auth_header = {"Authorization": f"Bearer {access_token}"}

        request_verification = client.post(
            "/api/v1/auth/phone/request-verification",
            json={"phone": "09351234567"},
            headers=auth_header,
        )
        assert request_verification.status_code == 202, request_verification.text
        challenge = request_verification.json()["challenge_id"]

        for _ in range(3):
            wrong = client.post(
                "/api/v1/auth/phone/verify",
                json={"challenge_id": challenge, "code": "000000"},
                headers=auth_header,
            )
            assert wrong.status_code == 401, wrong.text

        blocked = client.post(
            "/api/v1/auth/phone/verify",
            json={"challenge_id": challenge, "code": TEST_OTP},
            headers=auth_header,
        )
        assert blocked.status_code == 401, blocked.text


def test_unknown_phone_request_does_not_disclose_account_existence(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "sms_provider", "development")
    monkeypatch.setattr(settings, "sms_otp_resend_cooldown_seconds", 0)
    monkeypatch.setattr(sms_service, "generate_otp_code", lambda: TEST_OTP)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/sms/request",
            json={"phone": "09991234567"},
        )
        assert response.status_code == 202, response.text
        challenge = response.json()["challenge_id"]

        verify = client.post(
            "/api/v1/auth/sms/verify",
            json={"challenge_id": challenge, "code": TEST_OTP},
        )
        assert verify.status_code == 401, verify.text
