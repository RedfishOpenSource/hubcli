import { readFile } from 'node:fs/promises';

import { coerceNumberOptions } from '../../core/payload-utils.js';

const numericKeys = ['timeout'];

function parseJsonOption(options, key) {
  if (!options[key]) {
    return;
  }

  try {
    options[key] = JSON.parse(options[key]);
  } catch {
    throw new Error(`Expected --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} to be valid JSON.`);
  }
}

export async function buildRocketMq4Payload(operation, options = {}, positional = {}) {
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

  parseJsonOption(payloadOptions, 'properties');

  return {
    operation,
    options: payloadOptions
  };
}
