import { beforeEach, describe, expect, it, mock } from "bun:test";
import { VMStatus } from "@openutm/shared-types";
import type { VM } from "@openutm/shared-types";
import { __setInvokeForTests, createVmViaBackend, detectQemuViaBackend, listVmsViaBackend } from "./backend";

describe("tauri renderer backend bridge", () => {
  beforeEach(() => {
    __setInvokeForTests(null);
  });

  it("throws when invoke bridge is missing", async () => {
    await expect(detectQemuViaBackend()).rejects.toThrow("Tauri invoke bridge unavailable");
  });

  it("maps detect_qemu response into setup wizard shape", async () => {
    __setInvokeForTests(
      mock(async (cmd: string) => {
        if (cmd === "detect_qemu") {
          return {
            detected: true,
            path: "/opt/homebrew/bin/qemu-system-aarch64",
            version: "QEMU emulator version 8.2.0",
            accelerator: "HVF",
          };
        }
        throw new Error("unexpected command");
      }),
    );

    const result = await detectQemuViaBackend();
    expect(result.available).toBe(true);
    expect(result.minimumVersionMet).toBe(true);
    expect(result.accelerators).toEqual(["hvf"]);
  });

  it("maps list_vms into shared VM shape", async () => {
    __setInvokeForTests(
      mock(async (cmd: string) => {
        if (cmd !== "list_vms") {
          throw new Error("unexpected command");
        }
        return [
          {
            id: "vm-1",
            name: "Ubuntu VM",
            status: "stopped",
            config: {
              name: "Ubuntu VM",
              memory_mb: 2048,
              cpu_cores: 2,
              disk_size_gb: 20,
              os: "linux",
            },
          },
        ];
      }),
    );

    const result = await listVmsViaBackend();
    const expected: VM[] = [
      {
        id: "vm-1",
        name: "Ubuntu VM",
        status: VMStatus.Stopped,
        config: {
          cpu: 2,
          memory: 2048,
          disks: [
            {
              path: "/tmp/vm-1.qcow2",
              size: 20 * 1024 * 1024 * 1024,
              format: "qcow2",
            },
          ],
          network: { type: "nat" },
        },
      },
    ];

    expect(result).toEqual(expected);
  });

  it("passes create_vm through invoke", async () => {
    const invoke = mock(async (cmd: string) => {
      if (cmd !== "create_vm") throw new Error("unexpected command");
      return {
        id: "vm-2",
        name: "Fedora VM",
        status: "stopped",
        config: {
          name: "Fedora VM",
          memory_mb: 4096,
          cpu_cores: 4,
          disk_size_gb: 40,
          os: "linux",
        },
      };
    });
    __setInvokeForTests(invoke);

    const vm = await createVmViaBackend({
      name: "Fedora VM",
      cpu: 4,
      memory: 4096,
      diskSizeGb: 40,
      networkType: "nat",
      os: "linux",
    });

    expect(vm.id).toBe("vm-2");
    expect(invoke).toHaveBeenCalled();
  });
});
