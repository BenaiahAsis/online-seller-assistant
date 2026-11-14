"""Application settings and centralized configuration."""

import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global application settings loaded from environment or defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core Application Metadata
    app_name: str = "Online Seller Assistant API"
    app_version: str = "2.0.0"

    # Database
    database_url: str = os.getenv("DATABASE_URL", "")

    # CORS
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:3000",
    )

    # OpenAI / LLM Model configuration (Single central config setting)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Rate Limiting
    rate_limit_generate_listing: str = os.getenv(
        "RATE_LIMIT_GENERATE_LISTING", "5/minute"
    )


settings = Settings()
