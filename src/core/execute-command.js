import { runPythonCommand } from './python-bridge.js';

function ensureRuntime(definition) {
  if (!['node', 'python', 'hybrid'].includes(definition.runtime)) {
    throw new Error(`Unsupported runtime for command ${definition.name}: ${definition.runtime}`);
  }
}

export async function executeCommand(definition, rawArgs) {
  ensureRuntime(definition);

  const context = { definition };
  const args = definition.prepare
    ? await definition.prepare(rawArgs, context)
    : rawArgs;

  if (definition.validate) {
    await definition.validate(args, context);
  }

  if (definition.runtime === 'node') {
    return definition.runNode(args, context);
  }

  const pythonArgs = definition.getPythonArgs
    ? await definition.getPythonArgs(args, context)
    : args;
  const pythonEnv = definition.getPythonEnv
    ? await definition.getPythonEnv(args, context)
    : undefined;
  const result = await runPythonCommand(
    {
      command: definition.pythonCommand ?? definition.name,
      args: pythonArgs
    },
    { env: pythonEnv }
  );

  if (definition.runtime === 'python') {
    if (definition.handleResult) {
      await definition.handleResult(args, result, context);
    }
    return result;
  }

  return definition.runNode(args, result, context);
}
