from __future__ import annotations

import socket
import subprocess
import time

from hubcli_worker.tasks.arthas.http_client import ArthasHttpClient
from hubcli_worker.tasks.arthas.models import ArthasEndpoint, ArthasRuntime


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def is_endpoint_reachable(endpoint: ArthasEndpoint) -> bool:
    return _port_open(endpoint.host, endpoint.http_port)


def verify_endpoint(runtime: ArthasRuntime, expect_pid: int | None = None) -> object:
    client = ArthasHttpClient(runtime.endpoint, timeout=min(runtime.timeout_seconds, 5.0))
    try:
        session = client.init_session()
        try:
            welcome = client.pull_results(session)
            actual_pid = client.extract_pid(welcome)
            if expect_pid is not None and actual_pid is not None and actual_pid != expect_pid:
                raise RuntimeError(
                    f"Arthas HTTP endpoint {runtime.endpoint.api_url} is attached to pid {actual_pid}, expected {expect_pid}."
                )
            return welcome
        finally:
            client.close_session(session)
    finally:
        client.close()


def attach_once(runtime: ArthasRuntime) -> None:
    if runtime.pid is None:
        raise ValueError("Arthas attach requires a target pid.")
    command = [
        runtime.java_command,
        "-jar",
        runtime.boot_jar,
        "--attach-only",
        "--target-ip",
        runtime.endpoint.host,
        "--telnet-port",
        str(runtime.endpoint.telnet_port),
        "--http-port",
        str(runtime.endpoint.http_port),
        str(runtime.pid),
    ]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=runtime.timeout_seconds,
        cwd=runtime.vendor_directory,
        check=False,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout).strip() or "Arthas attach failed."
        raise RuntimeError(message)


def wait_until_ready(runtime: ArthasRuntime) -> object:
    deadline = time.monotonic() + runtime.timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        if not is_endpoint_reachable(runtime.endpoint):
            time.sleep(0.5)
            continue
        try:
            return verify_endpoint(runtime, expect_pid=runtime.pid)
        except Exception as error:
            last_error = error
            time.sleep(0.5)
    if last_error is not None:
        raise RuntimeError(str(last_error))
    raise TimeoutError("Arthas HTTP API was not ready before timeout.")
