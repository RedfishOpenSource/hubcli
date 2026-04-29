import { createPythonCommand } from '../../core/python-command.js';
import { buildRabbitMqPayload } from './payload.js';
import { printRabbitMqResult } from './formatters.js';
import { consumeOptions, publishOptions, sharedOptions } from './shared-options.js';

const numericOptions = [
  { name: 'timeout', flags: '--timeout' },
  { name: 'port', flags: '--port' },
  { name: 'maxMessages', flags: '--max-messages' },
  { name: 'heartbeat', flags: '--heartbeat' }
];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'rabbitmq',
    sharedOptions,
    buildPayload: buildRabbitMqPayload,
    printResult: printRabbitMqResult,
    numericOptions,
    ...extra
  });
}

const queueGroup = {
  type: 'group',
  name: 'queue',
  description: 'Queue operations.',
  subcommands: [
    pythonCommand('queue.list', { name: 'list', description: 'List queues.' }),
    pythonCommand('queue.get', {
      name: 'get',
      description: 'Get queue details.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'queue name' }]
    }),
    pythonCommand('queue.declare', {
      name: 'declare',
      description: 'Declare a queue.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'queue name' }]
    }),
    pythonCommand('queue.purge', {
      name: 'purge',
      description: 'Purge a queue.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'queue name' }]
    }),
    pythonCommand('queue.delete', {
      name: 'delete',
      description: 'Delete a queue.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'queue name' }]
    }),
    pythonCommand('queue.peek', {
      name: 'peek',
      description: 'Peek messages from a queue.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'queue name' }],
      options: [{ flags: '--count <n>', description: 'messages to fetch from queue' }]
    })
  ]
};

const exchangeGroup = {
  type: 'group',
  name: 'exchange',
  description: 'Exchange operations.',
  subcommands: [
    pythonCommand('exchange.list', { name: 'list', description: 'List exchanges.' }),
    pythonCommand('exchange.get', {
      name: 'get',
      description: 'Get exchange details.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'exchange name' }]
    }),
    pythonCommand('exchange.declare', {
      name: 'declare',
      description: 'Declare an exchange.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'exchange name' }],
      options: [{ flags: '--type <kind>', description: 'exchange type' }]
    }),
    pythonCommand('exchange.delete', {
      name: 'delete',
      description: 'Delete an exchange.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'exchange name' }]
    })
  ]
};

const bindingGroup = {
  type: 'group',
  name: 'binding',
  description: 'Binding operations.',
  subcommands: [
    pythonCommand('binding.list', { name: 'list', description: 'List bindings.' }),
    pythonCommand('binding.create', {
      name: 'create',
      description: 'Create a binding.',
      options: [
        { flags: '--source <name>', description: 'source exchange' },
        { flags: '--destination <name>', description: 'destination queue or exchange' },
        { flags: '--destination-type <type>', description: 'queue or exchange' },
        { flags: '--routing-key <key>', description: 'binding routing key' }
      ]
    }),
    pythonCommand('binding.delete', {
      name: 'delete',
      description: 'Delete a binding.',
      options: [
        { flags: '--source <name>', description: 'source exchange' },
        { flags: '--destination <name>', description: 'destination queue or exchange' },
        { flags: '--destination-type <type>', description: 'queue or exchange' },
        { flags: '--routing-key <key>', description: 'binding routing key' }
      ]
    })
  ]
};

const clusterGroup = {
  type: 'group',
  name: 'cluster',
  description: 'Cluster operations.',
  subcommands: [
    pythonCommand('cluster.nodes', { name: 'nodes', description: 'List cluster nodes.' })
  ]
};

const vhostGroup = {
  type: 'group',
  name: 'vhost',
  description: 'Vhost operations.',
  subcommands: [
    pythonCommand('vhost.list', { name: 'list', description: 'List vhosts.' })
  ]
};

const connectionGroup = {
  type: 'group',
  name: 'connection',
  description: 'Connection operations.',
  subcommands: [
    pythonCommand('connection.list', { name: 'list', description: 'List connections.' })
  ]
};

