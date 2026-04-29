import { readFile } from 'node:fs/promises';

import { coerceNumberOptions } from '../../core/payload-utils.js';

const numericKeys = ['port', 'keepalive', 'sessionExpiry', 'timeout', 'qos', 'messageExpiry', 'maxMessages'];

function normalizeKeyValueList(values, label) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const result = [];

  for (const value of list) {
    const index = value.indexOf('=');
    if (index <= 0) {
      throw new Error(`Invalid ${label} format: ${value}. Expected key=value.`);
    }
    result.push([value.slice(0, index).trim(), value.slice(index + 1).trim()]);
  }

  return result;
}

export async function buildMqttPayload(operation, options = {}, positional = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      ...positional
    },
    numericKeys
  );

  if (payloadOptions.body && payloadOptions.bodyFile) {
    throw new Error('Use either --body or --body-file, not both.');
  }

  if (payloadOptions.bodyFile) {
    payloadOptions.body = await readFile(payloadOptions.bodyFile, 'utf8');
  }

  if (payloadOptions.userProperty) {
    payloadOptions.userProperties = normalizeKeyValueList(payloadOptions.userProperty, 'user property');
    delete payloadOptions.userProperty;
  }

  return {
    operation,
    options: payloadOptions
  };
}
