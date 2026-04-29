import { createPythonCommand } from '../../core/python-command.js';
import { buildRocketMq4Payload } from './payload.js';
import { printRocketMq4Result } from './formatters.js';
import { messageSendOptions, sharedOptions } from './shared-options.js';

const numericOptions = [{ name: 'timeout', flags: '--timeout' }];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'rocketmq4',
    sharedOptions,
    buildPayload: buildRocketMq4Payload,
    printResult: printRocketMq4Result,
    numericOptions,
    ...extra
  });
}

const topicGroup = {
  type: 'group',
  name: 'topic',
  description: 'Topic query operations.',
  subcommands: [
    pythonCommand('topic.list', { name: 'list', description: 'List topics from the configured NameServer.' }),
    pythonCommand('topic.route', {
      name: 'route',
      description: 'Query topic route data.',
      arguments: [{ name: 'topicName', syntax: '<topicName>', description: 'topic name' }]
    })
  ]
};

const messageGroup = {
  type: 'group',
  name: 'message',
  description: 'Message operations.',
  subcommands: [
    pythonCommand('message.send', {
      name: 'send',
      description: 'Send a message through the native RocketMQ 4.x protocol.',
      arguments: [{ name: 'topicName', syntax: '<topicName>', description: 'topic name' }],
      options: messageSendOptions
    })
  ]
};

export default {
  type: 'group',
  name: 'rocketmq4',
  description: 'Native RocketMQ 4.x topic query and message send commands.',
  subcommands: [
    pythonCommand('ping', { name: 'ping', description: 'Check native RocketMQ4 worker readiness.' }),
    topicGroup,
    messageGroup
  ]
};
