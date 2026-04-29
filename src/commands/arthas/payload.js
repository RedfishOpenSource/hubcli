import { coerceNumberOptions } from '../../core/payload-utils.js';

const numericKeys = ['pid', 'timeout'];

function normalizeArthasArgs(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value == null) {
    return [];
  }
  return [String(value)];
}

export async function buildArthasPayload(operation, options = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      arthasArgs: normalizeArthasArgs(options.arthasArgs)
    },
    numericKeys
  );

  if (!Number.isInteger(payloadOptions.pid) || payloadOptions.pid <= 0) {
    throw new Error('Expected --pid to be a positive integer.');
  }

  if (payloadOptions.timeout != null && (!(payloadOptions.timeout > 0) || Number.isNaN(payloadOptions.timeout))) {
    throw new Error('Expected --timeout to be a positive number.');
  }

  if (payloadOptions.arthasArgs.length === 0) {
    throw new Error('Arthas command arguments are required.');
  }

  return {
    operation,
    options: payloadOptions
  };
}
