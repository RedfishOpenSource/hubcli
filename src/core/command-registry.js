import { executeCommand } from './execute-command.js';
import arthasCommand from '../commands/arthas/index.js';
import doctorCommand from '../commands/doctor/index.js';
import markdownCommand from '../commands/md/index.js';
import minioCommand from '../commands/minio/index.js';
import mqttCommand from '../commands/mqtt/index.js';
import mysqlCommand from '../commands/mysql/index.js';
import nacosCommand from '../commands/nacos/index.js';
import rabbitmqCommand from '../commands/rabbitmq/index.js';
import rocketmq4Command from '../commands/rocketmq4/index.js';
import xmindCommand from '../commands/xmind/index.js';

const COMMAND_DEFINITIONS = [
  xmindCommand,
  markdownCommand,
  doctorCommand,
  arthasCommand,
  rabbitmqCommand,
  rocketmq4Command,
  mqttCommand,
  minioCommand,
  nacosCommand,
  mysqlCommand
];

function applyArguments(command, definition) {
  for (const argument of definition.arguments ?? []) {
    command.argument(argument.syntax, argument.description);
  }
}

function applyOptions(command, definition) {
  for (const option of definition.options ?? []) {
    command.option(option.flags, option.description, option.defaultValue);
  }
}

function collectArgs(definition, actionArgs) {
  const positionalCount = definition.arguments?.length ?? 0;
  const positionalValues = actionArgs.slice(0, positionalCount);
  const commanderCommand = actionArgs.at(-1);
  const args = Object.fromEntries(
    (definition.arguments ?? []).map((argument, index) => [argument.name, positionalValues[index]])
  );

  if ((definition.options ?? []).length > 0) {
    args.options = commanderCommand?.opts?.() ?? {};
  }

  return args;
}

function registerCommand(program, definition) {
  const command = program.command(definition.name).description(definition.description);
  applyArguments(command, definition);
  applyOptions(command, definition);
  if (definition.configure) {
    definition.configure(command);
  }
  command.action(async (...actionArgs) => {
    await executeCommand(definition, collectArgs(definition, actionArgs));
  });
}

function registerGroup(program, definition) {
  const group = program.command(definition.name).description(definition.description);
  for (const subcommand of definition.subcommands ?? []) {
    registerDefinition(group, subcommand);
  }
}

function registerDefinition(program, definition) {
  if (definition.type === 'group') {
    registerGroup(program, definition);
    return;
  }

  registerCommand(program, definition);
}

export function registerCommands(program) {
  for (const definition of COMMAND_DEFINITIONS) {
    registerDefinition(program, definition);
  }
}
