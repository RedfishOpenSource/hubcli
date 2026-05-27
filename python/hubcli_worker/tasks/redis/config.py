from __future__ import annotations

import os

from hubcli_worker.tasks.common import TlsConfig, bool_from_options, path_value
from hubcli_worker.tasks.redis.models import RedisConfig


def build_tls_config(options: dict) -> TlsConfig:
    return TlsConfig(
        verify=not bool_from_options(options, 'insecure', False),
        ca_cert=path_value(options.get('caCert') or os.getenv('HUBCLI_REDIS_TLS_CA')),
        client_cert=path_value(options.get('clientCert') or os.getenv('HUBCLI_REDIS_TLS_CERT')),
        client_key=path_value(options.get('clientKey') or os.getenv('HUBCLI_REDIS_TLS_KEY')),
    )


def _positive_float(value: object, label: str) -> float:
    result = float(value)
    if result <= 0:
        raise ValueError(f'{label} must be greater than 0.')
    return result


def _non_negative_int(value: object, label: str) -> int:
    result = int(value)
    if result < 0:
        raise ValueError(f'{label} must be greater than or equal to 0.')
    return result


def build_redis_config(options: dict) -> RedisConfig:
    timeout = _positive_float(options.get('timeout') or os.getenv('HUBCLI_REDIS_TIMEOUT') or 10, 'Redis timeout')
    port = int(options.get('port') or os.getenv('HUBCLI_REDIS_PORT') or 6379)
    if port <= 0:
        raise ValueError('Redis port must be greater than 0.')

    database = options.get('database') or os.getenv('HUBCLI_REDIS_DATABASE')

    return RedisConfig(
        url=options.get('url') or os.getenv('HUBCLI_REDIS_URL'),
        host=options.get('host') or os.getenv('HUBCLI_REDIS_HOST'),
        port=port,
        username=options.get('username') or os.getenv('HUBCLI_REDIS_USERNAME'),
        password=options.get('password') or os.getenv('HUBCLI_REDIS_PASSWORD'),
        database=_non_negative_int(database, 'Redis database') if database is not None else None,
        timeout=timeout,
        tls_enabled=bool_from_options(options, 'tls', False),
        tls=build_tls_config(options),
    )
