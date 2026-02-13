import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import path from 'path';
import {
  cloneVm,
  createSnapshot,
  deleteSnapshot,
  exportVm,
  importVm,
  listSnapshots,
  resetVmArtifactsDepsForTests,
  restoreSnapshot,
  setVmArtifactsDepsForTests,
} from './vm-artifacts';

describe('vm artifacts', () => {
  const spawnSyncMock = mock(() => ({ status: 0, stdout: '', stderr: '' }));
  const getVMConfigMock = mock(async () => ({
    id: 'vm-1',
    name: 'Ubuntu',
    memory: 2048,
    cores: 2,
    disk: '/tmp/vm-1.qcow2',
    accelerator: 'hvf',
    bootOrder: 'disk-first',
    networkType: 'nat',
  }));
  const createVMConfigMock = mock(async () => ({}));
  const copyFileSyncMock = mock(() => {});
  const writeFileSyncMock = mock(() => {});
  const readFileSyncMock = mock(() =>
    JSON.stringify({
      version: 1,
      vm: {
        name: 'Ubuntu',
        memory: 2048,
        cores: 2,
        accelerator: 'hvf',
      },
      diskFile: 'disk.qcow2',
    }),
  );
  const rmSyncMock = mock(() => {});
  const mkdirSyncMock = mock(() => {});
  const detectQemuMock = mock(async () => ({
    path: '/runtime/bin/qemu-system-x86_64',
  }));

  beforeEach(() => {
    spawnSyncMock.mockClear();
    getVMConfigMock.mockClear();
    createVMConfigMock.mockClear();
    copyFileSyncMock.mockClear();
    writeFileSyncMock.mockClear();
    readFileSyncMock.mockClear();
    rmSyncMock.mockClear();
    mkdirSyncMock.mockClear();
    detectQemuMock.mockClear();

    setVmArtifactsDepsForTests({
      spawnSync: spawnSyncMock as any,
      randomUUID: () => 'cloned-id',
      mkdtempSync: () => '/tmp/stage-dir',
      writeFileSync: writeFileSyncMock as any,
      readFileSync: readFileSyncMock as any,
      copyFileSync: copyFileSyncMock as any,
      mkdirSync: mkdirSyncMock as any,
      rmSync: rmSyncMock as any,
      getVMConfig: getVMConfigMock as any,
      createVMConfig: createVMConfigMock as any,
      getVmRuntimeStatus: () => 'stopped',
      detectQemu: detectQemuMock as any,
    });
  });

  afterEach(() => {
    resetVmArtifactsDepsForTests();
  });

  it('creates snapshot with qemu-img', async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === '/runtime/bin/qemu-img' && args[0] === '--version') {
        return { status: 0, stdout: 'qemu-img version 10.2.0\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    const result = await createSnapshot('vm-1', 'clean-install');
    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      '/runtime/bin/qemu-img',
      ['snapshot', '-c', 'clean-install', '/tmp/vm-1.qcow2'],
      expect.any(Object),
    );
  });

  it('lists snapshots by parsing qemu-img output', async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === '/runtime/bin/qemu-img' && args[0] === '--version') {
        return { status: 0, stdout: 'qemu-img version 10.2.0\n', stderr: '' };
      }
      return {
        status: 0,
        stdout: [
          'Snapshot list:',
          'ID        TAG                VM SIZE                DATE       VM CLOCK',
          '1         clean-install      0 B                    2026-02-13 00:00:00',
        ].join('\n'),
        stderr: '',
      };
    });

    const snapshots = await listSnapshots('vm-1');
    expect(snapshots).toEqual([
      {
        id: '1',
        name: 'clean-install',
        vmSize: '0 B',
        date: '2026-02-13 00:00:00',
      },
    ]);
  });

  it('restores and deletes snapshots', async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === '/runtime/bin/qemu-img' && args[0] === '--version') {
        return { status: 0, stdout: 'qemu-img version 10.2.0\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    await restoreSnapshot('vm-1', 'clean-install');
    await deleteSnapshot('vm-1', 'clean-install');

    expect(spawnSyncMock).toHaveBeenCalledWith(
      '/runtime/bin/qemu-img',
      ['snapshot', '-a', 'clean-install', '/tmp/vm-1.qcow2'],
      expect.any(Object),
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      '/runtime/bin/qemu-img',
      ['snapshot', '-d', 'clean-install', '/tmp/vm-1.qcow2'],
      expect.any(Object),
    );
  });

  it('blocks snapshot actions when vm is running', async () => {
    setVmArtifactsDepsForTests({
      getVmRuntimeStatus: () => 'running',
    });
    await expect(createSnapshot('vm-1', 'blocked')).rejects.toThrow('VM must be stopped');
  });

  it('clones vm and disk', async () => {
    const result = await cloneVm('vm-1');
    expect(result.vmId).toBe('cloned-id');
    expect(copyFileSyncMock).toHaveBeenCalledWith('/tmp/vm-1.qcow2', '/tmp/cloned-id.qcow2');
    expect(createVMConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cloned-id',
        name: 'Ubuntu Copy',
        disk: '/tmp/cloned-id.qcow2',
      }),
    );
  });

  it('exports vm archive', async () => {
    const result = await exportVm('vm-1', '/tmp/ubuntu.openutmvm');
    expect(result).toEqual({ success: true, path: '/tmp/ubuntu.openutmvm' });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/tmp/stage-dir/manifest.json',
      expect.any(String),
      'utf8',
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'tar',
      ['-czf', '/tmp/ubuntu.openutmvm', '-C', '/tmp/stage-dir', '.'],
      expect.any(Object),
    );
  });

  it('imports vm archive', async () => {
    const result = await importVm('/tmp/ubuntu.openutmvm');
    expect(result.vmId).toBe('cloned-id');
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'tar',
      ['-xzf', '/tmp/ubuntu.openutmvm', '-C', '/tmp/stage-dir'],
      expect.any(Object),
    );
    expect(mkdirSyncMock).toHaveBeenCalledWith(path.join(process.env.HOME || '/tmp', '.openutm', 'disks'), {
      recursive: true,
    });
    expect(createVMConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cloned-id',
        name: 'Ubuntu Imported',
      }),
    );
  });

  it('falls back to PATH qemu-img when sidecar is unavailable', async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === '/runtime/bin/qemu-img' && args[0] === '--version') {
        return { status: 1, stdout: '', stderr: 'missing' };
      }
      if (cmd === 'qemu-img' && args[0] === '--version') {
        return { status: 0, stdout: 'qemu-img version 9.1.0\n', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });

    await createSnapshot('vm-1', 'fallback-ok');
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'qemu-img',
      ['snapshot', '-c', 'fallback-ok', '/tmp/vm-1.qcow2'],
      expect.any(Object),
    );
  });

  it('throws if qemu-img is unavailable', async () => {
    spawnSyncMock.mockImplementation(() => ({ status: 1, stdout: '', stderr: 'missing' }));
    await expect(createSnapshot('vm-1', 'broken')).rejects.toThrow('qemu-img not found');
  });
});