const channelGroup = {
  type: 'group',
  name: 'channel',
  description: 'Channel operations.',
  subcommands: [
    pythonCommand('channel.list', { name: 'list', description: 'List channels.' })
  ]
};

const consumerGroup = {
  type: 'group',
  name: 'consumer',
  description: 'Consumer operations.',
  subcommands: [
    pythonCommand('consumer.list', { name: 'list', description: 'List consumers.' })
  ]
};

const definitionsGroup = {
  type: 'group',
  name: 'definitions',
  description: 'Definitions import and export.',
  subcommands: [
    pythonCommand('definitions.export', {
      name: 'export',
      description: 'Export RabbitMQ definitions.',
      options: [{ flags: '--output <path>', description: 'write definitions to file path' }]
    }),
    pythonCommand('definitions.import', {
      name: 'import',
      description: 'Import RabbitMQ definitions.',
      options: [{ flags: '--input <path>', description: 'definitions file path' }]
    })
  ]
};

const userGroup = {
  type: 'group',
  name: 'user',
  description: 'User operations.',
  subcommands: [
    pythonCommand('user.list', { name: 'list', description: 'List users.' }),
    pythonCommand('user.get', {
      name: 'get',
      description: 'Get user details.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'user name' }]
    }),
    pythonCommand('user.create', {
      name: 'create',
      description: 'Create or update a user.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'user name' }],
      options: [
        { flags: '--password <password>', description: 'user password' },
        { flags: '--tags <tags>', description: 'comma-separated user tags' }
      ]
    }),
    pythonCommand('user.delete', {
      name: 'delete',
      description: 'Delete a user.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'user name' }]
    })
  ]
};

const permissionGroup = {
  type: 'group',
  name: 'permission',
  description: 'Permission operations.',
  subcommands: [
    pythonCommand('permission.list', { name: 'list', description: 'List permissions.' }),
    pythonCommand('permission.grant', {
      name: 'grant',
      description: 'Grant permissions.',
      options: [
        { flags: '--user-name <name>', description: 'user name' },
        { flags: '--configure <regex>', description: 'configure permission regex' },
        { flags: '--write <regex>', description: 'write permission regex' },
        { flags: '--read <regex>', description: 'read permission regex' }
      ]
    }),
    pythonCommand('permission.revoke', {
      name: 'revoke',
      description: 'Revoke permissions.',
      options: [{ flags: '--user-name <name>', description: 'user name' }]
    })
  ]
};

const policyGroup = {
  type: 'group',
  name: 'policy',
  description: 'Policy operations.',
  subcommands: [
    pythonCommand('policy.list', { name: 'list', description: 'List policies.' }),
    pythonCommand('policy.set', {
      name: 'set',
      description: 'Set a policy.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'policy name' }],
      options: [
        { flags: '--pattern <regex>', description: 'policy pattern' },
        { flags: '--definition <json>', description: 'policy definition JSON' },
        { flags: '--apply-to <scope>', description: 'queues, exchanges, or all' },
        { flags: '--priority <n>', description: 'policy priority' }
      ]
    }),
    pythonCommand('policy.delete', {
      name: 'delete',
      description: 'Delete a policy.',
      arguments: [{ name: 'name', syntax: '<name>', description: 'policy name' }]
    })
  ]
};

export default {
  type: 'group',
  name: 'rabbitmq',
  description: 'RabbitMQ operations.',
  subcommands: [
    pythonCommand('ping', { name: 'ping', description: 'Check RabbitMQ connectivity.' }),
    pythonCommand('whoami', { name: 'whoami', description: 'Show the current authenticated user.' }),
    pythonCommand('overview', { name: 'overview', description: 'Show RabbitMQ overview.' }),
    clusterGroup,
    vhostGroup,
    connectionGroup,
    channelGroup,
    consumerGroup,
    queueGroup,
    exchangeGroup,
    bindingGroup,
    pythonCommand('publish', { name: 'publish', description: 'Publish a message.', options: publishOptions }),
    pythonCommand('consume', { name: 'consume', description: 'Consume messages.', options: consumeOptions }),
    definitionsGroup,
    userGroup,
    permissionGroup,
    policyGroup
  ]
};
