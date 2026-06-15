import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { printCommandResult } from '../../core/python-command.js';
import { coerceNumberOptions } from '../../core/payload-utils.js';

export const REQUEST_EXTENSION = '.http.json';
export const REQUEST_EXAMPLE_EXTENSION = '.example.http.json';
export const DEFAULT_ROOT = './http';
const DEFAULT_METHOD = 'GET';
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const HTTP_IMPORT_TYPES = [
  { value: 'curl', label: 'curl' }
];

function splitCurlInput(source) {
  return String(source || '')
    .replace(/\\\r?\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function tokenizeShellCommand(source) {
  const input = splitCurlInput(source);
  const tokens = [];
  let current = '';
  let quote = null;
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\' && quote !== '\'') {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '\'' || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += '\\';
  }
  if (quote) {
    throw new Error('Unterminated quoted string in curl command.');
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

export function getHttpImportTypes() {
  return HTTP_IMPORT_TYPES.map((item) => ({ ...item }));
}

export function normalizeImportType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Import type is required.');
  }
  if (!HTTP_IMPORT_TYPES.some((item) => item.value === normalized)) {
    throw new Error(`Unsupported import type: ${type}`);
  }
  return normalized;
}

function parseTimeoutValue(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout)) {
    throw new Error(`Invalid curl timeout: ${value}`);
  }
  return timeout;
}

function parseCurlBody(values) {
  if (values.length === 0) {
    return undefined;
  }
  const body = values.join('&');
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // noop
  }
  return body;
}

function toSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toDisplayName(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveImportNameFromRequest(definition) {
  const method = normalizeMethod(definition.method).toLowerCase();
  const url = new URL(definition.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean).map(toSlug).filter(Boolean);
  const tail = segments.length > 0 ? segments.join('-') : toSlug(url.hostname) || 'request';
  return path.posix.join('imported', `${method}-${tail}`);
}

export function resolveImportPath(nameOrPath, root) {
  const normalizedInput = String(nameOrPath || '').trim();
  if (!normalizedInput) {
    throw new Error('Request name is required for import.');
  }

  const withoutExtension = normalizedInput.endsWith(REQUEST_EXTENSION)
    ? normalizedInput.slice(0, -REQUEST_EXTENSION.length)
    : normalizedInput;

  if (!withoutExtension || withoutExtension.endsWith('.example')) {
    throw new Error('Imported request paths cannot target example files.');
  }

  const normalizedRelativePath = withoutExtension.replace(/\\/g, '/');
  if (normalizedRelativePath.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedRelativePath)) {
    throw new Error('Imported request path must stay inside the HTTP workspace root.');
  }

  const segments = normalizedRelativePath.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Imported request path must stay inside the HTTP workspace root.');
  }

  const logicalName = segments.join('/');
  return {
    logicalName,
    requestPath: path.join(root, ...segments) + REQUEST_EXTENSION
  };
}

export function parseCurlCommand(source) {
  const tokens = tokenizeShellCommand(source);
  if (tokens.length === 0) {
    throw new Error('Curl input cannot be empty.');
  }
  if (tokens[0] !== 'curl') {
    throw new Error('Imported curl input must start with `curl`.');
  }

  let method;
  let url;
  let timeout;
  const headers = [];
  const bodyParts = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextValue = () => {
      index += 1;
      if (index >= tokens.length) {
        throw new Error(`Expected a value after ${token}.`);
      }
      return tokens[index];
    };

    if (token === '-X' || token === '--request') {
      method = nextValue();
      continue;
    }
    if (token === '-H' || token === '--header') {
      headers.push(nextValue());
      continue;
    }
    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      bodyParts.push(nextValue());
      continue;
    }
    if (token === '--max-time') {
      timeout = parseTimeoutValue(nextValue());
      continue;
    }
    if (token === '-F' || token === '--form' || token === '-T' || token === '--upload-file' || token === '-b' || token === '--cookie' || token === '-u' || token === '--user' || token === '-x' || token === '--proxy') {
      throw new Error(`Unsupported curl option for import: ${token}`);
    }
    if (token === '--location' || token === '--compressed' || token === '--silent' || token === '--globoff' || token === '-s' || token === '-L' || token === '-k' || token === '--insecure') {
      continue;
    }
    if (token.startsWith('-')) {
      throw new Error(`Unsupported curl option for import: ${token}`);
    }
    if (url) {
      throw new Error('Curl import currently supports exactly one URL argument.');
    }
    url = token;
  }

  if (!url) {
    throw new Error('Curl command must include a URL.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error(`Invalid curl URL: ${error.message}`);
  }

  const query = {};
  for (const [key, value] of parsedUrl.searchParams.entries()) {
    if (key in query) {
      throw new Error(`Repeated query parameter is not supported for import: ${key}`);
    }
    query[key] = value;
  }
  parsedUrl.search = '';

  const normalizedMethod = normalizeMethod(method || (bodyParts.length > 0 ? 'POST' : DEFAULT_METHOD));
  const body = parseCurlBody(bodyParts);
  const definition = {
    name: toDisplayName(deriveImportNameFromRequest({ method: normalizedMethod, url: parsedUrl.toString() }).split('/').at(-1)),
    method: normalizedMethod,
    url: parsedUrl.toString(),
    headers: parseEntries(headers, ':', 'curl header'),
    query
  };

  if (body != null) {
    definition.body = body;
  }
  if (timeout != null) {
    definition.timeout = timeout;
  }

  return validateRequestDefinition(definition);
}

