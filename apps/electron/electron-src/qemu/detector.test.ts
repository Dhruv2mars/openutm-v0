import { afterEach, describe, expect, it, mock } from 'bun:test';
import {
  detectQemu,
  getRuntimeStatus,
  resetDetectorDepsForTests,
  setDetectorDepsForTests,
} from './detector';

describe('qemu detector', () => {
  afterEach(() => {
    resetDetectorDepsForTests();
  });

  it('prefers managed runtime when configured and present', async () => {
    const spawnSync = mock((cmd: string, args: string[]) => {
      if (args[0] === '--version') {
        return { status: 0, stdout: 'QEMU emulator version 10.2.0-openutm\n', stderr: '' };
      }
      if (args[0] === '--help') {
        return { status: 0, stdout: '-accel hvf\n-accel tcg\n', stderr: '' };
      }
      if (args[0] === '-spice') {
        return { status: 0, stdout: 'spice options:\n', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    setDetectorDepsForTests({
      spawnSync: spawnSync as any,
      existsSync: ((targetPath: string) => targetPath === '/managed/qemu-system-x86_64') as any,
      platform: () => 'darwin',
      getRuntimeConfig: async () => ({
        managedRuntimePath: '/managed/qemu-system-x86_64',
        managedRuntimeVersion: '10.2.0-openutm.1',
      }),
    });

    const result = await detectQemu();
    expect(result.source).toBe('managed');
    expect(result.spiceSupported).toBe(true);
    expect(result.path).toBe('/managed/qemu-system-x86_64');
  });

  it('falls back to system qemu when managed runtime missing', async () => {
    const spawnSync = mock((cmd: string, args: string[]) => {
      if (cmd === 'which') {
        return { status: 0, stdout: '/opt/homebrew/bin/qemu-system-x86_64\n', stderr: '' };
      }
      if (args[0] === '--version') {
        return { status: 0, stdout: 'QEMU emulator version 9.0.0\n', stderr: '' };
      }
      if (args[0] === '--help') {
        return { status: 0, stdout: '-accel hvf\n-accel tcg\n', stderr: '' };
      }
      if (args[0] === '-spice') {
        return { status: 1, stdout: '', stderr: 'invalid option' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    setDetectorDepsForTests({
      spawnSync: spawnSync as any,
      existsSync: ((targetPath: string) => targetPath === '/opt/homebrew/bin/qemu-system-x86_64') as any,
      platform: () => 'darwin',
      getRuntimeConfig: async () => ({
        managedRuntimePath: '/managed/missing-qemu',
        managedRuntimeVersion: '10.2.0-openutm.1',
      }),
    });

    const result = await detectQemu();
    expect(result.source).toBe('system');
    expect(result.path).toBe('/opt/homebrew/bin/qemu-system-x86_64');
    expect(result.spiceSupported).toBe(false);
  });

  it('reports runtime ready only when spice is supported', async () => {
    const spawnSync = mock((cmd: string, args: string[]) => {
      if (cmd === 'which') {
        return { status: 0, stdout: '/opt/homebrew/bin/qemu-system-x86_64\n', stderr: '' };
      }
      if (args[0] === '--version') {
        return { status: 0, stdout: 'QEMU emulator version 9.0.0\n', stderr: '' };
      }
      if (args[0] === '--help') {
        return { status: 0, stdout: '-accel hvf\n-accel tcg\n', stderr: '' };
      }
      if (args[0] === '-spice') {
        return { status: 1, stdout: '', stderr: 'invalid option' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    setDetectorDepsForTests({
      spawnSync: spawnSync as any,
      existsSync: ((targetPath: string) => targetPath === '/opt/homebrew/bin/qemu-system-x86_64') as any,
      platform: () => 'darwin',
      getRuntimeConfig: async () => ({}),
    });

    const status = await getRuntimeStatus();
    expect(status.ready).toBe(false);
    expect(status.spiceSupported).toBe(false);
    expect(status.source).toBe('system');
  });

  it('throws if neither managed nor system qemu are available', async () => {
    setDetectorDepsForTests({
      spawnSync: (() => ({ status: 1, stdout: '', stderr: '' })) as any,
      existsSync: (() => false) as any,
      platform: () => 'darwin',
      getRuntimeConfig: async () => ({
        managedRuntimePath: '/managed/missing-qemu',
        managedRuntimeVersion: '10.2.0-openutm.1',
      }),
    });

    await expect(detectQemu()).rejects.toThrow('QEMU not found');
  });
});
