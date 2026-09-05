from functools import lru_cache
from urllib.parse import SplitResult, urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_redis_url(value: SecretStr, *, field_name: str) -> SplitResult:
    parsed = urlsplit(value.get_secret_value())
    if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
        raise ValueError(f"{field_name} must be a Redis URL")
    return parsed


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    celery_broker_url: SecretStr = SecretStr("redis://redis:6379/1")
    celery_result_backend: SecretStr = SecretStr("redis://redis:6379/2")
    database_url: str = "postgresql+asyncpg://hring:hring@postgres:5432/hring"
    worker_metrics_host: str = "0.0.0.0"
    worker_metrics_port: int = Field(default=9808, ge=1, le=65_535)
    worker_task_soft_time_limit_seconds: int = Field(default=540, ge=1, le=3_600)
    worker_task_time_limit_seconds: int = Field(default=600, ge=2, le=3_900)
    worker_result_expires_seconds: int = Field(default=3_600, ge=60, le=86_400)
    worker_broker_visibility_timeout_seconds: int = Field(
        default=3_600,
        ge=60,
        le=86_400,
    )

    @model_validator(mode="after")
    def validate_worker_runtime(self) -> "WorkerSettings":
        if self.worker_task_soft_time_limit_seconds >= self.worker_task_time_limit_seconds:
            raise ValueError("Worker soft time limit must be lower than its hard time limit")
        if self.worker_broker_visibility_timeout_seconds <= self.worker_task_time_limit_seconds:
            raise ValueError("Broker visibility timeout must exceed the hard task time limit")

        broker = _parse_redis_url(self.celery_broker_url, field_name="CELERY_BROKER_URL")
        backend = _parse_redis_url(
            self.celery_result_backend,
            field_name="CELERY_RESULT_BACKEND",
        )
        if self.environment.lower() == "production":
            if not broker.password or not backend.password:
                raise ValueError("Production worker Redis URLs must include authentication")
            broker_database = (broker.hostname, broker.port, broker.path.rstrip("/"))
            backend_database = (backend.hostname, backend.port, backend.path.rstrip("/"))
            if broker_database == backend_database:
                raise ValueError("Celery broker and result backend must use separate Redis databases")
        return self


@lru_cache
def get_worker_settings() -> WorkerSettings:
    return WorkerSettings()
