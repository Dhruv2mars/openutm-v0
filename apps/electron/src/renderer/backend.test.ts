import { beforeEach, describe, expect, it } from "bun:test";
import type { VM } from "@openutm/shared-types";
import {
  closeDisplayViaBackend,
  createVmViaBackend,
  detectQemuViaBackend,
  deleteVmViaBackend,
  ejectInstallMediaViaBackend,
  getQemuInstallCommandViaBackend,
  getDisplayViaBackend,
  listVmsViaBackend,
  openQemuInstallTerminalViaBackend,
  openDisplayViaBackend,
  pauseVmViaBackend,
  pickInstallMediaViaBackend,
  resumeVmViaBackend,
  setBootOrderViaBackend,
  setInstallMediaViaBackend,
  updateVmViaBackend,
  startVmViaBackend,
  stopVmViaBackend,
} from "./backend";
import { VMStatus } from "@openutm/shared-types";

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

  it('marks minimum version false when version cannot be parsed', async () => {
    const win = getWindow();
    win.openutm = {
      detectQemu: async () => ({
        success: true,
        data: {
          path: '/opt/homebrew/bin/qemu-system-aarch64',
          version: 'unknown',
          accelerators: ['tcg'],
        },
      }),
    };

    const result = await detectQemuViaBackend();
    expect(result.minimumVersionMet).toBe(false);
  });

  it('handles null version payloads', async () => {
    const win = getWindow();
    win.openutm = {
      detectQemu: async () => ({
        success: true,
        data: {
          path: '/opt/homebrew/bin/qemu-system-aarch64',
          version: null,
          accelerators: ['tcg'],
        },
      }),
    };

    const result = await detectQemuViaBackend();
    expect(result.minimumVersionMet).toBe(false);
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
          installMediaPath: undefined,
          bootOrder: "disk-first",
          networkType: "nat",
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

  it('normalizes VM status and config defaults from backend list response', async () => {
    const win = getWindow();
    win.openutm = {
      listVms: async () => ({
        success: true,
        data: [
          {
            id: 'vm-1',
            name: 'Unknown',
            status: 'bad-status',
            config: {
              cpu: 1,
              memory: 512,
              disks: [],
              network: { type: 'nat' },
            },
          },
        ],
      }),
    };

    const result = await listVmsViaBackend();
    expect(result[0].status).toBe(VMStatus.Error);
    expect(result[0].config.bootOrder).toBe('disk-first');
    expect(result[0].config.networkType).toBe('nat');
  });

  it('fills default config when backend VM config is missing', async () => {
    const win = getWindow();
    win.openutm = {
      listVms: async () => ({
        success: true,
        data: [
          {
            id: 'vm-1',
            name: 'No Config',
            status: 'running',
          },
        ],
      }),
    };

    const result = await listVmsViaBackend();
    expect(result[0].config.cpu).toBe(2);
    expect(result[0].config.network.type).toBe('nat');
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
      bootOrder: "disk-first",
      networkType: "nat",
      os: "linux",
    });
    await startVmViaBackend("vm-1");
    await stopVmViaBackend("vm-1");

    expect(calls).toEqual(["create", "start", "stop"]);
  });

  it('passes update/pause/resume/delete through IPC', async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      updateVm: async () => {
        calls.push('update');
        return {
          success: true,
          data: {
            id: 'vm-1',
            name: 'Updated VM',
            status: 'stopped',
            config: {
              cpu: 4,
              memory: 4096,
              disks: [{ path: '/tmp/vm-1.qcow2', size: 1024, format: 'qcow2' }],
              network: { type: 'nat' },
              bootOrder: 'disk-first',
              networkType: 'nat',
            },
          },
        };
      },
      pauseVm: async () => {
        calls.push('pause');
        return { success: true, data: { success: true } };
      },
      resumeVm: async () => {
        calls.push('resume');
        return { success: true, data: { success: true } };
      },
      deleteVm: async () => {
        calls.push('delete');
        return { success: true, data: { success: true } };
      },
    };

    const updated = await updateVmViaBackend({ id: 'vm-1', cpu: 4 });
    await pauseVmViaBackend('vm-1');
    await resumeVmViaBackend('vm-1');
    await deleteVmViaBackend('vm-1');

    expect(updated.config.cpu).toBe(4);
    expect(calls).toEqual(['update', 'pause', 'resume', 'delete']);
  });

  it("passes open/get/close display through IPC", async () => {
    const calls: string[] = [];
    const session = {
      vmId: "550e8400-e29b-41d4-a716-446655440000",
      protocol: "spice",
      host: "127.0.0.1",
      port: 5901,
      uri: "spice://127.0.0.1:5901",
      websocketUri: "ws://127.0.0.1:5960/spice/vm-1",
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

  it('returns null when display session missing', async () => {
    const win = getWindow();
    win.openutm = {
      getDisplay: async () => ({ success: true, data: null }),
    };

    await expect(getDisplayViaBackend('vm-1')).resolves.toBeNull();
  });

  it("calls qemu install command and terminal actions through bridge", async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      getQemuInstallCommand: async () => {
        calls.push("cmd");
        return { success: true, data: { command: "brew install qemu" } };
      },
      openQemuInstallTerminal: async () => {
        calls.push("term");
        return { success: true, data: { success: true } };
      },
    };

    const command = await getQemuInstallCommandViaBackend();
    await openQemuInstallTerminalViaBackend();

    expect(command).toContain("brew install qemu");
    expect(calls).toEqual(["cmd", "term"]);
  });

  it('throws when IPC returns unsuccessful result', async () => {
    const win = getWindow();
    win.openutm = {
      stopVm: async () => ({ success: false, error: 'stop failed' }),
    };

    await expect(stopVmViaBackend('vm-1')).rejects.toThrow('stop failed');
  });

  it('uses fallback error message when IPC omits error string', async () => {
    const win = getWindow();
    win.openutm = {
      openDisplay: async () => ({ success: false }),
    };

    await expect(openDisplayViaBackend('vm-1')).rejects.toThrow('Failed to open display session');
  });

  it('rejects malformed display session payloads', async () => {
    const win = getWindow();
    win.openutm = {
      openDisplay: async () => ({
        success: true,
        data: {
          vmId: 'not-uuid',
          protocol: 'spice',
          host: '127.0.0.1',
          port: 5901,
          uri: 'spice://127.0.0.1:5901',
          status: 'connected',
          reconnectAttempts: 0,
        },
      }),
    };

    await expect(openDisplayViaBackend('vm-1')).rejects.toThrow();
  });

  it("passes install-media and boot-order IPC calls through bridge", async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      pickInstallMedia: async () => {
        calls.push("pick");
        return { success: true, data: "/isos/ubuntu-24.04.iso" };
      },
      setInstallMedia: async () => {
        calls.push("set");
        return { success: true, data: { success: true } };
      },
      ejectInstallMedia: async () => {
        calls.push("eject");
        return { success: true, data: { success: true } };
      },
      setBootOrder: async () => {
        calls.push("boot");
        return { success: true, data: { success: true } };
      },
    };

    const picked = await pickInstallMediaViaBackend("vm-1");
    await setInstallMediaViaBackend("vm-1", "/isos/ubuntu-24.04.iso");
    await ejectInstallMediaViaBackend("vm-1");
    await setBootOrderViaBackend("vm-1", "disk-first");

    expect(picked).toBe("/isos/ubuntu-24.04.iso");
    expect(calls).toEqual(["pick", "set", "eject", "boot"]);
  });
});
