import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createVMConfig, deleteVMConfig, getVMConfig, listVMs, updateVMConfig } from "./index";

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_CONFIG_DIR = process.env.OPENUTM_CONFIG_DIR;

describe("electron config migration", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    if (ORIGINAL_HOME === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = ORIGINAL_HOME;
    }
    if (ORIGINAL_CONFIG_DIR === undefined) {
      delete process.env.OPENUTM_CONFIG_DIR;
    } else {
      process.env.OPENUTM_CONFIG_DIR = ORIGINAL_CONFIG_DIR;
    }
  });

  it("fills defaults for legacy records missing install/boot/network fields", async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "openutm-electron-config-"));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;

    writeFileSync(
      path.join(tempDir, "config.json"),
      JSON.stringify({
        vms: [
          {
            id: "vm-legacy",
            name: "Legacy VM",
            memory: 2048,
            cores: 2,
            disk: "/tmp/legacy.qcow2",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
      "utf8"
    );

    const result = await listVMs();

    expect(result).toHaveLength(1);
    expect(result[0].installMediaPath).toBeUndefined();
    expect(result[0].bootOrder).toBe("disk-first");
    expect(result[0].networkType).toBe("nat");
  });

  it('creates, updates, reads and deletes VM config records', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;

    const created = await createVMConfig({
      id: 'vm-1',
      name: 'VM One',
      memory: 4096,
      cores: 4,
      disk: '/tmp/vm-1.qcow2',
      installMediaPath: '/isos/ubuntu.iso',
      bootOrder: 'cdrom-first',
      networkType: 'nat',
      qmpSocket: '/tmp/qmp-vm-1.sock',
      accelerator: 'hvf',
    });

    expect(created.id).toBe('vm-1');
    const listed = await listVMs();
    expect(listed).toHaveLength(1);

    const loaded = await getVMConfig('vm-1');
    expect(loaded?.name).toBe('VM One');

    const updated = await updateVMConfig('vm-1', {
      name: 'VM Renamed',
      memory: 8192,
      networkType: 'bridge',
    });
    expect(updated.name).toBe('VM Renamed');
    expect(updated.memory).toBe(8192);
    expect(updated.networkType).toBe('bridge');

    await deleteVMConfig('vm-1');
    const deleted = await getVMConfig('vm-1');
    expect(deleted).toBeNull();
  });

  it('rejects duplicate VM ids on create', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;
    await createVMConfig({
      id: 'vm-dup',
      name: 'First',
      memory: 2048,
      cores: 2,
      disk: '/tmp/first.qcow2',
      bootOrder: 'disk-first',
      networkType: 'nat',
      accelerator: 'hvf',
    });

    await expect(
      createVMConfig({
        id: 'vm-dup',
        name: 'Second',
        memory: 2048,
        cores: 2,
        disk: '/tmp/second.qcow2',
        bootOrder: 'disk-first',
        networkType: 'nat',
        accelerator: 'hvf',
      })
    ).rejects.toThrow('already exists');
  });

  it('returns empty list for malformed config file', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;
    writeFileSync(path.join(tempDir, 'config.json'), '{ bad json', 'utf8');

    const result = await listVMs();
    expect(result).toEqual([]);
  });

  it('writes config store atomically', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;
    await createVMConfig({
      id: 'vm-atomic',
      name: 'Atomic',
      memory: 1024,
      cores: 1,
      disk: '/tmp/atomic.qcow2',
      bootOrder: 'disk-first',
      networkType: 'nat',
      accelerator: 'hvf',
    });

    const onDisk = JSON.parse(readFileSync(path.join(tempDir, 'config.json'), 'utf8'));
    expect(onDisk.vms).toHaveLength(1);
    expect(onDisk.vms[0].id).toBe('vm-atomic');
  });

  it('throws when updating missing VM', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;
    await expect(updateVMConfig('missing', { name: 'nope' })).rejects.toThrow('not found');
  });

  it('creates missing config directory automatically', async () => {
    tempDir = path.join(mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-')), 'nested');
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;

    await createVMConfig({
      id: 'vm-nested',
      name: 'Nested',
      memory: 1024,
      cores: 1,
      disk: '/tmp/nested.qcow2',
      bootOrder: 'disk-first',
      networkType: 'nat',
      accelerator: 'hvf',
    });

    const result = await listVMs();
    expect(result).toHaveLength(1);
  });

  it('returns empty list when config has invalid shape', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;
    writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify({ vms: {} }), 'utf8');

    const result = await listVMs();
    expect(result).toEqual([]);
  });

  it('sorts VM list by createdAt descending', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'openutm-electron-config-'));
    process.env.OPENUTM_CONFIG_DIR = tempDir;
    delete process.env.HOME;
    writeFileSync(
      path.join(tempDir, 'config.json'),
      JSON.stringify({
        vms: [
          {
            id: 'older',
            name: 'Older',
            memory: 1024,
            cores: 1,
            disk: '/tmp/older.qcow2',
            bootOrder: 'disk-first',
            networkType: 'nat',
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'newer',
            name: 'Newer',
            memory: 2048,
            cores: 2,
            disk: '/tmp/newer.qcow2',
            bootOrder: 'disk-first',
            networkType: 'nat',
            createdAt: 2,
            updatedAt: 2,
          },
        ],
      }),
      'utf8',
    );

    const result = await listVMs();
    expect(result[0].id).toBe('newer');
    expect(result[1].id).toBe('older');
  });
});
