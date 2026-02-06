import { spawnSync as defaultSpawnSync } from 'child_process';
import { existsSync as defaultExistsSync } from 'fs';
import { platform as defaultPlatform } from 'os';
import { getRuntimeConfig as defaultGetRuntimeConfig } from '../config';

export type RuntimeSource = 'managed' | 'system';

export interface QemuInfo {
  path: string;
  version: string;
  accelerators: string[];
  spiceSupported: boolean;
  source: RuntimeSource;
  ready: boolean;
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

type SpawnSyncResult = {
  status: number | null;
  stdout?: string | null;
  stderr?: string | null;
};

interface DetectorDeps {
  spawnSync: typeof defaultSpawnSync;
  existsSync: typeof defaultExistsSync;
  platform: typeof defaultPlatform;
  getRuntimeConfig: typeof defaultGetRuntimeConfig;
}

const defaultDeps: DetectorDeps = {
  spawnSync: defaultSpawnSync,
  existsSync: defaultExistsSync,
  platform: defaultPlatform,
  getRuntimeConfig: defaultGetRuntimeConfig,
};

let deps: DetectorDeps = { ...defaultDeps };

export function setDetectorDepsForTests(overrides: Partial<DetectorDeps>): void {
  deps = { ...deps, ...overrides };
}

export function resetDetectorDepsForTests(): void {
  deps = { ...defaultDeps };
}

function run(binaryPath: string, args: string[]): SpawnSyncResult {
  const result = deps.spawnSync(binaryPath, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 5000,
  }) as unknown as SpawnSyncResult;
  return result;
}

function findSystemQemuBinary(): string {
  const osType = deps.platform();
  const searchPaths = SEARCH_PATHS[osType] || [];

  for (const targetPath of searchPaths) {
    if (deps.existsSync(targetPath)) {
      return targetPath;
    }
  }

  try {
    const x64 = deps.spawnSync('which', ['qemu-system-x86_64'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    }) as unknown as SpawnSyncResult;
    if (x64.status === 0 && x64.stdout) {
      return String(x64.stdout).trim();
    }

    const arm64 = deps.spawnSync('which', ['qemu-system-aarch64'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    }) as unknown as SpawnSyncResult;
    if (arm64.status === 0 && arm64.stdout) {
      return String(arm64.stdout).trim();
    }
  } catch {
    // noop
  }

  throw new Error('QEMU not found in PATH. Please install QEMU.');
}

function getQemuVersion(binaryPath: string): string {
  try {
    const result = run(binaryPath, ['--version']);
    if (result.status === 0 && result.stdout) {
      return String(result.stdout).trim().split('\n')[0] || 'unknown';
    }
  } catch {
    // noop
  }
  return 'unknown';
}

function detectSpiceSupport(binaryPath: string): boolean {
  try {
    const result = run(binaryPath, ['-spice', 'help']);
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.toLowerCase();
    if (output.includes('spice options:')) {
      return true;
    }
    return result.status === 0;
  } catch {
    return false;
  }
}

function detectPlatformAccelerators(binaryPath: string): string[] {
  const accelerators: string[] = [];
  const osType = deps.platform();

  try {
    const result = run(binaryPath, ['--help']);
    const output = String(result.stdout || '');

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
  } catch {
    accelerators.push('tcg');
  }

  if (accelerators.length === 0) {
    accelerators.push('tcg');
  }
  return accelerators;
}

function buildResult(binaryPath: string, source: RuntimeSource): QemuInfo {
  const version = getQemuVersion(binaryPath);
  const accelerators = detectPlatformAccelerators(binaryPath);
  const spiceSupported = detectSpiceSupport(binaryPath);
  return {
    path: binaryPath,
    version,
    accelerators,
    spiceSupported,
    source,
    ready: spiceSupported,
  };
}

export async function detectQemu(): Promise<QemuInfo> {
  const runtime = await deps.getRuntimeConfig();
  if (runtime.managedRuntimePath && deps.existsSync(runtime.managedRuntimePath)) {
    return buildResult(runtime.managedRuntimePath, 'managed');
  }

  const systemPath = findSystemQemuBinary();
  return buildResult(systemPath, 'system');
}

export async function getRuntimeStatus(): Promise<QemuInfo> {
  return detectQemu();
}