export function buildImportedRequestDefinition(type, source) {
  const normalizedType = normalizeImportType(type);
  if (normalizedType === 'curl') {
    return parseCurlCommand(source);
  }
  throw new Error(`Unsupported import type: ${type}`);
}

export async function writeImportedRequestFile(requestPath, definition, options = {}) {
  try {
    await readFile(requestPath, 'utf8');
    if (!options.force) {
      throw new Error(`Request definition already exists: ${requestPath}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  await mkdir(path.dirname(requestPath), { recursive: true });
  await writeFile(requestPath, JSON.stringify(definition, null, 2) + '\n', 'utf8');
}

export async function importRequestDefinition({ type, source, name, root, force = false }) {
  const definition = buildImportedRequestDefinition(type, source);
  const workspaceRoot = toAbsoluteRoot(root || DEFAULT_ROOT);
  const targetName = String(name || '').trim() || deriveImportNameFromRequest(definition);
  const { logicalName, requestPath } = resolveImportPath(targetName, workspaceRoot);
  await writeImportedRequestFile(requestPath, definition, { force });
  return {
    type: normalizeImportType(type),
    logicalName,
    requestPath,
    root: workspaceRoot,
    definition
  };
}

export const EXAMPLE_FILES = {
  'README.example.md': `# hubcli http examples\n\n1. Copy \`*.example.http.json\` files to \`*.http.json\`.\n2. Copy \`env/*.example.json\` files to \`env/*.json\`.\n3. Fill in real values such as \`baseUrl\`, \`token\`, and request variables.\n4. Run a request with \`hubcli http run user/create-user --env dev\`.\n`,
  [path.join('env', 'dev.example.json')]: JSON.stringify({
    baseUrl: 'https://api.example.com',
    token: 'replace-with-token',
    userId: '1001'
  }, null, 2) + '\n',
  [path.join('env', 'test.example.json')]: JSON.stringify({
    baseUrl: 'https://test-api.example.com',
    token: 'replace-with-test-token',
    userId: '2001'
  }, null, 2) + '\n',
  [path.join('user', 'get-user.example.http.json')]: JSON.stringify({
    name: 'Get user',
    description: 'Fetch user detail',
    method: 'GET',
    url: '{{baseUrl}}/users/{{userId}}',
    headers: { Authorization: 'Bearer {{token}}' },
    query: { verbose: 'true' },
    timeout: 30
  }, null, 2) + '\n',
  [path.join('user', 'create-user.example.http.json')]: JSON.stringify({
    name: 'Create user',
    description: 'Create a demo user',
    method: 'POST',
    url: '{{baseUrl}}/users',
    headers: {
      Authorization: 'Bearer {{token}}',
      'Content-Type': 'application/json'
    },
    query: { source: 'hubcli' },
    body: { name: 'demo', email: 'demo@example.com' },
    timeout: 30
  }, null, 2) + '\n',
  [path.join('order', 'list-orders.example.http.json')]: JSON.stringify({
    name: 'List orders',
    description: 'List orders for a user',
    method: 'GET',
    url: '{{baseUrl}}/orders',
    headers: { Authorization: 'Bearer {{token}}' },
    query: { userId: '{{userId}}' },
    timeout: 30
  }, null, 2) + '\n',
  [path.join('folder1', 'folder2', 'folder3', 'xxx.example.http.json')]: JSON.stringify({
    name: 'Nested example',
    description: 'Example nested request definition',
    method: 'GET',
    url: '{{baseUrl}}/nested/{{userId}}',
    timeout: 30
  }, null, 2) + '\n'
};

export function parseEntries(values = [], separator, label) {
  const result = {};
  for (const entry of values) {
    const index = entry.indexOf(separator);
    if (index <= 0) {
      throw new Error(`Expected ${label} in key${separator}value format.`);
    }
    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + separator.length).trim();
    if (!key) {
      throw new Error(`Expected ${label} key to be non-empty.`);
    }
    result[key] = value;
  }
  return result;
}

export function normalizeSharedOptions(options = {}) {
  const normalized = {
    json: Boolean(options.json),
    root: options.root || DEFAULT_ROOT,
    env: options.env,
    output: options.output,
    insecure: Boolean(options.insecure),
    timeout: options.timeout,
    headers: parseEntries(options.header, ':', '--header'),
    query: parseEntries(options.query, '=', '--query'),
    vars: parseEntries(options.var, '=', '--var')
  };
  coerceNumberOptions(normalized, ['timeout']);
  if (normalized.timeout != null && Number.isNaN(normalized.timeout)) {
    throw new Error('Expected --timeout to be a number.');
  }
  return normalized;
}

export function normalizeMethod(method) {
  const normalized = String(method || DEFAULT_METHOD).toUpperCase();
  if (!VALID_METHODS.has(normalized)) {
    throw new Error(`Unsupported HTTP method: ${normalized}`);
  }
  return normalized;
}

export function normalizeRequestOptions(options = {}) {
  const shared = normalizeSharedOptions(options);
  if (options.body && options.jsonBody) {
    throw new Error('Use either --body or --json-body, not both.');
  }

  let jsonBody;
  if (options.jsonBody) {
    try {
      jsonBody = JSON.parse(options.jsonBody);
    } catch (error) {
      throw new Error(`Invalid JSON passed to --json-body: ${error.message}`);
    }
  }

  return {
    ...shared,
    method: normalizeMethod(options.method),
    body: options.body,
    jsonBody
  };
}

export function ensurePlainObject(value, fieldName) {
  if (value == null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be a JSON object.`);
  }
  return value;
}

export function validateRequestDefinition(definition) {
  if (typeof definition !== 'object' || definition == null || Array.isArray(definition)) {
    throw new Error('Request definition must be a JSON object.');
  }
  if (!definition.method) {
    throw new Error('Request definition must include method.');
  }
  if (!definition.url) {
    throw new Error('Request definition must include url.');
  }
  normalizeMethod(definition.method);
  ensurePlainObject(definition.headers, 'headers');
  ensurePlainObject(definition.query, 'query');
  if (definition.timeout != null && typeof definition.timeout !== 'number') {
    throw new Error('timeout must be a number.');
  }
  if (definition.body != null && typeof definition.body !== 'string' && (typeof definition.body !== 'object' || Array.isArray(definition.body))) {
    throw new Error('body must be either a string or a JSON object.');
  }
  return definition;
}

export async function readJsonFile(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`${label} not found: ${filePath}`);
    }
    throw error;
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label.toLowerCase()}: ${filePath}. ${error.message}`);
  }
}

export function isExampleRequestPath(filePath) {
  return filePath.endsWith(REQUEST_EXAMPLE_EXTENSION);
}

export function isExecutableRequestPath(filePath) {
  return filePath.endsWith(REQUEST_EXTENSION) && !isExampleRequestPath(filePath);
}

export function toAbsoluteRoot(root) {
  return path.resolve(root || DEFAULT_ROOT);
}

export function resolveRequestPath(nameOrPath, root) {
  const absoluteCandidate = path.resolve(nameOrPath);
  if (path.extname(absoluteCandidate) === '.json') {
    if (!absoluteCandidate.endsWith(REQUEST_EXTENSION)) {
      throw new Error('Explicit request file paths must end with .http.json.');
    }
    if (isExampleRequestPath(absoluteCandidate)) {
      throw new Error('Example request files are not runnable request definitions.');
    }
    return absoluteCandidate;
  }

  if (nameOrPath.endsWith('.example')) {
    throw new Error('Example request files are not runnable request definitions.');
  }

  return path.resolve(root, `${nameOrPath}${REQUEST_EXTENSION}`);
}

export async function listEnvironmentNames(root) {
  const envRoot = path.join(toAbsoluteRoot(root || DEFAULT_ROOT), 'env');
  let entries;
  try {
    entries = await readdir(envRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.example.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .sort();
}

export async function loadEnvironment(root, envName) {
  if (!envName) {
    return {};
  }
  const envPath = path.join(root, 'env', `${envName}.json`);
  const data = await readJsonFile(envPath, 'Environment file');
  return ensurePlainObject(data, 'Environment file');
}

export function substituteTemplate(value, variables) {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, name) => {
      if (!(name in variables)) {
        return match;
      }
      return String(variables[name]);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteTemplate(item, variables));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substituteTemplate(item, variables)]));
  }
  return value;
}

