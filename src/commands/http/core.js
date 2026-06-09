import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { printCommandResult } from '../../core/python-command.js';
import { coerceNumberOptions } from '../../core/payload-utils.js';

export const REQUEST_EXTENSION = '.http.json';
export const REQUEST_EXAMPLE_EXTENSION = '.example.http.json';
export const DEFAULT_ROOT = './http';
const DEFAULT_METHOD = 'GET';
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

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
