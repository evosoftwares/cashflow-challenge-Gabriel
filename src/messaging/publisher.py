import json

import pika

from src.app.config import Settings


class RabbitMQPublisher:
    def __init__(self, settings: Settings):
        self.settings = settings

    def publish_transaction_created(self, event: dict[str, str]) -> None:
        parameters = pika.URLParameters(self.settings.rabbitmq_url)
        connection = pika.BlockingConnection(parameters)
        try:
            channel = connection.channel()
            channel.queue_declare(queue=self.settings.queue_name, durable=True)
            channel.basic_publish(
                exchange="",
                routing_key=self.settings.queue_name,
                body=json.dumps(event).encode("utf-8"),
                properties=pika.BasicProperties(
                    content_type="application/json",
                    delivery_mode=2,
                    correlation_id=event.get("correlation_id"),
                ),
                mandatory=True,
            )
        finally:
            connection.close()