export function mergeRequestDefinition(definition, overrides) {
  const merged = {
    ...definition,
    headers: {
      ...ensurePlainObject(definition.headers, 'headers'),
      ...overrides.headers
    },
    query: {
      ...ensurePlainObject(definition.query, 'query'),
      ...overrides.query
    }
  };

  if (overrides.timeout != null) {
    merged.timeout = overrides.timeout;
  }

  return merged;
}

export async function buildFileRequest(nameOrPath, options) {
  const root = toAbsoluteRoot(options.root);
  const requestPath = resolveRequestPath(nameOrPath, root);
  if (isExampleRequestPath(requestPath)) {
    throw new Error('Example request files are not runnable request definitions.');
  }
  const definition = validateRequestDefinition(await readJsonFile(requestPath, 'Request definition'));
  const variables = {
    ...(await loadEnvironment(root, options.env)),
    ...options.vars
  };
  const merged = mergeRequestDefinition(definition, options);
  const substituted = substituteTemplate(merged, variables);
  return {
    requestPath,
    request: {
      method: normalizeMethod(substituted.method),
      url: substituted.url,
      headers: ensurePlainObject(substituted.headers, 'headers'),
      query: ensurePlainObject(substituted.query, 'query'),
      body: substituted.body,
      timeout: substituted.timeout,
      output: options.output,
      insecure: options.insecure,
      json: options.json
    }
  };
}

