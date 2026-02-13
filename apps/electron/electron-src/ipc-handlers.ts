import { dialog, ipcMain } from 'electron';
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
import { getQemuInstallCommand, openQemuInstallInTerminal } from './qemu/install';
import {
  cloneVm,
  createSnapshot,
  deleteSnapshot,
  exportVm,
  importVm,
  listSnapshots,
  restoreSnapshot,
} from './vm-artifacts';

interface CreateVmRequest {
  name: string;
  cpu: number;
  memory: number;
  diskSizeGb: number;
  networkType: 'nat' | 'bridge';
  os: 'linux' | 'windows' | 'macos' | 'other';
  installMediaPath?: string | null;
  bootOrder?: 'disk-first' | 'cdrom-first';
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
  installMediaPath?: string;
  bootOrder?: 'disk-first' | 'cdrom-first';
  networkType?: 'nat' | 'bridge';
}

const DEFAULT_DISK_FALLBACK_BYTES = 25 * 1024 * 1024 * 1024;

function mapStatus(vmId: string): VMStatus {
  const runtimeStatus = getVmRuntimeStatus(vmId);
  if (runtimeStatus === 'running') return VMStatus.Running;
  if (runtimeStatus === 'paused') return VMStatus.Paused;
  return VMStatus.Stopped;
}

function mapStoredConfigToVm(config: StoredVmConfig) {
  const networkType = config.networkType || 'nat';
  const bootOrder = config.bootOrder || 'disk-first';
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
        type: networkType,
      },
      installMediaPath: config.installMediaPath,
      bootOrder,
      networkType,
    },
  };
}

function normalizeBootOrder(order: unknown): 'disk-first' | 'cdrom-first' {
  if (order === 'cdrom-first') {
    return 'cdrom-first';
  }
  return 'disk-first';
}

export function registerIpcHandlers() {
  ipcMain.handle('qemu-install-command', async () => {
    try {
      const command = getQemuInstallCommand();
      return { success: true, data: command };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('qemu-install-terminal', async () => {
    try {
      const result = openQemuInstallInTerminal();
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('snapshot-create', async (_event, request: { id: string; name: string }) => {
    try {
      const result = await createSnapshot(request.id, request.name);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('snapshot-list', async (_event, vmId: string) => {
    try {
      const snapshots = await listSnapshots(vmId);
      return { success: true, data: snapshots };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('snapshot-restore', async (_event, request: { id: string; name: string }) => {
    try {
      const result = await restoreSnapshot(request.id, request.name);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('snapshot-delete', async (_event, request: { id: string; name: string }) => {
    try {
      const result = await deleteSnapshot(request.id, request.name);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('clone-vm', async (_event, request: { id: string; name?: string }) => {
    try {
      const result = await cloneVm(request.id, request.name);
      const cloned = await getVMConfig(result.vmId);
      if (!cloned) {
        return { success: false, error: `Cloned VM ${result.vmId} not found` };
      }
      return { success: true, data: mapStoredConfigToVm(cloned) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('export-vm', async (_event, request: { id: string; path?: string }) => {
    try {
      const vm = await getVMConfig(request.id);
      if (!vm) {
        return { success: false, error: `VM ${request.id} not found` };
      }

      let archivePath = request.path;
      if (!archivePath) {
        const save = await dialog.showSaveDialog({
          title: 'Export VM',
          defaultPath: `${vm.name}.openutmvm`,
          filters: [{ name: 'OpenUTM VM Archive', extensions: ['openutmvm', 'tar.gz'] }],
        });
        if (save.canceled || !save.filePath) {
          return { success: true, data: { canceled: true } };
        }
        archivePath = save.filePath;
      }

      const result = await exportVm(request.id, archivePath);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('import-vm', async (_event, request?: { path?: string }) => {
    try {
      let archivePath = request?.path;
      if (!archivePath) {
        const picked = await dialog.showOpenDialog({
          title: 'Import VM',
          properties: ['openFile'],
          filters: [{ name: 'OpenUTM VM Archive', extensions: ['openutmvm', 'tar.gz'] }],
        });
        if (picked.canceled || picked.filePaths.length === 0) {
          return { success: true, data: { canceled: true } };
        }
        archivePath = picked.filePaths[0];
      }

      const result = await importVm(archivePath);
      const imported = await getVMConfig(result.vmId);
      if (!imported) {
        return { success: false, error: `Imported VM ${result.vmId} not found` };
      }
      return { success: true, data: mapStoredConfigToVm(imported) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

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
        installMediaPath: request.installMediaPath || undefined,
        bootOrder: normalizeBootOrder(request.bootOrder || (request.installMediaPath ? 'cdrom-first' : 'disk-first')),
        networkType: request.networkType || 'nat',
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
      const result = await closeDisplaySession(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('pick-install-media', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Install Media',
        properties: ['openFile'],
        filters: [
          { name: 'Install Media', extensions: ['iso', 'img'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }
      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('set-install-media', async (_event, request: { id: string; path: string }) => {
    try {
      if (!request?.id || !request?.path) {
        return { success: false, error: 'Invalid install media request' };
      }
      await updateVMConfig(request.id, {
        installMediaPath: request.path,
      });
      return { success: true, data: { success: true } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('eject-install-media', async (_event, vmId: string) => {
    try {
      if (!vmId) {
        return { success: false, error: 'VM id required' };
      }
      await updateVMConfig(vmId, {
        installMediaPath: undefined,
      });
      return { success: true, data: { success: true } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'set-boot-order',
    async (_event, request: { id: string; order: 'disk-first' | 'cdrom-first' }) => {
      try {
        if (!request?.id) {
          return { success: false, error: 'VM id required' };
        }
        await updateVMConfig(request.id, {
          bootOrder: normalizeBootOrder(request.order),
        });
        return { success: true, data: { success: true } };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    },
  );
}
