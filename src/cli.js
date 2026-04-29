import './core/runtime-paths.js';
import { Command } from 'commander';
import pc from 'picocolors';
import { registerCommands } from './core/command-registry.js';

const program = new Command();

program
  .name('hubcli')
  .description('A unified CLI shell powered by Node.js and Python workers.')
  .version('0.1.0')
  .enablePositionalOptions()
  .showHelpAfterError()
  .showSuggestionAfterError();

registerCommands(program);

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function run() {
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

try {
  await run();
} catch (error) {
  console.error(pc.red(getErrorMessage(error)));
  process.exitCode = 1;
}
