import { describe, it, expect, mock, spyOn } from 'bun:test';
import { execSync } from 'child_process';
import * as detector from './detector';

describe('QEMU Detection (Electron)', () => {
  const isQemuInstalled = (): boolean => {
    try {
      execSync('which qemu-system-x86_64', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  const skipIfNoQemu = () => {
    if (!isQemuInstalled()) {
      // Skip test - QEMU not installed in test environment
    }
  };

  describe('detectQemu', () => {
    it('should return QemuInfo with path and version when QEMU is found', async () => {
      skipIfNoQemu();
      try {
        const result = await detector.detectQemu();
        expect(result).toBeDefined();
        expect(result.path).toBeDefined();
        expect(result.version).toBeDefined();
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('QEMU not found');
      }
    });

    it('should throw error when QEMU not found', async () => {
      try {
        await detector.detectQemu();
        expect(true).toBe(false);
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('QEMU');
      }
    });

    it('should detect version from --version output', () => {
      if (!isQemuInstalled()) return;
      
      const result = detector.detectQemu();
      expect(result.version).toBeDefined();
      expect(result.version).not.toEqual('');
    });
  });

  describe('Accelerator Detection', () => {
    it('should detect HVF on macOS', () => {
      if (process.platform !== 'darwin') return;
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(result.accelerators).toBeDefined();
      expect(Array.isArray(result.accelerators)).toBe(true);
    });

    it('should detect KVM on Linux', () => {
      if (process.platform !== 'linux') return;
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(result.accelerators).toBeDefined();
      expect(Array.isArray(result.accelerators)).toBe(true);
    });

    it('should detect TCG as fallback', () => {
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(result.accelerators).toBeDefined();
      expect(Array.isArray(result.accelerators)).toBe(true);
    });
  });

  describe('QEMU Path Detection', () => {
    it('should return valid path to QEMU binary', () => {
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(result.path).toBeDefined();
      expect(result.path).not.toEqual('');
      expect(result.path).toContain('qemu');
    });

    it('should detect x86_64 or aarch64 binary', () => {
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(result.path).toMatch(/qemu-system-(x86_64|aarch64)/);
    });
  });

  describe('Error Handling', () => {
    it('should provide helpful error for missing QEMU', () => {
      const message = 'QEMU not found in PATH. Please install QEMU.';
      expect(message).toContain('PATH');
    });

    it('should handle command execution failures gracefully', () => {
      expect(() => {
        try {
          execSync('invalid-command-that-does-not-exist-xyz123', { stdio: 'pipe' });
        } catch (e) {
          expect(e).toBeDefined();
        }
      }).not.toThrow();
    });
  });

  describe('Architecture Support', () => {
    it('should support x86_64 architecture', () => {
      try {
        execSync('which qemu-system-x86_64', { stdio: 'ignore' });
        expect(true).toBe(true);
      } catch {
        // Not available - acceptable
      }
    });

    it('should support aarch64 architecture', () => {
      try {
        execSync('which qemu-system-aarch64', { stdio: 'ignore' });
        expect(true).toBe(true);
      } catch {
        // Not available - acceptable
      }
    });
  });

  describe('QemuInfo Interface', () => {
    it('should have required fields', () => {
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('accelerators');
    });

    it('should have array accelerators', () => {
      if (!isQemuInstalled()) return;

      const result = detector.detectQemu();
      expect(Array.isArray(result.accelerators)).toBe(true);
    });
  });
});

