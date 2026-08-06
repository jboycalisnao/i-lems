import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = resolve(projectRoot, '.env.example');
const localPath = resolve(projectRoot, '.env.local');

try {
  await access(localPath, constants.F_OK);
} catch {
  await copyFile(examplePath, localPath, constants.COPYFILE_EXCL);
  console.log('Created .env.local from .env.example.');
}
