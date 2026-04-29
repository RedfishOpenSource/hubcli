from __future__ import annotations

import ipaddress
import json
import socket
import time
from itertools import count
from typing import Any

from hubcli_worker.tasks.rocketmq4.models import RocketMqRuntime


GET_ROUTEINFO_BY_TOPIC = 105
GET_ALL_TOPIC_LIST_FROM_NAMESERVER = 206
SEND_MESSAGE = 10
SUCCESS_CODES = {0}
SEND_SUCCESS_CODES = {0, 10, 11, 12}
PROPERTY_NAME_SEPARATOR = '\x01'
PROPERTY_ENTRY_SEPARATOR = '\x02'
DEFAULT_PRODUCER_GROUP = 'HUBCLI_PRODUCER'
DEFAULT_TOPIC = 'TBW102'
DEFAULT_TOPIC_QUEUE_NUMS = 4
MASTER_BROKER_ID = '0'
RESPONSE_CODE_MESSAGES = {
    10: 'Flush disk timeout',
    11: 'Slave not available',
    12: 'Flush slave timeout',
}


class RocketMqNativeClient:
    def __init__(self, runtime: RocketMqRuntime) -> None:
        self.runtime = runtime
        self._opaque = count(1)

    def ping(self) -> dict[str, Any]:
        if not self.runtime.namesrv:
            return {
                'message': 'RocketMQ4 native worker is ready.',
                'namesrvConfigured': False,
                'timeout': self.runtime.timeout,
            }

        endpoint, _, body = self._request_namesrv(GET_ALL_TOPIC_LIST_FROM_NAMESERVER)
        topics = self._extract_topic_names(self._decode_json_body(body, 'topic list response'))
        return {
            'message': 'RocketMQ4 native worker can reach the configured NameServer.',
            'namesrvConfigured': True,
            'endpoint': endpoint,
            'topicCount': len(topics),
        }

    def list_topics(self) -> list[str]:
        _, _, body = self._request_namesrv(GET_ALL_TOPIC_LIST_FROM_NAMESERVER)
        return self._extract_topic_names(self._decode_json_body(body, 'topic list response'))

    def topic_route(self, topic: str) -> dict[str, Any]:
        _, _, body = self._request_namesrv(
            GET_ROUTEINFO_BY_TOPIC,
            {
                'topic': topic,
                'acceptStandardJsonOnly': True,
            },
        )
        route_data = self._decode_json_body(body, 'topic route response')
        if not isinstance(route_data, dict):
            raise ValueError('RocketMQ returned an unexpected topic route payload.')
        route_data.setdefault('topic', topic)
        return route_data

    def send_message(
        self,
        topic: str,
        body: str,
        producer_group: str | None = None,
        tag: str | None = None,
        keys: str | None = None,
        properties: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        route_data = self.topic_route(topic)
        broker_addr, queue_id = self._resolve_publish_target(route_data)
        try:
            header, _, _ = self._request_endpoint(
                broker_addr,
                SEND_MESSAGE,
                {
                    'producerGroup': producer_group or DEFAULT_PRODUCER_GROUP,
                    'topic': topic,
                    'defaultTopic': DEFAULT_TOPIC,
                    'defaultTopicQueueNums': DEFAULT_TOPIC_QUEUE_NUMS,
                    'queueId': queue_id,
                    'sysFlag': 0,
                    'bornTimestamp': int(time.time() * 1000),
                    'flag': 0,
                    'properties': self._encode_properties(properties, tag, keys),
                    'reconsumeTimes': 0,
                    'unitMode': False,
                    'batch': False,
                    'maxReconsumeTimes': 0,
                },
                body.encode('utf-8'),
                allowed_codes=SEND_SUCCESS_CODES,
            )
        except (TimeoutError, OSError) as error:
            raise ValueError(self._format_broker_connect_error(broker_addr, error)) from error
        ext_fields = header.get('extFields') or {}
        response_code = int(header.get('code', 0))
        result = {
            'message': 'Message sent.',
            'topic': topic,
            'broker': broker_addr,
            'queueId': self._parse_int(ext_fields.get('queueId'), default=queue_id),
            'queueOffset': self._parse_int(ext_fields.get('queueOffset')),
            'msgId': ext_fields.get('msgId'),
            'status': RESPONSE_CODE_MESSAGES.get(response_code, 'OK'),
        }
        if ext_fields.get('transactionId'):
            result['transactionId'] = ext_fields['transactionId']
        return result

    def _request_namesrv(
        self,
        request_code: int,
        ext_fields: dict[str, Any] | None = None,
        body: bytes = b'',
        allowed_codes: set[int] | None = None,
    ) -> tuple[str, dict[str, Any], bytes]:
        if not self.runtime.namesrv:
            raise ValueError('RocketMQ nameserver is required. Pass --namesrv or set HUBCLI_ROCKETMQ_NAMESRV.')

        last_error: Exception | None = None
        for endpoint in self._parse_namesrv_entries(self.runtime.namesrv):
            try:
                header, response_body, _ = self._request_endpoint(endpoint, request_code, ext_fields, body, allowed_codes)
                return endpoint, header, response_body
            except Exception as error:
                last_error = error

        raise ValueError(f'Failed to reach RocketMQ nameserver {self.runtime.namesrv}: {last_error}')

    def _request_endpoint(
        self,
        endpoint: str,
        request_code: int,
        ext_fields: dict[str, Any] | None = None,
        body: bytes = b'',
        allowed_codes: set[int] | None = None,
    ) -> tuple[dict[str, Any], bytes, int]:
        host, port = self._parse_endpoint(endpoint)
        command = {
            'code': request_code,
            'language': 'JAVA',
            'version': 0,
            'opaque': next(self._opaque),
            'flag': 0,
            'remark': None,
            'extFields': self._stringify_ext_fields(ext_fields),
            'serializeTypeCurrentRPC': 'JSON',
        }
        frame = self._encode_frame(command, body)

        with socket.create_connection((host, port), timeout=self.runtime.timeout) as conn:
            conn.settimeout(self.runtime.timeout)
            conn.sendall(frame)
            total_length = int.from_bytes(self._read_exact(conn, 4), byteorder='big', signed=False)
            payload = self._read_exact(conn, total_length)

        header, response_body, serialize_type = self._decode_frame(payload)
        self._ensure_success(header, allowed_codes or SUCCESS_CODES)
        return header, response_body, serialize_type

    def _encode_frame(self, command: dict[str, Any], body: bytes) -> bytes:
        header_bytes = json.dumps(command, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        header_length = len(header_bytes)
        if header_length > 0xFFFFFF:
            raise ValueError('RocketMQ request header is too large.')

        total_length = 4 + header_length + len(body)
        protocol_mark = bytes([0, (header_length >> 16) & 0xFF, (header_length >> 8) & 0xFF, header_length & 0xFF])
        return total_length.to_bytes(4, byteorder='big', signed=False) + protocol_mark + header_bytes + body

    def _decode_frame(self, payload: bytes) -> tuple[dict[str, Any], bytes, int]:
        if len(payload) < 4:
            raise ValueError('RocketMQ response frame is truncated.')

        header_mark = payload[:4]
        serialize_type = header_mark[0]
        header_length = int.from_bytes(header_mark[1:4], byteorder='big', signed=False)
        header_end = 4 + header_length
        if len(payload) < header_end:
            raise ValueError('RocketMQ response header is truncated.')

        header_bytes = payload[4:header_end]
        body = payload[header_end:]
        try:
            header = json.loads(header_bytes.decode('utf-8'))
        except json.JSONDecodeError as error:
            raise ValueError(f'Failed to decode RocketMQ response header: {error}') from error
        return header, body, serialize_type

    def _ensure_success(self, header: dict[str, Any], allowed_codes: set[int]) -> None:
        code = self._parse_int(header.get('code'), default=-1)
        if code in allowed_codes:
            return
        remark = header.get('remark')
        if remark:
            raise ValueError(str(remark))
        raise ValueError(f'RocketMQ request failed with response code {code}.')

    def _decode_json_body(self, body: bytes, label: str) -> Any:
        if not body:
            return {}
        try:
            return json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as error:
            raise ValueError(f'Failed to decode RocketMQ {label}: {error}') from error

    def _extract_topic_names(self, payload: Any) -> list[str]:
        if isinstance(payload, dict):
            topics = payload.get('topicList')
            if isinstance(topics, dict):
                topics = topics.get('topicList')
            if isinstance(topics, list):
                return sorted(str(topic) for topic in topics)
        raise ValueError('RocketMQ returned an unexpected topic list payload.')

    def _resolve_publish_target(self, route_data: dict[str, Any]) -> tuple[str, int]:
        queue_datas = route_data.get('queueDatas') or []
        broker_datas = route_data.get('brokerDatas') or []
        if not queue_datas or not broker_datas:
            raise ValueError('RocketMQ topic route data does not include writable brokers.')

        selected_queue = None
        for queue_data in queue_datas:
            write_queue_nums = self._parse_int(queue_data.get('writeQueueNums'), default=0)
            if write_queue_nums > 0:
                selected_queue = queue_data
                break
        if selected_queue is None:
            raise ValueError('RocketMQ topic route data does not include writable queues.')

        broker_name = selected_queue.get('brokerName')
        for broker_data in broker_datas:
            if broker_data.get('brokerName') != broker_name:
                continue
            broker_addrs = broker_data.get('brokerAddrs') or {}
            master_addr = broker_addrs.get(MASTER_BROKER_ID) or broker_addrs.get(0)
            if master_addr:
                return str(master_addr), 0

        raise ValueError('RocketMQ topic route data does not include a master broker.')

    def _encode_properties(self, properties: dict[str, Any] | None, tag: str | None, keys: str | None) -> str:
        merged: dict[str, str] = {}
        if properties is not None:
            if not isinstance(properties, dict):
                raise ValueError('RocketMQ message properties must be a JSON object.')
            for key, value in properties.items():
                merged[str(key)] = '' if value is None else str(value)
        if tag:
            merged['TAGS'] = str(tag)
        if keys:
            merged['KEYS'] = str(keys)
        return ''.join(f'{key}{PROPERTY_NAME_SEPARATOR}{value}{PROPERTY_ENTRY_SEPARATOR}' for key, value in merged.items())

    def _stringify_ext_fields(self, ext_fields: dict[str, Any] | None) -> dict[str, str]:
        if not ext_fields:
            return {}
        normalized: dict[str, str] = {}
        for key, value in ext_fields.items():
            if value is None:
                continue
            if isinstance(value, bool):
                normalized[key] = 'true' if value else 'false'
            else:
                normalized[key] = str(value)
        return normalized

    def _parse_namesrv_entries(self, namesrv: str) -> list[str]:
        entries = [entry.strip() for entry in namesrv.replace(';', ',').split(',') if entry.strip()]
        if not entries:
            raise ValueError('RocketMQ nameserver list is empty.')
        return entries

    def _parse_endpoint(self, endpoint: str) -> tuple[str, int]:
        if endpoint.startswith('['):
            host, rest = endpoint[1:].split(']', 1)
            if not rest.startswith(':'):
                raise ValueError(f'Invalid RocketMQ endpoint: {endpoint}')
            return host, int(rest[1:])

        host, separator, port_text = endpoint.rpartition(':')
        if not separator or not host or not port_text:
            raise ValueError(f'Invalid RocketMQ endpoint: {endpoint}')
        return host, int(port_text)

    def _format_broker_connect_error(self, broker_addr: str, error: BaseException) -> str:
        host, _ = self._parse_endpoint(broker_addr)
        message = f'Failed to reach RocketMQ broker {broker_addr}: {error}'
        if self._host_looks_private(host):
            message += ' The topic route resolved to a private broker address, so this broker may only be reachable from inside the RocketMQ network.'
        return message

    def _host_looks_private(self, host: str) -> bool:
        if host in {'localhost', '127.0.0.1', '::1'}:
            return True
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            return False
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved

    def _read_exact(self, conn: socket.socket, length: int) -> bytes:
        chunks = bytearray()
        while len(chunks) < length:
            chunk = conn.recv(length - len(chunks))
            if not chunk:
                raise ValueError('RocketMQ closed the connection before the full response was received.')
            chunks.extend(chunk)
        return bytes(chunks)

    def _parse_int(self, value: Any, default: int | None = None) -> int | None:
        if value is None or value == '':
            return default
        return int(value)
