export const connectionOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--host <host>', description: 'MySQL host' },
  { flags: '--port <port>', description: 'MySQL port' },
  { flags: '--user <username>', description: 'MySQL username' },
  { flags: '--pass <password>', description: 'MySQL password' },
  { flags: '--database <name>', description: 'default MySQL database' },
  { flags: '--charset <name>', description: 'connection charset' },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--insecure', description: 'disable TLS certificate verification' },
  { flags: '--ca-cert <path>', description: 'CA certificate path for TLS' },
  { flags: '--client-cert <path>', description: 'client certificate path for TLS' },
  { flags: '--client-key <path>', description: 'client private key path for TLS' }
];

export const sqlInputOptions = [
  { flags: '--sql <text>', description: 'SQL text to execute' },
  { flags: '--file <path>', description: 'read SQL from a file' }
];

export const executionOptions = [
  { flags: '--allow-write', description: 'allow mutating SQL execution' },
  { flags: '--yes', description: 'confirm dangerous SQL execution' },
  { flags: '--multi', description: 'allow multiple SQL statements' },
  { flags: '--limit <n>', description: 'limit rows for read queries' }
];

export const exportOptions = [
  { flags: '--format <type>', description: 'export format: csv, json, tsv, sql' },
  { flags: '--output <path>', description: 'output file path' },
  { flags: '--tables <names>', description: 'comma-separated table names' },
  { flags: '--schema-only', description: 'export schema only' },
  { flags: '--data-only', description: 'export data only' }
];
