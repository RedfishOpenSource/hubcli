export const sharedOptions = [
  { flags: '--json', description: 'output raw JSON results' },
  { flags: '--namesrv <addr>', description: 'RocketMQ NameServer address list' },
  { flags: '--group <name>', description: 'producer group used for message send' },
  { flags: '--tag <value>', description: 'message tag' },
  { flags: '--timeout <seconds>', description: 'request timeout in seconds' },
  { flags: '--output <path>', description: 'output file path' }
];

export const messageSendOptions = [
  { flags: '--body <text>', description: 'message body text' },
  { flags: '--body-file <path>', description: 'read message body from file' },
  { flags: '--keys <keys>', description: 'message keys' },
  { flags: '--properties <json>', description: 'message properties as JSON object' }
];
