import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { platform } from 'os';

export interface QemuInfo {
  path: string;
  version: string;
  accelerators: string[];
  spiceSupported: boolean;
}

const SEARCH_PATHS: Record<string, string[]> = {
  darwin: [
    '/usr/local/bin/qemu-system-x86_64',
    '/opt/homebrew/bin/qemu-system-x86_64',
    '/usr/local/bin/qemu-system-aarch64',
    '/opt/homebrew/bin/qemu-system-aarch64',
  ],
  linux: [
    '/usr/bin/qemu-system-x86_64',
    '/usr/bin/qemu-system-aarch64',
    '/usr/libexec/qemu-system-x86_64',
  ],
  win32: [
    'C:\\Program Files\\qemu\\qemu-system-x86_64.exe',
    'C:\\Program Files (x86)\\qemu\\qemu-system-x86_64.exe',
  ],
};

function findQemuBinary(): string {
  const osType = platform();
  const searchPaths = SEARCH_PATHS[osType] || [];

  for (const path of searchPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  try {
    const x64 = spawnSync('which', ['qemu-system-x86_64'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    if (x64.status === 0 && x64.stdout) {
      return x64.stdout.trim();
    }

    const arm64 = spawnSync('which', ['qemu-system-aarch64'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    if (arm64.status === 0 && arm64.stdout) {
      return arm64.stdout.trim();
    }
  } catch {
    // which command failed - fall through to error
  }

  throw new Error('QEMU not found in PATH. Please install QEMU.');
}

function getQemuVersion(path: string): string {
  try {
    const result = spawnSync(path, ['--version'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    if (result.status === 0 && result.stdout) {
      return result.stdout.trim().split('\n')[0];
    }
  } catch (err) {
    console.warn('Failed to get QEMU version:', err);
  }

  return 'unknown';
}

function detectPlatformAccelerators(): string[] {
  const accelerators: string[] = [];
  const osType = platform();

  try {
    const result = spawnSync('qemu-system-x86_64', ['--help'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000
    });

    if (result.stdout) {
      const output = result.stdout;

      if (osType === 'darwin' && output.includes('-accel hvf')) {
        accelerators.push('hvf');
      }
      if (osType === 'linux' && output.includes('-accel kvm')) {
        accelerators.push('kvm');
      }
      if (osType === 'win32' && output.includes('-accel whpx')) {
        accelerators.push('whpx');
      }
      if (output.includes('-accel tcg')) {
        accelerators.push('tcg');
      }
    }
  } catch (err) {
    console.warn('Failed to detect accelerators:', err);
    accelerators.push('tcg');
  }

  if (accelerators.length === 0) {
    accelerators.push('tcg');
  }

  return accelerators;
}

function prioritizeAccelerators(accelerators: string[]): string[] {
  const preferred: string[] = [];
  const osType = platform();

  if (osType === 'darwin' && accelerators.includes('hvf')) preferred.push('hvf');
  if (osType === 'linux' && accelerators.includes('kvm')) preferred.push('kvm');
  if (osType === 'win32' && accelerators.includes('whpx')) preferred.push('whpx');
  if (accelerators.includes('tcg')) preferred.push('tcg');

  for (const accelerator of accelerators) {
    if (!preferred.includes(accelerator)) {
      preferred.push(accelerator);
    }
  }

  if (preferred.length === 0) {
    preferred.push('tcg');
  }

  return preferred;
}

function detectSpiceSupport(path: string): boolean {
  try {
    const result = spawnSync(path, ['-spice', 'help'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000,
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.toLowerCase();
    if (output.includes('spice options:')) {
      return true;
    }
    return result.status === 0;
  } catch {
    return false;
  }
}

export async function detectQemu(): Promise<QemuInfo> {
  const qemuPath = findQemuBinary();
  const version = getQemuVersion(qemuPath);
  const accelerators = prioritizeAccelerators(detectPlatformAccelerators());
  const spiceSupported = detectSpiceSupport(qemuPath);

  return {
    path: qemuPath,
    version,
    accelerators,
    spiceSupported,
  };
}
