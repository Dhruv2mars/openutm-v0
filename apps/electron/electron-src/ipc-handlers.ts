import { ipcMain } from 'electron';
import { detectQemu } from './qemu/detector';
import { startVM, stopVM, pauseVM, resumeVM } from './qemu/controller';
import { createVMConfig, listVMs } from './config';
import { createDiskImage } from './storage';

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

  ipcMain.handle('create-vm', async (event, vmConfig) => {
    try {
      const newVM = await createVMConfig(vmConfig);
      return { success: true, data: newVM };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('start-vm', async (event, vmId) => {
    try {
      const result = await startVM(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('stop-vm', async (event, vmId) => {
    try {
      const result = await stopVM(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('pause-vm', async (event, vmId) => {
    try {
      const result = await pauseVM(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('resume-vm', async (event, vmId) => {
    try {
      const result = await resumeVM(vmId);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('list-vms', async () => {
    try {
      const vms = await listVMs();
      return { success: true, data: vms };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('create-disk-image', async (event, diskConfig) => {
    try {
      const result = await createDiskImage(diskConfig);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  });
}
