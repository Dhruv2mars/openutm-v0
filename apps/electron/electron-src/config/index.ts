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
  createdAt: number;
  updatedAt: number;
}

interface ConfigStore {
  vms: VMConfigData[];
}

const CONFIG_DIR = path.join(process.env.HOME || '/tmp', '.openutm');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readStore(): ConfigStore {
  ensureConfigDir();

  if (!existsSync(CONFIG_PATH)) {
    return { vms: [] };
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ConfigStore;
    if (!parsed || !Array.isArray(parsed.vms)) {
      return { vms: [] };
    }
    return parsed;
  } catch {
    return { vms: [] };
  }
}

function writeStore(store: ConfigStore): void {
  ensureConfigDir();
  const tempPath = `${CONFIG_PATH}.tmp`;
  writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tempPath, CONFIG_PATH);
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
