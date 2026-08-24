from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from hring_api.api.v1.router import api_router
from hring_api.config import get_settings
from hring_api.observability import MetricsMiddleware, metrics_response
from hring_api.security.middleware import (
    SecurityHeadersMiddleware,
    SensitiveRouteRateLimitMiddleware,
)


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    openapi_url="/openapi.json" if settings.environment != "production" else None,
)
app.include_router(api_router, prefix=settings.api_v1_prefix)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[*settings.trusted_hosts, "api"],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Idempotency-Key", "X-Request-ID"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SensitiveRouteRateLimitMiddleware, settings=settings)
app.add_middleware(MetricsMiddleware, service="hring-api")


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> Response:
    return metrics_response()
