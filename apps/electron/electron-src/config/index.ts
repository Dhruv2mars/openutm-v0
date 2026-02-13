import path from 'path';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';

interface VMConfigData {
  id: string;
  name: string;
  memory: number;
  cores: number;
  disk: string;
  qmpSocket?: string;
  accelerator?: string;
  installMediaPath?: string;
  bootOrder?: 'disk-first' | 'cdrom-first';
  networkType?: 'nat' | 'bridge';
  createdAt: number;
  updatedAt: number;
}

interface ConfigStore {
  vms: VMConfigData[];
  managedRuntimePath?: string;
  managedRuntimeVersion?: string;
}

export interface RuntimeConfigData {
  managedRuntimePath?: string;
  managedRuntimeVersion?: string;
}

function getConfigDir(): string {
  return process.env.OPENUTM_CONFIG_DIR || path.join(process.env.HOME || '/tmp', '.openutm');
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function getConfigDirPath(): string {
  return getConfigDir();
}

function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

function readStore(): ConfigStore {
  const configPath = getConfigPath();
  ensureConfigDir();

  if (!existsSync(configPath)) {
    return { vms: [] };
  }

  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as ConfigStore;
    if (!parsed || !Array.isArray(parsed.vms)) {
      return {
        vms: [],
        managedRuntimePath: undefined,
        managedRuntimeVersion: undefined,
      };
    }
    return {
      vms: parsed.vms,
      managedRuntimePath:
        typeof parsed.managedRuntimePath === 'string' ? parsed.managedRuntimePath : undefined,
      managedRuntimeVersion:
        typeof parsed.managedRuntimeVersion === 'string' ? parsed.managedRuntimeVersion : undefined,
    };
  } catch {
    return { vms: [] };
  }
}

function writeStore(store: ConfigStore): void {
  const configPath = getConfigPath();
  const tempPath = `${configPath}.tmp`;
  ensureConfigDir();
  writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tempPath, configPath);
  if (existsSync(tempPath)) {
    unlinkSync(tempPath);
  }
}

function sortByCreatedAtDesc(vms: VMConfigData[]): VMConfigData[] {
  return [...vms].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createVMConfig(config: Omit<VMConfigData, 'createdAt' | 'updatedAt'>): Promise<VMConfigData> {
  const store = readStore();

  if (store.vms.some((vm) => vm.id === config.id)) {
    throw new Error(`VM ${config.id} already exists`);
  }

  const now = Date.now();
  const next: VMConfigData = {
    ...config,
    createdAt: now,
    updatedAt: now,
  };

  store.vms.push(next);
  writeStore(store);

  return next;
}

export async function getVMConfig(vmId: string): Promise<VMConfigData | null> {
  const store = readStore();
  const vm = store.vms.find((entry) => entry.id === vmId);
  return vm || null;
}

export async function listVMs(): Promise<VMConfigData[]> {
  const store = readStore();
  return sortByCreatedAtDesc(store.vms);
}

export async function updateVMConfig(
  vmId: string,
  updates: Partial<Omit<VMConfigData, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<VMConfigData> {
  const store = readStore();
  const index = store.vms.findIndex((entry) => entry.id === vmId);

  if (index === -1) {
    throw new Error(`VM ${vmId} not found`);
  }

  const current = store.vms[index];
  const next: VMConfigData = {
    ...current,
    ...updates,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
  };

  store.vms[index] = next;
  writeStore(store);

  return next;
}

export async function deleteVMConfig(vmId: string): Promise<{ success: boolean }> {
  const store = readStore();
  store.vms = store.vms.filter((entry) => entry.id !== vmId);
  writeStore(store);
  return { success: true };
}

export async function getRuntimeConfig(): Promise<RuntimeConfigData> {
  const store = readStore();
  return {
    managedRuntimePath: store.managedRuntimePath,
    managedRuntimeVersion: store.managedRuntimeVersion,
  };
}

export async function setManagedRuntime(path: string, version: string): Promise<RuntimeConfigData> {
  const store = readStore();
  store.managedRuntimePath = path;
  store.managedRuntimeVersion = version;
  writeStore(store);
  return {
    managedRuntimePath: store.managedRuntimePath,
    managedRuntimeVersion: store.managedRuntimeVersion,
  };
}

export async function clearManagedRuntime(): Promise<{ success: boolean }> {
  const store = readStore();
  delete store.managedRuntimePath;
  delete store.managedRuntimeVersion;
  writeStore(store);
  return { success: true };
}
