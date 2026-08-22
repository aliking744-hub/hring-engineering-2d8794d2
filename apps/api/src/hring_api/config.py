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
    public_app_url: str = "http://localhost:5173"
    trusted_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
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
    recruiting_ai_provider: str = "gemini"
    recruiting_ai_model: str = "gemini-2.5-pro"
    recruiting_enrichment_provider: str = "perplexity"
    recruiting_enrichment_model: str = "sonar"
    recruiting_sourcing_webhook_url: SecretStr | None = None
    recruiting_sourcing_webhook_bearer_token: SecretStr | None = None
    recruiting_web_enrichment_enabled: bool = True
    recruiting_analysis_max_candidates: int = Field(default=20, ge=1, le=100)
    recruiting_auto_source_max_candidates: int = Field(default=30, ge=1, le=100)
    cors_origins: list[str] = ["http://localhost:5173"]

    auth_jwt_secret: SecretStr = SecretStr("development-only-change-me")
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_issuer: str = "hring"
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 30
    auth_refresh_cookie_name: str = "hring_refresh"
    auth_refresh_cookie_path: str = "/api/v1/auth"
    auth_refresh_cookie_samesite: str = "lax"
    auth_refresh_cookie_domain: str | None = None
    auth_security_token_pepper: SecretStr = SecretStr(
        "development-security-token-pepper-change-me"
    )
    auth_password_reset_ttl_minutes: int = 30
    auth_email_verify_ttl_hours: int = 24

    sms_provider: str = "disabled"
    sms_otp_pepper: SecretStr = SecretStr("development-sms-otp-pepper-change-me")
    sms_otp_ttl_seconds: int = 120
    sms_otp_max_attempts: int = 5
    sms_otp_resend_cooldown_seconds: int = 60

    email_provider: str = "disabled"
    email_resend_api_key: SecretStr | None = None
    email_from: str = "HRing <noreply@hring.ir>"

    rate_limit_enabled: bool = True
    rate_limit_login_per_minute: int = 12
    rate_limit_register_per_minute: int = 6
    rate_limit_sms_request_per_minute: int = 5
    rate_limit_recovery_per_minute: int = 6

    @model_validator(mode="after")
    def reject_unsafe_production_configuration(self) -> "Settings":
        if self.environment.lower() != "production":
            return self

        insecure_values = {
            "change-me",
            "local-development",
            "development-only-change-me",
            "development-sms-otp-pepper-change-me",
            "development-security-token-pepper-change-me",
        }
        secrets = {
            self.object_storage_secret_key.get_secret_value(),
            self.ai_api_key.get_secret_value(),
            self.auth_jwt_secret.get_secret_value(),
            self.sms_otp_pepper.get_secret_value(),
            self.auth_security_token_pepper.get_secret_value(),
        }
        if secrets & insecure_values:
            raise ValueError("Production secrets must be supplied securely")
        if self.sms_provider.lower() == "development":
            raise ValueError("Development SMS provider is forbidden in production")
        if self.email_provider.lower() == "development":
            raise ValueError("Development email provider is forbidden in production")
        if self.email_provider.lower() == "resend" and self.email_resend_api_key is None:
            raise ValueError("EMAIL_RESEND_API_KEY is required when EMAIL_PROVIDER=resend")
        if "*" in self.cors_origins:
            raise ValueError("Wildcard CORS is forbidden in production")
        if not self.trusted_hosts or "*" in self.trusted_hosts:
            raise ValueError("Explicit trusted hosts are required in production")
        if not self.public_app_url.lower().startswith("https://"):
            raise ValueError("PUBLIC_APP_URL must use HTTPS in production")
        if self.auth_refresh_cookie_samesite.lower() not in {"lax", "strict", "none"}:
            raise ValueError("AUTH_REFRESH_COOKIE_SAMESITE is invalid")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
