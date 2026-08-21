import hmac
import re
from hashlib import sha256
from secrets import randbelow

from hring_api.config import Settings


IRAN_MOBILE_RE = re.compile(r"^\+989\d{9}$")


def normalize_phone_e164(value: str) -> str:
    phone = re.sub(r"[\s\-()]+", "", value.strip())
    if phone.startswith("0098"):
        phone = "+98" + phone[4:]
    elif phone.startswith("98") and not phone.startswith("+98"):
        phone = "+" + phone
    elif phone.startswith("09"):
        phone = "+98" + phone[1:]

    if not IRAN_MOBILE_RE.fullmatch(phone):
        raise ValueError("Unsupported or invalid mobile number")
    return phone


def generate_otp_code() -> str:
    return f"{randbelow(1_000_000):06d}"


def hash_otp_code(*, challenge_id: str, code: str, settings: Settings) -> str:
    message = f"{challenge_id}:{code}".encode("utf-8")
    key = settings.sms_otp_pepper.get_secret_value().encode("utf-8")
    return hmac.new(key, message, sha256).hexdigest()


def verify_otp_code(*, challenge_id: str, code: str, expected_hash: str, settings: Settings) -> bool:
    candidate = hash_otp_code(challenge_id=challenge_id, code=code, settings=settings)
    return hmac.compare_digest(candidate, expected_hash)
