from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.consolidation.models import DailyBalance, ProcessedEvent


class ConsolidationRepository:
    def __init__(self, db: Session):
        self.db = db

    def has_processed_event(self, event_id: UUID) -> bool:
        return self.db.get(ProcessedEvent, event_id) is not None

    def get_daily_balance(self, *, merchant_id: UUID, balance_date: date) -> DailyBalance | None:
        statement = (
            select(DailyBalance)
            .where(DailyBalance.merchant_id == merchant_id)
            .where(DailyBalance.balance_date == balance_date)
        )
        return self.db.scalars(statement).one_or_none()

    def apply_amount(
        self,
        *,
        merchant_id: UUID,
        balance_date: date,
        transaction_type: str,
        amount: Decimal,
    ) -> DailyBalance:
        balance = self.get_daily_balance(
            merchant_id=merchant_id,
            balance_date=balance_date,
        )
        if balance is None:
            balance = DailyBalance(
                id=uuid4(),
                merchant_id=merchant_id,
                balance_date=balance_date,
                total_credit=Decimal("0.00"),
                total_debit=Decimal("0.00"),
                balance=Decimal("0.00"),
            )
            self.db.add(balance)

        if transaction_type == "CREDIT":
            balance.total_credit += amount
            balance.balance += amount
        elif transaction_type == "DEBIT":
            balance.total_debit += amount
            balance.balance -= amount
        else:
            raise ValueError(f"Unsupported transaction_type: {transaction_type}")

        return balance

    def mark_event_processed(self, *, event_id: UUID, transaction_id: UUID) -> None:
        self.db.add(
            ProcessedEvent(
                event_id=event_id,
                transaction_id=transaction_id,
            )
        )
