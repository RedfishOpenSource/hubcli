from __future__ import annotations

from pathlib import Path

from minio import Minio
from urllib3 import PoolManager

from hubcli_worker.tasks.common import build_cert, build_verify
from hubcli_worker.tasks.minio.models import MinioConfig


class MinioClient:
    def __init__(self, config: MinioConfig):
        if not config.endpoint:
            raise ValueError('MinIO endpoint is required. Use --endpoint or HUBCLI_MINIO_ENDPOINT.')
        if not config.access_key or not config.secret_key:
            raise ValueError('MinIO access key and secret key are required. Use --access-key/--secret-key or HUBCLI_MINIO_ACCESS_KEY/HUBCLI_MINIO_SECRET_KEY.')
        self._config = config
        self._client = Minio(
            endpoint=config.endpoint,
            access_key=config.access_key,
            secret_key=config.secret_key,
            secure=config.secure,
            region=config.region,
            http_client=self._build_http_client(),
        )

    def _build_http_client(self):
        cert = build_cert(self._config)
        cert_reqs = 'CERT_REQUIRED' if build_verify(self._config) else 'CERT_NONE'
        return PoolManager(
            timeout=self._config.timeout,
            cert_reqs=cert_reqs,
            ca_certs=str(self._config.tls.ca_cert) if self._config.tls.ca_cert else None,
            cert_file=cert[0] if cert else None,
            key_file=cert[1] if cert else None,
        )

    def ping(self) -> dict:
        self._client._url_open('GET', 'region')
        return {
            'message': 'MinIO reachable.',
            'endpoint': self._config.endpoint,
            'secure': self._config.secure,
        }

    def list_buckets(self) -> list[dict]:
        return [
            {
                'name': bucket.name,
                'creationDate': bucket.creation_date.isoformat() if bucket.creation_date else None,
            }
            for bucket in self._client.list_buckets()
        ]

    def stat_bucket(self, bucket_name: str) -> dict:
        region = self._client.get_bucket_location(bucket_name)
        return {
            'name': bucket_name,
            'exists': True,
            'region': region,
        }

    def create_bucket(self, bucket_name: str) -> dict:
        self._client.make_bucket(bucket_name, location=self._config.region)
        return {'message': 'Bucket created.', 'name': bucket_name, 'region': self._config.region}

    def delete_bucket(self, bucket_name: str) -> dict:
        self._client.remove_bucket(bucket_name)
        return {'message': 'Bucket deleted.', 'name': bucket_name}

    def list_objects(self, bucket_name: str, options: dict) -> list[dict]:
        objects = self._client.list_objects(
            bucket_name,
            prefix=options.get('prefix') or None,
            recursive=bool(options.get('recursive')),
            include_version=bool(options.get('includeVersions')),
        )
        return [
            {
                'key': item.object_name,
                'size': item.size,
                'etag': item.etag,
                'lastModified': item.last_modified.isoformat() if item.last_modified else None,
                'isDir': item.is_dir,
                'versionId': item.version_id,
            }
            for item in objects
        ]

    def stat_object(self, bucket_name: str, object_key: str) -> dict:
        stat = self._client.stat_object(bucket_name, object_key)
        return {
            'bucket': bucket_name,
            'key': object_key,
            'size': stat.size,
            'etag': stat.etag,
            'contentType': stat.content_type,
            'lastModified': stat.last_modified.isoformat() if stat.last_modified else None,
            'metadata': dict(stat.metadata or {}),
        }

    def get_object(self, bucket_name: str, object_key: str, output_path: str) -> dict:
        if not output_path:
            raise ValueError('Output path is required. Use --output.')
        target = Path(output_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        self._client.fget_object(bucket_name, object_key, str(target))
        return {'message': 'Object downloaded.', 'bucket': bucket_name, 'key': object_key, 'output': str(target)}

    def put_object(self, bucket_name: str, object_key: str, file_path: str, content_type: str | None = None) -> dict:
        if not file_path:
            raise ValueError('Input file is required. Use --file.')
        source = Path(file_path)
        if not source.is_file():
            raise ValueError(f'Input file not found: {source}')
        result = self._client.fput_object(bucket_name, object_key, str(source), content_type=content_type)
        return {
            'message': 'Object uploaded.',
            'bucket': bucket_name,
            'key': object_key,
            'etag': result.etag,
            'versionId': result.version_id,
        }

    def delete_object(self, bucket_name: str, object_key: str) -> dict:
        self._client.remove_object(bucket_name, object_key)
        return {'message': 'Object deleted.', 'bucket': bucket_name, 'key': object_key}
