from __future__ import annotations

import os

from hubcli_worker.tasks.common import bool_from_options, path_value
from hubcli_worker.tasks.rabbitmq.models import AmqpConfig, ManagementConfig, TlsConfig


def build_tls_config(options: dict) -> TlsConfig:
    return TlsConfig(
        verify=not bool_from_options(options, "insecure", False),
        ca_cert=path_value(options.get("caCert") or os.getenv("HUBCLI_RABBITMQ_TLS_CA")),
        client_cert=path_value(options.get("clientCert") or os.getenv("HUBCLI_RABBITMQ_TLS_CERT")),
        client_key=path_value(options.get("clientKey") or os.getenv("HUBCLI_RABBITMQ_TLS_KEY")),
    )


def build_management_config(options: dict) -> ManagementConfig:
    timeout = options.get("timeout") or 10
    return ManagementConfig(
        url=options.get("mgmtUrl") or os.getenv("HUBCLI_RABBITMQ_MGMT_URL"),
        username=options.get("mgmtUser") or os.getenv("HUBCLI_RABBITMQ_MGMT_USER"),
        password=options.get("mgmtPass") or os.getenv("HUBCLI_RABBITMQ_MGMT_PASS"),
        timeout=float(timeout),
        tls=build_tls_config(options),
    )


def build_amqp_config(options: dict) -> AmqpConfig:
    vhost = options.get("vhost") or os.getenv("HUBCLI_RABBITMQ_VHOST") or "/"
    heartbeat = options.get("heartbeat")
    return AmqpConfig(
        url=options.get("amqpUrl") or os.getenv("HUBCLI_RABBITMQ_AMQP_URL"),
        host=options.get("host"),
        port=options.get("port"),
        username=options.get("user"),
        password=options.get("pass"),
        vhost=vhost,
        heartbeat=int(heartbeat) if heartbeat is not None else None,
        tls=build_tls_config(options),
    )
