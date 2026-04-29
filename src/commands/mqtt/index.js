import { createPythonCommand } from '../../core/python-command.js';
import { printMqttResult } from './formatters.js';
import { buildMqttPayload } from './payload.js';
import { publishOptions, sharedOptions, subscribeOptions } from './shared-options.js';

const numericOptions = [
  { name: 'port', flags: '--port' },
  { name: 'keepalive', flags: '--keepalive' },
  { name: 'sessionExpiry', flags: '--session-expiry' },
  { name: 'timeout', flags: '--timeout' },
  { name: 'qos', flags: '--qos' },
  { name: 'messageExpiry', flags: '--message-expiry' },
  { name: 'maxMessages', flags: '--max-messages' }
];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'mqtt',
    sharedOptions,
    buildPayload: buildMqttPayload,
    printResult: printMqttResult,
    numericOptions,
    ...extra
  });
}

const sessionGroup = {
  type: 'group',
  name: 'session',
  description: 'Session operations.',
  subcommands: [pythonCommand('session.info', { name: 'info', description: 'Inspect broker session behavior.' })]
};

const retainedGroup = {
  type: 'group',
  name: 'retained',
  description: 'Retained message operations.',
  subcommands: [
    pythonCommand('retained.get', {
      name: 'get',
      description: 'Fetch the retained message for a topic.',
      arguments: [{ name: 'topic', syntax: '<topic>', description: 'topic name' }],
      options: subscribeOptions
    }),
    pythonCommand('retained.clear', {
      name: 'clear',
      description: 'Clear the retained message for a topic.',
      arguments: [{ name: 'topic', syntax: '<topic>', description: 'topic name' }]
    })
  ]
};

export default {
  type: 'group',
  name: 'mqtt',
  description: 'Generic MQTT protocol operations.',
  subcommands: [
    pythonCommand('ping', { name: 'ping', description: 'Check MQTT connectivity.' }),
    pythonCommand('publish', {
      name: 'publish',
      description: 'Publish a message to a topic.',
      arguments: [{ name: 'topic', syntax: '<topic>', description: 'topic name' }],
      options: publishOptions
    }),
    pythonCommand('subscribe', {
      name: 'subscribe',
      description: 'Subscribe to a topic filter and receive messages.',
      arguments: [{ name: 'topicFilter', syntax: '<topicFilter>', description: 'topic filter' }],
      options: subscribeOptions
    }),
    sessionGroup,
    retainedGroup
  ]
};
