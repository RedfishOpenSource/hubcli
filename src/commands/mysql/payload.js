import { readFile } from 'node:fs/promises';

import { coerceNumberOptions } from '../../core/payload-utils.js';

export async function buildMysqlPayload(operation, options = {}, positional = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      ...positional
    },
    ['port', 'timeout', 'limit']
  );

  if (payloadOptions.sql && payloadOptions.file) {
    throw new Error('Use either --sql or --file, not both.');
  }

  if (payloadOptions.file) {
    payloadOptions.sql = await readFile(payloadOptions.file, 'utf8');
  }

  if (payloadOptions.tables) {
    payloadOptions.tables = String(payloadOptions.tables)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return {
    operation,
    options: payloadOptions
  };
}
