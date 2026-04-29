from __future__ import annotations

from dataclasses import dataclass

from hubcli_worker.tasks.common import TlsConfig


@dataclass
class ManagementConfig:
    url: str | None
    username: str | None
    password: str | None
    timeout: float
    tls: TlsConfig


@dataclass
class AmqpConfig:
    url: str | None
    host: str | None
    port: int | None
    username: str | None
    password: str | None
    vhost: str
    heartbeat: int | None
    tls: TlsConfig
