declare global {
  interface Window {
    openutm?: {
      detectQemu: () => Promise<unknown>;
      listVms: () => Promise<unknown>;
      getVm: (id: string) => Promise<unknown>;
      createVm: (request: unknown) => Promise<unknown>;
      updateVm: (request: unknown) => Promise<unknown>;
      deleteVm: (id: string) => Promise<unknown>;
      startVm: (id: string) => Promise<unknown>;
      stopVm: (id: string) => Promise<unknown>;
      pauseVm: (id: string) => Promise<unknown>;
      resumeVm: (id: string) => Promise<unknown>;
      openDisplay: (id: string) => Promise<unknown>;
      getDisplay: (id: string) => Promise<unknown>;
      closeDisplay: (id: string) => Promise<unknown>;
      getQemuInstallCommand: () => Promise<unknown>;
      openQemuInstallTerminal: () => Promise<unknown>;
      pickInstallMedia: (id?: string) => Promise<unknown>;
      setInstallMedia: (id: string, path: string) => Promise<unknown>;
      ejectInstallMedia: (id: string) => Promise<unknown>;
      setBootOrder: (id: string, order: "disk-first" | "cdrom-first") => Promise<unknown>;
    };
  }
}

export {};
