from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from src.database.connection import Base


class DailyBalance(Base):
    __tablename__ = "daily_balances"
    __table_args__ = (
        UniqueConstraint("merchant_id", "balance_date", name="uq_daily_balances_merchant_date"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    merchant_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    balance_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_credit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total_debit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    event_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    transaction_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("transactions.id", name="fk_processed_events_transaction_id"),
        nullable=False,
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
