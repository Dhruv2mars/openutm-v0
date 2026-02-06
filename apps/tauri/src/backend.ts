import { VMStatus } from "@openutm/shared-types";
import type { VM } from "@openutm/shared-types";
import type { QemuDetectionResult } from "@openutm/ui";

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
}

interface RawVm {
  id: string;
  name: string;
  status: string;
  config: RawVmConfig;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeOverride: InvokeFn | null = null;

export function __setInvokeForTests(invoke: InvokeFn | null): void {
  invokeOverride = invoke;
}

async function getInvoke(): Promise<InvokeFn> {
  if (invokeOverride) {
    return invokeOverride;
  }

  if (typeof window === "undefined") {
    throw new Error("Tauri invoke bridge unavailable");
  }

  const module = await import("@tauri-apps/api/core");
  if (!module.invoke) {
    throw new Error("Tauri invoke bridge unavailable");
  }

  return module.invoke as InvokeFn;
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
      network: { type: "nat" },
    },
  };
}

export async function detectQemuViaBackend(): Promise<QemuDetectionResult> {
  const invoke = await getInvoke();
  const result = await invoke<RawQemuInfo>("detect_qemu");
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
  const invoke = await getInvoke();
  const result = await invoke<RawVm[]>("list_vms");
  return result.map(mapRawVm);
}

export async function createVmViaBackend(request: CreateVmRequest): Promise<VM> {
  const invoke = await getInvoke();
  const raw = await invoke<RawVm>("create_vm", {
    config: {
      name: request.name,
      memory_mb: request.memory,
      cpu_cores: request.cpu,
      disk_size_gb: request.diskSizeGb,
      os: request.os,
    },
  });
  return mapRawVm(raw);
}

export async function updateVmViaBackend(request: UpdateVmRequest): Promise<VM> {
  const invoke = await getInvoke();
  const raw = await invoke<RawVm>("update_vm", { request });
  return mapRawVm(raw);
}

export async function deleteVmViaBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("delete_vm", { id });
}

export async function startVmViaBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("start_vm", { id });
}

export async function stopVmViaBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("stop_vm", { id });
}

export async function pauseVmViaBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("pause_vm", { id });
}

export async function resumeVmViaBackend(id: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("resume_vm", { id });
}
