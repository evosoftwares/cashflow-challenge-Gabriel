from collections.abc import Callable
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
