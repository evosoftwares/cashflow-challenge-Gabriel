import json
import logging
import time
from collections.abc import Callable

import pika

from src.app.config import Settings
from src.app.observability import log_event, record_counter

logger = logging.getLogger(__name__)


class RabbitMQConsumer:
    def __init__(self, settings: Settings, handler: Callable[[dict[str, str]], str]):
        self.settings = settings
        self.handler = handler

    def start(self) -> None:
        connection = self._connect_with_retry()
        channel = connection.channel()
        channel.queue_declare(queue=self.settings.queue_name, durable=True)
        channel.basic_qos(prefetch_count=10)

        def callback(ch, method, properties, body):
            try:
                event = json.loads(body.decode("utf-8"))
                status = self.handler(event)
                record_counter(
                    logger,
                    event="worker_message_ack",
                    component="consolidation_worker",
                    metric_name="cashflow_worker_messages_total",
                    metric_labels={"status": status},
                    event_id=event.get("event_id"),
                )
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except json.JSONDecodeError:
                record_counter(
                    logger,
                    event="invalid_json_message",
                    component="consolidation_worker",
                    metric_name="cashflow_worker_messages_total",
                    metric_labels={"status": "invalid_json"},
                    level=logging.ERROR,
                )
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as exc:
                record_counter(
                    logger,
                    event="transaction_consolidation_failed",
                    component="consolidation_worker",
                    metric_name="cashflow_worker_messages_total",
                    metric_labels={"status": "failed"},
                    level=logging.ERROR,
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                )
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

        channel.basic_consume(queue=self.settings.queue_name, on_message_callback=callback)
        log_event(logger, event="consolidation_worker_started", component="consolidation_worker")
        channel.start_consuming()

    def _connect_with_retry(self):
        parameters = pika.URLParameters(self.settings.rabbitmq_url)
        last_exception = None
        for attempt in range(1, 11):
            try:
                return pika.BlockingConnection(parameters)
            except Exception as exc:
                last_exception = exc
                log_event(
                    logger,
                    event="rabbitmq_connection_retry",
                    component="messaging",
                    level=logging.WARNING,
                    attempt=attempt,
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                )
                time.sleep(2)
        raise RuntimeError("Could not connect to RabbitMQ") from last_exception
