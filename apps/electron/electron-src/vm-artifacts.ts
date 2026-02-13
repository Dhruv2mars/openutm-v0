import { randomUUID as defaultRandomUUID } from 'crypto';
import {
  copyFileSync as defaultCopyFileSync,
  mkdirSync as defaultMkdirSync,
  mkdtempSync as defaultMkdtempSync,
  readFileSync as defaultReadFileSync,
  rmSync as defaultRmSync,
  writeFileSync as defaultWriteFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync as defaultSpawnSync } from 'child_process';
import { createVMConfig as defaultCreateVMConfig, getVMConfig as defaultGetVMConfig } from './config';
import { getVmRuntimeStatus as defaultGetVmRuntimeStatus } from './qemu/controller';
import { detectQemu as defaultDetectQemu } from './qemu/detector';

export interface SnapshotInfo {
  name: string;
  id?: string;
  vmSize?: string;
  date?: string;
}

interface ExportManifest {
  version: 1;
  vm: {
    name: string;
    memory: number;
    cores: number;
    accelerator?: string;
    installMediaPath?: string;
    bootOrder?: 'disk-first' | 'cdrom-first';
    networkType?: 'nat' | 'bridge';
  };
  diskFile: string;
}

interface VmArtifactsDeps {
  spawnSync: typeof defaultSpawnSync;
  randomUUID: typeof defaultRandomUUID;
  mkdtempSync: typeof defaultMkdtempSync;
  writeFileSync: typeof defaultWriteFileSync;
  readFileSync: typeof defaultReadFileSync;
  copyFileSync: typeof defaultCopyFileSync;
  mkdirSync: typeof defaultMkdirSync;
  rmSync: typeof defaultRmSync;
  getVMConfig: typeof defaultGetVMConfig;
  createVMConfig: typeof defaultCreateVMConfig;
  getVmRuntimeStatus: typeof defaultGetVmRuntimeStatus;
  detectQemu: typeof defaultDetectQemu;
}

const defaultDeps: VmArtifactsDeps = {
  spawnSync: defaultSpawnSync,
  randomUUID: defaultRandomUUID,
  mkdtempSync: defaultMkdtempSync,
  writeFileSync: defaultWriteFileSync,
  readFileSync: defaultReadFileSync,
  copyFileSync: defaultCopyFileSync,
  mkdirSync: defaultMkdirSync,
  rmSync: defaultRmSync,
  getVMConfig: defaultGetVMConfig,
  createVMConfig: defaultCreateVMConfig,
  getVmRuntimeStatus: defaultGetVmRuntimeStatus,
  detectQemu: defaultDetectQemu,
};

let deps: VmArtifactsDeps = { ...defaultDeps };
let resolvedQemuImgPath: string | null = null;

export function setVmArtifactsDepsForTests(overrides: Partial<VmArtifactsDeps>): void {
  deps = { ...deps, ...overrides };
}

export function resetVmArtifactsDepsForTests(): void {
  deps = { ...defaultDeps };
  resolvedQemuImgPath = null;
}

function assertStopped(vmId: string): void {
  if (deps.getVmRuntimeStatus(vmId) !== 'stopped') {
    throw new Error('VM must be stopped for this operation');
  }
}

function runCommand(command: string, args: string[]): string {
  const result = deps.spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const err = `${result.stderr || result.stdout || 'command failed'}`.trim();
    throw new Error(err || 'command failed');
  }
  return `${result.stdout || ''}`;
}

function canExecuteCommand(command: string, args: string[]): boolean {
  const result = deps.spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0;
}

async function resolveQemuImgBinary(): Promise<string> {
  if (resolvedQemuImgPath) {
    return resolvedQemuImgPath;
  }

  const candidates: string[] = [];
  try {
    const detected = await deps.detectQemu();
    if (detected.path) {
      candidates.push(path.join(path.dirname(detected.path), 'qemu-img'));
    }
  } catch {
    // noop
  }
  candidates.push('qemu-img');

  for (const candidate of candidates) {
    if (canExecuteCommand(candidate, ['--version'])) {
      resolvedQemuImgPath = candidate;
      return candidate;
    }
  }

  throw new Error('qemu-img not found. Install QEMU tools to use snapshots.');
}

function parseSnapshotList(output: string): SnapshotInfo[] {
  const snapshots: SnapshotInfo[] = [];
  const lines = output.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Snapshot list') || line.startsWith('ID') || line.startsWith('--')) {
      continue;
    }
    const parsed = line.match(/^(\S+)\s+(\S+)\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (parsed) {
      snapshots.push({
        id: parsed[1],
        name: parsed[2],
        vmSize: parsed[3].trim(),
        date: parsed[4],
      });
      continue;
    }

    const cols = line.split(/\s+/).filter(Boolean);
    if (cols.length < 4) {
      continue;
    }
    const id = cols[0];
    const name = cols[1];
    const date = cols[cols.length - 2] && cols[cols.length - 1]
      ? `${cols[cols.length - 2]} ${cols[cols.length - 1]}`
      : undefined;
    const vmSize = cols.slice(2, Math.max(2, cols.length - 2)).join(' ').trim() || undefined;
    snapshots.push({
      id,
      name,
      vmSize,
      date,
    });
  }
  return snapshots;
}

