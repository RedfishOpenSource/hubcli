import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getHttpImportTypes, importRequestDefinition, initWorkspace, listRequestNames, runRequest, sendRequest } from './core.js';
import { sharedOptions, sendOptions } from './shared-options.js';

async function readStdinToEnd() {
  const chunks = [];
  for await (const chunk of input) {
    chunks.push(chunk);
  }
  return chunks.join('').trim();
}

async function promptForImportType(rl) {
  const importTypes = getHttpImportTypes();
  console.log('Select import type:');
  importTypes.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.label}`);
  });
  const answer = (await rl.question('Type number: ')).trim();
  const normalizedAnswer = answer || '1';
  const selected = importTypes[Number(normalizedAnswer) - 1];
  if (!selected) {
    throw new Error('Invalid import type selection.');
  }
  return selected.value;
}

async function readCurlInput(rl) {
  if (!input.isTTY) {
    const source = await readStdinToEnd();
    if (!source) {
      throw new Error('Curl input cannot be empty.');
    }
    return source;
  }

  console.log('Paste curl command, then submit an empty line to finish.');
  const lines = [];
  while (true) {
    const line = await rl.question('');
    if (!line.trim()) {
      break;
    }
    lines.push(line);
  }

  const source = lines.join('\n').trim();
  if (!source) {
    throw new Error('Curl input cannot be empty.');
  }
  return source;
}


async function prepareImportArgs(args) {
  const options = args.options ?? {};
  if (!input.isTTY) {
    const type = options.type ? String(options.type).trim().toLowerCase() : 'curl';
    const source = await readCurlInput();
    return {
      ...args,
      importSource: source,
      options: {
        ...options,
        type
      }
    };
  }

  const rl = readline.createInterface({ input, output });
  try {
    const type = options.type ? String(options.type).trim().toLowerCase() : await promptForImportType(rl);
    const source = await readCurlInput(rl);
    const name = args.name || undefined;
    return {
      ...args,
      name,
      importSource: source,
      options: {
        ...options,
        type
      }
    };
  } finally {
    rl.close();
  }
}

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
    },
    {
      type: 'command',
      name: 'import',
      description: 'Import an HTTP request into the local workspace.',
      runtime: 'node',
      arguments: [{ name: 'name', syntax: '[name]', description: 'request logical name' }],
      options: [
        { flags: '--root <dir>', description: 'request workspace root directory' },
        { flags: '--type <type>', description: 'import type, for example curl' },
        { flags: '--force', description: 'overwrite an existing request definition' }
      ],
      prepare: prepareImportArgs,
      async runNode(args) {
        const result = await importRequestDefinition({
          type: args.options?.type,
          source: args.importSource,
          name: args.name,
          root: args.options?.root,
          force: Boolean(args.options?.force)
        });
        console.log(`Imported ${result.type} request to ${result.requestPath}`);
        console.log(`Run it with: hubcli http run ${result.logicalName}`);
      }
    }
  ]
};
