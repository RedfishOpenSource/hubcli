import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = path.resolve(MODULE_DIRECTORY, '..', '..');
const PROJECT_ROOT = path.resolve(process.env.HUBCLI_HOME || DEFAULT_PROJECT_ROOT);
const IS_WINDOWS = process.platform === 'win32';
const DEFAULT_BROWSER_PATH = path.join(PROJECT_ROOT, 'ms-playwright');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(DEFAULT_BROWSER_PATH)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = DEFAULT_BROWSER_PATH;
}

function resolveFromRoot(...segments) {
  return path.join(PROJECT_ROOT, ...segments);
}

async function pathExists(targetPath, mode = constants.F_OK) {
  try {
    await access(targetPath, mode);
    return true;
  } catch {
    return false;
  }
}

export function getProjectRoot() {
  return PROJECT_ROOT;
}

export function isPackagedRuntime() {
  return process.env.HUBCLI_HOME === PROJECT_ROOT || process.env.HUBCLI_PACKAGED === '1';
}

export function getMermaidScriptPath() {
  return resolveFromRoot('node_modules', 'mermaid', 'dist', 'mermaid.min.js');
}

export function getPlaywrightBrowsersPath() {
  return process.env.PLAYWRIGHT_BROWSERS_PATH || DEFAULT_BROWSER_PATH;
}

export function getBundledWorkerPath() {
  return process.env.HUBCLI_PYTHON_WORKER || resolveFromRoot('runtime', 'python-worker', IS_WINDOWS ? 'hubcli-worker.exe' : 'hubcli-worker');
}

export function getSourceWorkerDirectory() {
  return resolveFromRoot('python');
}

export function getSourceWorkerEntry() {
  return resolveFromRoot('python', 'hubcli_worker', 'main.py');
}

export async function hasBundledWorker() {
  return pathExists(getBundledWorkerPath(), constants.X_OK);
}

export async function hasBundledBrowsers() {
  return pathExists(getPlaywrightBrowsersPath());
}
