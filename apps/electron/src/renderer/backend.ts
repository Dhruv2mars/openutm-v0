import { VMStatus } from "@openutm/shared-types";
import { DisplaySessionSchema } from "@openutm/shared-types";
import type { VM } from "@openutm/shared-types";
import type { DisplaySession } from "@openutm/shared-types";
import type { QemuDetectionResult } from "@openutm/ui";

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DetectQemuPayload {
  path: string;
  version: string;
  accelerators: string[];
}

interface QemuInstallCommandPayload {
  command: string;
}

export interface CreateVmRequest {
  name: string;
  cpu: number;
  memory: number;
  diskSizeGb: number;
  installMediaPath?: string;
  bootOrder: "disk-first" | "cdrom-first";
  networkType: "nat" | "bridge";
  os: "linux" | "windows" | "macos" | "other";
}

export interface UpdateVmRequest {
  id: string;
  name?: string;
  cpu?: number;
  memory?: number;
}

interface ElectronBridge {
  detectQemu: () => Promise<IpcResult<DetectQemuPayload>>;
  listVms: () => Promise<IpcResult<VM[]>>;
  createVm: (request: CreateVmRequest) => Promise<IpcResult<VM>>;
  updateVm: (request: UpdateVmRequest) => Promise<IpcResult<VM>>;
  deleteVm: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  startVm: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  stopVm: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  pauseVm: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  resumeVm: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  openDisplay: (id: string) => Promise<IpcResult<DisplaySession>>;
  getDisplay: (id: string) => Promise<IpcResult<DisplaySession | null>>;
  closeDisplay: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  getQemuInstallCommand: () => Promise<IpcResult<QemuInstallCommandPayload>>;
  openQemuInstallTerminal: () => Promise<IpcResult<{ success: boolean }>>;
  pickInstallMedia: (id?: string) => Promise<IpcResult<string | null>>;
  setInstallMedia: (id: string, path: string) => Promise<IpcResult<{ success: boolean }>>;
  ejectInstallMedia: (id: string) => Promise<IpcResult<{ success: boolean }>>;
  setBootOrder: (id: string, order: "disk-first" | "cdrom-first") => Promise<IpcResult<{ success: boolean }>>;
}

function getBridge(): ElectronBridge {
  if (typeof window === "undefined" || !window.openutm) {
    throw new Error("Electron bridge unavailable");
  }

  return window.openutm as ElectronBridge;
}

function unwrapResult<T>(result: IpcResult<T>, fallback: string): T {
  if (!result.success || result.data === undefined) {
    throw new Error(result.error || fallback);
  }
  return result.data;
}

function parseMajor(version: string | null): number | null {
  if (!version) {
    return null;
  }
  const match = version.match(/version\s+(\d+)/i);
  if (!match || !match[1]) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function normalizeVm(vm: VM): VM {
  const status = Object.values(VMStatus).includes(vm.status) ? vm.status : VMStatus.Error;
  const config = vm.config || {
    cpu: 2,
    memory: 2048,
    disks: [],
    network: { type: "nat" as const },
    bootOrder: "disk-first" as const,
    networkType: "nat" as const,
  };
  const installMediaPath = config.installMediaPath;
  const bootOrder = config.bootOrder || "disk-first";
  const networkType = config.networkType || config.network.type || "nat";
  return {
    ...vm,
    status,
    config: {
      ...config,
      installMediaPath,
      bootOrder,
      networkType,
      network: {
        ...config.network,
        type: networkType,
      },
    },
  };
}

export async function detectQemuViaBackend(): Promise<QemuDetectionResult> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.detectQemu(), "Failed to detect QEMU");
  const major = parseMajor(data.version || null);
  return {
    available: true,
    path: data.path,
    version: data.version,
    accelerators: data.accelerators,
    minimumVersionMet: major !== null ? major >= 6 : false,
  };
}

export async function listVmsViaBackend(): Promise<VM[]> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.listVms(), "Failed to list VMs");
  return data.map(normalizeVm);
}

export async function createVmViaBackend(request: CreateVmRequest): Promise<VM> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.createVm(request), "Failed to create VM");
  return normalizeVm(data);
}

export async function updateVmViaBackend(request: UpdateVmRequest): Promise<VM> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.updateVm(request), "Failed to update VM");
  return normalizeVm(data);
}

export async function deleteVmViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.deleteVm(id), "Failed to delete VM");
}

export async function startVmViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.startVm(id), "Failed to start VM");
}

export async function stopVmViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.stopVm(id), "Failed to stop VM");
}

export async function pauseVmViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.pauseVm(id), "Failed to pause VM");
}

export async function resumeVmViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.resumeVm(id), "Failed to resume VM");
}

function normalizeDisplaySession(session: DisplaySession): DisplaySession {
  return DisplaySessionSchema.parse(session);
}

export async function openDisplayViaBackend(id: string): Promise<DisplaySession> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.openDisplay(id), "Failed to open display session");
  return normalizeDisplaySession(data);
}

export async function getDisplayViaBackend(id: string): Promise<DisplaySession | null> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.getDisplay(id), "Failed to get display session");
  if (!data) {
    return null;
  }
  return normalizeDisplaySession(data);
}

export async function closeDisplayViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.closeDisplay(id), "Failed to close display session");
}

export async function pickInstallMediaViaBackend(id?: string): Promise<string | null> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.pickInstallMedia(id), "Failed to pick install media");
  return data || null;
}

export async function setInstallMediaViaBackend(id: string, path: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.setInstallMedia(id, path), "Failed to set install media");
}

export async function ejectInstallMediaViaBackend(id: string): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.ejectInstallMedia(id), "Failed to eject install media");
}

export async function setBootOrderViaBackend(id: string, order: "disk-first" | "cdrom-first"): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.setBootOrder(id, order), "Failed to set boot order");
}

export async function getQemuInstallCommandViaBackend(): Promise<string> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.getQemuInstallCommand(), 'Failed to get QEMU install command');
  return data.command;
}

export async function openQemuInstallTerminalViaBackend(): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.openQemuInstallTerminal(), 'Failed to open QEMU install terminal');
}
