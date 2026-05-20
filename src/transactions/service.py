import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy.orm import Session

from src.messaging.outbox import OutboxRepository
from src.transactions.models import Transaction
from src.transactions.repository import TransactionRepository
from src.transactions.schemas import TransactionCreate

logger = logging.getLogger(__name__)
MONEY_QUANTIZER = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def create_transaction(db: Session, payload: TransactionCreate) -> Transaction:
    transaction = Transaction(
        id=uuid4(),
        merchant_id=payload.merchant_id,
        type=payload.type,
        amount=money(payload.amount),
        description=payload.description,
        occurred_at=payload.occurred_at,
    )

    repository = TransactionRepository(db)
    saved = repository.add(transaction)
    event = build_transaction_created_event(saved)
    OutboxRepository(db).add_pending(event)
    db.commit()
    db.refresh(saved)

    logger.info(
        json.dumps(
            {
                "event": "transaction_created",
                "transaction_id": str(saved.id),
                "merchant_id": str(saved.merchant_id),
                "amount": f"{saved.amount:.2f}",
            }
        )
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
