const messages = [
  'hubcli postinstall: source and npm installs still require Python 3.11+ on PATH before running Python-backed commands.',
  'For source and npm installs, run `npx playwright install chromium` before using `hubcli md` unless Chromium is already available.',
  'GitHub Releases installer builds bundle Node, the Python worker, and Chromium; only `hubcli arthas` still requires local Java.',
  'Arthas is bundled with hubcli. Install Java locally before using `hubcli arthas`.',
  'RabbitMQ, RocketMQ4, MQTT, Nacos, and MySQL support use the Python packages declared in `python/pyproject.toml`.',
  'RocketMQ4 now uses a native Python implementation and no longer downloads Java or mqadmin during install.'
];

for (const message of messages) {
  console.log(message);
}
