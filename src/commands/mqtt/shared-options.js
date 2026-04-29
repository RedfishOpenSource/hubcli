export const sharedOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--url <mqtt-url>', description: 'MQTT broker URL' },
  { flags: '--host <host>', description: 'MQTT broker host' },
  { flags: '--port <port>', description: 'MQTT broker port' },
  { flags: '--username <name>', description: 'MQTT username' },
  { flags: '--password <password>', description: 'MQTT password' },
  { flags: '--client-id <id>', description: 'MQTT client ID' },
  { flags: '--protocol-version <version>', description: 'MQTT protocol version: 3.1.1 or 5' },
  { flags: '--keepalive <seconds>', description: 'keepalive interval in seconds' },
  { flags: '--clean-start', description: 'start a clean session' },
  { flags: '--session-expiry <seconds>', description: 'MQTT 5 session expiry interval in seconds' },
  { flags: '--timeout <seconds>', description: 'operation timeout in seconds' },
  { flags: '--tls', description: 'enable TLS for host/port connections' },
  { flags: '--ca-cert <path>', description: 'CA certificate path for TLS' },
  { flags: '--client-cert <path>', description: 'client certificate path for TLS' },
  { flags: '--client-key <path>', description: 'client private key path for TLS' },
  { flags: '--insecure', description: 'disable TLS certificate verification' }
];

export const publishOptions = [
  { flags: '--qos <level>', description: 'publish QoS level: 0, 1, or 2' },
  { flags: '--retain', description: 'publish as retained message' },
  { flags: '--body <text>', description: 'message body text' },
  { flags: '--body-file <path>', description: 'read message body from file' },
  { flags: '--content-type <type>', description: 'MQTT 5 content type' },
  { flags: '--message-expiry <seconds>', description: 'MQTT 5 message expiry interval in seconds' },
  { flags: '--user-property <key=value>', description: 'MQTT 5 user property, repeatable' }
];

export const subscribeOptions = [
  { flags: '--qos <level>', description: 'subscription QoS level: 0, 1, or 2' },
  { flags: '--max-messages <n>', description: 'maximum messages to receive before exit' },
  { flags: '--user-property <key=value>', description: 'MQTT 5 user property, repeatable' }
];
