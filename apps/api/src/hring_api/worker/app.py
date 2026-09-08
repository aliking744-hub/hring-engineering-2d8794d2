from celery import Celery  # type: ignore[import-untyped]
from celery.schedules import crontab  # type: ignore[import-untyped]
from kombu import Exchange, Queue  # type: ignore[import-untyped]

from hring_api.worker.config import get_worker_settings
from hring_api.worker.metrics import install_worker_metrics


DEFAULT_QUEUE = "hring.default"
AI_QUEUE = "hring.ai"
NOTIFICATIONS_QUEUE = "hring.notifications"
MAINTENANCE_QUEUE = "hring.maintenance"
WORKER_QUEUES = (DEFAULT_QUEUE, AI_QUEUE, NOTIFICATIONS_QUEUE, MAINTENANCE_QUEUE)

settings = get_worker_settings()
celery_app = Celery(
    "hring",
    broker=settings.celery_broker_url.get_secret_value(),
    backend=settings.celery_result_backend.get_secret_value(),
    include=("hring_api.worker.tasks",),
)
celery_app.conf.update(
    accept_content=("json",),
    broker_connection_retry_on_startup=True,
    broker_transport_options={
        "global_keyprefix": "hring:broker:",
        "health_check_interval": 30,
        "visibility_timeout": settings.worker_broker_visibility_timeout_seconds,
    },
    enable_utc=True,
    result_backend_transport_options={"global_keyprefix": "hring:result:"},
    result_expires=settings.worker_result_expires_seconds,
    result_serializer="json",
    task_acks_late=True,
    task_default_exchange=DEFAULT_QUEUE,
    task_default_exchange_type="direct",
    task_default_queue=DEFAULT_QUEUE,
    task_default_routing_key=DEFAULT_QUEUE,
    task_ignore_result=True,
    task_publish_retry=True,
    task_publish_retry_policy={"interval_start": 0, "interval_step": 0.5, "interval_max": 2, "max_retries": 3},
    task_queues=tuple(
        Queue(name, Exchange(name, type="direct", durable=True), routing_key=name, durable=True)
        for name in WORKER_QUEUES
    ),
    task_reject_on_worker_lost=True,
    task_routes={
        "hring.worker.healthcheck": {"queue": MAINTENANCE_QUEUE, "routing_key": MAINTENANCE_QUEUE},
        "hring.legal.sync_sources": {"queue": MAINTENANCE_QUEUE, "routing_key": MAINTENANCE_QUEUE},
        "hring.billing.refresh_exchange_rate": {"queue": MAINTENANCE_QUEUE, "routing_key": MAINTENANCE_QUEUE},
    },
    task_send_sent_event=True,
    task_serializer="json",
    task_soft_time_limit=settings.worker_task_soft_time_limit_seconds,
    task_store_errors_even_if_ignored=True,
    task_time_limit=settings.worker_task_time_limit_seconds,
    task_track_started=True,
    timezone="UTC",
    worker_cancel_long_running_tasks_on_connection_loss=True,
    worker_enable_remote_control=True,
    worker_prefetch_multiplier=1,
    worker_send_task_events=True,
)

celery_app.conf.beat_schedule = {
    "daily-legal-source-sync": {
        "task": "hring.legal.sync_sources",
        "schedule": crontab(hour=0, minute=0),
    },
    "daily-exchange-rate-refresh": {
        "task": "hring.billing.refresh_exchange_rate",
        "schedule": crontab(hour=5, minute=0),
    },
}

install_worker_metrics()
