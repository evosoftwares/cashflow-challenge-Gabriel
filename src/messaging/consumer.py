import json
import logging
import time
from collections.abc import Callable

import pika

from src.app.config import Settings

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
                self.handler(event)
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except json.JSONDecodeError:
                logger.exception("invalid_json_message")
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception:
                logger.exception("transaction_consolidation_failed")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

        channel.basic_consume(queue=self.settings.queue_name, on_message_callback=callback)
        logger.info("consolidation_worker_started")
        channel.start_consuming()

    def _connect_with_retry(self):
        parameters = pika.URLParameters(self.settings.rabbitmq_url)
        last_exception = None
        for attempt in range(1, 11):
            try:
                return pika.BlockingConnection(parameters)
            except Exception as exc:
                last_exception = exc
                logger.warning("rabbitmq_connection_retry", extra={"attempt": attempt})
                time.sleep(2)
        raise RuntimeError("Could not connect to RabbitMQ") from last_exception
