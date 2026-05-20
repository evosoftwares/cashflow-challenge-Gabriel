from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.database.connection import Base
from src.messaging.models import OutboxEvent
from src.transactions.models import Transaction
from src.transactions.schemas import TransactionCreate
from src.transactions.service import create_transaction


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


def test_create_credit_transaction_persists_transaction_and_outbox_event(db_session):
    merchant_id = uuid4()
    payload = TransactionCreate(
        merchant_id=merchant_id,
        type="CREDIT",
        amount=Decimal("100.00"),
        description="Venda no cartao",
        occurred_at=datetime(2026, 5, 20, 10, 0, 0),
    )

    transaction = create_transaction(db_session, payload)

    saved = db_session.get(Transaction, transaction.id)
    outbox_event = db_session.query(OutboxEvent).one()
    assert saved is not None
    assert saved.type == "CREDIT"
    assert saved.amount == Decimal("100.00")
    assert outbox_event.event_type == "TRANSACTION_CREATED"
    assert outbox_event.status == "PENDING"
    assert UUID(str(outbox_event.id))
    assert outbox_event.payload["event_id"] == str(outbox_event.id)
    assert outbox_event.payload["transaction_id"] == str(transaction.id)
    assert outbox_event.payload["merchant_id"] == str(merchant_id)
    assert outbox_event.payload["transaction_type"] == "CREDIT"
    assert outbox_event.payload["amount"] == "100.00"


def test_create_debit_transaction_persists_outbox_event(db_session):
    payload = TransactionCreate(
        merchant_id=uuid4(),
        type="DEBIT",
        amount=Decimal("35.50"),
        description="Pagamento fornecedor",
        occurred_at=datetime(2026, 5, 20, 11, 0, 0),
    )

    transaction = create_transaction(db_session, payload)

    saved = db_session.get(Transaction, transaction.id)
    outbox_event = db_session.query(OutboxEvent).one()
    assert saved.type == "DEBIT"
    assert outbox_event.payload["transaction_id"] == str(transaction.id)
    assert outbox_event.payload["transaction_type"] == "DEBIT"
    assert outbox_event.payload["amount"] == "35.50"


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
