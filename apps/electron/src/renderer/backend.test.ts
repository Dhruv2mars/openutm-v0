import { beforeEach, describe, expect, it } from "bun:test";
import type { VM } from "@openutm/shared-types";
import {
  closeDisplayViaBackend,
  createVmViaBackend,
  detectQemuViaBackend,
  getDisplayViaBackend,
  listVmsViaBackend,
  openDisplayViaBackend,
  startVmViaBackend,
  stopVmViaBackend,
} from "./backend";

declare global {
  interface Window {
    openutm?: unknown;
  }
}

const getWindow = (): Window => {
  const globalRef = globalThis as typeof globalThis & { window?: Window };
  if (!globalRef.window) {
    globalRef.window = {} as Window;
  }
  return globalRef.window;
};

describe("electron renderer backend bridge", () => {
  beforeEach(() => {
    const win = getWindow();
    delete win.openutm;
  });

  it("throws when preload bridge is missing", async () => {
    await expect(detectQemuViaBackend()).rejects.toThrow("Electron bridge unavailable");
  });

  it("maps detect-qemu response into setup wizard shape", async () => {
    const win = getWindow();
    win.openutm = {
      detectQemu: async () => ({
        success: true,
        data: {
          path: "/opt/homebrew/bin/qemu-system-aarch64",
          version: "QEMU emulator version 8.2.0",
          accelerators: ["hvf", "tcg"],
        },
      }),
    };

    const result = await detectQemuViaBackend();
    expect(result.available).toBe(true);
    expect(result.minimumVersionMet).toBe(true);
    expect(result.accelerators).toEqual(["hvf", "tcg"]);
  });

  it("returns VM list from list-vms IPC", async () => {
    const vms: VM[] = [
      {
        id: "vm-1",
        name: "Ubuntu",
        status: "stopped",
        config: {
          cpu: 2,
          memory: 2048,
          disks: [{ path: "/tmp/vm-1.qcow2", size: 1024, format: "qcow2" }],
          network: { type: "nat" },
        },
      },
    ];

    const win = getWindow();
    win.openutm = {
      listVms: async () => ({ success: true, data: vms }),
    };

    const result = await listVmsViaBackend();
    expect(result).toEqual(vms);
  });

  it("passes create/start/stop through IPC", async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      createVm: async () => {
        calls.push("create");
        return { success: true, data: { id: "vm-1" } };
      },
      startVm: async () => {
        calls.push("start");
        return { success: true, data: { success: true } };
      },
      stopVm: async () => {
        calls.push("stop");
        return { success: true, data: { success: true } };
      },
    };

    await createVmViaBackend({
      name: "Test VM",
      cpu: 2,
      memory: 2048,
      diskSizeGb: 25,
      networkType: "nat",
      os: "linux",
    });
    await startVmViaBackend("vm-1");
    await stopVmViaBackend("vm-1");

    expect(calls).toEqual(["create", "start", "stop"]);
  });

  it("passes open/get/close display through IPC", async () => {
    const calls: string[] = [];
    const session = {
      vmId: "550e8400-e29b-41d4-a716-446655440000",
      protocol: "spice",
      host: "127.0.0.1",
      port: 5901,
      uri: "spice://127.0.0.1:5901",
      status: "connected",
      reconnectAttempts: 0,
    };
    const win = getWindow();
    win.openutm = {
      openDisplay: async () => {
        calls.push("open");
        return { success: true, data: session };
      },
      getDisplay: async () => {
        calls.push("get");
        return { success: true, data: session };
      },
      closeDisplay: async () => {
        calls.push("close");
        return { success: true, data: { success: true } };
      },
    };

    const opened = await openDisplayViaBackend(session.vmId);
    const fetched = await getDisplayViaBackend(session.vmId);
    await closeDisplayViaBackend(session.vmId);

    expect(opened.uri).toBe("spice://127.0.0.1:5901");
    expect(fetched?.status).toBe("connected");
    expect(calls).toEqual(["open", "get", "close"]);
  });
});
