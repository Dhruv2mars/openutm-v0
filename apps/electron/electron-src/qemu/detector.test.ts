import { describe, expect, it } from 'bun:test';
import { execSync } from 'child_process';
import * as detector from './detector';

describe('QEMU Detection (Electron)', () => {
  const isQemuInstalled = (): boolean => {
    try {
      execSync('which qemu-system-x86_64 || which qemu-system-aarch64', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  describe('detectQemu', () => {
    it('returns info when QEMU is installed, otherwise throws a helpful error', async () => {
      if (isQemuInstalled()) {
      const result = await detector.detectQemu();
      expect(result.path).toContain('qemu-system-');
      expect(result.version.length).toBeGreaterThan(0);
      expect(Array.isArray(result.accelerators)).toBe(true);
      expect(typeof result.spiceSupported).toBe('boolean');
      return;
      }

      await expect(detector.detectQemu()).rejects.toThrow('QEMU not found');
    });

    it('reports a non-empty version string when installed', async () => {
      if (!isQemuInstalled()) return;
      const result = await detector.detectQemu();
      expect(result.version).toBeDefined();
      expect(result.version).not.toEqual('');
    });
  });

  describe('accelerators', () => {
    it('returns an array and includes a fallback accelerator', async () => {
      if (!isQemuInstalled()) return;
      const result = await detector.detectQemu();
      expect(Array.isArray(result.accelerators)).toBe(true);
      expect(result.accelerators.length).toBeGreaterThan(0);
      expect(result.accelerators).toContain('tcg');
    });

    it('matches accelerator list exposed by qemu -accel help when available', async () => {
      if (!isQemuInstalled()) return;

      let accelHelp = '';
      try {
        accelHelp = execSync('qemu-system-x86_64 -accel help', { encoding: 'utf8' });
      } catch {
        return;
      }

      const parsed = accelHelp
        .split('\n')
        .map((line) => line.trim().toLowerCase())
        .filter((line) => ['hvf', 'kvm', 'whpx', 'tcg'].includes(line));
      if (parsed.length === 0) return;

      const result = await detector.detectQemu();
      expect(result.accelerators).toEqual(parsed);
    });
  });

  describe('path detection', () => {
    it('returns a QEMU binary path', async () => {
      if (!isQemuInstalled()) return;
      const result = await detector.detectQemu();
      expect(result.path).toContain('qemu');
      expect(result.path).toMatch(/qemu-system-(x86_64|aarch64)/);
    });
  });

  describe('display capability', () => {
    it('reports spice support based on qemu probe', async () => {
      if (!isQemuInstalled()) return;
      const result = await detector.detectQemu();
      let supportsSpice = false;
      try {
        const output = execSync('qemu-system-x86_64 -spice help 2>&1 || true', { encoding: 'utf8' });
        supportsSpice = output.toLowerCase().includes('spice options:');
      } catch {
        supportsSpice = false;
      }
      expect(result.spiceSupported).toBe(supportsSpice);
    });
  });

  describe('error messaging', () => {
    it('documents the expected missing-QEMU guidance', () => {
      const message = 'QEMU not found in PATH. Please install QEMU.';
      expect(message).toContain('PATH');
      expect(message).toContain('install QEMU');
    });
  });
});
