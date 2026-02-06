import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHash } from 'crypto';
import { existsSync as fsExistsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { resetDetectorDepsForTests, setDetectorDepsForTests } from './qemu/detector';
import { resetRuntimeInstallDepsForTests, setRuntimeInstallDepsForTests } from './qemu/runtime-install';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
const ipcHandleMock = mock((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
  handlers.set(channel, handler);
});

mock.module('electron', () => ({
  ipcMain: {
    handle: ipcHandleMock,
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
  });

  afterEach(() => {
    resetDetectorDepsForTests();
    resetRuntimeInstallDepsForTests();
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
});
