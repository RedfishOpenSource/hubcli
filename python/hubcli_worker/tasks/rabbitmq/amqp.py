from __future__ import annotations

try:
    import pika
except ModuleNotFoundError:
    pika = None

from hubcli_worker.tasks.rabbitmq.models import AmqpConfig


def _require_pika():
    if pika is None:
        raise ModuleNotFoundError("Missing Python dependency: pika")


def _build_connection_parameters(config: AmqpConfig):
    _require_pika()
    ssl_options = None
    if config.url:
        parameters = pika.URLParameters(config.url)
        if config.heartbeat is not None:
            parameters.heartbeat = config.heartbeat
        return parameters

    credentials = pika.PlainCredentials(config.username or "guest", config.password or "guest")
    parameters = pika.ConnectionParameters(
        host=config.host or "localhost",
        port=config.port or 5672,
        virtual_host=config.vhost or "/",
        credentials=credentials,
        heartbeat=config.heartbeat,
        ssl_options=ssl_options,
    )
    return parameters


class RabbitMqAmqpClient:
    def __init__(self, config: AmqpConfig):
        self._config = config
        if not (config.url or config.host):
            raise ValueError("RabbitMQ AMQP connection is required. Use --amqp-url or AMQP host parameters.")
        self._parameters = _build_connection_parameters(config)

    def ping(self):
        connection = pika.BlockingConnection(self._parameters)
        connection.close()
        return {"message": "AMQP reachable."}

    def publish(self, options: dict):
        connection = pika.BlockingConnection(self._parameters)
        try:
            channel = connection.channel()
            body = options.get("body") or ""
            headers = options.get("headers") or {}
            properties = pika.BasicProperties(
                content_type=options.get("contentType") or "text/plain",
                delivery_mode=2 if options.get("persistent") else None,
                headers=headers or None,
            )
            channel.basic_publish(
                exchange=options.get("exchange") or "",
                routing_key=options.get("routingKey") or "",
                body=body.encode("utf-8"),
                properties=properties,
            )
            return {"message": "Message published."}
        finally:
            connection.close()

    def consume(self, options: dict):
        queue = options.get("queue")
        if not queue:
            raise ValueError("Missing --queue for consume operation.")
        max_messages = int(options.get("maxMessages") or 1)
        auto_ack = bool(options.get("noAck"))
        ack = bool(options.get("ack"))

        connection = pika.BlockingConnection(self._parameters)
        messages = []
        try:
            channel = connection.channel()
            for _ in range(max_messages):
                method, properties, body = channel.basic_get(queue=queue, auto_ack=auto_ack)
                if method is None:
                    break
                messages.append(
                    {
                        "routing_key": method.routing_key,
                        "exchange": method.exchange,
                        "delivery_tag": method.delivery_tag,
                        "body": body.decode("utf-8", errors="replace"),
                        "content_type": properties.content_type,
                        "headers": properties.headers,
                    }
                )
                if ack and not auto_ack:
                    channel.basic_ack(method.delivery_tag)
            return messages
        finally:
            connection.close()
