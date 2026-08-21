from functools import lru_cache

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class GatewaySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    internal_api_key: SecretStr = SecretStr("development-only-change-me")

    openai_api_key: SecretStr | None = None
    openai_base_url: str = "https://api.openai.com/v1"

    gemini_api_key: SecretStr | None = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"

    perplexity_api_key: SecretStr | None = None
    perplexity_base_url: str = "https://api.perplexity.ai"

    upstream_timeout_seconds: float = 120.0
    upstream_connect_timeout_seconds: float = 10.0

    @model_validator(mode="after")
    def reject_unsafe_production_configuration(self) -> "GatewaySettings":
        if self.environment.lower() != "production":
            return self
        internal = self.internal_api_key.get_secret_value()
        if internal in {"development-only-change-me", "change-me", "local-development"}:
            raise ValueError("AI gateway internal key must be supplied securely in production")
        if not internal or len(internal) < 32:
            raise ValueError("AI gateway internal key must be at least 32 characters")
        return self


@lru_cache
def get_settings() -> GatewaySettings:
    return GatewaySettings()
