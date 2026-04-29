from __future__ import annotations

from hubcli_worker.tasks.nacos.client import NacosClient
from hubcli_worker.tasks.nacos.config import build_nacos_config


def _run_operation(client: NacosClient, operation: str, options: dict) -> object:
    if operation == "ping":
        return client.ping()
    if operation == "server.info":
        return client.server_info()
    if operation == "namespace.list":
        return client.list_namespaces()
    if operation == "namespace.get":
        return client.get_namespace(options["namespaceId"])
    if operation == "config.list":
        return client.list_configs(options)
    if operation == "config.get":
        return client.get_config(options)
    if operation == "service.list":
        return client.list_services(options)
    if operation == "service.get":
        return client.get_service(options)
    if operation == "instance.list":
        return client.list_instances(options)
    raise ValueError(f"Unsupported Nacos operation: {operation}")


def run_operation(operation: str, options: dict) -> object:
    client = NacosClient(build_nacos_config(options))
    try:
        return _run_operation(client, operation, options)
    finally:
        client.close()
