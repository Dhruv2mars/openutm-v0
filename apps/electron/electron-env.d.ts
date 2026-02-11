/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly VITE_DEV_SERVER_URL?: string;
    readonly VITE_PUBLIC_PATH?: string;
  }
}

// Expose ipcRenderer
declare global {
  interface Window {
    openutm?: {
      detectQemu: () => Promise<unknown>;
      getRuntimeStatus: () => Promise<unknown>;
      installManagedRuntime: () => Promise<unknown>;
      clearManagedRuntime: () => Promise<unknown>;
      listVms: () => Promise<unknown>;
      getVm: (id: string) => Promise<unknown>;
      createVm: (request: unknown) => Promise<unknown>;
      updateVm: (request: unknown) => Promise<unknown>;
      deleteVm: (id: string) => Promise<unknown>;
      startVm: (id: string) => Promise<unknown>;
      stopVm: (id: string) => Promise<unknown>;
      pauseVm: (id: string) => Promise<unknown>;
      resumeVm: (id: string) => Promise<unknown>;
    };
  }
}
