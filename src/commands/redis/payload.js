import { readFile } from 'node:fs/promises';

import { coerceNumberOptions } from '../../core/payload-utils.js';

const numericKeys = ['port', 'database', 'timeout', 'count', 'limit', 'ttl'];

export async function buildRedisPayload(operation, options = {}, positional = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      ...positional
    },
    numericKeys
  );

  if (payloadOptions.value != null && payloadOptions.file) {
    throw new Error('Use either --value or --file, not both.');
  }

  if (payloadOptions.file) {
    payloadOptions.value = await readFile(payloadOptions.file, 'utf8');
  }

  return {
    operation,
    options: payloadOptions
  };
}
