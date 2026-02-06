import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
  clearManagedRuntime,
  createVMConfig,
  getRuntimeConfig,
  listVMs,
  setManagedRuntime,
} from './index';

describe('config runtime persistence', () => {
  let configDir = '';

  beforeEach(() => {
    configDir = mkdtempSync(path.join(tmpdir(), 'openutm-config-test-'));
    process.env.OPENUTM_CONFIG_DIR = configDir;
  });

  afterEach(() => {
    delete process.env.OPENUTM_CONFIG_DIR;
    if (configDir) {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('persists managed runtime path/version', async () => {
    await setManagedRuntime('/tmp/openutm-runtime/qemu-system-x86_64', '10.2.0-openutm.1');
    const runtime = await getRuntimeConfig();
    expect(runtime.managedRuntimePath).toBe('/tmp/openutm-runtime/qemu-system-x86_64');
    expect(runtime.managedRuntimeVersion).toBe('10.2.0-openutm.1');

    const raw = JSON.parse(readFileSync(path.join(configDir, 'config.json'), 'utf8'));
    expect(raw.managedRuntimePath).toBe('/tmp/openutm-runtime/qemu-system-x86_64');
    expect(raw.managedRuntimeVersion).toBe('10.2.0-openutm.1');
  });

  it('clears managed runtime metadata', async () => {
    await setManagedRuntime('/tmp/openutm-runtime/qemu-system-x86_64', '10.2.0-openutm.1');
    await clearManagedRuntime();
    const runtime = await getRuntimeConfig();
    expect(runtime.managedRuntimePath).toBeUndefined();
    expect(runtime.managedRuntimeVersion).toBeUndefined();
  });

  it('retains runtime metadata when VM store updates', async () => {
    await setManagedRuntime('/tmp/openutm-runtime/qemu-system-aarch64', '10.2.0-openutm.2');
    await createVMConfig({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'vm-1',
      memory: 2048,
      cores: 2,
      disk: '/tmp/vm-1.qcow2',
    });

    const list = await listVMs();
    expect(list).toHaveLength(1);

    const runtime = await getRuntimeConfig();
    expect(runtime.managedRuntimePath).toBe('/tmp/openutm-runtime/qemu-system-aarch64');
    expect(runtime.managedRuntimeVersion).toBe('10.2.0-openutm.2');
  });
});
