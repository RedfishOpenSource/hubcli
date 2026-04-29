import { createPythonCommand } from '../../core/python-command.js';
import { buildArthasPayload } from './payload.js';
import { printArthasResult } from './formatters.js';
import { sharedOptions } from './shared-options.js';

const numericOptions = [
  { name: 'pid', flags: '--pid' },
  { name: 'timeout', flags: '--timeout' }
];

export default createPythonCommand('exec', {
  name: 'arthas',
  description: 'Run an Arthas command against a target JVM over the Arthas HTTP API.',
  pythonCommand: 'arthas',
  sharedOptions,
  buildPayload: buildArthasPayload,
  printResult: printArthasResult,
  numericOptions,
  arguments: [{ name: 'arthasArgs', syntax: '<arthasArgs...>', description: 'Arthas command and arguments' }],
  configure(command) {
    command.allowUnknownOption(true);
    command.passThroughOptions();
  }
});
