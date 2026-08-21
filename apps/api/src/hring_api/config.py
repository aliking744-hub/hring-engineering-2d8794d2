from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "HRing API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(
        default="postgresql+asyncpg://hring:hring@postgres:5432/hring",
        description="Independent PostgreSQL database URL.",
    )
    redis_url: str = "redis://redis:6379/0"
    object_storage_endpoint: str = "http://minio:9000"
    object_storage_bucket: str = "hring-private"
    object_storage_access_key: str = "hring"
    object_storage_secret_key: str = "change-me"
    ai_base_url: str = "http://ai:8000/v1"
    ai_api_key: str = "local-development"
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
