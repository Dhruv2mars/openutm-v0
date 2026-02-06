import { VMStatus } from "@openutm/shared-types";
import { DisplaySessionSchema } from "@openutm/shared-types";
import type { VM } from "@openutm/shared-types";
import type { DisplaySession } from "@openutm/shared-types";
import type { QemuDetectionResult } from "@openutm/ui";

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

interface RawQemuInfo {
  detected: boolean;
  path?: string | null;
  version?: string | null;
  accelerator?: string | null;
}

interface RawVmConfig {
  name: string;
  memory_mb: number;
  cpu_cores: number;
  disk_size_gb: number;
  os: string;
  install_media_path?: string | null;
  boot_order?: string;
  network_type?: string;
}

interface RawVm {
  id: string;
  name: string;
  status: string;
  config: RawVmConfig;
}

interface RawDisplaySession {
  vmId: string;
  protocol: string;
  host: string;
  port: number;
  uri: string;
  status: string;
  reconnectAttempts: number;
  lastError?: string | null;
  connectedAt?: string | null;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeOverride: InvokeFn | null = null;
let globalInvokeOverride: InvokeFn | null = null;

export function __setInvokeForTests(invoke: InvokeFn | null): void {
  invokeOverride = invoke;
}

export function __setGlobalInvokeForTests(invoke: InvokeFn | null): void {
  globalInvokeOverride = invoke;
}

interface TauriInternalsWindow extends Window {
  __TAURI_INTERNALS__?: {
    invoke?: InvokeFn;
  };
}

function resolveGlobalInvoke(): InvokeFn | null {
  if (globalInvokeOverride) {
    return globalInvokeOverride;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as TauriInternalsWindow;
  if (typeof w.__TAURI_INTERNALS__?.invoke === "function") {
    return w.__TAURI_INTERNALS__.invoke as InvokeFn;
  }
  return null;
}

async function getInvoke(): Promise<InvokeFn> {
  if (invokeOverride) {
    return invokeOverride;
  }

  const globalInvoke = resolveGlobalInvoke();
  if (globalInvoke) {
    return globalInvoke;
  }

  throw new Error("Tauri invoke bridge unavailable");
}

function parseMajor(version: string | null): number | null {
  if (!version) return null;
  const match = version.match(/version\s+(\d+)/i);
  if (!match || !match[1]) return null;
  return Number.parseInt(match[1], 10);
}

function normalizeStatus(status: string): VMStatus {
  const lower = status.toLowerCase();
  if (lower === VMStatus.Running) return VMStatus.Running;
  if (lower === VMStatus.Paused) return VMStatus.Paused;
  if (lower === VMStatus.Error) return VMStatus.Error;
  return VMStatus.Stopped;
}

function mapRawVm(raw: RawVm): VM {
  const networkType = raw.config.network_type === "bridge" ? "bridge" : "nat";
  return {
    id: raw.id,
    name: raw.name,
    status: normalizeStatus(raw.status),
    config: {
      cpu: raw.config.cpu_cores,
      memory: raw.config.memory_mb,
      disks: [
        {
          path: `/tmp/${raw.id}.qcow2`,
          size: raw.config.disk_size_gb * 1024 * 1024 * 1024,
          format: "qcow2",
        },
      ],
      network: { type: networkType },
      installMediaPath: raw.config.install_media_path || undefined,
      bootOrder: raw.config.boot_order === "cdrom-first" ? "cdrom-first" : "disk-first",
      networkType,
    },
  };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message && error.message !== "[object Object]") {
      return error.message;
    }
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const maybeMessage = (error as Record<string, unknown>).message;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
      return maybeMessage;
    }
    const maybeError = (error as Record<string, unknown>).error;
    if (typeof maybeError === "string" && maybeError.length > 0) {
      return maybeError;
    }
    return JSON.stringify(error);
  }

  return String(error);
}

async function invokeOrThrow<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = await getInvoke();
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    throw new Error(stringifyError(error));
  }
}

export async function detectQemuViaBackend(): Promise<QemuDetectionResult> {
  const result = await invokeOrThrow<RawQemuInfo>("detect_qemu");
  const version = result.version || null;
  const major = parseMajor(version);
  const accelerators = result.accelerator ? [result.accelerator.toLowerCase()] : [];
  return {
    available: !!result.detected,
    path: result.path || null,
    version,
    accelerators,
    minimumVersionMet: major !== null ? major >= 6 : false,
  };
}

export async function listVmsViaBackend(): Promise<VM[]> {
  const result = await invokeOrThrow<RawVm[]>("list_vms");
  return result.map(mapRawVm);
}

export async function createVmViaBackend(request: CreateVmRequest): Promise<VM> {
  const raw = await invokeOrThrow<RawVm>("create_vm", {
    config: {
      name: request.name,
      memory_mb: request.memory,
      cpu_cores: request.cpu,
      disk_size_gb: request.diskSizeGb,
      os: request.os,
      install_media_path: request.installMediaPath || null,
      boot_order: request.bootOrder,
      network_type: request.networkType,
    },
  });
  return mapRawVm(raw);
}

export async function updateVmViaBackend(request: UpdateVmRequest): Promise<VM> {
  const raw = await invokeOrThrow<RawVm>("update_vm", { request });
  return mapRawVm(raw);
}

export async function deleteVmViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("delete_vm", { id });
}

export async function startVmViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("start_vm", { id });
}

export async function stopVmViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("stop_vm", { id });
}

export async function pauseVmViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("pause_vm", { id });
}

export async function resumeVmViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("resume_vm", { id });
}

function normalizeDisplaySession(raw: RawDisplaySession): DisplaySession {
  return DisplaySessionSchema.parse({
    ...raw,
    lastError: raw.lastError || undefined,
    connectedAt: raw.connectedAt || undefined,
  });
}

export async function openDisplayViaBackend(id: string): Promise<DisplaySession> {
  const raw = await invokeOrThrow<RawDisplaySession>("open_display", { id });
  return normalizeDisplaySession(raw);
}

export async function getDisplayViaBackend(id: string): Promise<DisplaySession | null> {
  const raw = await invokeOrThrow<RawDisplaySession | null>("get_display", { id });
  if (!raw) {
    return null;
  }
  return normalizeDisplaySession(raw);
}

export async function closeDisplayViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("close_display", { id });
}

export async function pickInstallMediaViaBackend(id?: string): Promise<string | null> {
  const result = await invokeOrThrow<string | null>("pick_install_media", { id });
  return result || null;
}

export async function setInstallMediaViaBackend(id: string, path: string): Promise<void> {
  await invokeOrThrow<void>("set_install_media", { id, path });
}

export async function ejectInstallMediaViaBackend(id: string): Promise<void> {
  await invokeOrThrow<void>("eject_install_media", { id });
}

export async function setBootOrderViaBackend(id: string, order: "disk-first" | "cdrom-first"): Promise<void> {
  await invokeOrThrow<void>("set_boot_order", { id, order });
}
