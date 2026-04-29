from __future__ import annotations

import queue
import ssl
import threading
import uuid

try:
    import paho.mqtt.client as mqtt
    from paho.mqtt.properties import Properties
    from paho.mqtt.packettypes import PacketTypes
except ModuleNotFoundError:
    mqtt = None
    Properties = None
    PacketTypes = None


CONNECT_FLAGS_SESSION_PRESENT = 'session present'

from hubcli_worker.tasks.common import build_cert, build_verify
from hubcli_worker.tasks.mqtt.models import MqttConfig


MQTT_PROTOCOL_MAP = {
    '3.1.1': mqtt.MQTTv311 if mqtt else None,
    '5': mqtt.MQTTv5 if mqtt else None,
}


class MqttClient:
    def __init__(self, config: MqttConfig):
        self._config = config
        self._require_paho()
        self._host, self._port, self._use_tls = self._resolve_target(config)
        self._session_present = False

    def ping(self) -> dict:
        client = self._create_client()
        try:
            self._connect(client)
            return {
                'message': 'MQTT reachable.',
                'host': self._host,
                'port': self._port,
                'protocolVersion': self._config.protocol_version,
                'tls': self._use_tls,
                'sessionPresent': self._session_present,
            }
        finally:
            self._disconnect(client)

    def publish(self, topic: str, options: dict) -> dict:
        client = self._create_client()
        try:
            self._connect(client)
            info = client.publish(
                topic,
                payload=(options.get('body') or '').encode('utf-8'),
                qos=self._get_qos(options),
                retain=bool(options.get('retain')),
                properties=self._build_publish_properties(options),
            )
            info.wait_for_publish(timeout=self._config.timeout)
            if not info.is_published():
                raise ValueError('MQTT publish timed out before completion.')
            return {
                'message': 'Message published.',
                'topic': topic,
                'qos': self._get_qos(options),
                'retain': bool(options.get('retain')),
            }
        finally:
            self._disconnect(client)

    def subscribe(self, topic_filter: str, options: dict) -> list[dict]:
        client = self._create_client()
        messages: queue.Queue = queue.Queue()
        errors: queue.Queue = queue.Queue()
        max_messages = int(options.get('maxMessages') or 1)
        done = threading.Event()

        def on_message(_client, _userdata, message):
            messages.put(
                {
                    'topic': message.topic,
                    'qos': message.qos,
                    'retain': message.retain,
                    'payload': message.payload.decode('utf-8', errors='replace'),
                }
            )
            if messages.qsize() >= max_messages:
                done.set()

        def on_disconnect(_client, _userdata, _flags, reason_code, _properties=None):
            if done.is_set():
                return
            if self._reason_code_value(reason_code) != 0:
                errors.put(f'MQTT subscribe disconnected unexpectedly: {reason_code}')
                done.set()

        client.on_message = on_message
        client.on_disconnect = on_disconnect

        try:
            self._connect(client)
            result, _ = client.subscribe(topic_filter, qos=self._get_qos(options))
            if result != mqtt.MQTT_ERR_SUCCESS:
                raise ValueError(f'MQTT subscribe failed with result code {result}.')
            if not done.wait(self._config.timeout):
                done.set()

            if not errors.empty():
                raise ValueError(errors.get())

            return [messages.get() for _ in range(messages.qsize())]
        finally:
            self._disconnect(client)

    def session_info(self) -> dict:
        client = self._create_client()
        try:
            self._connect(client)
            return {
                'message': 'MQTT session established.',
                'clientId': client._client_id.decode('utf-8', errors='replace'),
                'protocolVersion': self._config.protocol_version,
                'keepalive': self._config.keepalive,
                'cleanStart': self._config.clean_start,
                'sessionExpiry': self._config.session_expiry,
                'sessionPresent': self._session_present,
                'tls': self._use_tls,
            }
        finally:
            self._disconnect(client)

    def retained_get(self, topic: str, options: dict) -> dict:
        messages = self.subscribe(topic, {**options, 'maxMessages': 1})
        if not messages:
            return {'topic': topic, 'retained': False, 'message': 'No retained message found.'}
        message = messages[0]
        return {
            'topic': topic,
            'retained': bool(message.get('retain')),
            'payload': message.get('payload'),
            'qos': message.get('qos'),
        }

    def retained_clear(self, topic: str) -> dict:
        client = self._create_client()
        try:
            self._connect(client)
            info = client.publish(topic, payload=b'', qos=0, retain=True)
            info.wait_for_publish(timeout=self._config.timeout)
            if not info.is_published():
                raise ValueError('MQTT retained clear timed out before completion.')
            return {'message': 'Retained message cleared.', 'topic': topic}
        finally:
            self._disconnect(client)

    def _require_paho(self) -> None:
        if mqtt is None:
            raise ModuleNotFoundError('Missing Python dependency: paho.mqtt.client')

    def _resolve_target(self, config: MqttConfig) -> tuple[str, int, bool]:
        if config.parsed_url:
            parsed = config.parsed_url
            if parsed.scheme not in {'mqtt', 'mqtts'}:
                raise ValueError('MQTT URL must use mqtt:// or mqtts://.')
            host = parsed.hostname
            port = parsed.port or (8883 if parsed.scheme == 'mqtts' else 1883)
            if not host:
                raise ValueError('MQTT URL must include a host.')
            return host, port, parsed.scheme == 'mqtts'

        if not config.host:
            raise ValueError('MQTT connection is required. Use --url or --host.')
        return config.host, config.port or 1883, config.tls_enabled

    def _create_client(self):
        protocol = MQTT_PROTOCOL_MAP[self._config.protocol_version]
        client_id = self._config.client_id or f'hubcli-{uuid.uuid4().hex[:12]}'
        client = mqtt.Client(client_id=client_id, protocol=protocol, callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
        if self._config.username:
            client.username_pw_set(self._config.username, self._config.password)
        if self._use_tls:
            self._configure_tls(client)
        return client

    def _configure_tls(self, client) -> None:
        cert = build_cert(self._config)
        client.tls_set(
            ca_certs=str(self._config.tls.ca_cert) if self._config.tls.ca_cert else None,
            certfile=cert[0] if cert else None,
            keyfile=cert[1] if cert else None,
            tls_version=ssl.PROTOCOL_TLS_CLIENT,
        )
        client.tls_insecure_set(not build_verify(self._config))

    def _reason_code_value(self, reason_code) -> int:
        if isinstance(reason_code, int):
            return reason_code
        value = getattr(reason_code, 'value', None)
        if isinstance(value, int):
            return value
        try:
            return int(reason_code)
        except (TypeError, ValueError):
            if str(reason_code) == 'Success':
                return 0
            return -1

    def _connect(self, client) -> None:
        connected = threading.Event()
        errors: queue.Queue = queue.Queue()

        def on_connect(_client, _userdata, flags, reason_code, _properties=None):
            if self._reason_code_value(reason_code) != 0:
                errors.put(f'MQTT connect failed: {reason_code}')
            if hasattr(flags, 'session_present'):
                self._session_present = bool(flags.session_present)
            elif isinstance(flags, dict):
                self._session_present = bool(flags.get(CONNECT_FLAGS_SESSION_PRESENT))
            else:
                self._session_present = False
            connected.set()

        client.on_connect = on_connect
        client.connect(**self._build_connect_kwargs())
        client.loop_start()
        if not connected.wait(self._config.timeout):
            client.loop_stop()
            raise TimeoutError('MQTT connect timed out.')
        if not errors.empty():
            client.loop_stop()
            raise ValueError(errors.get())

    def _disconnect(self, client) -> None:
        try:
            client.disconnect()
        except Exception:
            pass
        try:
            client.loop_stop()
        except Exception:
            pass

    def _build_publish_properties(self, options: dict):
        if self._config.protocol_version != '5' or Properties is None or PacketTypes is None:
            return None
        properties = Properties(PacketTypes.PUBLISH)
        if options.get('contentType'):
            properties.ContentType = str(options['contentType'])
        if options.get('messageExpiry') is not None:
            properties.MessageExpiryInterval = int(options['messageExpiry'])
        if options.get('userProperties'):
            properties.UserProperty = [(str(key), str(value)) for key, value in options['userProperties']]
        return properties

    def _build_connect_properties(self):
        if self._config.protocol_version != '5' or Properties is None or PacketTypes is None:
            return None
        if self._config.session_expiry is None:
            return None
        properties = Properties(PacketTypes.CONNECT)
        properties.SessionExpiryInterval = int(self._config.session_expiry)
        return properties

    def _build_connect_kwargs(self) -> dict:
        kwargs = {
            'host': self._host,
            'port': self._port,
            'keepalive': self._config.keepalive,
        }
        if self._config.protocol_version == '5':
            kwargs['clean_start'] = mqtt.MQTT_CLEAN_START_FIRST_ONLY if self._config.clean_start else False
            kwargs['properties'] = self._build_connect_properties()
        return kwargs

    def _get_qos(self, options: dict) -> int:
        qos = int(options.get('qos') or 0)
        if qos not in {0, 1, 2}:
            raise ValueError('MQTT QoS must be 0, 1, or 2.')
        return qos
