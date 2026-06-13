import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildFileRequest,
  buildImportedRequestDefinition,
  executeHttpRequest,
  formatHttpResult,
  importRequestDefinition,
  initWorkspace,
  listRequestNames,
  normalizeRequestOptions,
  normalizeSharedOptions,
  parseCurlCommand,
  resolveImportPath,
  resolveRequestPath,
  substituteTemplate,
  tokenizeShellCommand
} from '../src/commands/http/core.js';

test('tokenizeShellCommand keeps quoted curl arguments intact', () => {
  const tokens = tokenizeShellCommand("curl 'https://example.com/users?page=1' -H 'Authorization: Bearer token' -d '{\"name\":\"demo\"}'");
  assert.deepEqual(tokens, [
    'curl',
    'https://example.com/users?page=1',
    '-H',
    'Authorization: Bearer token',
    '-d',
    '{"name":"demo"}'
  ]);
});

test('parseCurlCommand maps URL, query, headers, json body, and timeout', () => {
  const definition = parseCurlCommand(
    "curl 'https://api.example.com/users?page=1' -X POST -H 'Authorization: Bearer token' -H 'Content-Type: application/json' --data '{\"name\":\"demo\"}' --max-time 12"
  );

  assert.equal(definition.method, 'POST');
  assert.equal(definition.url, 'https://api.example.com/users');
  assert.deepEqual(definition.query, { page: '1' });
  assert.deepEqual(definition.headers, {
    Authorization: 'Bearer token',
    'Content-Type': 'application/json'
  });
  assert.deepEqual(definition.body, { name: 'demo' });
  assert.equal(definition.timeout, 12);
});

test('parseCurlCommand infers POST for curl data payloads', () => {
  const definition = parseCurlCommand("curl https://api.example.com/login --data 'name=demo'");
  assert.equal(definition.method, 'POST');
  assert.equal(definition.body, 'name=demo');
});

test('parseCurlCommand rejects unsupported multipart uploads', () => {
  assert.throws(() => parseCurlCommand("curl https://api.example.com/upload -F 'file=@demo.txt'"), /Unsupported curl option/);
});

test('resolveImportPath keeps imported requests inside the workspace root', () => {
  const root = path.resolve('http');
  const resolved = resolveImportPath('folder1/folder2/demo', root);
  assert.equal(resolved.logicalName, 'folder1/folder2/demo');
  assert.equal(resolved.requestPath, path.join(root, 'folder1', 'folder2', 'demo.http.json'));
  assert.throws(() => resolveImportPath('../demo', root), /inside the HTTP workspace root/);
  assert.throws(() => resolveImportPath('demo.example', root), /example files/);
});

test('buildImportedRequestDefinition supports curl imports', () => {
  const definition = buildImportedRequestDefinition('curl', "curl https://api.example.com/users");
  assert.equal(definition.method, 'GET');
  assert.equal(definition.url, 'https://api.example.com/users');
});

test('importRequestDefinition writes a runnable request definition', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hubcli-http-import-'));
  const result = await importRequestDefinition({
    type: 'curl',
    source: "curl 'https://api.example.com/users/1001?page=1' -H 'Authorization: Bearer token'",
    name: 'user/detail',
    root
  });

  const saved = JSON.parse(await readFile(result.requestPath, 'utf8'));
  assert.equal(result.logicalName, 'user/detail');
  assert.equal(saved.method, 'GET');
  assert.equal(saved.url, 'https://api.example.com/users/1001');
  assert.deepEqual(saved.query, { page: '1' });
  assert.deepEqual(saved.headers, { Authorization: 'Bearer token' });

  const built = await buildFileRequest('user/detail', {
    root,
    headers: {},
    query: {},
    vars: {},
    json: false,
    insecure: false
  });
  assert.equal(built.request.url, 'https://api.example.com/users/1001');
});

test('importRequestDefinition derives a logical name when name is omitted', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hubcli-http-import-derived-'));
  const result = await importRequestDefinition({
    type: 'curl',
    source: "curl 'https://api.example.com/users?page=1'"
  , root });

  assert.equal(result.logicalName, 'imported/get-users');
  assert.equal(path.basename(result.requestPath), 'get-users.http.json');

  const saved = JSON.parse(await readFile(result.requestPath, 'utf8'));
  assert.equal(saved.url, 'https://api.example.com/users');
  assert.deepEqual(saved.query, { page: '1' });
});

test('importRequestDefinition rejects overwriting unless force is enabled', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hubcli-http-import-force-'));
  await importRequestDefinition({
    type: 'curl',
    source: 'curl https://api.example.com/users',
    name: 'user/list',
    root
  });

  await assert.rejects(
    () => importRequestDefinition({
      type: 'curl',
      source: 'curl https://api.example.com/orders',
      name: 'user/list',
      root
    }),
    /already exists/
  );

  await importRequestDefinition({
    type: 'curl',
    source: 'curl https://api.example.com/orders',
    name: 'user/list',
    root,
    force: true
  });

  const saved = JSON.parse(await readFile(path.join(root, 'user', 'list.http.json'), 'utf8'));
  assert.equal(saved.url, 'https://api.example.com/orders');
});

