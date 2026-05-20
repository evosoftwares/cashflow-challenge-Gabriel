from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.consolidation.models import DailyBalance, ProcessedEvent
from src.consolidation.service import apply_transaction_created_event
from src.database.connection import Base


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def transaction_event(
    *,
    event_id=None,
    transaction_id=None,
    merchant_id=None,
    transaction_type="CREDIT",
    amount="100.00",
):
    return {
        "event_id": str(event_id or uuid4()),
        "event_type": "TRANSACTION_CREATED",
        "transaction_id": str(transaction_id or uuid4()),
        "merchant_id": str(merchant_id or uuid4()),
        "transaction_type": transaction_type,
        "amount": amount,
        "occurred_at": "2026-05-20T10:00:00",
    }


def test_applies_credit_to_daily_balance(db_session):
    merchant_id = uuid4()
    event = transaction_event(merchant_id=merchant_id, amount="100.00")

    result = apply_transaction_created_event(db_session, event)

    balance = db_session.query(DailyBalance).one()
    processed = db_session.query(ProcessedEvent).one()
    assert result == "success"
    assert balance.merchant_id == merchant_id
    assert balance.balance_date.isoformat() == "2026-05-20"
    assert balance.total_credit == Decimal("100.00")
    assert balance.total_debit == Decimal("0.00")
    assert balance.balance == Decimal("100.00")
    assert str(processed.event_id) == event["event_id"]


def test_applies_debit_to_daily_balance(db_session):
    merchant_id = uuid4()
    event = transaction_event(
        merchant_id=merchant_id,
        transaction_type="DEBIT",
        amount="40.00",
    )

    apply_transaction_created_event(db_session, event)

    balance = db_session.query(DailyBalance).one()
    assert balance.total_credit == Decimal("0.00")
    assert balance.total_debit == Decimal("40.00")
    assert balance.balance == Decimal("-40.00")


def test_ignores_duplicate_event(db_session):
    event_id = uuid4()
    merchant_id = uuid4()
    first = transaction_event(
        event_id=event_id,
        merchant_id=merchant_id,
        transaction_id=uuid4(),
        amount="100.00",
    )
    duplicate = dict(first)

    first_result = apply_transaction_created_event(db_session, first)
    second_result = apply_transaction_created_event(db_session, duplicate)

    balance = db_session.query(DailyBalance).one()
    assert first_result == "success"
    assert second_result == "duplicate"
    assert balance.total_credit == Decimal("100.00")
    assert balance.balance == Decimal("100.00")
    assert db_session.query(ProcessedEvent).count() == 1
