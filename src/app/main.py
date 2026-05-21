import logging
from collections.abc import Callable
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from src.app.config import Settings, get_settings
from src.app.health import router as health_router
from src.app.metrics import router as metrics_router
from src.app.observability import (
    CORRELATION_ID_HEADER,
    configure_logging,
    metrics_registry,
    record_counter,
    resolve_correlation_id,
)
from src.consolidation.routes import create_router as create_consolidation_router
from src.database.connection import SessionLocal
from src.transactions.routes import create_router as create_transactions_router

logger = logging.getLogger(__name__)


def create_app(
    *,
    settings: Settings | None = None,
    session_factory: Callable[[], Session] | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    session_factory = session_factory or SessionLocal
    configure_logging()
    metrics_registry.reset()

    app = FastAPI(
        title="Cash Flow Architecture Challenge",
        version="0.1.0",
        description="Modular cash flow API with asynchronous daily consolidation.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key", CORRELATION_ID_HEADER],
        expose_headers=[CORRELATION_ID_HEADER],
    )

    @app.middleware("http")
    async def observability_middleware(request: Request, call_next):
        correlation_id = resolve_correlation_id(request.headers.get(CORRELATION_ID_HEADER))
        request.state.correlation_id = correlation_id
        started_at = perf_counter()
        response = await call_next(request)
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        labels = {
            "method": request.method,
            "path": path,
            "status": str(response.status_code),
        }
        record_counter(
            logger,
            event="http_request_completed",
            component="api",
            metric_name="cashflow_http_requests_total",
            metric_labels=labels,
            method=request.method,
            path=path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
        )
        metrics_registry.increment_counter(
            "cashflow_http_request_duration_ms_sum",
            labels,
            duration_ms,
        )
        return response

    app.include_router(health_router)
    app.include_router(metrics_router)
    app.include_router(create_transactions_router(settings, session_factory))
    app.include_router(create_consolidation_router(settings, session_factory))
    return app


app = create_app()
