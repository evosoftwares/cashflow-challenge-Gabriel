from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.app.config import Settings
from src.app.main import create_app
from src.consolidation.service import apply_transaction_created_event
from src.database.connection import Base


class FakePublisher:
    def __init__(self):
        self.events = []

    def publish_transaction_created(self, event):
        self.events.append(event)


@pytest.fixture()
def app_context():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    publisher = FakePublisher()
    settings = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        rabbitmq_url="amqp://guest:guest@localhost:5672/",
        api_key="test-key",
        queue_name="transaction.created",
    )
    app = create_app(
        settings=settings,
        session_factory=SessionLocal,
        publisher=publisher,
    )
    yield TestClient(app), SessionLocal, publisher


def test_post_transactions_creates_record_and_publishes_event(app_context):
    client, SessionLocal, publisher = app_context
    merchant_id = uuid4()

    response = client.post(
        "/transactions",
        headers={"X-API-Key": "test-key"},
        json={
            "merchant_id": str(merchant_id),
            "type": "CREDIT",
            "amount": "100.00",
            "description": "Venda no cartao",
            "occurred_at": "2026-05-20T10:00:00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["merchant_id"] == str(merchant_id)
    assert body["type"] == "CREDIT"
    assert body["amount"] == "100.00"
    assert body["status"] == "CREATED"
    assert len(publisher.events) == 1

    with SessionLocal() as session:
        rows = client.get(
            f"/transactions?merchant_id={merchant_id}&date=2026-05-20",
            headers={"X-API-Key": "test-key"},
        )
        assert rows.status_code == 200
        assert len(rows.json()) == 1
        assert session is not None


def test_daily_balance_is_updated_after_worker_applies_published_event(app_context):
    client, SessionLocal, publisher = app_context
    merchant_id = uuid4()
    client.post(
        "/transactions",
        headers={"X-API-Key": "test-key"},
        json={
            "merchant_id": str(merchant_id),
            "type": "CREDIT",
            "amount": "120.00",
            "description": "Venda",
            "occurred_at": "2026-05-20T10:00:00",
        },
    )
    client.post(
        "/transactions",
        headers={"X-API-Key": "test-key"},
        json={
            "merchant_id": str(merchant_id),
            "type": "DEBIT",
            "amount": "40.00",
            "description": "Despesa",
            "occurred_at": "2026-05-20T11:00:00",
        },
    )

    with SessionLocal() as session:
        for event in publisher.events:
            apply_transaction_created_event(session, event)

    response = client.get(
        f"/daily-balances/{date(2026, 5, 20).isoformat()}?merchant_id={merchant_id}",
        headers={"X-API-Key": "test-key"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "merchant_id": str(merchant_id),
        "date": "2026-05-20",
        "total_credit": "120.00",
        "total_debit": "40.00",
        "balance": "80.00",
    }


def test_post_transactions_keeps_working_when_worker_is_stopped(app_context):
    client, _, publisher = app_context
    merchant_id = uuid4()

    response = client.post(
        "/transactions",
        headers={"X-API-Key": "test-key"},
        json={
            "merchant_id": str(merchant_id),
            "type": "CREDIT",
            "amount": "100.00",
            "description": "Teste com worker parado",
            "occurred_at": "2026-05-20T10:00:00",
        },
    )
    balance_response = client.get(
        f"/daily-balances/2026-05-20?merchant_id={merchant_id}",
        headers={"X-API-Key": "test-key"},
    )

    assert response.status_code == 201
    assert len(publisher.events) == 1
    assert balance_response.status_code == 404


def test_protected_endpoints_require_api_key(app_context):
    client, _, _ = app_context

    response = client.get(
        f"/daily-balances/2026-05-20?merchant_id={uuid4()}",
    )

    assert response.status_code == 401
