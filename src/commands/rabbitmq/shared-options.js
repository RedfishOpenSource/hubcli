export const sharedOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--via <management|amqp>', description: 'force connection mode' },
  { flags: '--vhost <name>', description: 'RabbitMQ vhost' },
  { flags: '--mgmt-url <url>', description: 'RabbitMQ management API base URL' },
  { flags: '--mgmt-user <username>', description: 'RabbitMQ management username' },
  { flags: '--mgmt-pass <password>', description: 'RabbitMQ management password' },
  { flags: '--insecure', description: 'disable TLS certificate verification for management API' },
  { flags: '--ca-cert <path>', description: 'CA certificate path for TLS' },
  { flags: '--client-cert <path>', description: 'client certificate path for TLS' },
  { flags: '--client-key <path>', description: 'client private key path for TLS' },
  { flags: '--amqp-url <url>', description: 'RabbitMQ AMQP URL' },
  { flags: '--host <host>', description: 'RabbitMQ AMQP host' },
  { flags: '--port <port>', description: 'RabbitMQ AMQP port' },
  { flags: '--user <username>', description: 'RabbitMQ AMQP username' },
  { flags: '--pass <password>', description: 'RabbitMQ AMQP password' },
  { flags: '--heartbeat <seconds>', description: 'AMQP heartbeat interval in seconds' }
];

export const publishOptions = [
  { flags: '--exchange <name>', description: 'exchange name' },
  { flags: '--routing-key <key>', description: 'routing key' },
  { flags: '--body <text>', description: 'message body text' },
  { flags: '--body-file <path>', description: 'read message body from file' },
  { flags: '--content-type <type>', description: 'message content type' },
  { flags: '--persistent', description: 'publish message as persistent' },
  { flags: '--header <key=value>', description: 'message header, repeatable' }
];

export const consumeOptions = [
  { flags: '--queue <name>', description: 'queue name' },
  { flags: '--max-messages <n>', description: 'maximum messages to consume' },
  { flags: '--ack', description: 'acknowledge messages after consume' },
  { flags: '--no-ack', description: 'consume without acknowledgements' }
];
