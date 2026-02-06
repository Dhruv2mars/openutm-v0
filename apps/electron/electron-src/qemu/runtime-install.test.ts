import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { getRuntimeConfig } from '../config';
import {
  clearManagedRuntimeInstallation,
  installManagedRuntime,
  resetRuntimeInstallDepsForTests,
  setRuntimeInstallDepsForTests,
} from './runtime-install';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

describe('managed runtime install', () => {
  let configDir = '';

  beforeEach(() => {
    configDir = mkdtempSync(path.join(tmpdir(), 'openutm-runtime-test-'));
    process.env.OPENUTM_CONFIG_DIR = configDir;
  });

  afterEach(() => {
    resetRuntimeInstallDepsForTests();
    delete process.env.OPENUTM_CONFIG_DIR;
    if (configDir) {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('downloads, verifies, installs runtime and persists config', async () => {
    const payload = Buffer.from('#!/bin/sh\necho qemu\n', 'utf8');
    const checksum = sha256(payload);
    const manifest = {
      version: '10.2.0-openutm.1',
      assets: {
        'darwin-arm64': {
          url: 'https://example.com/runtime.bin',
          sha256: checksum,
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
    });

    const installed = await installManagedRuntime('https://example.com/manifest.json');
    expect(installed.version).toBe('10.2.0-openutm.1');
    expect(installed.path).toContain('qemu-system-x86_64');
    expect(existsSync(installed.path)).toBe(true);
    expect(readFileSync(installed.path, 'utf8')).toContain('echo qemu');

    const runtime = await getRuntimeConfig();
    expect(runtime.managedRuntimeVersion).toBe('10.2.0-openutm.1');
    expect(runtime.managedRuntimePath).toBe(installed.path);
  });

  it('fails when checksum does not match', async () => {
    const payload = Buffer.from('broken-runtime', 'utf8');
    const manifest = {
      version: '10.2.0-openutm.2',
      assets: {
        'darwin-arm64': {
          url: 'https://example.com/runtime.bin',
          sha256: 'deadbeef',
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
    });

    await expect(installManagedRuntime('https://example.com/manifest.json')).rejects.toThrow(
      'Checksum verification failed',
    );
  });

  it('clears managed runtime installation metadata', async () => {
    const payload = Buffer.from('runtime', 'utf8');
    const checksum = sha256(payload);
    const manifest = {
      version: '10.2.0-openutm.3',
      assets: {
        'darwin-arm64': {
          url: 'https://example.com/runtime.bin',
          sha256: checksum,
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
    });

    const installed = await installManagedRuntime('https://example.com/manifest.json');
    await clearManagedRuntimeInstallation();

    const runtime = await getRuntimeConfig();
    expect(runtime.managedRuntimePath).toBeUndefined();
    expect(runtime.managedRuntimeVersion).toBeUndefined();
    expect(existsSync(path.dirname(path.dirname(installed.path)))).toBe(false);
  });
});
