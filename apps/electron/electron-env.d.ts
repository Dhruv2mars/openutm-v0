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
    ipcRenderer?: any;
  }
}
