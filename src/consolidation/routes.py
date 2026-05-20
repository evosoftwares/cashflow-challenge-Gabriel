import asyncio
import json
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.app.config import Settings, require_api_key
from src.consolidation.repository import ConsolidationRepository


class DailyBalanceResponse(BaseModel):
    merchant_id: UUID
    date: date
    total_credit: Decimal
    total_debit: Decimal
    balance: Decimal


def _daily_balance_payload(daily_balance) -> dict[str, str]:
    if daily_balance is None:
        return {"status": "pending"}

    return {
        "status": "available",
        "merchant_id": str(daily_balance.merchant_id),
        "date": daily_balance.balance_date.isoformat(),
        "total_credit": str(daily_balance.total_credit),
        "total_debit": str(daily_balance.total_debit),
        "balance": str(daily_balance.balance),
    }


def _sse_event(payload: dict[str, str]) -> str:
    data = json.dumps(payload, separators=(",", ":"))
    return f"event: daily_balance\ndata: {data}\n\n"


def create_router(settings: Settings, session_factory: Callable[[], Session]) -> APIRouter:
    router = APIRouter(tags=["daily-balances"])

    def get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    api_key_dependency = require_api_key(settings)

    @router.get(
        "/daily-balances/{balance_date}/stream",
        dependencies=[Depends(api_key_dependency)],
    )
    async def stream_daily_balance(
        request: Request,
        balance_date: date,
        merchant_id: UUID = Query(...),
        once: bool = Query(False, include_in_schema=False),
    ):
        async def event_generator():
            last_payload: dict[str, str] | None = None
            while not await request.is_disconnected():
                db = session_factory()
                try:
                    repository = ConsolidationRepository(db)
                    daily_balance = repository.get_daily_balance(
                        merchant_id=merchant_id,
                        balance_date=balance_date,
                    )
                    payload = _daily_balance_payload(daily_balance)
                finally:
                    db.close()

                if payload != last_payload:
                    yield _sse_event(payload)
                    last_payload = payload

                if once:
                    break

                await asyncio.sleep(settings.realtime_poll_interval_seconds)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @router.get(
        "/daily-balances/{balance_date}",
        response_model=DailyBalanceResponse,
        dependencies=[Depends(api_key_dependency)],
    )
    def get_daily_balance(
        balance_date: date,
        merchant_id: UUID = Query(...),
        db: Session = Depends(get_db),
    ):
        repository = ConsolidationRepository(db)
        daily_balance = repository.get_daily_balance(
            merchant_id=merchant_id,
            balance_date=balance_date,
        )
        if daily_balance is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Daily balance not found",
            )
        return DailyBalanceResponse(
            merchant_id=daily_balance.merchant_id,
            date=daily_balance.balance_date,
            total_credit=daily_balance.total_credit,
            total_debit=daily_balance.total_debit,
            balance=daily_balance.balance,
        )

    return router
