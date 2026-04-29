from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class TlsConfig:
    verify: bool = True
    ca_cert: Path | None = None
    client_cert: Path | None = None
    client_key: Path | None = None


def bool_from_options(options: dict, key: str, default: bool) -> bool:
    value = options.get(key)
    if value is None:
        return default
    return bool(value)


def path_value(value: str | None) -> Path | None:
    return Path(value) if value else None


def build_verify(config):
    if not config.tls.verify:
        return False
    if config.tls.ca_cert:
        return str(config.tls.ca_cert)
    return True


def build_cert(config):
    if config.tls.client_cert and config.tls.client_key:
        return (str(config.tls.client_cert), str(config.tls.client_key))
    return None
