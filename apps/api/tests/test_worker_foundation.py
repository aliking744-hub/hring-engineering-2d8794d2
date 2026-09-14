import asyncio

import pytest
from pydantic import ValidationError

import hring_api.worker.tasks as worker_tasks
from hring_api.worker.app import MAINTENANCE_QUEUE, WORKER_QUEUES, celery_app
from hring_api.worker.config import WorkerSettings
from hring_api.worker.tasks import _run_async, generate_content_article_task, worker_healthcheck


def test_worker_uses_durable_isolated_json_queues() -> None:
    queues = {queue.name: queue for queue in celery_app.conf.task_queues}

    assert set(queues) == set(WORKER_QUEUES)
    assert all(queue.durable for queue in queues.values())
    assert tuple(celery_app.conf.accept_content) == ("json",)
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.task_reject_on_worker_lost is True
    assert celery_app.conf.task_routes["hring.worker.healthcheck"]["queue"] == MAINTENANCE_QUEUE
    assert celery_app.conf.task_routes["hring.legal.sync_sources"]["queue"] == MAINTENANCE_QUEUE
    assert celery_app.conf.beat_schedule["daily-legal-source-sync"]["task"] == (
        "hring.legal.sync_sources"
    )


def test_worker_reuses_one_event_loop_across_sequential_tasks() -> None:
    async def loop_id() -> int:
        return id(asyncio.get_running_loop())

    worker_tasks._worker_event_loop = None
    worker_tasks._worker_event_loop_pid = None
    try:
        first = _run_async(loop_id())
        second = _run_async(loop_id())
        assert first == second
    finally:
        if worker_tasks._worker_event_loop is not None:
            worker_tasks._worker_event_loop.close()
        worker_tasks._worker_event_loop = None
        worker_tasks._worker_event_loop_pid = None


def test_worker_health_task_runs_without_external_side_effects() -> None:
    result = worker_healthcheck.apply()

    assert result.successful()
    assert result.result == {"status": "ok", "service": "hring-worker"}


def test_failed_content_result_is_returned_without_celery_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(awaitable):  # type: ignore[no-untyped-def]
        awaitable.close()
        return {"status": "failed", "run_id": "run-1", "article_id": None}

    monkeypatch.setattr(worker_tasks, "_run_async", fake_run)
    result = generate_content_article_task.apply(
        kwargs={"slot_key": "manual:test", "trigger": "manual", "force": True}
    )

    assert result.successful()
    assert result.result["status"] == "failed"


def test_production_worker_requires_authenticated_isolated_redis_databases() -> None:
    with pytest.raises(ValidationError):
        WorkerSettings(
            environment="production",
            celery_broker_url="redis://redis:6379/1",
            celery_result_backend="redis://redis:6379/2",
        )

    with pytest.raises(ValidationError):
        WorkerSettings(
            environment="production",
            celery_broker_url="redis://:secret@redis:6379/1",
            celery_result_backend="redis://:secret@redis:6379/1",
        )

    settings = WorkerSettings(
        environment="production",
        celery_broker_url="redis://:secret@redis:6379/1",
        celery_result_backend="redis://:secret@redis:6379/2",
    )
    assert settings.worker_metrics_port == 9808

