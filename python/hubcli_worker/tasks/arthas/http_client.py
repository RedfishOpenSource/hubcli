from __future__ import annotations

import json
from collections.abc import Iterable

import httpx

from hubcli_worker.tasks.arthas.models import ArthasEndpoint, ArthasSession


TERMINAL_STATES = {"done", "success", "succeeded", "fail", "failed", "error", "cancelled", "canceled", "terminated", "end"}


def _normalize_state(value: object) -> str | None:
    if value is None:
        return None
    return str(value).strip().lower()


def _collect_values(payload: object, key: str) -> list[object]:
    values: list[object] = []
    if isinstance(payload, dict):
        if key in payload:
            values.append(payload[key])
        for value in payload.values():
            values.extend(_collect_values(value, key))
    elif isinstance(payload, list):
        for item in payload:
            values.extend(_collect_values(item, key))
    return values


def _first_string(payload: object, keys: Iterable[str]) -> str | None:
    for key in keys:
        for value in _collect_values(payload, key):
            if value not in (None, ""):
                return str(value)
    return None


def _iter_messages(payload: object) -> list[object]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        body = payload.get("body")
        if isinstance(body, dict):
            for key in ("results", "messages", "events", "data", "result"):
                value = body.get(key)
                if isinstance(value, list):
                    return value
        for key in ("messages", "results", "events", "data", "result"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        return [payload]
    if payload in (None, ""):
        return []
    return [payload]


class ArthasHttpClient:
    def __init__(self, endpoint: ArthasEndpoint, timeout: float):
        self.endpoint = endpoint
        self._client = httpx.Client(timeout=timeout)

    def close(self) -> None:
        self._client.close()

    def request(self, action: str, **payload) -> object:
        request_body = {"action": action, **payload}
        response = self._client.post(self.endpoint.api_url, json=request_body)
        response.raise_for_status()
        if not response.content:
            return {}
        body = response.json()
        self._raise_if_failed(body)
        return body

    def exec(self, command: str) -> object:
        return self.request("exec", command=command)

    def init_session(self) -> ArthasSession:
        payload = self.request("init_session")
        session_id = _first_string(payload, ("sessionId", "session_id"))
        consumer_id = _first_string(payload, ("consumerId", "consumer_id"))
        if not session_id or not consumer_id:
            raise RuntimeError(f"Unexpected Arthas init_session response: {json.dumps(payload, ensure_ascii=False)}")
        return ArthasSession(session_id=session_id, consumer_id=consumer_id)

    def join_session(self, session_id: str) -> ArthasSession:
        payload = self.request("join_session", sessionId=session_id)
        joined_session_id = _first_string(payload, ("sessionId", "session_id")) or session_id
        consumer_id = _first_string(payload, ("consumerId", "consumer_id"))
        if not consumer_id:
            raise RuntimeError(f"Unexpected Arthas join_session response: {json.dumps(payload, ensure_ascii=False)}")
        return ArthasSession(session_id=joined_session_id, consumer_id=consumer_id)

    def async_exec(self, command: str, session: ArthasSession) -> object:
        return self.request("async_exec", command=command, sessionId=session.session_id, consumerId=session.consumer_id)

    def pull_results(self, session: ArthasSession) -> object:
        return self.request("pull_results", sessionId=session.session_id, consumerId=session.consumer_id)

    def interrupt_job(self, session: ArthasSession) -> object:
        return self.request("interrupt_job", sessionId=session.session_id, consumerId=session.consumer_id)

    def close_session(self, session: ArthasSession) -> object:
        return self.request("close_session", sessionId=session.session_id, consumerId=session.consumer_id)

    @staticmethod
    def extract_messages(payload: object) -> list[object]:
        return _iter_messages(payload)

    @staticmethod
    def extract_text(payload: object) -> tuple[str, str]:
        stdout_parts: list[str] = []
        stderr_parts: list[str] = []
        for item in _iter_messages(payload):
            if isinstance(item, str):
                stdout_parts.append(item)
                continue
            if not isinstance(item, dict):
                stdout_parts.append(json.dumps(item, ensure_ascii=False))
                continue
            item_type = str(item.get("type") or "").lower()
            if item_type in {"welcome", "input_status", "row_affect"}:
                continue
            appended = False
            for key in ("message", "text", "body", "stdout", "result", "output", "rendered"):
                value = item.get(key)
                if isinstance(value, str) and value:
                    stdout_parts.append(value)
                    appended = True
                    break
            if not appended and item_type not in {"status", "command"}:
                stdout_parts.append(json.dumps(item, ensure_ascii=False, indent=2))
            error_text = item.get("stderr") or item.get("error") or item.get("traceback")
            if isinstance(error_text, str) and error_text:
                stderr_parts.append(error_text)
        return "\n".join(stdout_parts).strip(), "\n".join(stderr_parts).strip()

    @staticmethod
    def extract_job_id(payload: object) -> str | None:
        return _first_string(payload, ("jobId", "job_id"))

    @staticmethod
    def extract_pid(payload: object) -> int | None:
        value = _first_string(payload, ("pid",))
        if value is None:
            return None
        try:
            return int(value)
        except ValueError:
            return None

    @staticmethod
    def is_terminal(payload: object) -> bool:
        if isinstance(payload, dict):
            body = payload.get("body")
            if isinstance(body, dict):
                state = _normalize_state(body.get("jobStatus") or body.get("status"))
                if state in TERMINAL_STATES:
                    return True
        for item in _iter_messages(payload):
            if isinstance(item, dict):
                state = _normalize_state(item.get("jobStatus") or item.get("status"))
                if state in TERMINAL_STATES:
                    return True
                if item.get("type") == "status" and item.get("statusCode") == 0:
                    return True
        return False

    @staticmethod
    def _raise_if_failed(payload: object) -> None:
        if not isinstance(payload, dict):
            return
        state = _normalize_state(payload.get("state") or payload.get("status"))
        if state in {"fail", "failed", "error"}:
            message = _first_string(payload, ("message", "error", "stderr")) or json.dumps(payload, ensure_ascii=False)
            raise RuntimeError(message)
        success = payload.get("success")
        if success is False:
            message = _first_string(payload, ("message", "error", "stderr")) or json.dumps(payload, ensure_ascii=False)
            raise RuntimeError(message)
