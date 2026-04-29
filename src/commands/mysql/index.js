import { createPythonCommand } from '../../core/python-command.js';
import { buildMysqlPayload } from './payload.js';
import { connectionOptions, executionOptions, exportOptions, sqlInputOptions } from './shared-options.js';

const numericOptions = [
  { name: 'port', flags: '--port' },
  { name: 'timeout', flags: '--timeout' },
  { name: 'limit', flags: '--limit' }
];

function pythonCommand(operation, extra = {}) {
  return createPythonCommand(operation, {
    pythonCommand: 'mysql',
    buildPayload: buildMysqlPayload,
    numericOptions,
    ...extra
  });
}

const databaseGroup = {
  type: 'group',
  name: 'database',
  description: 'MySQL database queries.',
  subcommands: [
    pythonCommand('database.list', {
      name: 'list',
      description: 'List databases and table counts.',
      sharedOptions: connectionOptions
    })
  ]
};

const tableGroup = {
  type: 'group',
  name: 'table',
  description: 'MySQL table queries.',
  subcommands: [
    pythonCommand('table.list', {
      name: 'list',
      description: 'List tables in a database.',
      sharedOptions: connectionOptions
    })
  ]
};

const queryGroup = {
  type: 'group',
  name: 'query',
  description: 'Read-only MySQL queries.',
  subcommands: [
    pythonCommand('query.run', {
      name: 'run',
      description: 'Run a read-only SQL query.',
      sharedOptions: [...connectionOptions, ...executionOptions],
      options: sqlInputOptions
    }),
    pythonCommand('query.cross', {
      name: 'cross',
      description: 'Run a read-only cross-database SQL query.',
      sharedOptions: [...connectionOptions, ...executionOptions],
      options: sqlInputOptions
    })
  ]
};

const execGroup = {
  type: 'group',
  name: 'exec',
  description: 'Mutating MySQL execution commands.',
  subcommands: [
    pythonCommand('exec.run', {
      name: 'run',
      description: 'Run DML or DDL SQL.',
      sharedOptions: [...connectionOptions, ...executionOptions],
      options: sqlInputOptions
    })
  ]
};

const exportGroup = {
  type: 'group',
  name: 'export',
  description: 'MySQL export commands.',
  subcommands: [
    pythonCommand('export.query', {
      name: 'query',
      description: 'Export query results to a file.',
      sharedOptions: [...connectionOptions, ...executionOptions, ...exportOptions],
      options: sqlInputOptions
    }),
    pythonCommand('export.dump', {
      name: 'dump',
      description: 'Export schema and/or data as SQL.',
      sharedOptions: [...connectionOptions, ...exportOptions]
    })
  ]
};

export default {
  type: 'group',
  name: 'mysql',
  description: 'MySQL operations.',
  subcommands: [
    pythonCommand('ping', {
      name: 'ping',
      description: 'Check MySQL connectivity.',
      sharedOptions: connectionOptions
    }),
    databaseGroup,
    tableGroup,
    queryGroup,
    execGroup,
    exportGroup
  ]
};
