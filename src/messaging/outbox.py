from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.messaging.models import OutboxEvent


class OutboxRepository:
    def __init__(self, db: Session):
        self.db = db

    def add_pending(self, event: dict[str, str]) -> OutboxEvent:
        outbox_event = OutboxEvent(
            id=UUID(event["event_id"]),
            event_type=event["event_type"],
            payload=event,
            status="PENDING",
        )
        self.db.add(outbox_event)
        return outbox_event

    def list_pending(self, *, limit: int = 50) -> list[OutboxEvent]:
        statement = (
            select(OutboxEvent)
            .where(OutboxEvent.status == "PENDING")
            .order_by(OutboxEvent.created_at.asc())
            .limit(limit)
        )
        return list(self.db.scalars(statement).all())

    def mark_published(self, event: OutboxEvent) -> None:
        event.status = "PUBLISHED"
        event.published_at = datetime.utcnow()
        event.last_error = None

    def mark_failed(self, event: OutboxEvent, error: str) -> None:
        event.attempts += 1
        event.last_error = error[:500]

