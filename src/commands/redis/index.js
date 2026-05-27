import { createPythonCommand } from '../../core/python-command.js';
import { buildRedisPayload } from './payload.js';
import { connectionOptions, infoOptions, keyExpireOptions, keySetOptions, scanOptions } from './shared-options.js';

const numericOptions = [
  { name: 'port', flags: '--port' },
  { name: 'database', flags: '--database' },
  { name: 'timeout', flags: '--timeout' },
  { name: 'count', flags: '--count' },
  { name: 'limit', flags: '--limit' },
  { name: 'ttl', flags: '--ttl' }
];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'redis',
    sharedOptions: connectionOptions,
    buildPayload: buildRedisPayload,
    numericOptions,
    ...extra
  });
}

const keyGroup = {
  type: 'group',
  name: 'key',
  description: 'Redis key operations.',
  subcommands: [
    pythonCommand('key.scan', {
      name: 'scan',
      description: 'Scan keys without blocking Redis.',
      options: scanOptions
    }),
    pythonCommand('key.get', {
      name: 'get',
      description: 'Get a string key value.',
      arguments: [{ name: 'key', syntax: '<key>', description: 'Redis key' }]
    }),
    pythonCommand('key.set', {
      name: 'set',
      description: 'Set a string key value.',
      arguments: [{ name: 'key', syntax: '<key>', description: 'Redis key' }],
      options: keySetOptions
    }),
    pythonCommand('key.delete', {
      name: 'delete',
      description: 'Delete a key.',
      arguments: [{ name: 'key', syntax: '<key>', description: 'Redis key' }]
    }),
    pythonCommand('key.exists', {
      name: 'exists',
      description: 'Check whether a key exists.',
      arguments: [{ name: 'key', syntax: '<key>', description: 'Redis key' }]
    }),
    pythonCommand('key.ttl', {
      name: 'ttl',
      description: 'Show key TTL in seconds.',
      arguments: [{ name: 'key', syntax: '<key>', description: 'Redis key' }]
    }),
    pythonCommand('key.expire', {
      name: 'expire',
      description: 'Set key expiration in seconds.',
      arguments: [{ name: 'key', syntax: '<key>', description: 'Redis key' }],
      options: keyExpireOptions
    })
  ]
};

export default {
  type: 'group',
  name: 'redis',
  description: 'Redis operations.',
  subcommands: [
    pythonCommand('ping', { name: 'ping', description: 'Check Redis connectivity.' }),
    pythonCommand('info', {
      name: 'info',
      description: 'Show Redis server information.',
      options: infoOptions
    }),
    pythonCommand('dbsize', { name: 'dbsize', description: 'Show the selected database key count.' }),
    keyGroup
  ]
};
