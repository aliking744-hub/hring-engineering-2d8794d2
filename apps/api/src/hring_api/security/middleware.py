from collections.abc import Awaitable, Callable
from time import time
from uuid import uuid4

from fastapi import Request, Response, status
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from hring_api.config import Settings


CallNext = Callable[[Request], Awaitable[Response]]


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response


class SensitiveRouteRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, settings: Settings) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.settings = settings
        self.enabled = settings.rate_limit_enabled and settings.environment.lower() != "test"
        self.redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)

        prefix = settings.api_v1_prefix.rstrip("/")
        self.rules: dict[tuple[str, str], tuple[str, int]] = {
            ("POST", f"{prefix}/auth/login"): (
                "login",
                settings.rate_limit_login_per_minute,
            ),
            ("POST", f"{prefix}/auth/register"): (
                "register",
                settings.rate_limit_register_per_minute,
            ),
            ("POST", f"{prefix}/auth/sms/request"): (
                "sms_request",
                settings.rate_limit_sms_request_per_minute,
            ),
            ("POST", f"{prefix}/auth/phone/request-verification"): (
                "sms_enrollment",
                settings.rate_limit_sms_request_per_minute,
            ),
            ("POST", f"{prefix}/auth/password/forgot"): (
                "password_forgot",
                settings.rate_limit_recovery_per_minute,
            ),
            ("POST", f"{prefix}/auth/password/reset"): (
                "password_reset",
                settings.rate_limit_recovery_per_minute,
            ),
            ("POST", f"{prefix}/auth/email-verification/confirm"): (
                "email_verify",
                settings.rate_limit_recovery_per_minute,
            ),
        }

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        if not self.enabled:
            return await call_next(request)

        rule = self.rules.get((request.method.upper(), request.url.path))
        if rule is None:
            return await call_next(request)

        route_key, limit = rule
        client_ip = self._client_ip(request)
        window = int(time() // 60)
        key = f"hring:rate:{route_key}:{client_ip}:{window}"

        try:
            current = await self.redis.incr(key)
            if current == 1:
                await self.redis.expire(key, 75)
        except RedisError:
            # Authentication brute-force protection is security-critical in
            # production; do not silently bypass it if the rate-limit store is down.
            if self.settings.environment.lower() == "production":
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "Authentication protection temporarily unavailable"},
                    headers={"Retry-After": "30"},
                )
            return await call_next(request)

        if current > limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests"},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)

    @staticmethod
    def _client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()[:64]
        if request.client:
            return request.client.host[:64]
        return "unknown"
