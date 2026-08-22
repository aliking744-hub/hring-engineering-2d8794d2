from __future__ import annotations

import asyncio
import base64
import hashlib
import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

from cryptography.fernet import Fernet, InvalidToken

from hring_api.config import Settings


class IntegrationSecurityError(ValueError):
    pass


class ProviderSecretCipher:
    def __init__(self, settings: Settings) -> None:
        configured = settings.integration_secret_encryption_key
        raw_key = configured.get_secret_value().strip() if configured is not None else ""
        if raw_key:
            key = raw_key.encode("ascii")
            try:
                Fernet(key)
            except (ValueError, TypeError) as exc:
                raise IntegrationSecurityError(
                    "INTEGRATION_SECRET_ENCRYPTION_KEY must be a valid Fernet key"
                ) from exc
        else:
            pepper = settings.auth_security_token_pepper.get_secret_value().encode("utf-8")
            key = base64.urlsafe_b64encode(
                hashlib.sha256(b"hring-integration-secrets-v1\0" + pepper).digest()
            )
        self._fernet = Fernet(key)

    def encrypt(self, value: str) -> str:
        if not value:
            raise IntegrationSecurityError("Provider secret must not be empty")
        return self._fernet.encrypt(value.encode("utf-8")).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")
        except (InvalidToken, UnicodeError, ValueError) as exc:
            raise IntegrationSecurityError("Stored provider secret cannot be decrypted") from exc

    @staticmethod
    def hint(value: str) -> str:
        suffix = value[-4:] if len(value) >= 4 else value[-1:]
        return f"••••{suffix}"


def normalize_provider_base_url(
    value: str | None,
    *,
    is_internal: bool,
    allowed_internal_hosts: list[str],
) -> str | None:
    if value is None or not value.strip():
        return None

    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise IntegrationSecurityError("Provider base URL must be an HTTP(S) URL")
    if parsed.username or parsed.password:
        raise IntegrationSecurityError("Credentials are forbidden in provider URLs")
    if parsed.query or parsed.fragment:
        raise IntegrationSecurityError("Query strings and fragments are forbidden in provider URLs")

    host = parsed.hostname.lower().rstrip(".")
    try:
        parsed_port = parsed.port
    except ValueError as exc:
        raise IntegrationSecurityError("Provider URL contains an invalid port") from exc
    rendered_host = f"[{host}]" if ":" in host else host
    port = f":{parsed_port}" if parsed_port is not None else ""
    if is_internal:
        allowed = {item.lower().rstrip(".") for item in allowed_internal_hosts}
        if host not in allowed:
            raise IntegrationSecurityError("Internal provider host is not allowlisted")
    else:
        if parsed.scheme != "https":
            raise IntegrationSecurityError("External provider URLs must use HTTPS")
        if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
            raise IntegrationSecurityError("Local hostnames are forbidden for external providers")
        try:
            literal_ip = ipaddress.ip_address(host)
        except ValueError:
            literal_ip = None
        if literal_ip is not None and not literal_ip.is_global:
            raise IntegrationSecurityError("Private or reserved IPs are forbidden")

    normalized_path = parsed.path.rstrip("/")
    return urlunsplit(
        (parsed.scheme.lower(), f"{rendered_host}{port}", normalized_path, "", "")
    )


async def assert_provider_host_is_safe(
    base_url: str,
    *,
    is_internal: bool,
    allowed_internal_hosts: list[str],
) -> None:
    parsed = urlsplit(base_url)
    host = parsed.hostname
    if host is None:
        raise IntegrationSecurityError("Provider URL has no hostname")
    if is_internal:
        allowed = {item.lower().rstrip(".") for item in allowed_internal_hosts}
        if host.lower().rstrip(".") not in allowed:
            raise IntegrationSecurityError("Internal provider host is not allowlisted")
        return

    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo,
            host,
            parsed.port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise IntegrationSecurityError("Provider hostname could not be resolved") from exc

    addresses = {str(info[4][0]) for info in infos}
    if not addresses:
        raise IntegrationSecurityError("Provider hostname resolved to no address")
    if any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise IntegrationSecurityError("Provider hostname resolves to a private or reserved IP")


def assert_no_secrets_in_metadata(value: object, *, path: str = "settings") -> None:
    sensitive_names = {
        "api_key",
        "apikey",
        "secret",
        "password",
        "access_token",
        "bearer_token",
        "merchant_id",
        "credential",
        "credentials",
    }
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = str(key).strip().lower().replace("-", "_")
            if normalized in sensitive_names:
                raise IntegrationSecurityError(
                    f"Sensitive field '{path}.{key}' must be stored in the secret field"
                )
            assert_no_secrets_in_metadata(nested, path=f"{path}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            assert_no_secrets_in_metadata(nested, path=f"{path}[{index}]")
