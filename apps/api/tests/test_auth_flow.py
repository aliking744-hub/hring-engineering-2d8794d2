from uuid import uuid4

from fastapi.testclient import TestClient

from hring_api.main import app


def test_register_refresh_logout_revokes_session() -> None:
    email = f"identity-{uuid4()}@example.com"
    password = "correct horse battery staple"

    with TestClient(app) as client:
        register_response = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "full_name": "Test User"},
        )
        assert register_response.status_code == 201, register_response.text
        registered = register_response.json()
        access_token = registered["tokens"]["access_token"]
        refresh_token = registered["tokens"]["refresh_token"]

        me_response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_response.status_code == 200, me_response.text
        assert me_response.json()["email"] == email

        duplicate_response = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password},
        )
        assert duplicate_response.status_code == 409

        refresh_response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_response.status_code == 200, refresh_response.text
        refreshed = refresh_response.json()
        next_access_token = refreshed["tokens"]["access_token"]
        next_refresh_token = refreshed["tokens"]["refresh_token"]
        assert next_refresh_token != refresh_token

        replay_response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert replay_response.status_code == 401

        logout_response = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": next_refresh_token},
        )
        assert logout_response.status_code == 204, logout_response.text

        revoked_me_response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {next_access_token}"},
        )
        assert revoked_me_response.status_code == 401


def test_login_rejects_invalid_password() -> None:
    email = f"login-{uuid4()}@example.com"
    password = "correct horse battery staple"

    with TestClient(app) as client:
        register_response = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password},
        )
        assert register_response.status_code == 201, register_response.text

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "definitely-wrong"},
        )
        assert login_response.status_code == 401
