from functools import lru_cache
from typing import Annotated

from fastapi import Header, HTTPException, status
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://cashflow:cashflow@postgres:5432/cashflow"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    api_key: str = "local-dev-key"
    queue_name: str = "transaction.created"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    realtime_poll_interval_seconds: float = 2.0
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_timeout: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def require_api_key(settings: Settings):
    def dependency(x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None):
        if x_api_key != settings.api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing API key",
            )

    return dependency
