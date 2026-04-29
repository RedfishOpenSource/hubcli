from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote

import httpx

from hubcli_worker.tasks.common import build_cert, build_verify
from hubcli_worker.tasks.rabbitmq.models import ManagementConfig


def _encoded_vhost(vhost: str | None) -> str:
    return quote(vhost or "/", safe="")


def _parse_response(response: httpx.Response, default: object = None):
    response.raise_for_status()
    if response.content:
        return response.json()
    return default


class RabbitMqManagementClient:
    def __init__(self, config: ManagementConfig):
        if not config.url:
            raise ValueError("RabbitMQ management URL is required. Use --mgmt-url or HUBCLI_RABBITMQ_MGMT_URL.")
        self._config = config
        self._client = httpx.Client(
            base_url=config.url.rstrip("/"),
            auth=(config.username or "guest", config.password or "guest"),
            verify=_build_verify(config),
            cert=_build_cert(config),
            timeout=config.timeout,
        )

    def close(self) -> None:
        self._client.close()

    def get(self, path: str, params: dict | None = None):
        return _parse_response(self._client.get(path, params=params))

    def put(self, path: str, payload: dict | None = None):
        return _parse_response(self._client.put(path, json=payload or {}), {"message": "Done."})

    def post(self, path: str, payload: dict | None = None):
        return _parse_response(self._client.post(path, json=payload or {}), {"message": "Done."})

    def delete(self, path: str):
        return _parse_response(self._client.delete(path), {"message": "Done."})

    def ping(self):
        overview = self.get("/api/overview")
        return {"message": "Management API reachable.", "rabbitmq_version": overview.get("rabbitmq_version")}

    def whoami(self):
        return self.get("/api/whoami")

    def overview(self):
        return self.get("/api/overview")

    def nodes(self):
        return self.get("/api/nodes")

    def vhosts(self):
        return self.get("/api/vhosts")

    def connections(self):
        return self.get("/api/connections")

    def channels(self):
        return self.get("/api/channels")

    def consumers(self):
        return self.get("/api/consumers")

    def queues(self, vhost: str | None):
        return self.get(f"/api/queues/{_encoded_vhost(vhost)}")

    def queue(self, vhost: str | None, name: str):
        return self.get(f"/api/queues/{_encoded_vhost(vhost)}/{quote(name, safe='')}")

    def declare_queue(self, vhost: str | None, name: str, durable: bool = True):
        return self.put(
            f"/api/queues/{_encoded_vhost(vhost)}/{quote(name, safe='')}",
            {"auto_delete": False, "durable": durable, "arguments": {}},
        )

    def purge_queue(self, vhost: str | None, name: str):
        return self.delete(f"/api/queues/{_encoded_vhost(vhost)}/{quote(name, safe='')}/contents")

    def delete_queue(self, vhost: str | None, name: str):
        return self.delete(f"/api/queues/{_encoded_vhost(vhost)}/{quote(name, safe='')}")

    def peek_queue(self, vhost: str | None, name: str, count: int):
        return self.post(
            f"/api/queues/{_encoded_vhost(vhost)}/{quote(name, safe='')}/get",
            {
                "count": count,
                "ackmode": "ack_requeue_true",
                "encoding": "auto",
                "truncate": 50000,
            },
        )

    def exchanges(self, vhost: str | None):
        return self.get(f"/api/exchanges/{_encoded_vhost(vhost)}")

    def exchange(self, vhost: str | None, name: str):
        return self.get(f"/api/exchanges/{_encoded_vhost(vhost)}/{quote(name, safe='')}")

    def declare_exchange(self, vhost: str | None, name: str, kind: str | None):
        return self.put(
            f"/api/exchanges/{_encoded_vhost(vhost)}/{quote(name, safe='')}",
            {"type": kind or "direct", "durable": True, "auto_delete": False, "internal": False, "arguments": {}},
        )

    def delete_exchange(self, vhost: str | None, name: str):
        return self.delete(f"/api/exchanges/{_encoded_vhost(vhost)}/{quote(name, safe='')}")

    def bindings(self, vhost: str | None):
        return self.get(f"/api/bindings/{_encoded_vhost(vhost)}")

    def create_binding(self, vhost: str | None, source: str, destination: str, destination_type: str, routing_key: str | None):
        return self.post(
            f"/api/bindings/{_encoded_vhost(vhost)}/e/{quote(source, safe='')}/{destination_type[0]}/{quote(destination, safe='')}",
            {"routing_key": routing_key or "", "arguments": {}},
        )

    def delete_binding(self, vhost: str | None, source: str, destination: str, destination_type: str, routing_key: str | None):
        properties_key = quote(routing_key or "", safe='')
        return self.delete(
            f"/api/bindings/{_encoded_vhost(vhost)}/e/{quote(source, safe='')}/{destination_type[0]}/{quote(destination, safe='')}/{properties_key}"
        )

    def export_definitions(self):
        return self.get("/api/definitions")

    def import_definitions(self, input_path: str):
        payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
        return self.post("/api/definitions", payload)

    def users(self):
        return self.get("/api/users")

    def user(self, name: str):
        return self.get(f"/api/users/{quote(name, safe='')}")

    def create_user(self, name: str, password: str | None, tags: str | None):
        return self.put(
            f"/api/users/{quote(name, safe='')}",
            {"password": password or "guest", "tags": tags or ""},
        )

    def delete_user(self, name: str):
        return self.delete(f"/api/users/{quote(name, safe='')}")

    def permissions(self, vhost: str | None):
        if vhost:
            return self.get(f"/api/vhosts/{_encoded_vhost(vhost)}/permissions")
        return self.get("/api/permissions")

    def grant_permission(self, vhost: str | None, user_name: str, configure: str | None, write: str | None, read: str | None):
        return self.put(
            f"/api/permissions/{_encoded_vhost(vhost)}/{quote(user_name, safe='')}",
            {
                "configure": configure or ".*",
                "write": write or ".*",
                "read": read or ".*",
            },
        )

    def revoke_permission(self, vhost: str | None, user_name: str):
        return self.delete(f"/api/permissions/{_encoded_vhost(vhost)}/{quote(user_name, safe='')}")

    def policies(self, vhost: str | None):
        if vhost:
            return self.get(f"/api/policies/{_encoded_vhost(vhost)}")
        return self.get("/api/policies")

    def set_policy(self, vhost: str | None, name: str, pattern: str | None, definition: str | None, apply_to: str | None, priority: int | None):
        return self.put(
            f"/api/policies/{_encoded_vhost(vhost)}/{quote(name, safe='')}",
            {
                "pattern": pattern or ".*",
                "definition": json.loads(definition or "{}"),
                "apply-to": apply_to or "all",
                "priority": priority or 0,
            },
        )

    def delete_policy(self, vhost: str | None, name: str):
        return self.delete(f"/api/policies/{_encoded_vhost(vhost)}/{quote(name, safe='')}")
