import path from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

function resolvePath(filePath) {
  return path.resolve(process.cwd(), filePath);
}

export function resolveInputPath(filePath) {
  return resolvePath(filePath);
}

export function resolveOutputPath(filePath) {
  return resolvePath(filePath);
}

export function ensureOutputExtension(filePath, extension) {
  if (path.extname(filePath).toLowerCase() === extension) {
    return filePath;
  }

  return `${filePath}${extension}`;
}

export async function assertReadableFile(filePath, extension) {
  await access(filePath, constants.R_OK);
  if (path.extname(filePath).toLowerCase() !== extension) {
    throw new Error(`Expected a ${extension} file: ${filePath}`);
  }
}
