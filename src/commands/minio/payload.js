import { coerceNumberOptions } from '../../core/payload-utils.js';

export async function buildMinioPayload(operation, options = {}, positional = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      ...positional
    },
    ['timeout']
  );

  return {
    operation,
    options: payloadOptions
  };
}
