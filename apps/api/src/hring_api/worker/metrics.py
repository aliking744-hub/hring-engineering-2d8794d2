from celery.signals import heartbeat_sent, worker_ready, worker_shutdown  # type: ignore[import-untyped]
from prometheus_client import Gauge, start_http_server

from hring_api.worker.config import get_worker_settings


WORKER_READY = Gauge(
    "hring_worker_ready",
    "Whether the HRing Celery worker has completed startup.",
)
WORKER_LAST_HEARTBEAT = Gauge(
    "hring_worker_last_heartbeat_timestamp_seconds",
    "Unix timestamp of the latest HRing Celery worker heartbeat.",
)

_handlers_installed = False
_metrics_server: object | None = None


def _handle_worker_ready(sender: object | None = None, **_: object) -> None:
    del sender
    global _metrics_server
    settings = get_worker_settings()
    if _metrics_server is None:
        _metrics_server = start_http_server(
            settings.worker_metrics_port,
            addr=settings.worker_metrics_host,
        )
    WORKER_READY.set(1)
    WORKER_LAST_HEARTBEAT.set_to_current_time()


def _handle_heartbeat(sender: object | None = None, **_: object) -> None:
    del sender
    WORKER_LAST_HEARTBEAT.set_to_current_time()


def _handle_worker_shutdown(sender: object | None = None, **_: object) -> None:
    del sender
    WORKER_READY.set(0)


def install_worker_metrics() -> None:
    global _handlers_installed
    if _handlers_installed:
        return
    worker_ready.connect(_handle_worker_ready, weak=False)
    heartbeat_sent.connect(_handle_heartbeat, weak=False)
    worker_shutdown.connect(_handle_worker_shutdown, weak=False)
    _handlers_installed = True
