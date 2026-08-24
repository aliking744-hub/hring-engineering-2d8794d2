from hring_api.worker.app import celery_app


@celery_app.task(  # type: ignore[untyped-decorator]
    name="hring.worker.healthcheck",
    ignore_result=False,
)
def worker_healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "hring-worker"}
