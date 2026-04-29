function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printList(items) {
  for (const item of items) {
    if (typeof item === 'string') {
      console.log(item);
      continue;
    }
    console.log(JSON.stringify(item, null, 2));
  }
}

export function printCommandResult(result, options = {}) {
  if (options.json) {
    printJson(result);
    return;
  }

  if (result == null) {
    console.log('Done.');
    return;
  }

  if (typeof result === 'string') {
    console.log(result);
    return;
  }

  if (Array.isArray(result)) {
    printList(result);
    return;
  }

  if (result.message && Object.keys(result).length === 1) {
    console.log(result.message);
    return;
  }

  printJson(result);
}

function validateNumericOptions(options, numericOptions) {
  for (const { name, flags } of numericOptions) {
    if (options[name] != null && Number.isNaN(options[name])) {
      throw new Error(`Expected ${flags} to be a number.`);
    }
  }
}

export function createPythonCommand(operation, extra = {}) {
  const {
    pythonCommand,
    sharedOptions = [],
    buildPayload,
    printResult = printCommandResult,
    numericOptions = [],
    arguments: extraArguments = [],
    options: extraOptions = [],
    getPythonEnv,
    ...rest
  } = extra;

  return {
    type: 'command',
    runtime: 'python',
    pythonCommand,
    options: [...sharedOptions, ...extraOptions],
    arguments: extraArguments,
    async prepare(rawArgs) {
      const args = {
        ...(rawArgs.options ?? {})
      };

      for (const argument of extraArguments) {
        args[argument.name] = rawArgs[argument.name];
      }

      return buildPayload(operation, args);
    },
    validate(args) {
      validateNumericOptions(args.options, numericOptions);
    },
    getPythonArgs(args) {
      return args;
    },
    async getPythonEnv(args, context) {
      return getPythonEnv ? getPythonEnv(args, context) : undefined;
    },
    async handleResult(args, result) {
      printResult(result, args.options);
    },
    ...rest
  };
}
