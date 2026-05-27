from __future__ import annotations

import redis

from hubcli_worker.tasks.redis.models import RedisConfig


class RedisClient:
    def __init__(self, config: RedisConfig):
        self._config = config
        self._client = self._create_client(config)

    def close(self) -> None:
        self._client.close()

    def ping(self) -> dict:
        self._client.ping()
        return {
            'message': 'Redis reachable.',
            'host': self._config.host,
            'port': self._config.port,
            'database': self._config.database if self._config.database is not None else 0,
            'tls': self._is_tls_enabled(),
        }

    def info(self, section: str | None = None) -> dict:
        return self._client.info(section=section)

    def dbsize(self) -> dict:
        return {'database': self._config.database, 'keys': self._client.dbsize()}

    def scan_keys(self, pattern: str | None = None, count: int | None = None, limit: int | None = None) -> dict:
        cursor = 0
        keys: list[str] = []
        while True:
            cursor, batch = self._client.scan(cursor=cursor, match=pattern, count=count)
            keys.extend(str(key) for key in batch)
            if limit and len(keys) >= limit:
                keys = keys[:limit]
                break
            if cursor == 0:
                break
        return {'cursor': cursor, 'keys': keys, 'count': len(keys)}

    def get_value(self, key: str) -> dict:
        return {'key': key, 'value': self._client.get(key)}

    def set_value(self, key: str, value: str, ttl: int | None = None, nx: bool = False, xx: bool = False) -> dict:
        result = self._client.set(key, value, ex=ttl, nx=nx, xx=xx)
        return {'message': 'Key set.' if result else 'Key not set.', 'key': key, 'set': bool(result)}

    def delete_key(self, key: str) -> dict:
        deleted = self._client.delete(key)
        return {'message': 'Key deleted.' if deleted else 'Key not found.', 'key': key, 'deleted': deleted}

    def key_exists(self, key: str) -> dict:
        exists = self._client.exists(key)
        return {'key': key, 'exists': bool(exists)}

    def key_ttl(self, key: str) -> dict:
        return {'key': key, 'ttl': self._client.ttl(key)}

    def expire_key(self, key: str, ttl: int) -> dict:
        result = self._client.expire(key, ttl)
        return {'message': 'Expiration set.' if result else 'Key not found.', 'key': key, 'ttl': ttl, 'updated': bool(result)}

    def _create_client(self, config: RedisConfig):
        kwargs = {
            'decode_responses': True,
            'socket_connect_timeout': config.timeout,
            'socket_timeout': config.timeout,
        }
        if config.username:
            kwargs['username'] = config.username
        if config.password:
            kwargs['password'] = config.password

        if config.url:
            kwargs['db'] = config.database
            kwargs.update(self._build_tls_kwargs(config, for_url=True))
            return redis.Redis.from_url(self._build_url(config), **{key: value for key, value in kwargs.items() if value is not None})

        if not config.host:
            raise ValueError('Redis connection is required. Use --url or --host.')

        return redis.Redis(
            host=config.host,
            port=config.port,
            db=config.database or 0,
            **kwargs,
            **self._build_tls_kwargs(config, for_url=False),
        )

    def _is_tls_enabled(self) -> bool:
        return self._config.tls_enabled or bool(self._config.url and self._config.url.startswith('rediss://'))

    def _build_url(self, config: RedisConfig) -> str:
        if config.tls_enabled and config.url and config.url.startswith('redis://'):
            return f"rediss://{config.url[len('redis://') :]}"
        return config.url or ''

    def _build_tls_kwargs(self, config: RedisConfig, for_url: bool = False) -> dict:
        if config.tls.verify and not config.tls_enabled and not any((config.tls.ca_cert, config.tls.client_cert, config.tls.client_key)):
            return {}

        kwargs = {
            'ssl_cert_reqs': 'required' if config.tls.verify else 'none',
        }
        if config.tls_enabled and not for_url:
            kwargs['ssl'] = True
        if config.tls.ca_cert:
            kwargs['ssl_ca_certs'] = str(config.tls.ca_cert)
        if config.tls.client_cert:
            kwargs['ssl_certfile'] = str(config.tls.client_cert)
        if config.tls.client_key:
            kwargs['ssl_keyfile'] = str(config.tls.client_key)
        return kwargs
