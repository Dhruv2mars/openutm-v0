import { dialog, ipcMain } from 'electron';
import { detectQemu } from './qemu/detector';
import { randomUUID } from 'crypto';
import { VMStatus } from '@openutm/shared-types';
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
import { closeSpiceProxy, ensureSpiceProxy, getSpiceProxyUri } from './qemu/spice-proxy';
import { getQemuInstallCommand, openQemuInstallInTerminal } from './qemu/install';
import { createVMConfig, deleteVMConfig, getVMConfig, listVMs, updateVMConfig } from './config';
import { createDiskImage, deleteDiskImage } from './storage';

interface CreateVmRequest {
  name: string;
  cpu: number;
  memory: number;
  diskSizeGb: number;
  installMediaPath?: string;
  bootOrder: 'disk-first' | 'cdrom-first';
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
  installMediaPath?: string;
  bootOrder: 'disk-first' | 'cdrom-first';
  networkType: 'nat' | 'bridge';
  qmpSocket?: string;
}

interface SetInstallMediaRequest {
  id: string;
  path: string;
}

interface SetBootOrderRequest {
  id: string;
  order: 'disk-first' | 'cdrom-first';
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
        type: config.networkType || 'nat',
      },
      installMediaPath: config.installMediaPath,
      bootOrder: config.bootOrder || 'disk-first',
      networkType: config.networkType || 'nat',
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

  ipcMain.handle('qemu-install-command', async () => {
    try {
      return { success: true, data: { command: getQemuInstallCommand() } };
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
        installMediaPath: request.installMediaPath,
        bootOrder: request.bootOrder || 'disk-first',
        networkType: request.networkType || 'nat',
        qmpSocket,
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
      await closeSpiceProxy(vmId);
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
        await closeSpiceProxy(vmId);
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
      const websocketUri = await ensureSpiceProxy(vmId, session.host, session.port);
      return { success: true, data: { ...session, websocketUri } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('get-display', async (_event, vmId: string) => {
    try {
      const session = getDisplaySession(vmId);
      if (!session) {
        return { success: true, data: null };
      }
      const websocketUri = getSpiceProxyUri(vmId) || undefined;
      return { success: true, data: { ...session, websocketUri } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('close-display', async (_event, vmId: string) => {
    try {
      await closeSpiceProxy(vmId);
      const result = closeDisplaySession(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('pick-install-media', async (_event, _vmId?: string) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Install Media', extensions: ['iso', 'img'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('set-install-media', async (_event, request: SetInstallMediaRequest) => {
    try {
      const existing = await getVMConfig(request.id);
      if (!existing) {
        return { success: false, error: `VM ${request.id} not found` };
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
      const existing = await getVMConfig(vmId);
      if (!existing) {
        return { success: false, error: `VM ${vmId} not found` };
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

  ipcMain.handle('set-boot-order', async (_event, request: SetBootOrderRequest) => {
    try {
      if (request.order !== 'disk-first' && request.order !== 'cdrom-first') {
        return { success: false, error: 'Invalid boot order' };
      }

      const existing = await getVMConfig(request.id);
      if (!existing) {
        return { success: false, error: `VM ${request.id} not found` };
      }

      await updateVMConfig(request.id, {
        bootOrder: request.order,
      });

      return { success: true, data: { success: true } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });
}
