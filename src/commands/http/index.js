import { initWorkspace, listRequestNames, runRequest, sendRequest } from './core.js';
import { sharedOptions, sendOptions } from './shared-options.js';

export default {
  type: 'group',
  name: 'http',
  description: 'HTTP request operations.',
  subcommands: [
    {
      type: 'command',
      name: 'send',
      description: 'Send a direct HTTP request.',
      runtime: 'node',
      arguments: [{ name: 'url', syntax: '<url>', description: 'request URL' }],
      options: [...sharedOptions, ...sendOptions],
      async runNode(args) {
        await sendRequest(args.url, args.options ?? {});
      }
    },
    {
      type: 'command',
      name: 'run',
      description: 'Run an HTTP request definition.',
      runtime: 'node',
      arguments: [{ name: 'nameOrPath', syntax: '<name-or-path>', description: 'request logical name or file path' }],
      options: sharedOptions,
      async runNode(args) {
        await runRequest(args.nameOrPath, args.options ?? {});
      }
    },
    {
      type: 'command',
      name: 'list',
      description: 'List runnable HTTP request definitions.',
      runtime: 'node',
      arguments: [{ name: 'targetPath', syntax: '[path]', description: 'subdirectory under the request root' }],
      options: sharedOptions,
      async runNode(args) {
        for (const item of await listRequestNames(args.targetPath, args.options ?? {})) {
          console.log(item);
        }
      }
    },
    {
      type: 'command',
      name: 'init',
      description: 'Initialize an HTTP example workspace.',
      runtime: 'node',
      arguments: [{ name: 'targetPath', syntax: '[path]', description: 'workspace directory path' }],
      async runNode(args) {
        const root = await initWorkspace(args.targetPath);
        console.log(`Initialized HTTP examples at ${root}`);
      }
    }
  ]
};