export function buildFetchOptions(request) {
  const headers = new Headers(request.headers);
  let body;
  if (request.body != null) {
    if (typeof request.body === 'string') {
      body = request.body;
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      body = JSON.stringify(request.body);
    }
  }
  return { headers, body };
}

export async function executeHttpRequest(request, fetchImpl = fetch) {
  const url = new URL(request.url);
  for (const [key, value] of Object.entries(request.query || {})) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  let timeoutId;
  if (request.timeout != null) {
    timeoutId = setTimeout(() => controller.abort(new Error('Request timed out.')), request.timeout * 1000);
  }

  const start = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: request.method,
      ...buildFetchOptions(request),
      signal: controller.signal
    });
    const rawBody = await response.text();
    const contentType = response.headers.get('content-type') || '';
    let data = rawBody;
    if (contentType.includes('application/json')) {
      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        data = rawBody;
      }
    }

    if (request.output) {
      await writeFile(request.output, rawBody, 'utf8');
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      timingMs: Date.now() - start,
      outputPath: request.output || undefined
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function formatHttpResult(result) {
  const lines = [`HTTP ${result.status} ${result.statusText} (${result.timingMs} ms)`];
  if (result.outputPath) {
    lines.push(`Output: ${result.outputPath}`);
  }
  lines.push('Headers:');
  for (const [key, value] of Object.entries(result.headers)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push('', 'Body:');
  lines.push(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
  return lines.join('\n');
}

export function printHttpResult(result, options = {}) {
  if (options.json) {
    printCommandResult(result, { json: true });
    return;
  }
  console.log(formatHttpResult(result));
}

export async function sendRequest(url, rawOptions, fetchImpl = fetch) {
  const options = normalizeRequestOptions(rawOptions);
  const request = {
    method: options.method,
    url,
    headers: options.headers,
    query: options.query,
    body: options.jsonBody ?? options.body,
    timeout: options.timeout,
    output: options.output,
    insecure: options.insecure,
    json: options.json
  };
  const result = await executeHttpRequest(request, fetchImpl);
  printHttpResult(result, options);
  return result;
}

export async function runRequest(nameOrPath, rawOptions, fetchImpl = fetch) {
  const options = normalizeSharedOptions(rawOptions);
  const { request } = await buildFileRequest(nameOrPath, options);
  const result = await executeHttpRequest(request, fetchImpl);
  printHttpResult(result, options);
  return result;
}

export async function walkRequests(basePath, currentPath = basePath, items = []) {
  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await walkRequests(basePath, entryPath, items);
      continue;
    }
    if (!isExecutableRequestPath(entry.name)) {
      continue;
    }
    const relativePath = path.relative(basePath, entryPath).replace(/\\/g, '/');
    items.push(relativePath.slice(0, -REQUEST_EXTENSION.length));
  }
  return items;
}

export async function listRequestNames(targetPath, rawOptions) {
  const options = normalizeSharedOptions(rawOptions);
  const root = toAbsoluteRoot(options.root);
  const listBase = targetPath ? path.resolve(root, targetPath) : root;
  const items = await walkRequests(root, listBase, []);
  items.sort();
  return items;
}

export async function initWorkspace(targetPath) {
  const root = toAbsoluteRoot(targetPath || DEFAULT_ROOT);
  for (const [relativePath, content] of Object.entries(EXAMPLE_FILES)) {
    const destination = path.join(root, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, 'utf8');
  }
  return root;
}
