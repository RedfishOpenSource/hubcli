from __future__ import annotations

from hubcli_worker.tasks.mqtt.client import MqttClient
from hubcli_worker.tasks.mqtt.config import build_mqtt_config


SUPPORTED_OPERATIONS = {
    'ping',
    'publish',
    'subscribe',
    'session.info',
    'retained.get',
    'retained.clear',
}


def _require_topic(options: dict, key: str, message: str) -> str:
    value = options.get(key)
    if not value:
        raise ValueError(message)
    return str(value)


def run_operation(operation: str, options: dict) -> object:
    if operation not in SUPPORTED_OPERATIONS:
        raise ValueError(f'Unsupported MQTT operation: {operation}')

    config = build_mqtt_config(options)
    client = MqttClient(config)

    if operation == 'ping':
        return client.ping()
    if operation == 'publish':
        topic = _require_topic(options, 'topic', 'MQTT topic is required for publish.')
        if options.get('body') is None:
            raise ValueError('MQTT publish requires --body or --body-file.')
        return client.publish(topic, options)
    if operation == 'subscribe':
        topic_filter = _require_topic(options, 'topicFilter', 'MQTT topic filter is required for subscribe.')
        return client.subscribe(topic_filter, options)
    if operation == 'session.info':
        return client.session_info()
    if operation == 'retained.get':
        topic = _require_topic(options, 'topic', 'MQTT topic is required for retained get.')
        return client.retained_get(topic, options)
    if operation == 'retained.clear':
        topic = _require_topic(options, 'topic', 'MQTT topic is required for retained clear.')
        return client.retained_clear(topic)

    raise ValueError(f'Unsupported MQTT operation: {operation}')
