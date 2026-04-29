import { coerceNumberOptions } from '../../core/payload-utils.js';

export async function buildNacosPayload(operation, options = {}, positional = {}) {
  const payloadOptions = coerceNumberOptions(
    {
      ...options,
      ...positional
    },
    ['timeout', 'pageNo', 'pageSize']
  );

  return {
    operation,
    options: payloadOptions
  };
}
