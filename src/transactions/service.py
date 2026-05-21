import logging
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.app.observability import record_counter
from src.messaging.outbox import OutboxRepository
from src.transactions.models import Transaction
from src.transactions.repository import TransactionRepository
from src.transactions.schemas import TransactionCreate

logger = logging.getLogger(__name__)
MONEY_QUANTIZER = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def create_transaction(db: Session, payload: TransactionCreate) -> Transaction:
    repository = TransactionRepository(db)
    if payload.client_request_id is not None:
        existing_transaction = repository.get_by_client_request_id(payload.client_request_id)
        if existing_transaction is not None:
            return existing_transaction

    transaction = Transaction(
        id=uuid4(),
        client_request_id=payload.client_request_id,
        merchant_id=payload.merchant_id,
        type=payload.type,
        amount=money(payload.amount),
        description=payload.description,
        occurred_at=payload.occurred_at,
    )

    saved = repository.add(transaction)
    event = build_transaction_created_event(saved)
    OutboxRepository(db).add_pending(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if payload.client_request_id is not None:
            existing_transaction = repository.get_by_client_request_id(payload.client_request_id)
            if existing_transaction is not None:
                return existing_transaction
        raise
    db.refresh(saved)

    record_counter(
        logger,
        event="transaction_created",
        component="transactions",
        metric_name="cashflow_transactions_created_total",
        metric_labels={"type": saved.type},
        transaction_id=str(saved.id),
        merchant_id=str(saved.merchant_id),
        transaction_type=saved.type,
        amount=f"{saved.amount:.2f}",
    )
    return saved


def build_transaction_created_event(transaction: Transaction) -> dict[str, str]:
    return {
        "event_id": str(uuid4()),
        "event_type": "TRANSACTION_CREATED",
        "transaction_id": str(transaction.id),
        "merchant_id": str(transaction.merchant_id),
        "transaction_type": transaction.type,
        "amount": f"{transaction.amount:.2f}",
        "occurred_at": transaction.occurred_at.isoformat(),
    }
