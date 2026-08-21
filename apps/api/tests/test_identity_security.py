from uuid import uuid4

import pytest

from hring_api.config import Settings
from hring_api.domains.identity.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


TEST_JWT_SECRET = "unit-test-secret-at-least-32-bytes-long"


def test_password_hash_is_one_way_and_verifiable() -> None:
    encoded = hash_password("correct horse battery staple")

    assert encoded != "correct horse battery staple"
    assert verify_password("correct horse battery staple", encoded)
    assert not verify_password("wrong password", encoded)


def test_access_token_round_trip() -> None:
    settings = Settings(environment="test", auth_jwt_secret=TEST_JWT_SECRET)
    user_id = uuid4()
    session_id = uuid4()

    token, expires_at = create_access_token(
        user_id=user_id,
        session_id=session_id,
        settings=settings,
    )
    claims = decode_access_token(token, settings)

    assert claims.user_id == user_id
    assert claims.session_id == session_id
    assert claims.expires_at == expires_at


def test_invalid_access_token_is_rejected() -> None:
    settings = Settings(environment="test", auth_jwt_secret=TEST_JWT_SECRET)

    with pytest.raises(ValueError, match="Invalid access token"):
        decode_access_token("not-a-token", settings)


def test_refresh_token_hash_does_not_store_plaintext() -> None:
    token = "refresh-token-secret"

    assert hash_refresh_token(token) != token
    assert len(hash_refresh_token(token)) == 64
