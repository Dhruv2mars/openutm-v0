import { createHash, randomUUID as defaultRandomUUID } from 'crypto';
import {
  chmodSync as defaultChmodSync,
  copyFileSync as defaultCopyFileSync,
  existsSync as defaultExistsSync,
  mkdirSync as defaultMkdirSync,
  renameSync as defaultRenameSync,
  rmSync as defaultRmSync,
  writeFileSync as defaultWriteFileSync,
} from 'fs';
import { arch as defaultArch, platform as defaultPlatform } from 'os';
import path from 'path';
import { spawnSync as defaultSpawnSync } from 'child_process';
import {
  clearManagedRuntime as defaultClearManagedRuntimeConfig,
  getConfigDirPath as defaultGetConfigDirPath,
  getRuntimeConfig as defaultGetRuntimeConfig,
  setManagedRuntime as defaultSetManagedRuntime,
} from '../config';

const DEFAULT_MANIFEST_URL = process.env.OPENUTM_RUNTIME_MANIFEST_URL || 'https://downloads.openutm.dev/runtime/manifest.json';

interface RuntimeManifestAsset {
  url: string;
  sha256: string;
  binaryPath: string;
  archiveType?: 'tar.gz' | 'binary';
}

interface RuntimeManifest {
  version: string;
  assets: Record<string, RuntimeManifestAsset>;
}

export interface InstalledRuntime {
  version: string;
  path: string;
}

interface RuntimeInstallDeps {
  fetch: typeof fetch;
  platform: typeof defaultPlatform;
  arch: typeof defaultArch;
  randomUUID: typeof defaultRandomUUID;
  existsSync: typeof defaultExistsSync;
  mkdirSync: typeof defaultMkdirSync;
  rmSync: typeof defaultRmSync;
  renameSync: typeof defaultRenameSync;
  writeFileSync: typeof defaultWriteFileSync;
  copyFileSync: typeof defaultCopyFileSync;
  chmodSync: typeof defaultChmodSync;
  spawnSync: typeof defaultSpawnSync;
  getRuntimeConfig: typeof defaultGetRuntimeConfig;
  setManagedRuntime: typeof defaultSetManagedRuntime;
  clearManagedRuntimeConfig: typeof defaultClearManagedRuntimeConfig;
  getConfigDirPath: typeof defaultGetConfigDirPath;
}

const defaultDeps: RuntimeInstallDeps = {
  fetch,
  platform: defaultPlatform,
  arch: defaultArch,
  randomUUID: defaultRandomUUID,
  existsSync: defaultExistsSync,
  mkdirSync: defaultMkdirSync,
  rmSync: defaultRmSync,
  renameSync: defaultRenameSync,
  writeFileSync: defaultWriteFileSync,
  copyFileSync: defaultCopyFileSync,
  chmodSync: defaultChmodSync,
  spawnSync: defaultSpawnSync,
  getRuntimeConfig: defaultGetRuntimeConfig,
  setManagedRuntime: defaultSetManagedRuntime,
  clearManagedRuntimeConfig: defaultClearManagedRuntimeConfig,
  getConfigDirPath: defaultGetConfigDirPath,
};

let deps: RuntimeInstallDeps = { ...defaultDeps };

export function setRuntimeInstallDepsForTests(overrides: Partial<RuntimeInstallDeps>): void {
  deps = { ...deps, ...overrides };
}

export function resetRuntimeInstallDepsForTests(): void {
  deps = { ...defaultDeps };
}

function buildRuntimeRoot(): string {
  return path.join(deps.getConfigDirPath(), 'runtime');
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchManifest(url: string): Promise<RuntimeManifest> {
  const res = await deps.fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download runtime manifest: HTTP ${res.status}`);
  }
  const data = await res.json() as RuntimeManifest;
  if (!data || !data.version || !data.assets || typeof data.assets !== 'object') {
    throw new Error('Runtime manifest is invalid');
  }
  return data;
}

async function fetchArtifact(url: string): Promise<Buffer> {
  const res = await deps.fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download runtime artifact: HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function extractTarball(archivePath: string, outputDir: string): void {
  const result = deps.spawnSync('tar', ['-xzf', archivePath, '-C', outputDir], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    const stderr = `${result.stderr || ''}`.trim();
    throw new Error(`Failed to extract runtime artifact${stderr ? `: ${stderr}` : ''}`);
  }
}

function installBinaryPayload(payloadPath: string, stageDir: string, binaryPath: string): string {
  const target = path.join(stageDir, binaryPath);
  deps.mkdirSync(path.dirname(target), { recursive: true });
  deps.copyFileSync(payloadPath, target);
  deps.chmodSync(target, 0o755);
  return target;
}

function archKey(): string {
  return `${deps.platform()}-${deps.arch()}`;
}

export async function installManagedRuntime(manifestUrl: string = DEFAULT_MANIFEST_URL): Promise<InstalledRuntime> {
  if (deps.platform() !== 'darwin') {
    throw new Error('Managed runtime install currently supports macOS only');
  }

  const manifest = await fetchManifest(manifestUrl);
  const asset = manifest.assets[archKey()];
  if (!asset) {
    throw new Error(`No runtime artifact available for ${archKey()}`);
  }

  const payload = await fetchArtifact(asset.url);
  const actual = sha256Hex(payload);
  if (actual.toLowerCase() !== asset.sha256.toLowerCase()) {
    throw new Error('Checksum verification failed for runtime artifact');
  }

  const runtimeRoot = buildRuntimeRoot();
  const versionsRoot = path.join(runtimeRoot, 'versions');
  deps.mkdirSync(versionsRoot, { recursive: true });

  const id = deps.randomUUID();
  const stageDir = path.join(runtimeRoot, `.stage-${id}`);
  const payloadPath = path.join(runtimeRoot, `.payload-${id}`);
  const finalDir = path.join(versionsRoot, manifest.version);

  deps.rmSync(stageDir, { recursive: true, force: true });
  deps.mkdirSync(stageDir, { recursive: true });
  deps.writeFileSync(payloadPath, payload);

  let binaryAbsPath = '';
  try {
    if ((asset.archiveType || 'tar.gz') === 'binary') {
      binaryAbsPath = installBinaryPayload(payloadPath, stageDir, asset.binaryPath);
    } else {
      extractTarball(payloadPath, stageDir);
      binaryAbsPath = path.join(stageDir, asset.binaryPath);
      if (!deps.existsSync(binaryAbsPath)) {
        throw new Error(`Runtime binary missing after extraction: ${asset.binaryPath}`);
      }
      deps.chmodSync(binaryAbsPath, 0o755);
    }

    deps.rmSync(finalDir, { recursive: true, force: true });
    deps.renameSync(stageDir, finalDir);
    const activated = path.join(finalDir, asset.binaryPath);
    await deps.setManagedRuntime(activated, manifest.version);
    return { version: manifest.version, path: activated };
  } catch (error) {
    deps.rmSync(stageDir, { recursive: true, force: true });
    throw error;
  } finally {
    deps.rmSync(payloadPath, { force: true });
  }
}

export async function clearManagedRuntimeInstallation(): Promise<{ success: boolean }> {
  const runtime = await deps.getRuntimeConfig();
  if (runtime.managedRuntimePath) {
    const runtimeRoot = path.join(path.dirname(path.dirname(path.dirname(runtime.managedRuntimePath))));
    deps.rmSync(runtimeRoot, { recursive: true, force: true });
  }
  return deps.clearManagedRuntimeConfig();
}
