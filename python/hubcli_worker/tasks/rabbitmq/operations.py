from __future__ import annotations

import json
from pathlib import Path

from hubcli_worker.tasks.rabbitmq.amqp import RabbitMqAmqpClient
from hubcli_worker.tasks.rabbitmq.config import build_amqp_config, build_management_config
from hubcli_worker.tasks.rabbitmq.management import RabbitMqManagementClient


def _use_amqp(operation: str, options: dict) -> bool:
    via = options.get("via")
    if via == "amqp":
        return True
    return operation in {"publish", "consume"}


def _write_json_file(path: str, data: object) -> dict:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"message": f"Written to {output_path}"}


def _run_amqp_operation(client: RabbitMqAmqpClient, operation: str, options: dict) -> object:
    if operation == "ping":
        return client.ping()
    if operation == "publish":
        return client.publish(options)
    if operation == "consume":
        return client.consume(options)
    raise ValueError(f"Unsupported RabbitMQ AMQP operation: {operation}")


def _run_management_operation(client: RabbitMqManagementClient, operation: str, options: dict) -> object:
    vhost = options.get("vhost")

    if operation == "ping":
        return client.ping()
    if operation == "whoami":
        return client.whoami()
    if operation == "overview":
        return client.overview()
    if operation == "cluster.nodes":
        return client.nodes()
    if operation == "vhost.list":
        return client.vhosts()
    if operation == "connection.list":
        return client.connections()
    if operation == "channel.list":
        return client.channels()
    if operation == "consumer.list":
        return client.consumers()
    if operation == "queue.list":
        return client.queues(vhost)
    if operation == "queue.get":
        return client.queue(vhost, options["name"])
    if operation == "queue.declare":
        return client.declare_queue(vhost, options["name"])
    if operation == "queue.purge":
        return client.purge_queue(vhost, options["name"])
    if operation == "queue.delete":
        return client.delete_queue(vhost, options["name"])
    if operation == "queue.peek":
        return client.peek_queue(vhost, options["name"], int(options.get("count") or 1))
    if operation == "exchange.list":
        return client.exchanges(vhost)
    if operation == "exchange.get":
        return client.exchange(vhost, options["name"])
    if operation == "exchange.declare":
        return client.declare_exchange(vhost, options["name"], options.get("type"))
    if operation == "exchange.delete":
        return client.delete_exchange(vhost, options["name"])
    if operation == "binding.list":
        return client.bindings(vhost)
    if operation == "binding.create":
        return client.create_binding(
            vhost,
            options["source"],
            options["destination"],
            options.get("destinationType") or "queue",
            options.get("routingKey"),
        )
    if operation == "binding.delete":
        return client.delete_binding(
            vhost,
            options["source"],
            options["destination"],
            options.get("destinationType") or "queue",
            options.get("routingKey"),
        )
    if operation == "definitions.export":
        result = client.export_definitions()
        output = options.get("output")
        return _write_json_file(output, result) if output else result
    if operation == "definitions.import":
        return client.import_definitions(options["input"])
    if operation == "user.list":
        return client.users()
    if operation == "user.get":
        return client.user(options["name"])
    if operation == "user.create":
        return client.create_user(options["name"], options.get("password"), options.get("tags"))
    if operation == "user.delete":
        return client.delete_user(options["name"])
    if operation == "permission.list":
        return client.permissions(vhost)
    if operation == "permission.grant":
        return client.grant_permission(
            vhost,
            options["userName"],
            options.get("configure"),
            options.get("write"),
            options.get("read"),
        )
    if operation == "permission.revoke":
        return client.revoke_permission(vhost, options["userName"])
    if operation == "policy.list":
        return client.policies(vhost)
    if operation == "policy.set":
        priority = options.get("priority")
        return client.set_policy(
            vhost,
            options["name"],
            options.get("pattern"),
            options.get("definition"),
            options.get("applyTo"),
            int(priority) if priority is not None else None,
        )
    if operation == "policy.delete":
        return client.delete_policy(vhost, options["name"])
    raise ValueError(f"Unsupported RabbitMQ management operation: {operation}")


def run_operation(operation: str, options: dict) -> object:
    if _use_amqp(operation, options):
        client = RabbitMqAmqpClient(build_amqp_config(options))
        return _run_amqp_operation(client, operation, options)

    client = RabbitMqManagementClient(build_management_config(options))
    try:
        return _run_management_operation(client, operation, options)
    finally:
        client.close()
