import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { watch } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');

let electronProcess = null;

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
  }

  electronProcess = spawn('electron', ['.'], {
    cwd: appDir,
    stdio: 'inherit'
  });
}

const viteProcess = spawn('vite', { cwd: appDir, stdio: 'inherit' });

setTimeout(() => {
  const tsWatcher = spawn('tsc', ['-w', '--noEmit'], { cwd: appDir, stdio: 'inherit' });

  watch(path.join(appDir, 'src/main.ts'), () => {
    startElectron();
  });

  startElectron();

  process.on('exit', () => {
    viteProcess.kill();
    tsWatcher.kill();
    if (electronProcess) electronProcess.kill();
  });
}, 2000);
