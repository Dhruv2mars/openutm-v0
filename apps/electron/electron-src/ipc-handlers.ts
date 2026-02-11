import { ipcMain } from 'electron';
import { detectQemu, getRuntimeStatus } from './qemu/detector';
import { randomUUID } from 'crypto';
import { VMStatus } from '@openutm/shared-types';
import {
  clearManagedRuntimeInstallation,
  installManagedRuntime,
} from './qemu/runtime-install';
import {
  startVM,
  stopVM,
  pauseVM,
  resumeVM,
  getVmRuntimeStatus,
  openDisplaySession,
  getDisplaySession,
  closeDisplaySession,
} from './qemu/controller';
import { createVMConfig, deleteVMConfig, getVMConfig, listVMs, updateVMConfig } from './config';
import { createDiskImage, deleteDiskImage } from './storage';

interface CreateVmRequest {
  name: string;
  cpu: number;
  memory: number;
  diskSizeGb: number;
  networkType: 'nat' | 'bridge';
  os: 'linux' | 'windows' | 'macos' | 'other';
}

interface UpdateVmRequest {
  id: string;
  name?: string;
  cpu?: number;
  memory?: number;
}

interface StoredVmConfig {
  id: string;
  name: string;
  memory: number;
  cores: number;
  disk: string;
  qmpSocket?: string;
}

const DEFAULT_DISK_FALLBACK_BYTES = 25 * 1024 * 1024 * 1024;

function mapStatus(vmId: string): VMStatus {
  const runtimeStatus = getVmRuntimeStatus(vmId);
  if (runtimeStatus === 'running') return VMStatus.Running;
  if (runtimeStatus === 'paused') return VMStatus.Paused;
  return VMStatus.Stopped;
}

function mapStoredConfigToVm(config: StoredVmConfig) {
  return {
    id: config.id,
    name: config.name,
    status: mapStatus(config.id),
    config: {
      cpu: config.cores,
      memory: config.memory,
      disks: [
        {
          path: config.disk,
          size: DEFAULT_DISK_FALLBACK_BYTES,
          format: 'qcow2' as const,
        },
      ],
      network: {
        type: 'nat' as const,
      },
    },
  };
}

export function registerIpcHandlers() {
  ipcMain.handle('detect-qemu', async () => {
    try {
      const qemuInfo = await detectQemu();
      return { success: true, data: qemuInfo };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('get-runtime-status', async () => {
    try {
      const status = await getRuntimeStatus();
      return { success: true, data: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('install-managed-runtime', async () => {
    try {
      await installManagedRuntime();
      const status = await getRuntimeStatus();
      return { success: true, data: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('clear-managed-runtime', async () => {
    try {
      const result = await clearManagedRuntimeInstallation();
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('create-vm', async (_event, request: CreateVmRequest) => {
    try {
      const vmId = randomUUID();
      const disk = await createDiskImage({
        name: vmId,
        size: `${request.diskSizeGb}G`,
      });

      const qmpSocket = `/tmp/openutm-qmp-${vmId}.sock`;
      const stored = await createVMConfig({
        id: vmId,
        name: request.name,
        memory: request.memory,
        cores: request.cpu,
        disk: disk.path,
        qmpSocket,
        accelerator: 'hvf',
      });

      return { success: true, data: mapStoredConfigToVm(stored) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('start-vm', async (_event, vmId: string) => {
    try {
      await startVM(vmId);
      const result = { success: true };
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('stop-vm', async (_event, vmId: string) => {
    try {
      await stopVM(vmId);
      const result = { success: true };
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('pause-vm', async (_event, vmId: string) => {
    try {
      await pauseVM(vmId);
      const result = { success: true };
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('resume-vm', async (_event, vmId: string) => {
    try {
      await resumeVM(vmId);
      const result = { success: true };
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('list-vms', async () => {
    try {
      const configs = await listVMs();
      const vms = configs.map((config) => mapStoredConfigToVm(config));
      return { success: true, data: vms };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('get-vm', async (_event, vmId: string) => {
    try {
      const config = await getVMConfig(vmId);
      if (!config) {
        return { success: true, data: null };
      }
      const vm = mapStoredConfigToVm(config);
      return { success: true, data: vm };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('update-vm', async (_event, request: UpdateVmRequest) => {
    try {
      const updates: Partial<StoredVmConfig> = {};
      if (request.name !== undefined) {
        updates.name = request.name;
      }
      if (request.cpu !== undefined) {
        updates.cores = request.cpu;
      }
      if (request.memory !== undefined) {
        updates.memory = request.memory;
      }

      const updated = await updateVMConfig(request.id, updates);
      const vm = mapStoredConfigToVm(updated);
      return { success: true, data: vm };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('delete-vm', async (_event, vmId: string) => {
    try {
      const existing = await getVMConfig(vmId);
      if (!existing) {
        return { success: true, data: { success: true } };
      }

      if (getVmRuntimeStatus(vmId) !== 'stopped') {
        await stopVM(vmId);
      }
      await deleteDiskImage(existing.disk);
      await deleteVMConfig(vmId);

      const result = { success: true };
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('open-display', async (_event, vmId: string) => {
    try {
      const session = await openDisplaySession(vmId);
      return { success: true, data: session };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('get-display', async (_event, vmId: string) => {
    try {
      const session = getDisplaySession(vmId);
      return { success: true, data: session };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('close-display', async (_event, vmId: string) => {
    try {
      const result = closeDisplaySession(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });
}
