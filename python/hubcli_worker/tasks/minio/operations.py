from __future__ import annotations

from hubcli_worker.tasks.minio.client import MinioClient
from hubcli_worker.tasks.minio.config import build_minio_config


SUPPORTED_OPERATIONS = {
    'ping',
    'bucket.list',
    'bucket.stat',
    'bucket.create',
    'bucket.delete',
    'object.list',
    'object.stat',
    'object.get',
    'object.put',
    'object.delete',
}


def _option_value(options: dict, key: str, message: str) -> str:
    value = options.get(key)
    if not value:
        raise ValueError(message)
    return str(value)


def _run_operation(client: MinioClient, operation: str, options: dict) -> object:
    if operation == 'ping':
        return client.ping()
    if operation == 'bucket.list':
        return client.list_buckets()
    if operation == 'bucket.stat':
        return client.stat_bucket(_option_value(options, 'bucketName', 'Bucket name is required.'))
    if operation == 'bucket.create':
        return client.create_bucket(_option_value(options, 'bucketName', 'Bucket name is required.'))
    if operation == 'bucket.delete':
        return client.delete_bucket(_option_value(options, 'bucketName', 'Bucket name is required.'))
    if operation == 'object.list':
        return client.list_objects(_option_value(options, 'bucketName', 'Bucket name is required.'), options)
    if operation == 'object.stat':
        return client.stat_object(
            _option_value(options, 'bucketName', 'Bucket name is required.'),
            _option_value(options, 'objectKey', 'Object key is required.'),
        )
    if operation == 'object.get':
        return client.get_object(
            _option_value(options, 'bucketName', 'Bucket name is required.'),
            _option_value(options, 'objectKey', 'Object key is required.'),
            _option_value(options, 'output', 'Output path is required. Use --output.'),
        )
    if operation == 'object.put':
        return client.put_object(
            _option_value(options, 'bucketName', 'Bucket name is required.'),
            _option_value(options, 'objectKey', 'Object key is required.'),
            _option_value(options, 'file', 'Input file is required. Use --file.'),
            options.get('contentType'),
        )
    if operation == 'object.delete':
        return client.delete_object(
            _option_value(options, 'bucketName', 'Bucket name is required.'),
            _option_value(options, 'objectKey', 'Object key is required.'),
        )
    raise ValueError(f'Unsupported MinIO operation: {operation}')


def run_operation(operation: str, options: dict) -> object:
    if operation not in SUPPORTED_OPERATIONS:
        raise ValueError(f'Unsupported MinIO operation: {operation}')
    client = MinioClient(build_minio_config(options))
    return _run_operation(client, operation, options)
