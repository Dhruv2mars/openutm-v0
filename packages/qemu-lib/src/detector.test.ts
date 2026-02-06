import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as detector from './detector';
import { Accelerator } from '@openutm/shared-types';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
const mockedExecSync = execSync as any;

describe('QEMU Detection', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

  const setPlatform = (value: string) => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    if (originalPlatformDescriptor) {
      Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }
  });

  afterEach(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }
  });

  describe('detectQemu', () => {
    it('should detect qemu with version and accelerator', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-x86_64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        if (cmd.includes('sysctl')) {
          throw new Error('Not macOS');
        }
        return '';
      });

      const result = await detector.detectQemu();

      expect(result).toBeDefined();
      expect(result.available).toBe(true);
      if (result.version) {
        expect(result.version).toContain('8.0.0');
      }
    });

    it('should return unavailable if qemu not found', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = await detector.detectQemu();

      expect(result.available).toBe(false);
      expect(result.path).toBeNull();
    });

    it('should return TCG accelerator as fallback', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = await detector.detectQemu();

      expect(result.accelerators).toContain(Accelerator.TCG);
    });

    it('should include HVF on darwin when hypervisor is supported', async () => {
      setPlatform('darwin');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        if (cmd.includes('sysctl kern.hv_support')) {
          return 'kern.hv_support: 1';
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toContain(Accelerator.HVF);
    });

    it('should continue when qemu version lookup fails', async () => {
      setPlatform('darwin');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          throw new Error('version failed');
        }
        if (cmd.includes('sysctl kern.hv_support')) {
          return 'kern.hv_support: 1';
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.available).toBe(true);
      expect(result.version).toBeNull();
    });

    it('should include WHPX on win32 when feature is available', async () => {
      setPlatform('win32');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        if (cmd.includes('Get-WindowsOptionalFeature')) {
          return 'Enabled';
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toContain(Accelerator.WHPX);
    });

    it('should fall back to TCG on linux when KVM detection fails', async () => {
      setPlatform('linux');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        if (cmd.includes('test -e /dev/kvm')) {
          throw new Error('kvm not available');
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toEqual([Accelerator.TCG]);
    });

    it('should fall back to TCG on win32 when WHPX detection fails', async () => {
      setPlatform('win32');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        if (cmd.includes('Get-WindowsOptionalFeature')) {
          throw new Error('feature query failed');
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toEqual([Accelerator.TCG]);
    });

    it('should keep TCG only on unknown platforms', async () => {
      setPlatform('sunos');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toEqual([Accelerator.TCG]);
    });
  });

  describe('getQemuPath', () => {
    it('should return qemu path if available', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '/usr/bin/qemu-system-x86_64\n';
        }
        return '';
      });

      const path = await detector.getQemuPath();

      expect(path).toBeTruthy();
      expect(path).toContain('qemu');
    });

    it('should return null if qemu not found', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const path = await detector.getQemuPath();

      expect(path).toBeNull();
    });

    it('should try multiple qemu candidates', async () => {
      let callCount = 0;
      mockedExecSync.mockImplementation((cmd: string) => {
        callCount++;
        throw new Error('not found');
      });

      const path = await detector.getQemuPath();

      expect(path).toBeNull();
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe('checkVersion', () => {
    it('should return true for version >= 6.0', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '/usr/bin/qemu\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        return '';
      });

      const isValid = await detector.checkVersion();

      expect(isValid).toBe(true);
    });

    it('should return false for version < 6.0', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '/usr/bin/qemu\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 5.0.0\n';
        }
        return '';
      });

      const isValid = await detector.checkVersion();

      expect(isValid).toBe(false);
    });

    it('should return false if qemu not found', async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const isValid = await detector.checkVersion();

      expect(isValid).toBe(false);
    });

    it('should return false when version output is malformed', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '/usr/bin/qemu\n';
        }
        if (cmd.includes('--version')) {
          return 'not-a-version\n';
        }
        return '';
      });

      const isValid = await detector.checkVersion();
      expect(isValid).toBe(false);
    });

    it('should return false when version command throws', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '/usr/bin/qemu\n';
        }
        if (cmd.includes('--version')) {
          throw new Error('exec failed');
        }
        return '';
      });

      const isValid = await detector.checkVersion();
      expect(isValid).toBe(false);
    });
  });

  describe('getInstallSuggestion', () => {
    it('should return a suggestion string', async () => {
      const suggestion = await detector.getInstallSuggestion();

      expect(typeof suggestion).toBe('string');
      expect(suggestion.length > 0).toBe(true);
    });

    it('should mention qemu', async () => {
      const suggestion = await detector.getInstallSuggestion();

      expect(suggestion.toLowerCase()).toContain('qemu');
    });

    it('should provide installation method', async () => {
      const suggestion = await detector.getInstallSuggestion();

      expect(suggestion.toLowerCase()).toMatch(/brew|apt|dnf|choco|download/i);
    });

    it('should return linux instructions on linux platform', async () => {
      setPlatform('linux');
      const suggestion = await detector.getInstallSuggestion();
      expect(suggestion).toContain('apt install');
    });

    it('should return windows instructions on windows platform', async () => {
      setPlatform('win32');
      const suggestion = await detector.getInstallSuggestion();
      expect(suggestion).toContain('Chocolatey');
    });

    it('should return generic instructions on unknown platform', async () => {
      setPlatform('sunos');
      const suggestion = await detector.getInstallSuggestion();
      expect(suggestion).toContain('https://www.qemu.org/download/');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed version string gracefully', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '/usr/bin/qemu\n';
        }
        if (cmd.includes('--version')) {
          return 'Invalid version output\n';
        }
        return '';
      });

      const result = await detector.detectQemu();

      expect(result).toBeDefined();
      expect(result.available).toBe(true);
    });

    it('should handle empty execution results', async () => {
      mockedExecSync.mockImplementation(() => '');

      const path = await detector.getQemuPath();

      expect(path).toBeNull();
    });

    it('should handle permission errors gracefully', async () => {
      mockedExecSync.mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        throw error;
      });

      const path = await detector.getQemuPath();

      expect(path).toBeNull();
    });

    it('should trim whitespace from paths', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) {
          return '  /usr/bin/qemu-system-x86_64  \n\n';
        }
        return '';
      });

      const path = await detector.getQemuPath();

      expect(path).toBe('/usr/bin/qemu-system-x86_64');
    });

    it('should include KVM accelerator on linux when available', async () => {
      setPlatform('linux');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          throw new Error('not found');
        }
        if (cmd.includes('test -e /dev/kvm')) {
          return '';
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toContain(Accelerator.KVM);
    });

    it('should include WHPX accelerator on win32 when available', async () => {
      setPlatform('win32');
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          throw new Error('not found');
        }
        if (cmd.includes('Get-WindowsOptionalFeature')) {
          return '';
        }
        return '';
      });

      const result = await detector.detectQemu();
      expect(result.accelerators).toContain(Accelerator.WHPX);
    });

    it('should fall back through detectQemu outer catch when platform getter throws', async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which qemu-system')) {
          return '/usr/local/bin/qemu-system-aarch64\n';
        }
        if (cmd.includes('--version')) {
          return 'QEMU emulator version 8.0.0\n';
        }
        return '';
      });

      Object.defineProperty(process, 'platform', {
        configurable: true,
        get() {
          throw new Error('platform read failed');
        },
      });

      const result = await detector.detectQemu();
      expect(result.available).toBe(false);
      expect(result.path).toBeNull();
    });
  });
});
