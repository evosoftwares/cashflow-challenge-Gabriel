from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from src.consolidation.models import DailyBalance, ProcessedEvent


class ConsolidationRepository:
    def __init__(self, db: Session):
        self.db = db

    def has_processed_event(self, event_id: UUID) -> bool:
        return self.db.get(ProcessedEvent, event_id) is not None

    def _insert_for_dialect(self, table):
        dialect_name = self.db.get_bind().dialect.name
        if dialect_name == "postgresql":
            return postgres_insert(table)
        if dialect_name == "sqlite":
            return sqlite_insert(table)
        return None

    def try_mark_event_processed(self, *, event_id: UUID, transaction_id: UUID) -> bool:
        insert_statement = self._insert_for_dialect(ProcessedEvent)
        if insert_statement is None:
            if self.has_processed_event(event_id):
                return False
            self.mark_event_processed(event_id=event_id, transaction_id=transaction_id)
            return True

        statement = (
            insert_statement.values(event_id=event_id, transaction_id=transaction_id)
            .on_conflict_do_nothing(index_elements=["event_id"])
            .returning(ProcessedEvent.event_id)
        )
        result = self.db.execute(statement)
        return result.scalar_one_or_none() is not None

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
        if transaction_type == "CREDIT":
            total_credit_delta = amount
            total_debit_delta = Decimal("0.00")
            balance_delta = amount
        elif transaction_type == "DEBIT":
            total_credit_delta = Decimal("0.00")
            total_debit_delta = amount
            balance_delta = -amount
        else:
            raise ValueError(f"Unsupported transaction_type: {transaction_type}")

        insert_statement = self._insert_for_dialect(DailyBalance)
        if insert_statement is None:
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
            balance.total_credit += total_credit_delta
            balance.total_debit += total_debit_delta
            balance.balance += balance_delta
            return balance

        statement = (
            insert_statement.values(
                id=uuid4(),
                merchant_id=merchant_id,
                balance_date=balance_date,
                total_credit=total_credit_delta,
                total_debit=total_debit_delta,
                balance=balance_delta,
            )
            .on_conflict_do_update(
                index_elements=["merchant_id", "balance_date"],
                set_={
                    "total_credit": DailyBalance.total_credit + total_credit_delta,
                    "total_debit": DailyBalance.total_debit + total_debit_delta,
                    "balance": DailyBalance.balance + balance_delta,
                    "updated_at": func.now(),
                },
            )
        )
        self.db.execute(statement)
        balance = self.get_daily_balance(
            merchant_id=merchant_id,
            balance_date=balance_date,
        )
        if balance is None:
            raise RuntimeError("Daily balance upsert did not return a persisted row")
        return balance

    def mark_event_processed(self, *, event_id: UUID, transaction_id: UUID) -> None:
        self.db.add(
            ProcessedEvent(
                event_id=event_id,
                transaction_id=transaction_id,
            )
        )
