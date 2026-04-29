export const connectionOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--endpoint <url>', description: 'MinIO or S3-compatible endpoint URL' },
  { flags: '--access-key <key>', description: 'MinIO access key' },
  { flags: '--secret-key <key>', description: 'MinIO secret key' },
  { flags: '--region <name>', description: 'bucket region' },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--secure', description: 'force HTTPS even when endpoint has no scheme' },
  { flags: '--insecure', description: 'disable TLS certificate verification' },
  { flags: '--ca-cert <path>', description: 'CA certificate path for TLS' },
  { flags: '--client-cert <path>', description: 'client certificate path for TLS' },
  { flags: '--client-key <path>', description: 'client private key path for TLS' }
];

export const bucketTargetOptions = [
  { flags: '--bucket <name>', description: 'target bucket name' }
];

export const objectListOptions = [
  { flags: '--prefix <value>', description: 'object key prefix filter' },
  { flags: '--recursive', description: 'list recursively' },
  { flags: '--include-versions', description: 'include object versions when supported' }
];

export const objectReadOptions = [
  { flags: '--output <path>', description: 'write object content to output file' }
];

export const objectWriteOptions = [
  { flags: '--file <path>', description: 'source file to upload' },
  { flags: '--content-type <type>', description: 'content type metadata' }
];
