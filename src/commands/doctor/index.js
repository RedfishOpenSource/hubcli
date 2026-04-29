import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { chromium } from 'playwright';
import pc from 'picocolors';
import { ensureWorkerFiles, findPythonCommand, runPythonCommand } from '../../core/python-bridge.js';
import { getPlaywrightBrowsersPath, isPackagedRuntime } from '../../core/runtime-paths.js';

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export default {
  name: 'doctor',
  description: 'Check whether the local runtime dependencies are available.',
  runtime: 'node',
  async runNode() {
    const worker = await ensureWorkerFiles();
    if (worker.mode === 'bundled') {
      console.log(pc.green(`Bundled Python worker detected: ${worker.workerPath}`));
    } else {
      const python = await findPythonCommand();
      console.log(pc.green(`Python command detected: ${python.command} ${python.version.major}.${python.version.minor}.${python.version.patch}`));
    }

    try {
      await access(chromium.executablePath(), constants.X_OK);
      if (isPackagedRuntime()) {
        console.log(pc.green(`Bundled Playwright Chromium is available from ${getPlaywrightBrowsersPath()}.`));
      } else {
        console.log(pc.green('Playwright Chromium is installed.'));
      }
    } catch {
      if (isPackagedRuntime()) {
        console.log(pc.yellow(`Bundled Playwright Chromium was not found under ${getPlaywrightBrowsersPath()}. Reinstall hubcli or rebuild the release artifact.`));
      } else {
        console.log(pc.yellow('Playwright Chromium is not installed. Run `npx playwright install chromium` before using `hubcli md`.'));
      }
    }

    try {
      const result = await runPythonCommand({ command: 'arthas', args: { operation: 'ping', options: {} } });
      if (result.httpReachable) {
        console.log(pc.green(`Arthas runtime is bundled and HTTP API is reachable at ${result.endpoint}.`));
      } else {
        console.log(pc.green(`Arthas runtime is bundled. HTTP API is not active yet; it will attach on first use. Endpoint: ${result.endpoint}.`));
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.log(pc.yellow(`Arthas check skipped: ${message}`));
    }

    try {
      await runPythonCommand({ command: 'rabbitmq', args: { operation: 'ping', options: { via: 'amqp' } } });
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes('RabbitMQ AMQP connection is required')) {
        console.log(pc.yellow('RabbitMQ worker dependencies are available. AMQP connectivity is not configured yet.'));
      } else if (message.includes('Missing Python dependency: pika')) {
        console.log(pc.yellow('RabbitMQ AMQP dependency `pika` is missing in the current Python environment.'));
      } else {
        console.log(pc.yellow(`RabbitMQ worker check skipped: ${message}`));
      }
    }

    try {
      const result = await runPythonCommand({ command: 'rocketmq4', args: { operation: 'ping', options: {} } });
      if (result.namesrvConfigured) {
        console.log(pc.green(`RocketMQ4 native worker can reach ${result.endpoint}.`));
      } else {
        console.log(pc.green('RocketMQ4 native worker is available. Configure `--namesrv` or `HUBCLI_ROCKETMQ_NAMESRV` before querying topics or sending messages.'));
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.log(pc.yellow(`RocketMQ4 worker check skipped: ${message}`));
    }

    try {
      const result = await runPythonCommand({ command: 'mqtt', args: { operation: 'ping', options: {} } });
      console.log(pc.green(`MQTT worker is available: ${result.protocolVersion || 'default protocol'}.`));
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes('MQTT connection is required')) {
        console.log(pc.yellow('MQTT worker dependencies are available. Configure `--url` or `--host` before connecting to a broker.'));
      } else if (message.includes('Missing Python dependency: paho.mqtt.client')) {
        console.log(pc.yellow('MQTT dependency `paho-mqtt` is missing in the current Python environment.'));
      } else {
        console.log(pc.yellow(`MQTT worker check skipped: ${message}`));
      }
    }

    try {
      const result = await runPythonCommand({ command: 'minio', args: { operation: 'ping', options: {} } });
      console.log(pc.green(`MinIO worker is available: ${result.endpoint || 'configured endpoint'}.`));
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes('MinIO endpoint is required')) {
        console.log(pc.yellow('MinIO worker dependencies are available. Configure `--endpoint`, `--access-key`, and `--secret-key` before connecting.'));
      } else if (message.includes('MinIO access key and secret key are required')) {
        console.log(pc.yellow('MinIO worker dependencies are available. Configure `--access-key` and `--secret-key` before connecting.'));
      } else if (message.includes("No module named 'minio'") || message.includes('Missing Python dependency: minio')) {
        console.log(pc.yellow('MinIO dependency `minio` is missing in the current Python environment.'));
      } else {
        console.log(pc.yellow(`MinIO worker check skipped: ${message}`));
      }
    }

    console.log(pc.green('Node CLI and Python worker look ready.'));
  }
};
