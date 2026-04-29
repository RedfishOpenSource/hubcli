import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { getBundledWorkerPath, getProjectRoot, getSourceWorkerDirectory, getSourceWorkerEntry, hasBundledWorker } from './runtime-paths.js';

const PYTHON_CANDIDATES = ['python', 'python3', 'py'];

function collectStream(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
    });
    stream.on('end', () => resolve(buffer));
    stream.on('error', reject);
  });
}

function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const stdoutPromise = collectStream(child.stdout);
    const stderrPromise = collectStream(child.stderr);

    child.on('error', reject);

    if (typeof options.stdin === 'string') {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }

    child.on('close', async (code) => {
      try {
        const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
        resolve({ code, stdout, stderr });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function parsePythonVersion(output) {
  const match = output.match(/Python\s+(\d+)\.(\d+)\.(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function isSupportedPython(version) {
  return version.major > 3 || (version.major === 3 && version.minor >= 11);
}

export async function findPythonCommand() {
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      const versionArgs = candidate === 'py' ? ['-3', '--version'] : ['--version'];
      const result = await spawnProcess(candidate, versionArgs, { cwd: process.cwd(), env: process.env });
      const combinedOutput = `${result.stdout}\n${result.stderr}`;
      const version = parsePythonVersion(combinedOutput);
      if (result.code === 0 && version && isSupportedPython(version)) {
        return candidate === 'py'
          ? { command: candidate, argsPrefix: ['-3'], version }
          : { command: candidate, argsPrefix: [], version };
      }
    } catch {
      continue;
    }
  }

  throw new Error('Python 3.11+ was not found on PATH. Please install Python and retry.');
}

export async function ensureWorkerFiles() {
  if (await hasBundledWorker()) {
    return { mode: 'bundled', workerPath: getBundledWorkerPath() };
  }

  const workerEntry = getSourceWorkerEntry();
  try {
    await access(workerEntry, constants.R_OK);
    return { mode: 'source', workerEntry, workerDirectory: getSourceWorkerDirectory() };
  } catch {
    throw new Error(`Python worker entrypoint is missing at ${workerEntry}.`);
  }
}

export async function runPythonCommand(payload, options = {}) {
  const worker = await ensureWorkerFiles();
  const commonEnv = {
    ...process.env,
    ...(options.env ?? {}),
    HUBCLI_HOME: getProjectRoot(),
    PYTHONUTF8: '1'
  };

  const result = worker.mode === 'bundled'
    ? await spawnProcess(worker.workerPath, [], {
        cwd: getProjectRoot(),
        env: {
          ...commonEnv,
          HUBCLI_PACKAGED: '1'
        },
        stdin: JSON.stringify(payload)
      })
    : await (async () => {
        const python = await findPythonCommand();
        const args = [...python.argsPrefix, '-m', 'hubcli_worker.main'];
        return spawnProcess(python.command, args, {
          cwd: worker.workerDirectory,
          env: commonEnv,
          stdin: JSON.stringify(payload)
        });
      })();

  if (!result.stdout.trim()) {
    throw new Error(result.stderr.trim() || 'Python worker returned no output.');
  }

  let response;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse worker response: ${result.stdout}`);
  }

  if (result.code !== 0 || !response.ok) {
    const message = response?.error?.message || result.stderr.trim() || 'Python worker failed.';
    throw new Error(message);
  }

  return response.result;
}
