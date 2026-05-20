import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy.orm import Session

from src.app.observability import record_counter
from src.consolidation.repository import ConsolidationRepository

logger = logging.getLogger(__name__)
MONEY_QUANTIZER = Decimal("0.01")


def parse_money(value: str) -> Decimal:
    return Decimal(value).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def apply_transaction_created_event(db: Session, event: dict[str, str]) -> str:
    if event.get("event_type") != "TRANSACTION_CREATED":
        raise ValueError("Unsupported event_type")

    repository = ConsolidationRepository(db)
    event_id = UUID(event["event_id"])
    transaction_id = UUID(event["transaction_id"])

    if not repository.try_mark_event_processed(event_id=event_id, transaction_id=transaction_id):
        record_counter(
            logger,
            event="transaction_consolidated",
            component="consolidation",
            metric_name="cashflow_consolidation_events_total",
            metric_labels={"status": "duplicate"},
            event_id=str(event_id),
            transaction_id=str(transaction_id),
            status="duplicate",
        )
        return "duplicate"

    amount = parse_money(event["amount"])
    occurred_at = datetime.fromisoformat(event["occurred_at"])
    repository.apply_amount(
        merchant_id=UUID(event["merchant_id"]),
        balance_date=occurred_at.date(),
        transaction_type=event["transaction_type"],
        amount=amount,
    )
    db.commit()

    record_counter(
        logger,
        event="transaction_consolidated",
        component="consolidation",
        metric_name="cashflow_consolidation_events_total",
        metric_labels={"status": "success"},
        event_id=str(event_id),
        transaction_id=str(transaction_id),
        status="success",
    )
    return "success"
