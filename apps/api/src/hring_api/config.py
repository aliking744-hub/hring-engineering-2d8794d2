from functools import lru_cache

from pydantic import Field, SecretStr, model_validator
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
    object_storage_secret_key: SecretStr = SecretStr("change-me")
    ai_base_url: str = "http://ai:8000/v1"
    ai_api_key: SecretStr = SecretStr("local-development")
    cors_origins: list[str] = ["http://localhost:5173"]

    auth_jwt_secret: SecretStr = SecretStr("development-only-change-me")
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_issuer: str = "hring"
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 30

    @model_validator(mode="after")
    def reject_default_production_secrets(self) -> "Settings":
        if self.environment.lower() != "production":
            return self

        insecure_values = {
            "change-me",
            "local-development",
            "development-only-change-me",
        }
        secrets = {
            self.object_storage_secret_key.get_secret_value(),
            self.ai_api_key.get_secret_value(),
            self.auth_jwt_secret.get_secret_value(),
        }
        if secrets & insecure_values:
            raise ValueError("Production secrets must be supplied securely")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
