from __future__ import annotations

import json
import time

from hubcli_worker.tasks.arthas.boot import attach_once, is_endpoint_reachable, wait_until_ready
from hubcli_worker.tasks.arthas.http_client import ArthasHttpClient
from hubcli_worker.tasks.arthas.models import ArthasExecutionResult, ArthasTransportState
from hubcli_worker.tasks.arthas.runtime import build_arthas_runtime


PING_OPERATION = "ping"
EXEC_OPERATION = "exec"
SUPPORTED_OPERATIONS = {PING_OPERATION, EXEC_OPERATION}
ASYNC_COMMANDS = {"trace", "watch", "stack", "tt", "monitor"}


def _quote_arthas_arg(value: object) -> str:
    text = str(value)
    if not text:
        return '""'
    escaped = text.replace('\\', '\\\\').replace('"', '\\"')
    if any(character.isspace() for character in text) or '"' in text:
        return f'"{escaped}"'
    return text


def _build_command(arthas_args: list[str]) -> str:
    if not arthas_args:
        raise ValueError("Arthas command arguments are required.")
    return " ".join(_quote_arthas_arg(item) for item in arthas_args)


def _detect_mode(arthas_args: list[str]) -> str:
    head = str(arthas_args[0]).lower()
    return "async" if head in ASYNC_COMMANDS else "sync"


def _ensure_attached(runtime) -> ArthasTransportState:
    if is_endpoint_reachable(runtime.endpoint):
        welcome = wait_until_ready(runtime)
        return ArthasTransportState(endpoint=runtime.endpoint, reused_existing=True, welcome=welcome)
    attach_once(runtime)
    welcome = wait_until_ready(runtime)
    return ArthasTransportState(endpoint=runtime.endpoint, reused_existing=False, welcome=welcome)


def _collect_result(pid: int, command: str, mode: str, state: ArthasTransportState) -> ArthasExecutionResult:
    return ArthasExecutionResult(
        pid=pid,
        command=command,
        mode=mode,
        transport="http",
        endpoint=state.endpoint.api_url,
        reused_existing=state.reused_existing,
        raw=[state.welcome] if state.welcome is not None else [],
    )


def _run_sync(runtime, state: ArthasTransportState, command: str) -> dict:
    result = _collect_result(runtime.pid or 0, command, "sync", state)
    client = ArthasHttpClient(state.endpoint, timeout=runtime.timeout_seconds)
    try:
        payload = client.exec(command)
        result.raw.append(payload)
        stdout, stderr = client.extract_text(payload)
        result.stdout = stdout
        result.stderr = stderr
        return result.to_dict()
    finally:
        client.close()


def _run_async(runtime, state: ArthasTransportState, command: str) -> dict:
    result = _collect_result(runtime.pid or 0, command, "async", state)
    client = ArthasHttpClient(state.endpoint, timeout=min(runtime.timeout_seconds, 30.0))
    session = client.init_session()
    result.session_id = session.session_id
    poll_session = client.join_session(session.session_id)
    try:
        submit = client.async_exec(command, session)
        result.raw.append(submit)
        result.job_id = client.extract_job_id(submit)
        stdout_parts: list[str] = []
        stderr_parts: list[str] = []
        deadline = time.monotonic() + runtime.timeout_seconds
        while True:
            if time.monotonic() >= deadline:
                result.timed_out = True
                try:
                    interrupt = client.interrupt_job(session)
                    result.raw.append(interrupt)
                    interrupt_stdout, interrupt_stderr = client.extract_text(interrupt)
                    if interrupt_stdout:
                        stdout_parts.append(interrupt_stdout)
                    if interrupt_stderr:
                        stderr_parts.append(interrupt_stderr)
                except RuntimeError as error:
                    message = str(error)
                    if "no foreground job is running" not in message.lower():
                        raise
                stderr_parts.append(f"Arthas command timed out after {runtime.timeout_seconds:g}s.")
                break
            payload = client.pull_results(poll_session)
            result.raw.append(payload)
            stdout, stderr = client.extract_text(payload)
            if stdout:
                stdout_parts.append(stdout)
            if stderr:
                stderr_parts.append(stderr)
            if client.is_terminal(payload):
                break
            time.sleep(0.5)
        result.stdout = "\n".join(part for part in stdout_parts if part).strip()
        result.stderr = "\n".join(part for part in stderr_parts if part).strip()
        return result.to_dict()
    finally:
        try:
            closed = client.close_session(session)
            result.raw.append(closed)
        except RuntimeError:
            pass
        finally:
            client.close()


def run_operation(operation: str, options: dict) -> object:
    if operation not in SUPPORTED_OPERATIONS:
        raise ValueError(f"Unsupported Arthas operation: {operation}")

    if operation == PING_OPERATION:
        runtime = build_arthas_runtime(options, require_pid=False)
        return {
            "javaCommand": runtime.java_command,
            "bootJar": runtime.boot_jar,
            "vendorDirectory": runtime.vendor_directory,
            "endpoint": runtime.endpoint.api_url,
            "httpReachable": is_endpoint_reachable(runtime.endpoint),
        }

    runtime = build_arthas_runtime(options)
    arthas_args = options.get("arthasArgs") or []
    command = _build_command(arthas_args)
    mode = _detect_mode(arthas_args)
    state = _ensure_attached(runtime)
    if mode == "sync":
        return _run_sync(runtime, state, command)
    return _run_async(runtime, state, command)