export async function createSnapshot(vmId: string, name: string): Promise<{ success: boolean }> {
  assertStopped(vmId);
  const vm = await deps.getVMConfig(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not found`);
  }
  if (!name.trim()) {
    throw new Error('Snapshot name required');
  }
  const qemuImg = await resolveQemuImgBinary();
  runCommand(qemuImg, ['snapshot', '-c', name, vm.disk]);
  return { success: true };
}

export async function listSnapshots(vmId: string): Promise<SnapshotInfo[]> {
  const vm = await deps.getVMConfig(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not found`);
  }
  const qemuImg = await resolveQemuImgBinary();
  const output = runCommand(qemuImg, ['snapshot', '-l', vm.disk]);
  return parseSnapshotList(output);
}

export async function restoreSnapshot(vmId: string, name: string): Promise<{ success: boolean }> {
  assertStopped(vmId);
  const vm = await deps.getVMConfig(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not found`);
  }
  const qemuImg = await resolveQemuImgBinary();
  runCommand(qemuImg, ['snapshot', '-a', name, vm.disk]);
  return { success: true };
}

export async function deleteSnapshot(vmId: string, name: string): Promise<{ success: boolean }> {
  assertStopped(vmId);
  const vm = await deps.getVMConfig(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not found`);
  }
  const qemuImg = await resolveQemuImgBinary();
  runCommand(qemuImg, ['snapshot', '-d', name, vm.disk]);
  return { success: true };
}

export async function cloneVm(vmId: string, name?: string): Promise<{ vmId: string }> {
  assertStopped(vmId);
  const vm = await deps.getVMConfig(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not found`);
  }

  const clonedId = deps.randomUUID();
  const ext = path.extname(vm.disk) || '.qcow2';
  const clonedDiskPath = path.join(path.dirname(vm.disk), `${clonedId}${ext}`);
  deps.copyFileSync(vm.disk, clonedDiskPath);

  await deps.createVMConfig({
    id: clonedId,
    name: name || `${vm.name} Copy`,
    memory: vm.memory,
    cores: vm.cores,
    disk: clonedDiskPath,
    qmpSocket: `/tmp/openutm-qmp-${clonedId}.sock`,
    accelerator: vm.accelerator,
    installMediaPath: vm.installMediaPath,
    bootOrder: vm.bootOrder,
    networkType: vm.networkType,
  });

  return { vmId: clonedId };
}

export async function exportVm(vmId: string, archivePath: string): Promise<{ success: boolean; path: string }> {
  assertStopped(vmId);
  const vm = await deps.getVMConfig(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not found`);
  }

  const stageDir = deps.mkdtempSync(path.join(tmpdir(), 'openutm-export-'));
  try {
    const diskFile = path.basename(vm.disk);
    const stageDiskPath = path.join(stageDir, diskFile);
    deps.copyFileSync(vm.disk, stageDiskPath);

    const manifest: ExportManifest = {
      version: 1,
      vm: {
        name: vm.name,
        memory: vm.memory,
        cores: vm.cores,
        accelerator: vm.accelerator,
        installMediaPath: vm.installMediaPath,
        bootOrder: vm.bootOrder,
        networkType: vm.networkType,
      },
      diskFile,
    };
    deps.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    runCommand('tar', ['-czf', archivePath, '-C', stageDir, '.']);
    return { success: true, path: archivePath };
  } finally {
    deps.rmSync(stageDir, { recursive: true, force: true });
  }
}

function parseManifest(manifestPath: string): ExportManifest {
  const raw = deps.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as ExportManifest;
  if (!parsed || parsed.version !== 1 || !parsed.vm || !parsed.diskFile) {
    throw new Error('Invalid VM archive manifest');
  }
  return parsed;
}

export async function importVm(archivePath: string): Promise<{ vmId: string }> {
  const stageDir = deps.mkdtempSync(path.join(tmpdir(), 'openutm-import-'));
  try {
    runCommand('tar', ['-xzf', archivePath, '-C', stageDir]);
    const manifest = parseManifest(path.join(stageDir, 'manifest.json'));

    const importedId = deps.randomUUID();
    const sourceDiskPath = path.join(stageDir, manifest.diskFile);
    const ext = path.extname(manifest.diskFile) || '.qcow2';
    const importedDiskDir = path.join(process.env.HOME || '/tmp', '.openutm', 'disks');
    deps.mkdirSync(importedDiskDir, { recursive: true });
    const targetDiskPath = path.join(importedDiskDir, `${importedId}${ext}`);
    deps.copyFileSync(sourceDiskPath, targetDiskPath);

    await deps.createVMConfig({
      id: importedId,
      name: `${manifest.vm.name} Imported`,
      memory: manifest.vm.memory,
      cores: manifest.vm.cores,
      disk: targetDiskPath,
      qmpSocket: `/tmp/openutm-qmp-${importedId}.sock`,
      accelerator: manifest.vm.accelerator,
      installMediaPath: manifest.vm.installMediaPath,
      bootOrder: manifest.vm.bootOrder,
      networkType: manifest.vm.networkType,
    });

    return { vmId: importedId };
  } finally {
    deps.rmSync(stageDir, { recursive: true, force: true });
  }
}
