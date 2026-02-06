import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');

const COVERAGE_TARGETS = [
  'electron-src/qemu/install.ts',
  'src/asset-path.ts',
  'src/renderer/backend.ts',
];

const run = spawnSync('bun', ['test', '--coverage'], {
  cwd: appDir,
  encoding: 'utf8',
  stdio: 'pipe',
});

const output = `${run.stdout || ''}${run.stderr || ''}`;
process.stdout.write(output);

if (run.status !== 0) {
  process.exit(run.status ?? 1);
}

const rows = new Map();
for (const line of output.split('\n')) {
  if (!line.includes('|')) continue;
  if (line.includes('File') || line.includes('---')) continue;
  const parts = line.split('|').map((item) => item.trim());
  if (parts.length < 3) continue;
  const file = parts[0];
  if (!file || file === 'All files') continue;
  const funcs = Number.parseFloat(parts[1]);
  const lines = Number.parseFloat(parts[2]);
  if (Number.isNaN(funcs) || Number.isNaN(lines)) continue;
  rows.set(file, { funcs, lines });
}

const failures = [];
for (const target of COVERAGE_TARGETS) {
  const targetPath = path.join(appDir, target);
  if (!existsSync(targetPath)) {
    continue;
  }
  const row = rows.get(target);
  if (!row) {
    failures.push(`${target} missing from coverage output`);
    continue;
  }
  if (row.funcs < 100 || row.lines < 100) {
    failures.push(`${target} funcs=${row.funcs}% lines=${row.lines}%`);
  }
}

if (failures.length > 0) {
  console.error('\nCoverage gate failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nCoverage gate passed (100% funcs + lines for Electron release targets).');
