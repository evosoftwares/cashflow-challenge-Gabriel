from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.database.connection import Base
from src.transactions.models import Transaction
from src.transactions.schemas import TransactionCreate
from src.transactions.service import create_transaction


class FakePublisher:
    def __init__(self):
        self.events = []

    def publish_transaction_created(self, event):
        self.events.append(event)


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


def test_create_credit_transaction_persists_and_publishes_event(db_session):
    publisher = FakePublisher()
    merchant_id = uuid4()
    payload = TransactionCreate(
        merchant_id=merchant_id,
        type="CREDIT",
        amount=Decimal("100.00"),
        description="Venda no cartao",
        occurred_at=datetime(2026, 5, 20, 10, 0, 0),
    )

    transaction = create_transaction(db_session, payload, publisher)

    saved = db_session.get(Transaction, transaction.id)
    assert saved is not None
    assert saved.type == "CREDIT"
    assert saved.amount == Decimal("100.00")
    assert len(publisher.events) == 1
    event = publisher.events[0]
    assert UUID(event["event_id"])
    assert event["event_type"] == "TRANSACTION_CREATED"
    assert event["transaction_id"] == str(transaction.id)
    assert event["merchant_id"] == str(merchant_id)
    assert event["transaction_type"] == "CREDIT"
    assert event["amount"] == "100.00"


def test_create_debit_transaction_persists_and_publishes_event(db_session):
    publisher = FakePublisher()
    payload = TransactionCreate(
        merchant_id=uuid4(),
        type="DEBIT",
        amount=Decimal("35.50"),
        description="Pagamento fornecedor",
        occurred_at=datetime(2026, 5, 20, 11, 0, 0),
    )

    transaction = create_transaction(db_session, payload, publisher)

    saved = db_session.get(Transaction, transaction.id)
    assert saved.type == "DEBIT"
    assert publisher.events[0]["transaction_type"] == "DEBIT"
    assert publisher.events[0]["amount"] == "35.50"


def test_rejects_negative_amount():
    with pytest.raises(ValidationError):
        TransactionCreate(
            merchant_id=uuid4(),
            type="CREDIT",
            amount=Decimal("-1.00"),
            occurred_at=datetime(2026, 5, 20, 10, 0, 0),
        )


def test_rejects_invalid_transaction_type():
    with pytest.raises(ValidationError):
        TransactionCreate(
            merchant_id=uuid4(),
            type="TRANSFER",
            amount=Decimal("10.00"),
            occurred_at=datetime(2026, 5, 20, 10, 0, 0),
        )
