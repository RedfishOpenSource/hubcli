export const sharedOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--root <dir>', description: 'request root directory, defaults to ./http' },
  { flags: '--env <name>', description: 'environment file name under env/' },
  { flags: '--var <key=value>', description: 'request variable override', defaultValue: collectValue },
  { flags: '--header <key:value>', description: 'request header override', defaultValue: collectValue },
  { flags: '--query <key=value>', description: 'request query override', defaultValue: collectValue },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--output <path>', description: 'write response body to a file' },
  { flags: '--insecure', description: 'disable TLS certificate verification' }
];

export const sendOptions = [
  { flags: '--method <method>', description: 'HTTP method, defaults to GET' },
  { flags: '--body <text>', description: 'raw request body text' },
  { flags: '--json-body <json>', description: 'JSON request body text' }
];

function collectValue(value, previous = []) {
  return [...previous, value];
}
