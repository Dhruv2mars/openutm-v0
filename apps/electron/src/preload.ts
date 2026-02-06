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
});
