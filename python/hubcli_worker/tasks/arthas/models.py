from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class ArthasEndpoint:
    host: str
    http_port: int
    telnet_port: int

    @property
    def api_url(self) -> str:
        return f"http://{self.host}:{self.http_port}/api"


@dataclass(frozen=True)
class ArthasSession:
    session_id: str
    consumer_id: str


@dataclass(frozen=True)
class ArthasRuntime:
    pid: int | None
    timeout_seconds: float
    endpoint: ArthasEndpoint
    vendor_directory: str
    boot_jar: str
    java_command: str


@dataclass
class ArthasTransportState:
    endpoint: ArthasEndpoint
    reused_existing: bool
    welcome: object = None


@dataclass
class ArthasExecutionResult:
    pid: int
    command: str
    mode: str
    transport: str
    endpoint: str
    reused_existing: bool
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    session_id: str | None = None
    job_id: str | None = None
    raw: list[object] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)
