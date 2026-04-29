from __future__ import annotations

from dataclasses import dataclass

from hubcli_worker.tasks.common import TlsConfig


@dataclass
class NacosConfig:
    server: str | None
    username: str | None
    password: str | None
    namespace: str | None
    group: str | None
    timeout: float
    tls: TlsConfig
