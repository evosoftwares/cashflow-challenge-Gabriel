import logging
import time

from src.app.config import get_settings
from src.app.observability import configure_logging, log_event, record_counter
from src.database.connection import SessionLocal
from src.messaging.outbox import OutboxRepository
from src.messaging.publisher import RabbitMQPublisher

configure_logging()
logger = logging.getLogger(__name__)


def dispatch_once(batch_size: int = 50) -> int:
    settings = get_settings()
    publisher = RabbitMQPublisher(settings)

    with SessionLocal() as db:
        repository = OutboxRepository(db)
        events = repository.list_pending(limit=batch_size)
        for event in events:
            try:
                publisher.publish_transaction_created(event.payload)
                repository.mark_published(event)
                db.commit()
                record_counter(
                    logger,
                    event="outbox_event_published",
                    component="outbox_dispatcher",
                    metric_name="cashflow_outbox_events_total",
                    metric_labels={"status": "published"},
                    event_id=str(event.id),
                )
            except Exception as exc:
                db.rollback()
                with SessionLocal() as retry_db:
                    retry_event = retry_db.get(type(event), event.id)
                    if retry_event is not None:
                        OutboxRepository(retry_db).mark_failed(retry_event, str(exc))
                        retry_db.commit()
                record_counter(
                    logger,
                    event="outbox_event_publish_failed",
                    component="outbox_dispatcher",
                    metric_name="cashflow_outbox_events_total",
                    metric_labels={"status": "failed"},
                    level=logging.ERROR,
                    event_id=str(event.id),
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                )

        return len(events)


def main() -> None:
    log_event(logger, event="outbox_dispatcher_started", component="outbox_dispatcher")
    while True:
        published = dispatch_once()
        time.sleep(0.2 if published else 1.0)


if __name__ == "__main__":
    main()
