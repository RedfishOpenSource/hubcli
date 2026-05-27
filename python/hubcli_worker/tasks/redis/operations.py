from __future__ import annotations

from hubcli_worker.tasks.redis.client import RedisClient
from hubcli_worker.tasks.redis.config import build_redis_config


SUPPORTED_OPERATIONS = {
    'ping',
    'info',
    'dbsize',
    'key.scan',
    'key.get',
    'key.set',
    'key.delete',
    'key.exists',
    'key.ttl',
    'key.expire',
}


def _require_key(options: dict) -> str:
    key = options.get('key')
    if not key:
        raise ValueError('Redis key is required.')
    return str(key)


def _positive_int(value: object, label: str) -> int:
    result = int(value)
    if result <= 0:
        raise ValueError(f'{label} must be greater than 0.')
    return result


def _get_optional_positive_int(options: dict, key: str, label: str) -> int | None:
    value = options.get(key)
    if value is None:
        return None
    return _positive_int(value, label)


def _run_operation(client: RedisClient, operation: str, options: dict) -> object:
    if operation == 'ping':
        return client.ping()
    if operation == 'info':
        return client.info(options.get('section'))
    if operation == 'dbsize':
        return client.dbsize()
    if operation == 'key.scan':
        return client.scan_keys(
            pattern=options.get('pattern'),
            count=_get_optional_positive_int(options, 'count', 'Redis scan count'),
            limit=_get_optional_positive_int(options, 'limit', 'Redis scan limit'),
        )
    if operation == 'key.get':
        return client.get_value(_require_key(options))
    if operation == 'key.set':
        key = _require_key(options)
        if options.get('value') is None:
            raise ValueError('Redis set requires --value or --file.')
        if options.get('nx') and options.get('xx'):
            raise ValueError('Use either --nx or --xx, not both.')
        return client.set_value(
            key,
            str(options.get('value')),
            ttl=_get_optional_positive_int(options, 'ttl', 'Redis TTL'),
            nx=bool(options.get('nx')),
            xx=bool(options.get('xx')),
        )
    if operation == 'key.delete':
        return client.delete_key(_require_key(options))
    if operation == 'key.exists':
        return client.key_exists(_require_key(options))
    if operation == 'key.ttl':
        return client.key_ttl(_require_key(options))
    if operation == 'key.expire':
        ttl = options.get('ttl')
        if ttl is None:
            raise ValueError('Redis expire requires --ttl.')
        return client.expire_key(_require_key(options), _positive_int(ttl, 'Redis TTL'))
    raise ValueError(f'Unsupported Redis operation: {operation}')


def run_operation(operation: str, options: dict) -> object:
    if operation not in SUPPORTED_OPERATIONS:
        raise ValueError(f'Unsupported Redis operation: {operation}')

    client = RedisClient(build_redis_config(options))
    try:
        return _run_operation(client, operation, options)
    finally:
        client.close()
