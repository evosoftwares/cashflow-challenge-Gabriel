import logging

from src.app.config import get_settings
from src.app.observability import configure_logging
from src.consolidation.service import apply_transaction_created_event
from src.database.connection import SessionLocal
from src.messaging.consumer import RabbitMQConsumer

configure_logging()
logger = logging.getLogger(__name__)


def handle_event(event: dict[str, str]) -> str:
    with SessionLocal() as db:
        return apply_transaction_created_event(db, event)


def main() -> None:
    settings = get_settings()
    consumer = RabbitMQConsumer(settings, handle_event)
    consumer.start()


if __name__ == "__main__":
    main()
