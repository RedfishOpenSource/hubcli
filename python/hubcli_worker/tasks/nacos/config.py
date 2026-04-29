from __future__ import annotations

import os

from hubcli_worker.tasks.common import bool_from_options, path_value
from hubcli_worker.tasks.nacos.models import NacosConfig, TlsConfig


def build_tls_config(options: dict) -> TlsConfig:
    return TlsConfig(
        verify=not bool_from_options(options, "insecure", False),
        ca_cert=path_value(options.get("caCert") or os.getenv("HUBCLI_NACOS_TLS_CA")),
        client_cert=path_value(options.get("clientCert") or os.getenv("HUBCLI_NACOS_TLS_CERT")),
        client_key=path_value(options.get("clientKey") or os.getenv("HUBCLI_NACOS_TLS_KEY")),
    )


def build_nacos_config(options: dict) -> NacosConfig:
    timeout = options.get("timeout") or os.getenv("HUBCLI_NACOS_TIMEOUT") or 10
    return NacosConfig(
        server=options.get("server") or os.getenv("HUBCLI_NACOS_SERVER"),
        username=options.get("username") or os.getenv("HUBCLI_NACOS_USERNAME"),
        password=options.get("password") or os.getenv("HUBCLI_NACOS_PASSWORD"),
        namespace=options.get("namespace") or os.getenv("HUBCLI_NACOS_NAMESPACE"),
        group=options.get("group") or os.getenv("HUBCLI_NACOS_GROUP"),
        timeout=float(timeout),
        tls=build_tls_config(options),
    )
