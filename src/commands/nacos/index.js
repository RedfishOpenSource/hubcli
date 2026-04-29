import { createPythonCommand } from '../../core/python-command.js';
import { buildNacosPayload } from './payload.js';
import { printNacosResult } from './formatters.js';
import {
  configGetOptions,
  configListOptions,
  connectionOptions,
  groupOptions,
  instanceFilterOptions,
  namespaceOptions,
  pagingOptions,
  serviceTargetOptions
} from './shared-options.js';

const numericOptions = [
  { name: 'timeout', flags: '--timeout' },
  { name: 'pageNo', flags: '--page-no' },
  { name: 'pageSize', flags: '--page-size' }
];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'nacos',
    buildPayload: buildNacosPayload,
    printResult: printNacosResult,
    numericOptions,
    ...extra
  });
}

const serverGroup = {
  type: 'group',
  name: 'server',
  description: 'Nacos server queries.',
  subcommands: [
    pythonCommand('server.info', {
      name: 'info',
      description: 'Show Nacos server information.',
      sharedOptions: connectionOptions
    })
  ]
};

const namespaceGroup = {
  type: 'group',
  name: 'namespace',
  description: 'Nacos namespace queries.',
  subcommands: [
    pythonCommand('namespace.list', {
      name: 'list',
      description: 'List namespaces.',
      sharedOptions: connectionOptions
    }),
    pythonCommand('namespace.get', {
      name: 'get',
      description: 'Get namespace details.',
      sharedOptions: connectionOptions,
      arguments: [{ name: 'namespaceId', syntax: '<namespaceId>', description: 'namespace ID' }]
    })
  ]
};

const configGroup = {
  type: 'group',
  name: 'config',
  description: 'Nacos configuration queries.',
  subcommands: [
    pythonCommand('config.list', {
      name: 'list',
      description: 'List configurations.',
      sharedOptions: [...connectionOptions, ...namespaceOptions, ...groupOptions, ...pagingOptions],
      options: configListOptions
    }),
    pythonCommand('config.get', {
      name: 'get',
      description: 'Get configuration content.',
      sharedOptions: [...connectionOptions, ...namespaceOptions, ...groupOptions],
      options: configGetOptions
    })
  ]
};

const serviceGroup = {
  type: 'group',
  name: 'service',
  description: 'Nacos service queries.',
  subcommands: [
    pythonCommand('service.list', {
      name: 'list',
      description: 'List services.',
      sharedOptions: [...connectionOptions, ...namespaceOptions, ...groupOptions, ...pagingOptions]
    }),
    pythonCommand('service.get', {
      name: 'get',
      description: 'Get service details.',
      sharedOptions: [...connectionOptions, ...namespaceOptions, ...groupOptions],
      options: serviceTargetOptions
    })
  ]
};

const instanceGroup = {
  type: 'group',
  name: 'instance',
  description: 'Nacos instance queries.',
  subcommands: [
    pythonCommand('instance.list', {
      name: 'list',
      description: 'List service instances.',
      sharedOptions: [...connectionOptions, ...namespaceOptions, ...groupOptions, ...instanceFilterOptions],
      options: serviceTargetOptions
    })
  ]
};

export default {
  type: 'group',
  name: 'nacos',
  description: 'Nacos operations.',
  subcommands: [
    pythonCommand('ping', {
      name: 'ping',
      description: 'Check Nacos connectivity.',
      sharedOptions: connectionOptions
    }),
    serverGroup,
    namespaceGroup,
    configGroup,
    serviceGroup,
    instanceGroup
  ]
};
