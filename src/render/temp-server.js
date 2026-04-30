import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.bmp', 'image/bmp']
]);

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function resolveDocumentPath(rootDirectory, pathname) {
  const relativePath = decodeURIComponent(pathname === '/' ? '/document.html' : pathname);
  return path.join(rootDirectory, relativePath);
}

function resolveAssetPath(assetRootDirectory, requestedPath) {
  if (!assetRootDirectory || !requestedPath) {
    return null;
  }

  return path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(assetRootDirectory, requestedPath);
}

export async function startStaticServer(rootDirectory, options = {}) {
  const assetRootDirectory = options.assetRootDirectory;

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const filePath = url.pathname === '/__hubcli_asset__'
        ? resolveAssetPath(assetRootDirectory, url.searchParams.get('path'))
        : resolveDocumentPath(rootDirectory, url.pathname);

      if (!filePath) {
        throw new Error('Asset path is missing.');
      }

      const contents = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': getContentType(filePath) });
      response.end(contents);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start temporary HTTP server.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
