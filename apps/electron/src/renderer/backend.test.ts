import { beforeEach, describe, expect, it } from "bun:test";
import type { VM } from "@openutm/shared-types";
import {
  cloneVmViaBackend,
  createSnapshotViaBackend,
  deleteSnapshotViaBackend,
  ejectInstallMediaViaBackend,
  exportVmViaBackend,
  getQemuInstallCommandViaBackend,
  importVmViaBackend,
  listSnapshotsViaBackend,
  clearManagedRuntimeViaBackend,
  closeDisplayViaBackend,
  createVmViaBackend,
  deleteVmViaBackend,
  detectQemuViaBackend,
  openQemuInstallTerminalViaBackend,
  pickInstallMediaViaBackend,
  restoreSnapshotViaBackend,
  setBootOrderViaBackend,
  setInstallMediaViaBackend,
  getDisplayViaBackend,
  getRuntimeStatusViaBackend,
  installManagedRuntimeViaBackend,
  listVmsViaBackend,
  openDisplayViaBackend,
  pauseVmViaBackend,
  resumeVmViaBackend,
  updateVmViaBackend,
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
          spiceSupported: true,
          source: "system",
          ready: true,
        },
      }),
    };

    const result = await detectQemuViaBackend();
    expect(result.available).toBe(true);
    expect(result.minimumVersionMet).toBe(true);
    expect(result.accelerators).toEqual(["hvf", "tcg"]);
    expect(result.spiceSupported).toBe(true);
    expect(result.source).toBe("system");
    expect(result.ready).toBe(true);
  });

  it("handles detect-qemu without parsable version/source/ready", async () => {
    const win = getWindow();
    win.openutm = {
      detectQemu: async () => ({
        success: true,
        data: {
          path: "/usr/local/bin/qemu-system-x86_64",
          version: "unknown",
          accelerators: ["tcg"],
          spiceSupported: false,
          source: undefined,
          ready: undefined,
        },
      }),
    };

    const result = await detectQemuViaBackend();
    expect(result.minimumVersionMet).toBe(false);
    expect(result.source).toBe("system");
    expect(result.ready).toBe(false);
  });

  it("handles detect-qemu with null version", async () => {
    const win = getWindow();
    win.openutm = {
      detectQemu: async () => ({
        success: true,
        data: {
          path: "/usr/local/bin/qemu-system-x86_64",
          version: null,
          accelerators: [],
          spiceSupported: false,
          source: "system",
          ready: false,
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
      bootOrder: "disk-first",
    });
    await startVmViaBackend("vm-1");
    await stopVmViaBackend("vm-1");

    expect(calls).toEqual(["create", "start", "stop"]);
  });

  it("passes update/delete/pause/resume through IPC", async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      updateVm: async () => {
        calls.push("update");
        return {
          success: true,
          data: {
            id: "vm-1",
            name: "VM",
            status: "stopped",
            config: {
              cpu: 4,
              memory: 4096,
              disks: [{ path: "/tmp/vm-1.qcow2", size: 1024, format: "qcow2" }],
              network: { type: "nat" },
              bootOrder: "disk-first",
              networkType: "nat",
            },
          },
        };
      },
      deleteVm: async () => {
        calls.push("delete");
        return { success: true, data: { success: true } };
      },
      pauseVm: async () => {
        calls.push("pause");
        return { success: true, data: { success: true } };
      },
      resumeVm: async () => {
        calls.push("resume");
        return { success: true, data: { success: true } };
      },
    };

    const vm = await updateVmViaBackend({ id: "vm-1", cpu: 4, memory: 4096 });
    await pauseVmViaBackend("vm-1");
    await resumeVmViaBackend("vm-1");
    await deleteVmViaBackend("vm-1");

    expect(vm.config.cpu).toBe(4);
    expect(calls).toEqual(["update", "pause", "resume", "delete"]);
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

  it("returns null when get-display payload is empty", async () => {
    const win = getWindow();
    win.openutm = {
      getDisplay: async () => ({ success: true, data: null }),
    };

    const result = await getDisplayViaBackend("550e8400-e29b-41d4-a716-446655440000");
    expect(result).toBeNull();
  });

  it("passes runtime status/install/clear IPCs", async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      getRuntimeStatus: async () => {
        calls.push("status");
        return {
          success: true,
          data: {
            source: "managed",
            path: "/Users/dhruv/.openutm/runtime/10.2.0-openutm.1/bin/qemu-system-x86_64",
            version: "QEMU emulator version 10.2.0-openutm.1",
            spiceSupported: true,
            ready: true,
            accelerators: ["hvf", "tcg"],
          },
        };
      },
      installManagedRuntime: async () => {
        calls.push("install");
        return {
          success: true,
          data: {
            source: "managed",
            path: "/Users/dhruv/.openutm/runtime/10.2.0-openutm.1/bin/qemu-system-x86_64",
            version: "QEMU emulator version 10.2.0-openutm.1",
            spiceSupported: true,
            ready: true,
            accelerators: ["hvf", "tcg"],
          },
        };
      },
      clearManagedRuntime: async () => {
        calls.push("clear");
        return { success: true, data: { success: true } };
      },
    };

    const status = await getRuntimeStatusViaBackend();
    const installed = await installManagedRuntimeViaBackend();
    await clearManagedRuntimeViaBackend();

    expect(status.source).toBe("managed");
    expect(installed.spiceSupported).toBe(true);
    expect(calls).toEqual(["status", "install", "clear"]);
  });

  it("passes install command/terminal and media IPCs", async () => {
    const calls: string[] = [];
    const win = getWindow();
    win.openutm = {
      getQemuInstallCommand: async () => {
        calls.push("install-command");
        return { success: true, data: "brew install qemu" };
      },
      openQemuInstallTerminal: async () => {
        calls.push("install-terminal");
        return { success: true, data: { success: true } };
      },
      pickInstallMedia: async () => {
        calls.push("pick-media");
        return { success: true, data: "/tmp/ubuntu.iso" };
      },
      setInstallMedia: async () => {
        calls.push("set-media");
        return { success: true, data: { success: true } };
      },
      ejectInstallMedia: async () => {
        calls.push("eject-media");
        return { success: true, data: { success: true } };
      },
      setBootOrder: async () => {
        calls.push("set-boot-order");
        return { success: true, data: { success: true } };
      },
    };

    const command = await getQemuInstallCommandViaBackend();
    await openQemuInstallTerminalViaBackend();
    const media = await pickInstallMediaViaBackend("vm-1");
    await setInstallMediaViaBackend("vm-1", "/tmp/ubuntu.iso");
    await ejectInstallMediaViaBackend("vm-1");
    await setBootOrderViaBackend("vm-1", "cdrom-first");

    expect(command).toBe("brew install qemu");
    expect(media).toBe("/tmp/ubuntu.iso");
    expect(calls).toEqual([
      "install-command",
      "install-terminal",
      "pick-media",
      "set-media",
      "eject-media",
      "set-boot-order",
    ]);
  });

  it("throws fallback error when IPC returns unsuccessful result without message", async () => {
    const win = getWindow();
    win.openutm = {
      updateVm: async () => ({ success: false }),
    };

    await expect(updateVmViaBackend({ id: "vm-1", cpu: 2 })).rejects.toThrow("Failed to update VM");
  });

  it("passes snapshot/clone/export/import IPCs", async () => {
    const calls: string[] = [];
    const vm = {
      id: "vm-2",
      name: "VM clone",
      status: "stopped",
      config: {
        cpu: 2,
        memory: 2048,
        disks: [{ path: "/tmp/vm-2.qcow2", size: 1024, format: "qcow2" }],
        network: { type: "nat" },
        bootOrder: "disk-first",
        networkType: "nat",
      },
    };
    const win = getWindow();
    win.openutm = {
      createSnapshot: async () => {
        calls.push("snapshot-create");
        return { success: true, data: { success: true } };
      },
      listSnapshots: async () => {
        calls.push("snapshot-list");
        return {
          success: true,
          data: [{ id: "1", name: "clean", vmSize: "0", date: "today" }],
        };
      },
      restoreSnapshot: async () => {
        calls.push("snapshot-restore");
        return { success: true, data: { success: true } };
      },
      deleteSnapshot: async () => {
        calls.push("snapshot-delete");
        return { success: true, data: { success: true } };
      },
      cloneVm: async () => {
        calls.push("clone-vm");
        return { success: true, data: vm };
      },
      exportVm: async () => {
        calls.push("export-vm");
        return { success: true, data: { success: true, path: "/tmp/export.openutmvm" } };
      },
      importVm: async () => {
        calls.push("import-vm");
        return { success: true, data: vm };
      },
    };

    await createSnapshotViaBackend("vm-1", "clean");
    const snapshots = await listSnapshotsViaBackend("vm-1");
    await restoreSnapshotViaBackend("vm-1", "clean");
    await deleteSnapshotViaBackend("vm-1", "clean");
    const cloned = await cloneVmViaBackend("vm-1");
    const exported = await exportVmViaBackend("vm-1");
    const imported = await importVmViaBackend();

    expect(snapshots[0]?.name).toBe("clean");
    expect(cloned.id).toBe("vm-2");
    expect("path" in exported && exported.path).toBe("/tmp/export.openutmvm");
    expect("id" in imported && imported.id).toBe("vm-2");
    expect(calls).toEqual([
      "snapshot-create",
      "snapshot-list",
      "snapshot-restore",
      "snapshot-delete",
      "clone-vm",
      "export-vm",
      "import-vm",
    ]);
  });

  it("handles canceled export/import payloads", async () => {
    const win = getWindow();
    win.openutm = {
      exportVm: async () => ({ success: true, data: { canceled: true } }),
      importVm: async () => ({ success: true, data: { canceled: true } }),
    };

    const exported = await exportVmViaBackend("vm-1");
    const imported = await importVmViaBackend();
    expect("canceled" in exported && exported.canceled).toBe(true);
    expect("canceled" in imported && imported.canceled).toBe(true);
  });
});
