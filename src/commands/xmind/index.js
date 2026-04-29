import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import pc from 'picocolors';
import { assertReadableFile, ensureOutputExtension, resolveInputPath, resolveOutputPath } from '../../core/paths.js';

export default {
  name: 'xmind',
  description: 'Convert an XMind file to Markdown.',
  runtime: 'python',
  pythonCommand: 'xmind',
  arguments: [
    { name: 'input', syntax: '<input>', description: 'source .xmind file path' },
    { name: 'output', syntax: '<output>', description: 'target markdown file path' }
  ],
  async prepare({ input, output }) {
    const inputPath = resolveInputPath(input);
    const outputPath = ensureOutputExtension(resolveOutputPath(output), '.md');

    return {
      inputPath,
      outputPath
    };
  },
  async validate(args) {
    await assertReadableFile(args.inputPath, '.xmind');
    await mkdir(path.dirname(args.outputPath), { recursive: true });
  },
  getPythonArgs(args) {
    return {
      inputPath: args.inputPath,
      outputPath: args.outputPath
    };
  },
  async handleResult(args, result) {
    console.log(pc.green(`Markdown written to ${result.outputPath}`));
    if (Array.isArray(result.warnings) && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(pc.yellow(`Warning: ${warning}`));
      }
    }
  }
};
