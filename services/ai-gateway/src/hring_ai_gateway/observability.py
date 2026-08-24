from collections.abc import Awaitable, Callable
from time import perf_counter

from fastapi import Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, Counter, Gauge, Histogram
from prometheus_client.exposition import generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Scope


CallNext = Callable[[Request], Awaitable[Response]]

HTTP_REQUESTS = Counter(
    "hring_http_requests_total",
    "Total HRing HTTP requests.",
    ("service", "method", "route", "status"),
)
HTTP_REQUEST_DURATION = Histogram(
    "hring_http_request_duration_seconds",
    "HRing HTTP request duration in seconds.",
    ("service", "method", "route"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 120),
)
HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "hring_http_requests_in_progress",
    "Current in-progress HRing HTTP requests.",
    ("service",),
)


class MetricsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, service: str) -> None:
        super().__init__(app)
        self.service = service

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        if request.url.path == "/metrics":
            return await call_next(request)

        method = request.method.upper()
        started_at = perf_counter()
        status_code = 500
        HTTP_REQUESTS_IN_PROGRESS.labels(service=self.service).inc()
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            route_label = self._route_label(request.scope)
            HTTP_REQUESTS.labels(
                service=self.service,
                method=method,
                route=route_label,
                status=str(status_code),
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                service=self.service,
                method=method,
                route=route_label,
            ).observe(max(0.0, perf_counter() - started_at))
            HTTP_REQUESTS_IN_PROGRESS.labels(service=self.service).dec()

    @staticmethod
    def _route_label(scope: Scope) -> str:
        fastapi_scope = scope.get("fastapi")
        if isinstance(fastapi_scope, dict):
            route_context = fastapi_scope.get("effective_route_context")
            route = getattr(route_context, "path_format", None)
            if isinstance(route, str):
                return route

        route_object = scope.get("route")
        for attribute in ("path_format", "path"):
            route = getattr(route_object, attribute, None)
            if isinstance(route, str):
                return route
        return "unmatched"


def metrics_response() -> Response:
    return Response(
        content=generate_latest(REGISTRY),
        headers={"Content-Type": CONTENT_TYPE_LATEST},
    )
