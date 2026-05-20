from collections.abc import Callable
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.app.config import Settings, require_api_key
from src.transactions.repository import TransactionRepository
from src.transactions.schemas import (
    TransactionCreate,
    TransactionListItem,
    TransactionResponse,
)
from src.transactions.service import create_transaction


def create_router(settings: Settings, session_factory: Callable[[], Session]) -> APIRouter:
    router = APIRouter(tags=["transactions"])

    def get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    api_key_dependency = require_api_key(settings)

    @router.post(
        "/transactions",
        status_code=status.HTTP_201_CREATED,
        response_model=TransactionResponse,
        dependencies=[Depends(api_key_dependency)],
    )
    def post_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
        transaction = create_transaction(db, payload)

        return TransactionResponse(
            id=transaction.id,
            merchant_id=transaction.merchant_id,
            type=transaction.type,
            amount=transaction.amount,
            status="CREATED",
        )

    @router.get(
        "/transactions",
        response_model=list[TransactionListItem],
        dependencies=[Depends(api_key_dependency)],
    )
    def list_transactions(
        merchant_id: UUID = Query(...),
        date: date = Query(...),
        db: Session = Depends(get_db),
    ):
        repository = TransactionRepository(db)
        transactions = repository.list_by_merchant_and_date(
            merchant_id=merchant_id,
            transaction_date=date,
        )
        return [
            TransactionListItem(
                id=transaction.id,
                merchant_id=transaction.merchant_id,
                type=transaction.type,
                amount=transaction.amount,
                description=transaction.description,
                occurred_at=transaction.occurred_at,
                created_at=transaction.created_at,
            )
            for transaction in transactions
        ]

    return router
