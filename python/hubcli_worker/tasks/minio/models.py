from __future__ import annotations

from dataclasses import dataclass

from hubcli_worker.tasks.common import TlsConfig


@dataclass
class MinioConfig:
    endpoint: str | None
    access_key: str | None
    secret_key: str | None
    region: str | None
    secure: bool
    timeout: float
    tls: TlsConfig
