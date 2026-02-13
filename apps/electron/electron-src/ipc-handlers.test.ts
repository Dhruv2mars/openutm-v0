import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHash } from 'crypto';
import { existsSync as fsExistsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { resetDetectorDepsForTests, setDetectorDepsForTests } from './qemu/detector';
import { resetRuntimeInstallDepsForTests, setRuntimeInstallDepsForTests } from './qemu/runtime-install';
import { setSpawnSyncFnForTests } from './qemu/install';
import { createVMConfig, getVMConfig } from './config';
import { resetVmArtifactsDepsForTests, setVmArtifactsDepsForTests } from './vm-artifacts';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
const ipcHandleMock = mock((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
  handlers.set(channel, handler);
});
const showOpenDialogMock = mock(async () => ({ canceled: false, filePaths: ['/tmp/ubuntu.iso'] }));
const showSaveDialogMock = mock(async () => ({ canceled: false, filePath: '/tmp/export.openutmvm' }));

mock.module('electron', () => ({
  ipcMain: {
    handle: ipcHandleMock,
  },
  dialog: {
    showOpenDialog: showOpenDialogMock,
    showSaveDialog: showSaveDialogMock,
  },
}));

const { registerIpcHandlers } = await import('./ipc-handlers');

function checksum(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

describe('ipc handlers runtime controls', () => {
  let configDir = '';

  beforeEach(() => {
    handlers.clear();
    ipcHandleMock.mockClear();
    configDir = mkdtempSync(path.join(tmpdir(), 'openutm-ipc-test-'));
    process.env.OPENUTM_CONFIG_DIR = configDir;

    setDetectorDepsForTests({
      platform: () => 'darwin',
      existsSync: ((targetPath: string) =>
        targetPath === '/opt/homebrew/bin/qemu-system-x86_64' || fsExistsSync(targetPath)) as any,
      spawnSync: ((cmd: string, args: string[]) => {
        if (cmd === 'which') {
          return { status: 0, stdout: '/opt/homebrew/bin/qemu-system-x86_64\n', stderr: '' };
        }
        if (args[0] === '--version') {
          return { status: 0, stdout: 'QEMU emulator version 10.2.0\n', stderr: '' };
        }
        if (args[0] === '--help') {
          return { status: 0, stdout: '-accel hvf\n-accel tcg\n', stderr: '' };
        }
        if (args[0] === '-spice') {
          return { status: 0, stdout: 'spice options:\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      }) as any,
    });

    const payload = Buffer.from('#!/bin/sh\necho runtime\n', 'utf8');
    const manifest = {
      version: '10.2.0-openutm.1',
      assets: {
        'darwin-arm64': {
          url: 'https://example.com/runtime.bin',
          sha256: checksum(payload),
          binaryPath: 'bin/qemu-system-x86_64',
          archiveType: 'binary',
        },
      },
    };
    setRuntimeInstallDepsForTests({
      platform: () => 'darwin',
      arch: () => 'arm64',
      fetch: (async (url: string) => {
        if (url.endsWith('manifest.json')) {
          return new Response(JSON.stringify(manifest), { status: 200 });
        }
        return new Response(payload, { status: 200 });
      }) as any,
      randomUUID: () => 'runtime-test',
    });
    showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: ['/tmp/ubuntu.iso'] });
    showSaveDialogMock.mockResolvedValue({ canceled: false, filePath: '/tmp/export.openutmvm' });
    let nextId = 0;
    setSpawnSyncFnForTests(
      ((cmd: string) => {
        if (cmd === 'osascript') {
          return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 0, stdout: '', stderr: '' };
      }) as any,
    );
    setVmArtifactsDepsForTests({
      randomUUID: () => {
        nextId += 1;
        return `generated-vm-id-${nextId}`;
      },
      mkdtempSync: () => '/tmp/openutm-stage',
      copyFileSync: (() => {}) as any,
      mkdirSync: (() => {}) as any,
      writeFileSync: (() => {}) as any,
      readFileSync: (() =>
        JSON.stringify({
          version: 1,
          vm: {
            name: 'Imported VM',
            memory: 2048,
            cores: 2,
            accelerator: 'hvf',
            bootOrder: 'disk-first',
            networkType: 'nat',
          },
          diskFile: 'disk.qcow2',
        })) as any,
      rmSync: (() => {}) as any,
      spawnSync: ((cmd: string, args: string[]) => {
        if (cmd.endsWith('qemu-img') && args[0] === 'snapshot' && args[1] === '-l') {
          return {
            status: 0,
            stdout:
              'Snapshot list:\nID        TAG                VM SIZE                DATE       VM CLOCK\n1         clean-install      0 B                    2026-02-13 00:00:00\n',
            stderr: '',
          };
        }
        return { status: 0, stdout: '', stderr: '' };
      }) as any,
    });
  });

  afterEach(() => {
    resetDetectorDepsForTests();
    resetRuntimeInstallDepsForTests();
    resetVmArtifactsDepsForTests();
    delete process.env.OPENUTM_CONFIG_DIR;
    if (configDir) {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('registers runtime endpoints', () => {
    registerIpcHandlers();
    expect(handlers.has('get-runtime-status')).toBe(true);
    expect(handlers.has('install-managed-runtime')).toBe(true);
    expect(handlers.has('clear-managed-runtime')).toBe(true);
    expect(handlers.has('qemu-install-command')).toBe(true);
    expect(handlers.has('qemu-install-terminal')).toBe(true);
    expect(handlers.has('pick-install-media')).toBe(true);
    expect(handlers.has('set-install-media')).toBe(true);
    expect(handlers.has('eject-install-media')).toBe(true);
    expect(handlers.has('set-boot-order')).toBe(true);
    expect(handlers.has('snapshot-create')).toBe(true);
    expect(handlers.has('snapshot-list')).toBe(true);
    expect(handlers.has('snapshot-restore')).toBe(true);
    expect(handlers.has('snapshot-delete')).toBe(true);
    expect(handlers.has('clone-vm')).toBe(true);
    expect(handlers.has('export-vm')).toBe(true);
    expect(handlers.has('import-vm')).toBe(true);
  });

  it('returns runtime status payload', async () => {
    registerIpcHandlers();
    const handler = handlers.get('get-runtime-status');
    expect(handler).toBeDefined();
    const result = await handler!(undefined);
    expect(result).toEqual({
      success: true,
      data: {
        path: '/opt/homebrew/bin/qemu-system-x86_64',
        version: 'QEMU emulator version 10.2.0',
        accelerators: ['hvf', 'tcg'],
        spiceSupported: true,
        source: 'system',
        ready: true,
      },
    });
  });

  it('installs managed runtime and returns refreshed status', async () => {
    registerIpcHandlers();
    const handler = handlers.get('install-managed-runtime');
    expect(handler).toBeDefined();
    const result = await handler!(undefined);
    expect((result as any).success).toBe(true);
    expect((result as any).data.source).toBe('managed');
    expect((result as any).data.spiceSupported).toBe(true);
  });

  it('clears managed runtime installation', async () => {
    registerIpcHandlers();
    const installHandler = handlers.get('install-managed-runtime');
    await installHandler!(undefined);

    const clearHandler = handlers.get('clear-managed-runtime');
    const result = await clearHandler!(undefined);
    expect(result).toEqual({ success: true, data: { success: true } });
  });

  it('returns qemu install command + opens terminal', async () => {
    registerIpcHandlers();
    const command = await handlers.get('qemu-install-command')!(undefined);
    expect((command as any).success).toBe(true);
    expect((command as any).data).toContain('brew install qemu');

    const terminal = await handlers.get('qemu-install-terminal')!(undefined);
    expect((terminal as any).success).toBe(true);
  });

  it('picks install media path', async () => {
    registerIpcHandlers();
    const result = await handlers.get('pick-install-media')!(undefined);
    expect((result as any)).toEqual({ success: true, data: '/tmp/ubuntu.iso' });
    expect(showOpenDialogMock).toHaveBeenCalled();
  });

  it('sets/ejects install media and updates boot order', async () => {
    registerIpcHandlers();
    await createVMConfig({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'ubuntu-vm',
      memory: 2048,
      cores: 2,
      disk: '/tmp/vm.qcow2',
    });

    const setMedia = await handlers.get('set-install-media')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      path: '/tmp/ubuntu.iso',
    });
    expect((setMedia as any).success).toBe(true);

    const setBoot = await handlers.get('set-boot-order')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      order: 'cdrom-first',
    });
    expect((setBoot as any).success).toBe(true);

    let vm = await getVMConfig('550e8400-e29b-41d4-a716-446655440000');
    expect(vm?.installMediaPath).toBe('/tmp/ubuntu.iso');
    expect(vm?.bootOrder).toBe('cdrom-first');

    const eject = await handlers.get('eject-install-media')!(undefined, '550e8400-e29b-41d4-a716-446655440000');
    expect((eject as any).success).toBe(true);
    vm = await getVMConfig('550e8400-e29b-41d4-a716-446655440000');
    expect(vm?.installMediaPath).toBeUndefined();
  });

  it('handles snapshot lifecycle endpoints', async () => {
    registerIpcHandlers();
    await createVMConfig({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'ubuntu-vm',
      memory: 2048,
      cores: 2,
      disk: '/tmp/vm.qcow2',
    });

    const created = await handlers.get('snapshot-create')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'clean-install',
    });
    expect((created as any).success).toBe(true);

    const listed = await handlers.get('snapshot-list')!(undefined, '550e8400-e29b-41d4-a716-446655440000');
    expect((listed as any).success).toBe(true);
    expect((listed as any).data).toHaveLength(1);

    const restored = await handlers.get('snapshot-restore')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'clean-install',
    });
    expect((restored as any).success).toBe(true);

    const deleted = await handlers.get('snapshot-delete')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'clean-install',
    });
    expect((deleted as any).success).toBe(true);
  });

  it('clones vm and imports/exports vm archive', async () => {
    registerIpcHandlers();
    await createVMConfig({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'ubuntu-vm',
      memory: 2048,
      cores: 2,
      disk: '/tmp/vm.qcow2',
    });

    const cloned = await handlers.get('clone-vm')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'ubuntu-vm-clone',
    });
    expect((cloned as any).success).toBe(true);
    expect((cloned as any).data.name).toBe('ubuntu-vm-clone');

    const exported = await handlers.get('export-vm')!(undefined, {
      id: '550e8400-e29b-41d4-a716-446655440000',
      path: '/tmp/export.openutmvm',
    });
    expect((exported as any).success).toBe(true);
    expect((exported as any).data.path).toBe('/tmp/export.openutmvm');

    const imported = await handlers.get('import-vm')!(undefined, {
      path: '/tmp/export.openutmvm',
    });
    expect((imported as any).success).toBe(true);
    expect((imported as any).data.name).toContain('Imported');
  });
});
