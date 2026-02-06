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
  spiceSupported: boolean;
  source: RuntimeSource;
  ready: boolean;
}

export type RuntimeSource = "managed" | "system";

export interface RuntimeStatus {
  source: RuntimeSource;
  path: string;
  version: string;
  accelerators: string[];
  spiceSupported: boolean;
  ready: boolean;
}

export type DetectionResult = QemuDetectionResult & RuntimeStatus;

export interface CreateVmRequest {
  name: string;
  cpu: number;
  memory: number;
  diskSizeGb: number;
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
  getRuntimeStatus: () => Promise<IpcResult<RuntimeStatus>>;
  installManagedRuntime: () => Promise<IpcResult<RuntimeStatus>>;
  clearManagedRuntime: () => Promise<IpcResult<{ success: boolean }>>;
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
  return {
    ...vm,
    status,
  };
}

export async function detectQemuViaBackend(): Promise<DetectionResult> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.detectQemu(), "Failed to detect QEMU");
  const major = parseMajor(data.version || null);
  const spiceSupported = Boolean(data.spiceSupported);
  const source: RuntimeSource = data.source || "system";
  const ready = data.ready !== undefined ? Boolean(data.ready) : spiceSupported;
  return {
    available: true,
    path: data.path,
    version: data.version,
    accelerators: data.accelerators,
    minimumVersionMet: major !== null ? major >= 6 : false,
    spiceSupported,
    source,
    ready,
  };
}

function normalizeRuntimeStatus(status: RuntimeStatus): RuntimeStatus {
  return {
    source: status.source,
    path: status.path,
    version: status.version,
    accelerators: status.accelerators || [],
    spiceSupported: Boolean(status.spiceSupported),
    ready: Boolean(status.ready),
  };
}

export async function getRuntimeStatusViaBackend(): Promise<RuntimeStatus> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.getRuntimeStatus(), "Failed to get runtime status");
  return normalizeRuntimeStatus(data);
}

export async function installManagedRuntimeViaBackend(): Promise<RuntimeStatus> {
  const bridge = getBridge();
  const data = unwrapResult(await bridge.installManagedRuntime(), "Failed to install OpenUTM runtime");
  return normalizeRuntimeStatus(data);
}

export async function clearManagedRuntimeViaBackend(): Promise<void> {
  const bridge = getBridge();
  unwrapResult(await bridge.clearManagedRuntime(), "Failed to clear managed runtime");
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
