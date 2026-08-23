"""Runtime configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with development-safe defaults."""

    app_name: str = "Nexus API"
    app_version: str = "0.1.0"
    debug: bool = False
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    database_url: str = "sqlite:///./data/nexus.db"
    upload_dir: str = "./data/uploads"
    max_upload_size_mb: int = 50
    gemini_api_key: str | None = None
    openai_api_key: str | None = None

    # JWT Authentication Security Settings
    secret_key: str = "39fbc8b609c13b35ebde214b7e923e4c41ef5e6b1897c8d91c13d8097b6a12df"  # Generate random key in prod
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    system_api_key: str = "nexus_secret_service_api_key_123"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured CORS origins as a cleaned list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def storage_path(self) -> Path:
        """Return the resolved local directory used for uploaded files."""
        return Path(self.upload_dir).resolve()


@lru_cache
def get_settings() -> Settings:
    """Create settings once per application process."""
    return Settings()
