import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import pc from 'picocolors';
import { ensureOutputExtension, resolveOutputPath } from '../../core/paths.js';

function formatTimestamp(date = new Date()) {
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].map((part) => String(part).padStart(2, '0'));

  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function parseMonitor(value) {
  if (value == null) {
    return undefined;
  }

  const monitor = Number(value);
  if (!Number.isInteger(monitor) || monitor < 1) {
    throw new Error('Expected --monitor to be a positive integer.');
  }

  return monitor;
}

const screenshotCommand = {
  name: 'screenshot',
  description: 'Capture the Windows desktop to a PNG file.',
  runtime: 'python',
  pythonCommand: 'windows',
  arguments: [{ name: 'output', syntax: '[output]', description: 'target PNG file path' }],
  options: [
    { flags: '--monitor <index>', description: '1-based monitor index to capture' },
    { flags: '--all', description: 'capture the full virtual desktop across all monitors' }
  ],
  async prepare({ output, options = {} }) {
    const outputName = output ?? `screenshot-${formatTimestamp()}.png`;
    const outputPath = ensureOutputExtension(resolveOutputPath(outputName), '.png');
    const monitor = parseMonitor(options.monitor);
    const all = options.all ? true : monitor == null;

    return {
      outputPath,
      all,
      monitor
    };
  },
  async validate(args) {
    if (process.platform !== 'win32') {
      throw new Error('Windows screenshot is only supported on Windows.');
    }

    if (args.all && args.monitor != null) {
      throw new Error('Use either --all or --monitor, not both.');
    }

    await mkdir(path.dirname(args.outputPath), { recursive: true });
  },
  getPythonArgs(args) {
    return {
      operation: 'screenshot',
      options: {
        outputPath: args.outputPath,
        all: args.all,
        monitor: args.monitor
      }
    };
  },
  async handleResult(args, result) {
    console.log(pc.green(`Screenshot written to ${result.outputPath}`));
    console.log(`Monitor: ${result.monitor}, size: ${result.width}x${result.height}`);
  }
};

export default {
  type: 'group',
  name: 'windows',
  description: 'Windows desktop operations.',
  subcommands: [screenshotCommand]
};
