from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.transactions.models import Transaction


class TransactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, transaction: Transaction) -> Transaction:
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def list_by_merchant_and_date(
        self,
        *,
        merchant_id: UUID,
        transaction_date: date,
    ) -> list[Transaction]:
        start = datetime.combine(transaction_date, time.min)
        end = start + timedelta(days=1)
        statement = (
            select(Transaction)
            .where(Transaction.merchant_id == merchant_id)
            .where(Transaction.occurred_at >= start)
            .where(Transaction.occurred_at < end)
            .order_by(Transaction.occurred_at.asc())
        )
        return list(self.db.scalars(statement).all())
