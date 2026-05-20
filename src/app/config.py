from functools import lru_cache
from typing import Annotated

from fastapi import Header, HTTPException, status
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://cashflow:cashflow@postgres:5432/cashflow"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    api_key: str = "local-dev-key"
    queue_name: str = "transaction.created"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


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
