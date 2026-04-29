from __future__ import annotations

import json
from pathlib import Path

from hubcli_worker.tasks.rocketmq4.client import RocketMqNativeClient
from hubcli_worker.tasks.rocketmq4.config import build_rocketmq_runtime


SUPPORTED_OPERATIONS = {
    'ping',
    'topic.list',
    'topic.route',
    'message.send',
}


def _ensure_namesrv(runtime, operation: str) -> None:
    if operation == 'ping':
        return
    if not runtime.namesrv:
        raise ValueError('RocketMQ nameserver is required. Pass --namesrv or set HUBCLI_ROCKETMQ_NAMESRV.')


def _write_output_file(path: str, data: object) -> dict:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        output_path.write_text(data, encoding='utf-8')
    else:
        output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'message': f'Written to {output_path}'}


def _get_topic_name(options: dict) -> str:
    topic_name = options.get('topicName') or options.get('topic')
    if not topic_name:
        raise ValueError('RocketMQ topic name is required.')
    return str(topic_name)


def run_operation(operation: str, options: dict) -> object:
    if operation not in SUPPORTED_OPERATIONS:
        raise ValueError(f'Unsupported RocketMQ4 native operation: {operation}')

    runtime = build_rocketmq_runtime(options)
    client = RocketMqNativeClient(runtime)

    if operation == 'ping':
        parsed = client.ping()
    elif operation == 'topic.list':
        _ensure_namesrv(runtime, operation)
        parsed = client.list_topics()
    elif operation == 'topic.route':
        _ensure_namesrv(runtime, operation)
        parsed = client.topic_route(_get_topic_name(options))
    elif operation == 'message.send':
        _ensure_namesrv(runtime, operation)
        body = options.get('body')
        if body in (None, ''):
            raise ValueError('RocketMQ message body is required. Pass --body or --body-file.')
        parsed = client.send_message(
            topic=_get_topic_name(options),
            body=str(body),
            producer_group=options.get('group'),
            tag=options.get('tag'),
            keys=options.get('keys'),
            properties=options.get('properties'),
        )
    else:
        raise ValueError(f'Unsupported RocketMQ4 native operation: {operation}')

    output = options.get('output')
    return _write_output_file(output, parsed) if output else parsed
