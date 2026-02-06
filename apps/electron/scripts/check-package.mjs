import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');

const archArgIndex = process.argv.indexOf('--arch');
const arch = archArgIndex >= 0 ? process.argv[archArgIndex + 1] : 'universal';

const appBundle =
  arch === 'x64'
    ? path.join(appDir, 'release', 'mac', 'OpenUTM (Electron).app')
    : path.join(appDir, 'release', 'mac-universal', 'OpenUTM (Electron).app');

const infoPlist = path.join(appBundle, 'Contents', 'Info.plist');

if (!existsSync(appBundle)) {
  console.error(`missing app bundle: ${appBundle}`);
  process.exit(1);
}

if (!existsSync(infoPlist)) {
  console.error(`missing Info.plist: ${infoPlist}`);
  process.exit(1);
}

function readPlistKey(key) {
  return execFileSync('defaults', ['read', infoPlist, key], { encoding: 'utf8' }).trim();
}

const bundleName = readPlistKey('CFBundleName');
const displayName = readPlistKey('CFBundleDisplayName');

if (bundleName !== 'OpenUTM (Electron)' || displayName !== 'OpenUTM (Electron)') {
  console.error(`unexpected app naming: CFBundleName='${bundleName}' CFBundleDisplayName='${displayName}'`);
  process.exit(1);
}

console.log('package sanity ok');
console.log(`arch: ${arch}`);
console.log(`bundle: ${appBundle}`);
console.log(`name: ${bundleName}`);
