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
from src.messaging.models import OutboxEvent


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
    settings = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        rabbitmq_url="amqp://guest:guest@localhost:5672/",
        api_key="test-key",
        queue_name="transaction.created",
    )
    app = create_app(
        settings=settings,
        session_factory=SessionLocal,
    )
    yield TestClient(app), SessionLocal


def test_post_transactions_creates_record_and_outbox_event(app_context):
    client, SessionLocal = app_context
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

    with SessionLocal() as session:
        outbox_event = session.query(OutboxEvent).one()
        assert outbox_event.event_type == "TRANSACTION_CREATED"
        assert outbox_event.status == "PENDING"
        assert outbox_event.payload["merchant_id"] == str(merchant_id)

        rows = client.get(
            f"/transactions?merchant_id={merchant_id}&date=2026-05-20",
            headers={"X-API-Key": "test-key"},
        )
        assert rows.status_code == 200
        assert len(rows.json()) == 1
        assert session is not None


def test_daily_balance_is_updated_after_worker_applies_outbox_events(app_context):
    client, SessionLocal = app_context
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
        for outbox_event in session.query(OutboxEvent).order_by(OutboxEvent.created_at).all():
            apply_transaction_created_event(session, outbox_event.payload)

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


def test_daily_balance_stream_emits_current_balance_event(app_context):
    client, SessionLocal = app_context
    merchant_id = uuid4()
    client.post(
        "/transactions",
        headers={"X-API-Key": "test-key"},
        json={
            "merchant_id": str(merchant_id),
            "type": "CREDIT",
            "amount": "75.00",
            "description": "Venda realtime",
            "occurred_at": "2026-05-20T10:00:00",
        },
    )

    with SessionLocal() as session:
        outbox_event = session.query(OutboxEvent).one()
        apply_transaction_created_event(session, outbox_event.payload)

    with client.stream(
        "GET",
        f"/daily-balances/2026-05-20/stream?merchant_id={merchant_id}&once=true",
        headers={"X-API-Key": "test-key"},
    ) as response:
        lines = response.iter_lines()
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert next(lines) == "event: daily_balance"
        data_line = next(lines)

    assert '"status":"available"' in data_line
    assert '"balance":"75.00"' in data_line


def test_post_transactions_keeps_working_when_worker_is_stopped(app_context):
    client, SessionLocal = app_context
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
    with SessionLocal() as session:
        assert session.query(OutboxEvent).count() == 1
    assert balance_response.status_code == 404


def test_protected_endpoints_require_api_key(app_context):
    client, _ = app_context

    response = client.get(
        f"/daily-balances/2026-05-20?merchant_id={uuid4()}",
    )

    assert response.status_code == 401


def test_cors_allows_frontend_origin(app_context):
    client, _ = app_context

    response = client.options(
        "/transactions",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-API-Key,Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "X-API-Key" in response.headers["access-control-allow-headers"]
