from __future__ import annotations

from dataclasses import dataclass

from hubcli_worker.tasks.common import TlsConfig


@dataclass
class RedisConfig:
    url: str | None
    host: str | None
    port: int
    username: str | None
    password: str | None
    database: int | None
    timeout: float
    tls_enabled: bool
    tls: TlsConfig
