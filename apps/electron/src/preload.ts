import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openutm', {
  detectQemu: () => ipcRenderer.invoke('detect-qemu'),
  listVms: () => ipcRenderer.invoke('list-vms'),
  getVm: (id: string) => ipcRenderer.invoke('get-vm', id),
  createVm: (request: unknown) => ipcRenderer.invoke('create-vm', request),
  updateVm: (request: unknown) => ipcRenderer.invoke('update-vm', request),
  deleteVm: (id: string) => ipcRenderer.invoke('delete-vm', id),
  startVm: (id: string) => ipcRenderer.invoke('start-vm', id),
  stopVm: (id: string) => ipcRenderer.invoke('stop-vm', id),
  pauseVm: (id: string) => ipcRenderer.invoke('pause-vm', id),
  resumeVm: (id: string) => ipcRenderer.invoke('resume-vm', id),
  openDisplay: (id: string) => ipcRenderer.invoke('open-display', id),
  getDisplay: (id: string) => ipcRenderer.invoke('get-display', id),
  closeDisplay: (id: string) => ipcRenderer.invoke('close-display', id),
  getQemuInstallCommand: () => ipcRenderer.invoke('qemu-install-command'),
  openQemuInstallTerminal: () => ipcRenderer.invoke('qemu-install-terminal'),
  pickInstallMedia: (id?: string) => ipcRenderer.invoke('pick-install-media', id),
  setInstallMedia: (id: string, path: string) => ipcRenderer.invoke('set-install-media', { id, path }),
  ejectInstallMedia: (id: string) => ipcRenderer.invoke('eject-install-media', id),
  setBootOrder: (id: string, order: 'disk-first' | 'cdrom-first') => ipcRenderer.invoke('set-boot-order', { id, order }),
});
