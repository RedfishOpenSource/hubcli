import { readFile } from 'node:fs/promises';

import { coerceNumberOptions } from '../../core/payload-utils.js';

function normalizeHeaders(headers) {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const result = {};

  for (const value of values) {
    const index = value.indexOf('=');
    if (index <= 0) {
      throw new Error(`Invalid header format: ${value}. Expected key=value.`);
    }
    const key = value.slice(0, index).trim();
    const headerValue = value.slice(index + 1).trim();
    result[key] = headerValue;
  }

  return result;
}

export async function buildRabbitMqPayload(operation, options = {}, positional = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      ...positional
    },
    ['timeout', 'port', 'heartbeat', 'maxMessages']
  );

  if (payloadOptions.bodyFile) {
    payloadOptions.body = await readFile(payloadOptions.bodyFile, 'utf8');
  }

  if (payloadOptions.header) {
    payloadOptions.headers = normalizeHeaders(payloadOptions.header);
    delete payloadOptions.header;
  }

  return {
    operation,
    options: payloadOptions
  };
}
