import base64
import hashlib
import hmac
import secrets
import struct
from datetime import UTC, datetime
from urllib.parse import quote, urlencode

from cryptography.fernet import Fernet, InvalidToken

from hring_api.config import Settings


TOTP_PERIOD_SECONDS = 30
TOTP_DIGITS = 6


class MfaSecretDecryptionError(ValueError):
    pass


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def encrypt_totp_secret(secret: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_totp_secret(ciphertext: str, settings: Settings) -> str:
    try:
        return _fernet(settings).decrypt(ciphertext.encode("ascii")).decode("ascii")
    except (InvalidToken, UnicodeDecodeError) as exc:
        raise MfaSecretDecryptionError("MFA secret cannot be decrypted") from exc


def generate_totp_code(secret: str, *, at: datetime | None = None) -> str:
    timestamp = int((at or datetime.now(UTC)).timestamp())
    return _totp_code_for_step(secret, timestamp // TOTP_PERIOD_SECONDS)


def match_totp_step(
    secret: str,
    code: str,
    *,
    at: datetime | None = None,
    window: int = 1,
    after_step: int | None = None,
) -> int | None:
    if len(code) != TOTP_DIGITS or not code.isdigit():
        return None
    timestamp = int((at or datetime.now(UTC)).timestamp())
    current_step = timestamp // TOTP_PERIOD_SECONDS
    for offset in range(-window, window + 1):
        step = current_step + offset
        if after_step is not None and step <= after_step:
            continue
        if hmac.compare_digest(_totp_code_for_step(secret, step), code):
            return step
    return None


def build_totp_uri(*, secret: str, account_name: str, issuer: str) -> str:
    label = quote(f"{issuer}:{account_name}", safe="")
    query = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": str(TOTP_DIGITS),
            "period": str(TOTP_PERIOD_SECONDS),
        }
    )
    return f"otpauth://totp/{label}?{query}"


def generate_recovery_codes(count: int) -> list[str]:
    codes: list[str] = []
    for _ in range(count):
        raw = base64.b32encode(secrets.token_bytes(10)).decode("ascii").rstrip("=")
        codes.append("-".join(raw[index : index + 4] for index in range(0, 16, 4)))
    return codes


def hash_recovery_code(code: str, settings: Settings) -> str:
    normalized = code.replace("-", "").replace(" ", "").upper()
    return hmac.new(
        _derived_key(settings, b"recovery-code"),
        normalized.encode("ascii", errors="ignore"),
        hashlib.sha256,
    ).hexdigest()


def hash_login_identifier(email: str, settings: Settings) -> str:
    return hmac.new(
        _derived_key(settings, b"login-identifier"),
        email.strip().lower().encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _totp_code_for_step(secret: str, step: int) -> str:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode((secret + padding).upper(), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10**TOTP_DIGITS)).zfill(TOTP_DIGITS)


def _fernet(settings: Settings) -> Fernet:
    key = base64.urlsafe_b64encode(_derived_key(settings, b"totp-secret"))
    return Fernet(key)


def _derived_key(settings: Settings, purpose: bytes) -> bytes:
    raw = settings.auth_mfa_encryption_key.get_secret_value().encode("utf-8")
    return hashlib.sha256(b"hring:mfa:v1:" + purpose + b":" + raw).digest()
