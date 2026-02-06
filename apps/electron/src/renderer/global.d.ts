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
    };
  }
}

export {};
