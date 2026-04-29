from __future__ import annotations

from dataclasses import dataclass

from hubcli_worker.tasks.common import TlsConfig


@dataclass
class MysqlConfig:
    host: str | None
    port: int
    user: str | None
    password: str | None
    database: str | None
    charset: str
    timeout: float
    tls: TlsConfig
