import { describe, it, expect } from 'vitest';
import {
  VMStatusSchema,
  VMConfigSchema,
  VMSchema,
  DiskSchema,
  NetworkConfigSchema,
  SystemInfoSchema,
  AcceleratorSchema,
  PlatformSchema,
} from '../src/schemas.js';
import { VMStatus, Platform, Accelerator } from '../src/types.js';

describe('Zod Schemas', () => {
  describe('PlatformSchema', () => {
    it('validates valid platforms', () => {
      expect(() => PlatformSchema.parse(Platform.macOS)).not.toThrow();
      expect(() => PlatformSchema.parse(Platform.Linux)).not.toThrow();
      expect(() => PlatformSchema.parse(Platform.Windows)).not.toThrow();
    });

    it('rejects invalid platforms', () => {
      expect(() => PlatformSchema.parse('darwin')).toThrow();
      expect(() => PlatformSchema.parse('invalid')).toThrow();
    });
  });

  describe('AcceleratorSchema', () => {
    it('validates valid accelerators', () => {
      expect(() => AcceleratorSchema.parse(Accelerator.HVF)).not.toThrow();
      expect(() => AcceleratorSchema.parse(Accelerator.KVM)).not.toThrow();
      expect(() => AcceleratorSchema.parse(Accelerator.WHPX)).not.toThrow();
      expect(() => AcceleratorSchema.parse(Accelerator.TCG)).not.toThrow();
    });

    it('rejects invalid accelerators', () => {
      expect(() => AcceleratorSchema.parse('xen')).toThrow();
    });
  });

  describe('VMStatusSchema', () => {
    it('validates valid statuses', () => {
      expect(() => VMStatusSchema.parse(VMStatus.Stopped)).not.toThrow();
      expect(() => VMStatusSchema.parse(VMStatus.Running)).not.toThrow();
      expect(() => VMStatusSchema.parse(VMStatus.Paused)).not.toThrow();
      expect(() => VMStatusSchema.parse(VMStatus.Error)).not.toThrow();
    });

    it('rejects invalid statuses', () => {
      expect(() => VMStatusSchema.parse('starting')).toThrow();
    });
  });

  describe('DiskSchema', () => {
    it('validates valid disk configurations', () => {
      expect(() =>
        DiskSchema.parse({
          path: '/path/to/disk.qcow2',
          size: 1073741824, // 1 GB
          format: 'qcow2',
        })
      ).not.toThrow();

      expect(() =>
        DiskSchema.parse({
          path: '/path/to/disk.img',
          size: 2147483648, // 2 GB
          format: 'raw',
        })
      ).not.toThrow();
    });

    it('rejects empty path', () => {
      const result = DiskSchema.safeParse({
        path: '',
        size: 1073741824,
        format: 'qcow2',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive size', () => {
      const result = DiskSchema.safeParse({
        path: '/path/to/disk.qcow2',
        size: 0,
        format: 'qcow2',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid disk format', () => {
      const result = DiskSchema.safeParse({
        path: '/path/to/disk.vdi',
        size: 1073741824,
        format: 'vdi' as 'qcow2' | 'raw',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NetworkConfigSchema', () => {
    it('validates valid NAT network config', () => {
      expect(() =>
        NetworkConfigSchema.parse({
          type: 'nat',
        })
      ).not.toThrow();
    });

    it('validates valid bridge network config', () => {
      expect(() =>
        NetworkConfigSchema.parse({
          type: 'bridge',
          config: { interface: 'eth0' },
        })
      ).not.toThrow();
    });

    it('rejects invalid network type', () => {
      const result = NetworkConfigSchema.safeParse({
        type: 'vpn' as 'nat' | 'bridge',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('VMConfigSchema', () => {
    const validDisk = {
      path: '/path/to/disk.qcow2',
      size: 1073741824,
      format: 'qcow2' as const,
    };

    it('validates valid VM config', () => {
      expect(() =>
        VMConfigSchema.parse({
          cpu: 4,
          memory: 8192,
          disks: [validDisk],
          network: { type: 'nat' },
        })
      ).not.toThrow();
    });

    it('rejects zero CPUs', () => {
      const result = VMConfigSchema.safeParse({
        cpu: 0,
        memory: 8192,
        disks: [validDisk],
        network: { type: 'nat' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero memory', () => {
      const result = VMConfigSchema.safeParse({
        cpu: 4,
        memory: 0,
        disks: [validDisk],
        network: { type: 'nat' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty disk array', () => {
      const result = VMConfigSchema.safeParse({
        cpu: 4,
        memory: 8192,
        disks: [],
        network: { type: 'nat' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('VMSchema', () => {
    const validVM = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test VM',
      status: VMStatus.Stopped,
      config: {
        cpu: 4,
        memory: 8192,
        disks: [
          {
            path: '/path/to/disk.qcow2',
            size: 1073741824,
            format: 'qcow2' as const,
          },
        ],
        network: { type: 'nat' },
      },
    };

    it('validates valid VM', () => {
      expect(() => VMSchema.parse(validVM)).not.toThrow();
    });

    it('rejects invalid UUID', () => {
      const result = VMSchema.safeParse({
        ...validVM,
        id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = VMSchema.safeParse({
        ...validVM,
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid status', () => {
      const result = VMSchema.safeParse({
        ...validVM,
        status: 'booting' as VMStatus,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SystemInfoSchema', () => {
    it('validates valid system info', () => {
      expect(() =>
        SystemInfoSchema.parse({
          platform: Platform.macOS,
          accelerator: Accelerator.HVF,
          cpuCount: 8,
          totalMemory: 16384,
        })
      ).not.toThrow();
    });

    it('rejects zero CPU count', () => {
      const result = SystemInfoSchema.safeParse({
        platform: Platform.Linux,
        accelerator: Accelerator.KVM,
        cpuCount: 0,
        totalMemory: 16384,
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero memory', () => {
      const result = SystemInfoSchema.safeParse({
        platform: Platform.Windows,
        accelerator: Accelerator.WHPX,
        cpuCount: 8,
        totalMemory: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
