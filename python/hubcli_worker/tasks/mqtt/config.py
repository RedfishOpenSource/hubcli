from __future__ import annotations

import os
from urllib.parse import urlparse

from hubcli_worker.tasks.common import bool_from_options, path_value, TlsConfig
from hubcli_worker.tasks.mqtt.models import MqttConfig


MQTT_PROTOCOL_VERSIONS = {'3.1.1', '5'}


def build_tls_config(options: dict) -> TlsConfig:
    return TlsConfig(
        verify=not bool_from_options(options, 'insecure', False),
        ca_cert=path_value(options.get('caCert') or os.getenv('HUBCLI_MQTT_TLS_CA')),
        client_cert=path_value(options.get('clientCert') or os.getenv('HUBCLI_MQTT_TLS_CERT')),
        client_key=path_value(options.get('clientKey') or os.getenv('HUBCLI_MQTT_TLS_KEY')),
    )


def build_mqtt_config(options: dict) -> MqttConfig:
    protocol_version = str(options.get('protocolVersion') or os.getenv('HUBCLI_MQTT_PROTOCOL_VERSION') or '5')
    if protocol_version not in MQTT_PROTOCOL_VERSIONS:
        raise ValueError('MQTT protocol version must be 3.1.1 or 5.')

    timeout = float(options.get('timeout') or os.getenv('HUBCLI_MQTT_TIMEOUT') or 10)
    if timeout <= 0:
        raise ValueError('MQTT timeout must be greater than 0 seconds.')

    keepalive = int(options.get('keepalive') or os.getenv('HUBCLI_MQTT_KEEPALIVE') or 60)
    if keepalive < 0:
        raise ValueError('MQTT keepalive must be 0 or greater.')

    port = options.get('port')
    if port is None:
        env_port = os.getenv('HUBCLI_MQTT_PORT')
        port = int(env_port) if env_port else None
    elif int(port) <= 0:
        raise ValueError('MQTT port must be greater than 0.')
    else:
        port = int(port)

    session_expiry = options.get('sessionExpiry')
    if session_expiry is None:
        env_expiry = os.getenv('HUBCLI_MQTT_SESSION_EXPIRY')
        session_expiry = int(env_expiry) if env_expiry else None
    else:
        session_expiry = int(session_expiry)
    if session_expiry is not None and session_expiry < 0:
        raise ValueError('MQTT session expiry must be 0 or greater.')

    url = options.get('url') or os.getenv('HUBCLI_MQTT_URL')
    parsed_url = urlparse(url) if url else None

    tls_enabled = bool_from_options(options, 'tls', False)
    if parsed_url and parsed_url.scheme == 'mqtts':
        tls_enabled = True

    return MqttConfig(
        url=url,
        parsed_url=parsed_url,
        host=options.get('host') or os.getenv('HUBCLI_MQTT_HOST'),
        port=port,
        username=options.get('username') or os.getenv('HUBCLI_MQTT_USERNAME') or (parsed_url.username if parsed_url else None),
        password=options.get('password') or os.getenv('HUBCLI_MQTT_PASSWORD') or (parsed_url.password if parsed_url else None),
        client_id=options.get('clientId') or os.getenv('HUBCLI_MQTT_CLIENT_ID'),
        protocol_version=protocol_version,
        keepalive=keepalive,
        clean_start=bool_from_options(options, 'cleanStart', False),
        session_expiry=session_expiry,
        timeout=timeout,
        tls_enabled=tls_enabled,
        tls=build_tls_config(options),
    )