test('normalizeRequestOptions parses method, json body, headers, query, and timeout', () => {
  const options = normalizeRequestOptions({
    method: 'post',
    jsonBody: '{"name":"demo"}',
    header: ['Authorization: Bearer token'],
    query: ['page=1'],
    timeout: '5'
  });

  assert.equal(options.method, 'POST');
  assert.deepEqual(options.jsonBody, { name: 'demo' });
  assert.deepEqual(options.headers, { Authorization: 'Bearer token' });
  assert.deepEqual(options.query, { page: '1' });
  assert.equal(options.timeout, 5);
});

test('normalizeSharedOptions parses runtime overrides', () => {
  const options = normalizeSharedOptions({
    var: ['userId=1002'],
    header: ['X-Test: yes'],
    query: ['traceId=abc'],
    timeout: '10',
    root: './apis',
    env: 'dev'
  });

  assert.equal(options.root, './apis');
  assert.equal(options.env, 'dev');
  assert.equal(options.timeout, 10);
  assert.deepEqual(options.vars, { userId: '1002' });
  assert.deepEqual(options.headers, { 'X-Test': 'yes' });
  assert.deepEqual(options.query, { traceId: 'abc' });
});

test('resolveRequestPath maps logical names under the default root', () => {
  const root = path.resolve('http');
  const resolved = resolveRequestPath('folder1/folder2/demo', root);
  assert.equal(resolved, path.resolve(root, 'folder1/folder2/demo.http.json'));
});

test('resolveRequestPath accepts explicit file paths', () => {
  const resolved = resolveRequestPath('D:/temp/demo.http.json', path.resolve('http'));
  assert.equal(resolved, path.resolve('D:/temp/demo.http.json'));
});

test('resolveRequestPath rejects example targets', () => {
  assert.throws(() => resolveRequestPath('user/demo.example', path.resolve('http')), /not runnable/);
  assert.throws(() => resolveRequestPath('D:/tmp/demo.example.http.json', path.resolve('http')), /not runnable/);
});

test('substituteTemplate replaces placeholders recursively', () => {
  const value = substituteTemplate(
    {
      url: '{{baseUrl}}/users/{{userId}}',
      headers: { Authorization: 'Bearer {{token}}' },
      query: { userId: '{{userId}}' }
    },
    { baseUrl: 'https://api.example.com', token: 'abc', userId: '1001' }
  );

  assert.deepEqual(value, {
    url: 'https://api.example.com/users/1001',
    headers: { Authorization: 'Bearer abc' },
    query: { userId: '1001' }
  });
});

test('buildFileRequest loads env files and applies CLI variable overrides', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hubcli-http-'));
  await mkdir(path.join(root, 'env'), { recursive: true });
  await mkdir(path.join(root, 'user'), { recursive: true });
  await writeFile(path.join(root, 'env', 'dev.json'), JSON.stringify({ baseUrl: 'https://api.example.com', userId: '1001' }), 'utf8');
  await writeFile(
    path.join(root, 'user', 'detail.http.json'),
    JSON.stringify({ method: 'GET', url: '{{baseUrl}}/users/{{userId}}', headers: {}, query: {} }),
    'utf8'
  );

  const result = await buildFileRequest('user/detail', {
    root,
    env: 'dev',
    vars: { userId: '1002' },
    headers: {},
    query: {},
    json: false,
    insecure: false
  });

  assert.equal(result.request.url, 'https://api.example.com/users/1002');
});

test('listRequestNames excludes example files and keeps nested logical names', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hubcli-http-list-'));
  await mkdir(path.join(root, 'user'), { recursive: true });
  await mkdir(path.join(root, 'folder1', 'folder2'), { recursive: true });
  await writeFile(path.join(root, 'user', 'detail.http.json'), '{}', 'utf8');
  await writeFile(path.join(root, 'user', 'detail.example.http.json'), '{}', 'utf8');
  await writeFile(path.join(root, 'folder1', 'folder2', 'demo.http.json'), '{}', 'utf8');

  const names = await listRequestNames(undefined, { root, header: [], query: [], var: [] });
  assert.deepEqual(names, ['folder1/folder2/demo', 'user/detail']);
});

test('initWorkspace creates example-only files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hubcli-http-init-'));
  const workspace = await initWorkspace(root);
  const readme = await readFile(path.join(workspace, 'README.example.md'), 'utf8');
  const envExample = await readFile(path.join(workspace, 'env', 'dev.example.json'), 'utf8');
  const requestExample = await readFile(path.join(workspace, 'user', 'create-user.example.http.json'), 'utf8');

  assert.match(readme, /Copy `\*\.example\.http\.json` files/);
  assert.match(envExample, /baseUrl/);
  assert.match(requestExample, /Create user/);
});

test('executeHttpRequest builds structured results and supports json payloads', async () => {
  const result = await executeHttpRequest(
    {
      method: 'POST',
      url: 'https://example.com/users',
      headers: {},
      query: { page: '1' },
      body: { name: 'demo' }
    },
    async (url, options) => {
      assert.equal(url.toString(), 'https://example.com/users?page=1');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.get('Content-Type'), 'application/json');
      assert.equal(options.body, '{"name":"demo"}');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      });
    }
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { ok: true });
  assert.match(formatHttpResult(result), /HTTP 200 OK/);
});
