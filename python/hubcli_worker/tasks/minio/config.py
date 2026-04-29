from __future__ import annotations

import os
from urllib.parse import urlparse

from hubcli_worker.tasks.common import TlsConfig, bool_from_options, path_value
from hubcli_worker.tasks.minio.models import MinioConfig


def build_tls_config(options: dict) -> TlsConfig:
    return TlsConfig(
        verify=not bool_from_options(options, 'insecure', False),
        ca_cert=path_value(options.get('caCert') or os.getenv('HUBCLI_MINIO_TLS_CA')),
        client_cert=path_value(options.get('clientCert') or os.getenv('HUBCLI_MINIO_TLS_CERT')),
        client_key=path_value(options.get('clientKey') or os.getenv('HUBCLI_MINIO_TLS_KEY')),
    )


def _normalize_endpoint(endpoint: str | None) -> tuple[str | None, bool]:
    if not endpoint:
        return None, False
    parsed = urlparse(endpoint)
    if parsed.scheme:
        if not parsed.hostname:
            raise ValueError('MinIO endpoint must include a host.')
        host = parsed.hostname
        if parsed.port:
            host = f'{host}:{parsed.port}'
        return host, parsed.scheme == 'https'
    return endpoint, False


def build_minio_config(options: dict) -> MinioConfig:
    timeout = float(options.get('timeout') or os.getenv('HUBCLI_MINIO_TIMEOUT') or 10)
    if timeout <= 0:
        raise ValueError('MinIO timeout must be greater than 0 seconds.')

    raw_endpoint = options.get('endpoint') or os.getenv('HUBCLI_MINIO_ENDPOINT')
    endpoint, endpoint_secure = _normalize_endpoint(raw_endpoint)
    secure = bool_from_options(options, 'secure', False)
    if endpoint_secure:
        secure = True

    return MinioConfig(
        endpoint=endpoint,
        access_key=options.get('accessKey') or os.getenv('HUBCLI_MINIO_ACCESS_KEY'),
        secret_key=options.get('secretKey') or os.getenv('HUBCLI_MINIO_SECRET_KEY'),
        region=options.get('region') or os.getenv('HUBCLI_MINIO_REGION'),
        secure=secure,
        timeout=timeout,
        tls=build_tls_config(options),
    )
