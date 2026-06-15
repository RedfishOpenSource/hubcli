import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import {
  DEFAULT_ROOT,
  buildFileRequest,
  getHttpImportTypes,
  importRequestDefinition,
  initWorkspace,
  listEnvironmentNames,
  listRequestNames,
  normalizeRequestOptions,
  normalizeSharedOptions,
  resolveImportPath,
  runRequest,
  sendRequest,
  toAbsoluteRoot,
  validateRequestDefinition,
  writeImportedRequestFile
} from './core.js';

const MENU_ITEMS = [
  { value: 'run', label: 'Run saved request' },
  { value: 'send', label: 'Send direct request' },
  { value: 'save', label: 'Save direct request as .http.json' },
  { value: 'list', label: 'List saved requests' },
  { value: 'init', label: 'Initialize example workspace' },
  { value: 'import', label: 'Import curl request' },
  { value: 'exit', label: 'Exit' }
];

const SENSITIVE_HEADER_PATTERN = /authorization|cookie|token|secret|api[-_]?key/i;

function defaultDeps() {
  return {
    buildFileRequest,
    getHttpImportTypes,
    importRequestDefinition,
    initWorkspace,
    listEnvironmentNames,
    listRequestNames,
    runRequest,
    sendRequest,
    writeImportedRequestFile,
    log: console.log
  };
}

function createPromptSession() {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive HTTP mode requires a TTY. Use `hubcli http <subcommand>` for automation.');
  }
  return readline.createInterface({ input, output });
}

function normalizeAnswer(answer) {
  return String(answer ?? '').trim();
}

async function askText(rl, question, defaultValue) {
  const suffix = defaultValue == null || defaultValue === '' ? '' : ` (${defaultValue})`;
  const answer = normalizeAnswer(await rl.question(`${question}${suffix}: `));
  return answer || defaultValue || '';
}

