from uuid import uuid4

from fastapi.testclient import TestClient

from hring_api.config import get_settings
from hring_api.domains.identity import recovery_service
from hring_api.main import app


TEST_RESET_TOKEN = "reset-token-for-tests-that-is-long-enough-1234567890"
TEST_VERIFY_TOKEN = "verify-token-for-tests-that-is-long-enough-123456789"
OLD_PASSWORD = "correct horse battery staple"
NEW_PASSWORD = "new correct horse battery staple"


def _register(client: TestClient) -> tuple[str, str]:
    email = f"recovery-{uuid4()}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": OLD_PASSWORD, "full_name": "Recovery User"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["tokens"]["access_token"], email


def _login(client: TestClient, *, email: str, password: str) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_password_reset_changes_password_and_revokes_existing_sessions(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "email_provider", "development")
    monkeypatch.setattr(recovery_service, "generate_security_token", lambda: TEST_RESET_TOKEN)

    with TestClient(app) as client:
        access_token, email = _register(client)
        second_login = _login(client, email=email, password=OLD_PASSWORD)
        second_access = second_login["tokens"]["access_token"]

        forgot = client.post(
            "/api/v1/auth/password/forgot",
            json={"email": email},
        )
        assert forgot.status_code == 202, forgot.text

        reset = client.post(
            "/api/v1/auth/password/reset",
            json={"token": TEST_RESET_TOKEN, "new_password": NEW_PASSWORD},
        )
        assert reset.status_code == 204, reset.text

        old_session = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert old_session.status_code == 401
        second_session = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {second_access}"},
        )
        assert second_session.status_code == 401

        old_password = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": OLD_PASSWORD},
        )
        assert old_password.status_code == 401

        new_password = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": NEW_PASSWORD},
        )
        assert new_password.status_code == 200, new_password.text

        reused_token = client.post(
            "/api/v1/auth/password/reset",
            json={"token": TEST_RESET_TOKEN, "new_password": OLD_PASSWORD},
        )
        assert reused_token.status_code == 400


def test_forgot_password_does_not_disclose_unknown_account(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "email_provider", "development")
    monkeypatch.setattr(recovery_service, "generate_security_token", lambda: TEST_RESET_TOKEN)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/password/forgot",
            json={"email": f"unknown-{uuid4()}@example.com"},
        )
        assert response.status_code == 202, response.text


def test_email_verification_marks_user_verified_without_revoking_session(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "email_provider", "development")
    monkeypatch.setattr(recovery_service, "generate_security_token", lambda: TEST_VERIFY_TOKEN)

    with TestClient(app) as client:
        access_token, _ = _register(client)
        auth_header = {"Authorization": f"Bearer {access_token}"}

        before = client.get("/api/v1/auth/me", headers=auth_header)
        assert before.status_code == 200, before.text
        assert before.json()["email_verified_at"] is None

        request = client.post(
            "/api/v1/auth/email-verification/request",
            headers=auth_header,
        )
        assert request.status_code == 202, request.text

        confirm = client.post(
            "/api/v1/auth/email-verification/confirm",
            json={"token": TEST_VERIFY_TOKEN},
        )
        assert confirm.status_code == 204, confirm.text

        after = client.get("/api/v1/auth/me", headers=auth_header)
        assert after.status_code == 200, after.text
        assert after.json()["email_verified_at"] is not None

        reused = client.post(
            "/api/v1/auth/email-verification/confirm",
            json={"token": TEST_VERIFY_TOKEN},
        )
        assert reused.status_code == 400


def test_change_password_requires_current_password_and_revokes_session() -> None:
    with TestClient(app) as client:
        access_token, email = _register(client)
        auth_header = {"Authorization": f"Bearer {access_token}"}

        wrong = client.post(
            "/api/v1/auth/password/change",
            json={"current_password": "wrong-password", "new_password": NEW_PASSWORD},
            headers=auth_header,
        )
        assert wrong.status_code == 401, wrong.text

        still_authenticated = client.get("/api/v1/auth/me", headers=auth_header)
        assert still_authenticated.status_code == 200, still_authenticated.text

        changed = client.post(
            "/api/v1/auth/password/change",
            json={"current_password": OLD_PASSWORD, "new_password": NEW_PASSWORD},
            headers=auth_header,
        )
        assert changed.status_code == 204, changed.text

        revoked = client.get("/api/v1/auth/me", headers=auth_header)
        assert revoked.status_code == 401

        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": NEW_PASSWORD},
        )
        assert new_login.status_code == 200, new_login.text


def test_session_listing_selective_revoke_and_logout_all() -> None:
    with TestClient(app) as client:
        access_a, email = _register(client)
        login_b = _login(client, email=email, password=OLD_PASSWORD)
        access_b = login_b["tokens"]["access_token"]

        sessions = client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {access_a}"},
        )
        assert sessions.status_code == 200, sessions.text
        items = sessions.json()
        assert len(items) >= 2
        current = [item for item in items if item["is_current"]]
        other = [item for item in items if not item["is_current"] and item["revoked_at"] is None]
        assert len(current) == 1
        assert other

        revoke_b = client.delete(
            f"/api/v1/auth/sessions/{other[0]['id']}",
            headers={"Authorization": f"Bearer {access_a}"},
        )
        assert revoke_b.status_code == 204, revoke_b.text

        b_me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_b}"},
        )
        assert b_me.status_code == 401

        random_session = client.delete(
            f"/api/v1/auth/sessions/{uuid4()}",
            headers={"Authorization": f"Bearer {access_a}"},
        )
        assert random_session.status_code == 404

        logout_all = client.post(
            "/api/v1/auth/logout-all",
            headers={"Authorization": f"Bearer {access_a}"},
        )
        assert logout_all.status_code == 204, logout_all.text

        a_me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_a}"},
        )
        assert a_me.status_code == 401
