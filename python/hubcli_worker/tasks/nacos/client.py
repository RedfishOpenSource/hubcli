from __future__ import annotations

import httpx

from hubcli_worker.tasks.common import build_cert, build_verify
from hubcli_worker.tasks.nacos.models import NacosConfig


class NacosClient:
    def __init__(self, config: NacosConfig):
        if not config.server:
            raise ValueError("Nacos server URL is required. Use --server or HUBCLI_NACOS_SERVER.")
        self._config = config
        self._client = httpx.Client(
            base_url=config.server.rstrip("/"),
            verify=build_verify(config),
            cert=build_cert(config),
            timeout=config.timeout,
        )
        self._access_token: str | None = None
        self._login_path = "/nacos/v1/auth/users/login"

    def close(self) -> None:
        self._client.close()

    def _request(self, method: str, path: str, *, params: dict | None = None):
        response = self._client.request(method, path, params=params)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        text = response.text
        return text if text else {"message": "Done."}

    def _login(self) -> str:
        if self._access_token:
            return self._access_token
        if not self._config.username or not self._config.password:
            raise ValueError("Nacos username and password are required. Use --username/--password or HUBCLI_NACOS_USERNAME/HUBCLI_NACOS_PASSWORD.")

        payload = {
            "username": self._config.username,
            "password": self._config.password,
        }
        for path in (self._login_path, "/nacos/v1/auth/login"):
            response = self._client.post(path, data=payload)
            if response.is_error:
                continue
            data = response.json()
            token = data.get("accessToken")
            if token:
                self._login_path = path
                self._access_token = token
                return token
        raise ValueError("Failed to obtain Nacos access token.")

    def _token_params(self, extra: dict | None = None) -> dict:
        params = dict(extra or {})
        if self._config.username and self._config.password:
            params["accessToken"] = self._login()
        return params

    def ping(self):
        info = self.server_info()
        return {
            "message": "Nacos API reachable.",
            "version": info.get("version"),
            "server_port": info.get("server_port"),
            "auth_enabled": info.get("auth_enabled"),
        }

    def server_info(self):
        data = self._request("GET", "/nacos/v1/console/server/state")
        if not isinstance(data, dict):
            return {"raw": data}
        return data

    def list_namespaces(self):
        data = self._request("GET", "/nacos/v1/console/namespaces")
        if isinstance(data, dict) and isinstance(data.get("data"), list):
            return data["data"]
        if isinstance(data, list):
            return data
        return data

    def get_namespace(self, namespace_id: str):
        namespaces = self.list_namespaces()
        for item in namespaces:
            if item.get("namespace") == namespace_id:
                return item
        raise ValueError(f"Namespace not found: {namespace_id}")

    def list_configs(self, options: dict):
        params = self._token_params(
            {
                "search": options.get("search") or "blur",
                "dataId": options.get("dataId") or "",
                "group": options.get("group") or self._config.group or "",
                "pageNo": options.get("pageNo") or 1,
                "pageSize": options.get("pageSize") or 20,
                "tenant": options.get("namespace") or self._config.namespace or "",
            }
        )
        return self._request("GET", "/nacos/v1/cs/configs", params=params)

    def get_config(self, options: dict):
        data_id = options.get("dataId")
        if not data_id:
            raise ValueError("Config data ID is required. Use --data-id.")
        params = self._token_params(
            {
                "dataId": data_id,
                "group": options.get("group") or self._config.group or "DEFAULT_GROUP",
                "tenant": options.get("namespace") or self._config.namespace or "",
            }
        )
        result = self._request("GET", "/nacos/v1/cs/configs", params=params)
        return {
            "dataId": data_id,
            "group": params["group"],
            "namespace": params["tenant"],
            "content": result,
        }

    def list_services(self, options: dict):
        params = self._token_params(
            {
                "pageNo": options.get("pageNo") or 1,
                "pageSize": options.get("pageSize") or 20,
                "namespaceId": options.get("namespace") or self._config.namespace or "public",
                "groupName": options.get("groupName") or "",
            }
        )
        return self._request("GET", "/nacos/v1/ns/service/list", params=params)

    def get_service(self, options: dict):
        service_name = options.get("serviceName")
        if not service_name:
            raise ValueError("Service name is required. Use --service-name.")
        params = self._token_params(
            {
                "serviceName": service_name,
                "groupName": options.get("groupName") or "DEFAULT_GROUP",
                "namespaceId": options.get("namespace") or self._config.namespace or "public",
            }
        )
        try:
            return self._request("GET", "/nacos/v1/ns/service", params=params)
        except httpx.HTTPStatusError:
            qualified = service_name if "@@" in service_name else f"{params['groupName']}@@{service_name}"
            params["serviceName"] = qualified
            return self._request("GET", "/nacos/v1/ns/service", params=params)

    def list_instances(self, options: dict):
        service_name = options.get("serviceName")
        if not service_name:
            raise ValueError("Service name is required. Use --service-name.")
        params = self._token_params(
            {
                "serviceName": service_name,
                "groupName": options.get("groupName") or "DEFAULT_GROUP",
                "namespaceId": options.get("namespace") or self._config.namespace or "public",
                "clusterName": options.get("clusterName") or "",
                "healthyOnly": str(bool(options.get("healthyOnly"))).lower(),
            }
        )
        try:
            return self._request("GET", "/nacos/v1/ns/instance/list", params=params)
        except httpx.HTTPStatusError:
            qualified = service_name if "@@" in service_name else f"{params['groupName']}@@{service_name}"
            params["serviceName"] = qualified
            return self._request("GET", "/nacos/v1/ns/instance/list", params=params)