export function parseConfirm(answer, defaultValue = false) {
  const normalized = normalizeAnswer(answer).toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  if (['y', 'yes'].includes(normalized)) {
    return true;
  }
  if (['n', 'no'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

async function askConfirm(rl, question, defaultValue = false) {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  return parseConfirm(await rl.question(`${question} [${hint}]: `), defaultValue);
}

async function askMenu(rl, title, items, defaultIndex = 0) {
  if (items.length === 0) {
    throw new Error('Menu cannot be empty.');
  }

  while (true) {
    console.log(title);
    items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.label}`);
    });

    const answer = normalizeAnswer(await rl.question(`Type number (${defaultIndex + 1}): `));
    const index = answer ? Number(answer) - 1 : defaultIndex;
    if (Number.isInteger(index) && items[index]) {
      return items[index].value;
    }
    console.log('Invalid selection. Please try again.');
  }
}

async function askRepeatedEntries(rl, label, separator) {
  console.log(`${label}: enter key${separator}value lines, then submit an empty line to finish.`);
  const entries = [];
  while (true) {
    const answer = normalizeAnswer(await rl.question('> '));
    if (!answer) {
      break;
    }
    entries.push(answer);
  }
  return entries;
}

async function askMultiline(rl, label) {
  console.log(`${label}, then submit an empty line to finish.`);
  const lines = [];
  while (true) {
    const answer = await rl.question('');
    if (!answer.trim()) {
      break;
    }
    lines.push(answer);
  }
  return lines.join('\n').trim();
}

function compactOptions(options) {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== '' && value !== false;
  }));
}

async function promptRoot(rl, initialOptions = {}) {
  return askText(rl, 'Request root', initialOptions.root || DEFAULT_ROOT);
}

async function promptEnvironment(rl, root, initialEnv, deps) {
  const envNames = await deps.listEnvironmentNames(root);
  if (envNames.length === 0) {
    return askText(rl, 'Environment name under env/ (blank for none)', initialEnv || '');
  }

  const items = [
    { value: '', label: 'None' },
    ...envNames.map((name) => ({ value: name, label: name })),
    { value: '__manual__', label: 'Manual input' }
  ];
  const defaultIndex = initialEnv ? items.findIndex((item) => item.value === initialEnv) : 0;
  const selected = await askMenu(rl, 'Select environment:', items, Math.max(defaultIndex, 0));
  if (selected === '__manual__') {
    return askText(rl, 'Environment name under env/ (blank for none)', initialEnv || '');
  }
  return selected;
}

async function promptRequestOptions(rl, root, initialOptions, deps) {
  const env = await promptEnvironment(rl, root, initialOptions.env, deps);
  const header = await askRepeatedEntries(rl, 'Header overrides', ':');
  const query = await askRepeatedEntries(rl, 'Query overrides', '=');
  const variable = await askRepeatedEntries(rl, 'Variable overrides', '=');
  const timeout = await askText(rl, 'Timeout seconds (blank for request default)', initialOptions.timeout || '');
  const outputPath = await askText(rl, 'Output file path (blank for stdout only)', initialOptions.output || '');

  return compactOptions({
    root,
    env,
    header,
    query,
    var: variable,
    timeout,
    output: outputPath,
    insecure: Boolean(initialOptions.insecure)
  });
}

async function promptBodyOptions(rl) {
  const bodyMode = await askMenu(rl, 'Select body type:', [
    { value: 'none', label: 'No body' },
    { value: 'raw', label: 'Raw text body' },
    { value: 'json', label: 'JSON body' }
  ], 0);

  if (bodyMode === 'raw') {
    return { body: await askMultiline(rl, 'Paste raw body') };
  }
  if (bodyMode === 'json') {
    return { jsonBody: await askMultiline(rl, 'Paste JSON body') };
  }
  return {};
}

async function promptDirectRequest(rl, initialOptions) {
  const method = await askText(rl, 'HTTP method', initialOptions.method || 'GET');
  const url = await askText(rl, 'Request URL');
  const header = await askRepeatedEntries(rl, 'Headers', ':');
  const query = await askRepeatedEntries(rl, 'Query parameters', '=');
  const timeout = await askText(rl, 'Timeout seconds (blank for none)', initialOptions.timeout || '');
  const outputPath = await askText(rl, 'Output file path (blank for stdout only)', initialOptions.output || '');
  const bodyOptions = await promptBodyOptions(rl);

  return {
    url,
    options: compactOptions({
      method,
      header,
      query,
      timeout,
      output: outputPath,
      ...bodyOptions
    })
  };
}

export function buildDirectRequestDefinition(url, rawOptions = {}) {
  const options = normalizeRequestOptions(rawOptions);
  const definition = {
    method: options.method,
    url,
    headers: options.headers,
    query: options.query
  };

  if (options.jsonBody != null) {
    definition.body = options.jsonBody;
  } else if (options.body != null) {
    definition.body = options.body;
  }
  if (options.timeout != null) {
    definition.timeout = options.timeout;
  }

  return validateRequestDefinition(definition);
}

export async function saveDirectRequestDefinition(definition, root, logicalName, options = {}, deps = defaultDeps()) {
  const workspaceRoot = toAbsoluteRoot(root || DEFAULT_ROOT);
  const resolved = resolveImportPath(logicalName, workspaceRoot);
  await deps.writeImportedRequestFile(resolved.requestPath, definition, { force: Boolean(options.force) });
  return {
    ...resolved,
    root: workspaceRoot,
    definition
  };
}

function maskHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [
    key,
    SENSITIVE_HEADER_PATTERN.test(key) ? '<hidden>' : value
  ]));
}

export function formatRequestPreview(request) {
  const lines = [
    `${request.method} ${request.url}`,
    `Headers: ${JSON.stringify(maskHeaders(request.headers || {}), null, 2)}`,
    `Query: ${JSON.stringify(request.query || {}, null, 2)}`
  ];

  if (request.body != null) {
    lines.push(`Body: ${typeof request.body === 'string' ? request.body : JSON.stringify(request.body, null, 2)}`);
  }
  if (request.timeout != null) {
    lines.push(`Timeout: ${request.timeout}s`);
  }
  if (request.output) {
    lines.push(`Output: ${request.output}`);
  }
  return lines.join('\n');
}

async function runSavedRequest(rl, initialOptions, deps) {
  const root = await promptRoot(rl, initialOptions);
  let names;
  try {
    names = await deps.listRequestNames(undefined, normalizeSharedOptions({ root }));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`No HTTP request workspace found at ${path.resolve(root)}.`);
      console.log('Use the init menu option or `hubcli http init` to create examples.');
      return;
    }
    throw error;
  }

  if (names.length === 0) {
    console.log(`No runnable .http.json requests found under ${path.resolve(root)}.`);
    return;
  }

  const name = await askMenu(rl, 'Select request:', names.map((item) => ({ value: item, label: item })), 0);
  const sharedRawOptions = await promptRequestOptions(rl, root, initialOptions, deps);
  const options = normalizeSharedOptions(sharedRawOptions);
  const { request } = await deps.buildFileRequest(name, options);
  console.log('\nRequest preview:');
  console.log(formatRequestPreview(request));
  if (await askConfirm(rl, 'Run this request?', false)) {
    await deps.runRequest(name, sharedRawOptions);
  } else {
    console.log('Canceled.');
  }
}

async function sendDirectRequest(rl, initialOptions, deps) {
  const direct = await promptDirectRequest(rl, initialOptions);
  const definition = buildDirectRequestDefinition(direct.url, direct.options);
  const shouldSave = await askConfirm(rl, 'Save this request as .http.json before sending?', false);
  if (shouldSave) {
    await saveDirectRequestWithPrompt(rl, definition, initialOptions, deps);
  }

  console.log('\nRequest preview:');
  console.log(formatRequestPreview({ ...definition, output: direct.options.output }));
  if (await askConfirm(rl, 'Send this request?', false)) {
    await deps.sendRequest(direct.url, direct.options);
  } else {
    console.log('Canceled.');
  }
}

async function saveDirectRequestWithPrompt(rl, definition, initialOptions, deps) {
  const root = await promptRoot(rl, initialOptions);
  const logicalName = await askText(rl, 'Request logical name, for example user/detail');
  try {
    const result = await saveDirectRequestDefinition(definition, root, logicalName, {}, deps);
    console.log(`Saved request to ${result.requestPath}`);
  } catch (error) {
    if (!/already exists/.test(error.message)) {
      throw error;
    }
    if (!(await askConfirm(rl, 'Request already exists. Overwrite?', false))) {
      console.log('Save skipped.');
      return;
    }
    const result = await saveDirectRequestDefinition(definition, root, logicalName, { force: true }, deps);
    console.log(`Saved request to ${result.requestPath}`);
  }
}

async function saveDirectRequestOnly(rl, initialOptions, deps) {
  const direct = await promptDirectRequest(rl, initialOptions);
  const definition = buildDirectRequestDefinition(direct.url, direct.options);
  await saveDirectRequestWithPrompt(rl, definition, initialOptions, deps);
}

async function listSavedRequests(rl, initialOptions, deps) {
  const root = await promptRoot(rl, initialOptions);
  const names = await deps.listRequestNames(undefined, normalizeSharedOptions({ root }));
  if (names.length === 0) {
    console.log(`No runnable .http.json requests found under ${path.resolve(root)}.`);
    return;
  }
  names.forEach((name, index) => console.log(`${index + 1}. ${name}`));
}

async function initializeWorkspace(rl, initialOptions, deps) {
  const root = await promptRoot(rl, initialOptions);
  const initializedRoot = await deps.initWorkspace(root);
  console.log(`Initialized HTTP examples at ${initializedRoot}`);
}

async function importCurlRequest(rl, initialOptions, deps) {
  const importTypes = deps.getHttpImportTypes();
  const type = await askMenu(rl, 'Select import type:', importTypes.map((item) => ({ value: item.value, label: item.label })), 0);
  const root = await promptRoot(rl, initialOptions);
  const name = await askText(rl, 'Request logical name (blank to derive automatically)');
  const source = await askMultiline(rl, 'Paste curl command');
  const result = await deps.importRequestDefinition({ type, source, name: name || undefined, root });
  console.log(`Imported ${result.type} request to ${result.requestPath}`);
  console.log(`Run it with: hubcli http run ${result.logicalName}`);
}

export async function runInteractiveHttp(initialOptions = {}, injectedDeps = {}) {
  const deps = { ...defaultDeps(), ...injectedDeps };
  const rl = injectedDeps.rl ?? createPromptSession();
  const shouldClose = !injectedDeps.rl;
  try {
    const action = await askMenu(rl, 'What do you want to do?', MENU_ITEMS, 0);
    if (action === 'run') {
      await runSavedRequest(rl, initialOptions, deps);
      return;
    }
    if (action === 'send') {
      await sendDirectRequest(rl, initialOptions, deps);
      return;
    }
    if (action === 'save') {
      await saveDirectRequestOnly(rl, initialOptions, deps);
      return;
    }
    if (action === 'list') {
      await listSavedRequests(rl, initialOptions, deps);
      return;
    }
    if (action === 'init') {
      await initializeWorkspace(rl, initialOptions, deps);
      return;
    }
    if (action === 'import') {
      await importCurlRequest(rl, initialOptions, deps);
      return;
    }
    console.log('Bye.');
  } finally {
    if (shouldClose) {
      rl.close();
    }
  }
}
