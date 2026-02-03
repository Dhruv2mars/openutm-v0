import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel: string, args: any) => ipcRenderer.send(channel, args),
  on: (channel: string, func: (...args: any[]) => void) => ipcRenderer.on(channel, (_, ...args) => func(...args)),
  invoke: (channel: string, args?: any) => ipcRenderer.invoke(channel, args)
});
