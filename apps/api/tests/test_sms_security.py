import pytest

from hring_api.config import Settings
from hring_api.domains.identity.sms_security import (
    hash_otp_code,
    normalize_phone_e164,
    verify_otp_code,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("09121234567", "+989121234567"),
        ("989121234567", "+989121234567"),
        ("00989121234567", "+989121234567"),
        ("+98 912 123 4567", "+989121234567"),
    ],
)
def test_normalize_iran_mobile(raw: str, expected: str) -> None:
    assert normalize_phone_e164(raw) == expected


def test_invalid_mobile_is_rejected() -> None:
    with pytest.raises(ValueError):
        normalize_phone_e164("02112345678")


def test_otp_hash_is_challenge_bound_and_constant_time_verifiable() -> None:
    settings = Settings(
        environment="test",
        sms_otp_pepper="unit-test-sms-pepper-at-least-32-bytes",
    )
    expected = hash_otp_code(challenge_id="challenge-a", code="123456", settings=settings)

    assert expected != "123456"
    assert verify_otp_code(
        challenge_id="challenge-a",
        code="123456",
        expected_hash=expected,
        settings=settings,
    )
    assert not verify_otp_code(
        challenge_id="challenge-b",
        code="123456",
        expected_hash=expected,
        settings=settings,
    )
