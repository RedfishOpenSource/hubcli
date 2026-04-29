from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import ParseResult

from hubcli_worker.tasks.common import TlsConfig


@dataclass
class MqttConfig:
    url: str | None
    parsed_url: ParseResult | None
    host: str | None
    port: int | None
    username: str | None
    password: str | None
    client_id: str | None
    protocol_version: str
    keepalive: int
    clean_start: bool
    session_expiry: int | None
    timeout: float
    tls_enabled: bool
    tls: TlsConfig
