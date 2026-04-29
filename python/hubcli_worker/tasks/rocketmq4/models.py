from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RocketMqRuntime:
    namesrv: str | None
    timeout: float
