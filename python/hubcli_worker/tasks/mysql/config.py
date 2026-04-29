from __future__ import annotations

import os

from hubcli_worker.tasks.common import TlsConfig, bool_from_options, path_value
from hubcli_worker.tasks.mysql.models import MysqlConfig


def build_tls_config(options: dict) -> TlsConfig:
    return TlsConfig(
        verify=not bool_from_options(options, "insecure", False),
        ca_cert=path_value(options.get("caCert") or os.getenv("HUBCLI_MYSQL_TLS_CA")),
        client_cert=path_value(options.get("clientCert") or os.getenv("HUBCLI_MYSQL_TLS_CERT")),
        client_key=path_value(options.get("clientKey") or os.getenv("HUBCLI_MYSQL_TLS_KEY")),
    )


def build_mysql_config(options: dict) -> MysqlConfig:
    timeout = options.get("timeout") or os.getenv("HUBCLI_MYSQL_TIMEOUT") or 10
    port = options.get("port") or os.getenv("HUBCLI_MYSQL_PORT") or 3306
    return MysqlConfig(
        host=options.get("host") or os.getenv("HUBCLI_MYSQL_HOST"),
        port=int(port),
        user=options.get("user") or os.getenv("HUBCLI_MYSQL_USER"),
        password=options.get("pass") or os.getenv("HUBCLI_MYSQL_PASS"),
        database=options.get("database") or os.getenv("HUBCLI_MYSQL_DATABASE"),
        charset=options.get("charset") or os.getenv("HUBCLI_MYSQL_CHARSET") or "utf8mb4",
        timeout=float(timeout),
        tls=build_tls_config(options),
    )
