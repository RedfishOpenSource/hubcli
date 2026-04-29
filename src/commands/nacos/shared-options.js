export const connectionOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--server <url>', description: 'Nacos server base URL' },
  { flags: '--username <username>', description: 'Nacos username' },
  { flags: '--password <password>', description: 'Nacos password' },
  { flags: '--insecure', description: 'disable TLS certificate verification' },
  { flags: '--ca-cert <path>', description: 'CA certificate path for TLS' },
  { flags: '--client-cert <path>', description: 'client certificate path for TLS' },
  { flags: '--client-key <path>', description: 'client private key path for TLS' }
];

export const namespaceOptions = [
  { flags: '--namespace <namespaceId>', description: 'Nacos namespace ID' }
];

export const pagingOptions = [
  { flags: '--page-no <n>', description: 'page number for list queries' },
  { flags: '--page-size <n>', description: 'page size for list queries' }
];

export const groupOptions = [
  { flags: '--group <name>', description: 'Nacos config group' },
  { flags: '--group-name <name>', description: 'Nacos service group name' }
];

export const instanceFilterOptions = [
  { flags: '--cluster-name <name>', description: 'service cluster name' },
  { flags: '--healthy-only', description: 'only return healthy instances when supported' }
];

export const configListOptions = [
  { flags: '--search <mode>', description: 'config search mode: blur or accurate' },
  { flags: '--data-id <id>', description: 'filter configs by data ID' }
];

export const configGetOptions = [
  { flags: '--data-id <id>', description: 'target config data ID' }
];

export const serviceTargetOptions = [
  { flags: '--service-name <name>', description: 'target service name' }
];
