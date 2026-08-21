import hmac
from hashlib import sha256
from secrets import token_urlsafe

from hring_api.config import Settings


def generate_security_token() -> str:
    return token_urlsafe(48)


def hash_security_token(token: str, settings: Settings) -> str:
    key = settings.auth_security_token_pepper.get_secret_value().encode("utf-8")
    return hmac.new(key, token.encode("utf-8"), sha256).hexdigest()
