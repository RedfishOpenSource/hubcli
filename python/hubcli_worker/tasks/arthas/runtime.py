from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from hubcli_worker.tasks.arthas.models import ArthasEndpoint, ArthasRuntime


DEFAULT_HOST = "127.0.0.1"
DEFAULT_TELNET_PORT = 3658
DEFAULT_HTTP_PORT = 8563
DEFAULT_TIMEOUT_SECONDS = 30.0


def _resolve_vendor_directory() -> Path:
    if getattr(sys, "frozen", False):
        executable_root = Path(sys.executable).resolve().parent
        candidates = [
            executable_root / "vendor" / "arthas",
            executable_root.parent / "python" / "hubcli_worker" / "vendor" / "arthas",
            Path(os.environ.get("HUBCLI_HOME", executable_root)) / "python" / "hubcli_worker" / "vendor" / "arthas",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
    return Path(__file__).resolve().parents[2] / "vendor" / "arthas"


VENDOR_DIRECTORY = _resolve_vendor_directory()
BUNDLED_BOOT_JAR = VENDOR_DIRECTORY / "arthas-boot.jar"


def _resolve_java_command() -> str:
    java_command = shutil.which("java")
    if not java_command:
        raise RuntimeError("Java was not found on PATH. Install Java before using `hubcli arthas`.")
    return java_command


def build_arthas_runtime(options: dict, require_pid: bool = True) -> ArthasRuntime:
    pid = options.get("pid")
    if require_pid:
        if not isinstance(pid, int) or pid <= 0:
            raise ValueError("Arthas target PID is required. Pass --pid <pid>.")
    elif pid is not None and (not isinstance(pid, int) or pid <= 0):
        raise ValueError("Expected pid to be a positive integer when provided.")

    timeout_seconds = float(options.get("timeout") or DEFAULT_TIMEOUT_SECONDS)
    if timeout_seconds <= 0:
        raise ValueError("Arthas timeout must be greater than zero.")

    if not VENDOR_DIRECTORY.exists():
        raise RuntimeError(f"Bundled Arthas directory is missing: {VENDOR_DIRECTORY}")
    if not BUNDLED_BOOT_JAR.exists():
        raise RuntimeError(f"Bundled Arthas boot jar is missing: {BUNDLED_BOOT_JAR}")

    java_command = _resolve_java_command()
    endpoint = ArthasEndpoint(
        host=str(options.get("host") or DEFAULT_HOST),
        http_port=int(options.get("httpPort") or DEFAULT_HTTP_PORT),
        telnet_port=int(options.get("telnetPort") or DEFAULT_TELNET_PORT),
    )
    return ArthasRuntime(
        pid=pid,
        timeout_seconds=timeout_seconds,
        endpoint=endpoint,
        vendor_directory=str(VENDOR_DIRECTORY),
        boot_jar=str(BUNDLED_BOOT_JAR),
        java_command=java_command,
    )
