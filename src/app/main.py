from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import Session

from src.app.config import Settings, get_settings
from src.app.health import router as health_router
from src.consolidation.routes import create_router as create_consolidation_router
from src.database.connection import SessionLocal, init_db
from src.messaging.publisher import RabbitMQPublisher
from src.transactions.routes import create_router as create_transactions_router


def create_app(
    *,
    settings: Settings | None = None,
    session_factory: Callable[[], Session] | None = None,
    publisher=None,
    initialize_database: bool = True,
) -> FastAPI:
    settings = settings or get_settings()
    session_factory = session_factory or SessionLocal
    publisher = publisher or RabbitMQPublisher(settings)

    lifespan = None
    if initialize_database:
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            init_db()
            yield

    app = FastAPI(
        title="Cash Flow Architecture Challenge",
        version="0.1.0",
        description="Modular cash flow API with asynchronous daily consolidation.",
        lifespan=lifespan,
    )

    app.include_router(health_router)
    app.include_router(create_transactions_router(settings, session_factory, publisher))
    app.include_router(create_consolidation_router(settings, session_factory))
    return app


app = create_app()
