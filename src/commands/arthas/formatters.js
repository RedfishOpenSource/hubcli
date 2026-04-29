import { printCommandResult } from '../../core/python-command.js';

function writeStream(output, text) {
  if (!text) {
    return;
  }
  output.write(text.endsWith('\n') ? text : `${text}\n`);
}

export function printArthasResult(result, options = {}) {
  if (options.json) {
    printCommandResult(result, options);
    return;
  }

  if (result.stdout) {
    writeStream(process.stdout, String(result.stdout));
  }

  if (result.stderr) {
    writeStream(process.stderr, String(result.stderr));
  }

  if (!result.stdout && !result.stderr) {
    printCommandResult(result.message ? { message: result.message } : result, options);
  }
}
