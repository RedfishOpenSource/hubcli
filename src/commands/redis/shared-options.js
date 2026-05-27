export const connectionOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--url <redis-url>', description: 'Redis connection URL' },
  { flags: '--host <host>', description: 'Redis host' },
  { flags: '--port <port>', description: 'Redis port' },
  { flags: '--username <name>', description: 'Redis ACL username' },
  { flags: '--password <password>', description: 'Redis password' },
  { flags: '--database <n>', description: 'Redis database index' },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--tls', description: 'connect using TLS' },
  { flags: '--insecure', description: 'disable TLS certificate verification' },
  { flags: '--ca-cert <path>', description: 'CA certificate path for TLS' },
  { flags: '--client-cert <path>', description: 'client certificate path for TLS' },
  { flags: '--client-key <path>', description: 'client private key path for TLS' }
];

export const infoOptions = [
  { flags: '--section <name>', description: 'Redis INFO section name' }
];

export const scanOptions = [
  { flags: '--pattern <glob>', description: 'key pattern to match' },
  { flags: '--count <n>', description: 'SCAN count hint' },
  { flags: '--limit <n>', description: 'maximum keys to return' }
];

export const keySetOptions = [
  { flags: '--value <text>', description: 'value to write' },
  { flags: '--file <path>', description: 'read value from a file' },
  { flags: '--ttl <seconds>', description: 'expiration time in seconds' },
  { flags: '--nx', description: 'set only when the key does not exist' },
  { flags: '--xx', description: 'set only when the key already exists' }
];

export const keyExpireOptions = [
  { flags: '--ttl <seconds>', description: 'expiration time in seconds' }
];
