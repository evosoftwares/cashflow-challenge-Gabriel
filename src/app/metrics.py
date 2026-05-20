from fastapi import APIRouter, Response

from src.app.observability import metrics_registry

router = APIRouter()


@router.get("/metrics", include_in_schema=False)
def metrics():
    return Response(
        content=metrics_registry.render_prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
