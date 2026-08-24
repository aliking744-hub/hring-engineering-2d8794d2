from hmac import compare_digest

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Response, status

from hring_ai_gateway.config import GatewaySettings, get_settings
from hring_ai_gateway.observability import MetricsMiddleware, metrics_response
from hring_ai_gateway.providers import (
    ProviderResponseError,
    ProviderUnavailableError,
    enabled_provider_names,
    generate_openai_compatible,
)
from hring_ai_gateway.schemas import GenerateRequest, GenerateResponse, HealthResponse


app = FastAPI(
    title="HRing AI Gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def require_internal_key(
    authorization: str | None = Header(default=None),
    settings: GatewaySettings = Depends(get_settings),
) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    supplied = authorization.removeprefix("Bearer ").strip()
    expected = settings.internal_api_key.get_secret_value()
    if not supplied or not compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@app.get("/health", response_model=HealthResponse)
async def health(settings: GatewaySettings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(enabled_providers=enabled_provider_names(settings))


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> Response:
    return metrics_response()


@app.post(
    "/v1/generate",
    response_model=GenerateResponse,
    dependencies=[Depends(require_internal_key)],
)
async def generate(
    payload: GenerateRequest,
    settings: GatewaySettings = Depends(get_settings),
) -> GenerateResponse:
    try:
        return await generate_openai_compatible(settings=settings, request=payload)
    except ProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Requested AI provider is unavailable",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI provider timed out",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider connection failed",
        ) from exc
    except httpx.HTTPStatusError as exc:
        # Do not proxy provider response bodies: they can contain account or
        # request details that should not cross the internal service boundary.
        upstream_status = exc.response.status_code
        mapped = status.HTTP_429_TOO_MANY_REQUESTS if upstream_status == 429 else status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=mapped, detail="AI provider request failed") from exc
    except ProviderResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider returned an invalid response",
        ) from exc


app.add_middleware(
    MetricsMiddleware,
    service="hring-ai-gateway",
)
