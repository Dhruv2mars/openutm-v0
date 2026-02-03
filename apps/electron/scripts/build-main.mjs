import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');

try {
  console.log('Building main process and preload script...');
  execSync('tsc --noEmit', { cwd: appDir, stdio: 'inherit' });
  
  console.log('Bundling main.ts...');
  execSync(`esbuild src/main.ts --bundle --platform=node --format=esm --external:electron --outfile=dist/main.js`, {
    cwd: appDir,
    stdio: 'inherit'
  });

  console.log('Bundling preload.ts...');
  execSync(`esbuild src/preload.ts --bundle --platform=node --format=esm --external:electron --outfile=dist/preload.js`, {
    cwd: appDir,
    stdio: 'inherit'
  });

  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
