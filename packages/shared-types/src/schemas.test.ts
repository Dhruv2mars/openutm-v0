import { describe, it, expect } from 'vitest';
import {
  VMStatusSchema,
  DisplayProtocolSchema,
  DisplaySessionStatusSchema,
  VMConfigSchema,
  VMSchema,
  DisplaySessionSchema,
  DiskSchema,
  NetworkConfigSchema,
  SystemInfoSchema,
  AcceleratorSchema,
  PlatformSchema,
} from '../src/schemas.js';
import { VMStatus, Platform, Accelerator, DisplayProtocol, DisplaySessionStatus } from '../src/types.js';

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

  describe('DisplayProtocolSchema', () => {
    it('validates display protocol', () => {
      expect(() => DisplayProtocolSchema.parse(DisplayProtocol.Spice)).not.toThrow();
    });

    it('rejects invalid display protocol', () => {
      expect(() => DisplayProtocolSchema.parse('vnc')).toThrow();
    });
  });

  describe('DisplaySessionStatusSchema', () => {
    it('validates display session statuses', () => {
      expect(() => DisplaySessionStatusSchema.parse(DisplaySessionStatus.Connecting)).not.toThrow();
      expect(() => DisplaySessionStatusSchema.parse(DisplaySessionStatus.Connected)).not.toThrow();
      expect(() => DisplaySessionStatusSchema.parse(DisplaySessionStatus.Disconnected)).not.toThrow();
      expect(() => DisplaySessionStatusSchema.parse(DisplaySessionStatus.Error)).not.toThrow();
    });

    it('rejects invalid display session status', () => {
      expect(() => DisplaySessionStatusSchema.parse('closed')).toThrow();
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
          bootOrder: 'disk-first',
          networkType: 'nat',
        })
      ).not.toThrow();
    });

    it('rejects zero CPUs', () => {
      const result = VMConfigSchema.safeParse({
        cpu: 0,
        memory: 8192,
        disks: [validDisk],
        network: { type: 'nat' },
        bootOrder: 'disk-first',
        networkType: 'nat',
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero memory', () => {
      const result = VMConfigSchema.safeParse({
        cpu: 4,
        memory: 0,
        disks: [validDisk],
        network: { type: 'nat' },
        bootOrder: 'disk-first',
        networkType: 'nat',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty disk array', () => {
      const result = VMConfigSchema.safeParse({
        cpu: 4,
        memory: 8192,
        disks: [],
        network: { type: 'nat' },
        bootOrder: 'disk-first',
        networkType: 'nat',
      });
      expect(result.success).toBe(false);
    });

    it('fills defaults for legacy config missing boot/network fields', () => {
      const parsed = VMConfigSchema.parse({
        cpu: 2,
        memory: 2048,
        disks: [validDisk],
        network: { type: 'nat' },
      });
      expect(parsed.bootOrder).toBe('disk-first');
      expect(parsed.networkType).toBe('nat');
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
        bootOrder: 'disk-first' as const,
        networkType: 'nat' as const,
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

  describe('DisplaySessionSchema', () => {
    const validSession = {
      vmId: '550e8400-e29b-41d4-a716-446655440000',
      protocol: DisplayProtocol.Spice,
      host: '127.0.0.1',
      port: 5901,
      uri: 'spice://127.0.0.1:5901',
      status: DisplaySessionStatus.Connected,
      reconnectAttempts: 1,
    };

    it('validates a display session', () => {
      expect(() => DisplaySessionSchema.parse(validSession)).not.toThrow();
    });

    it('accepts optional connectedAt timestamp', () => {
      const parsed = DisplaySessionSchema.parse({
        ...validSession,
        connectedAt: '2026-02-06T07:00:00.000Z',
      });
      expect(parsed.connectedAt).toBe('2026-02-06T07:00:00.000Z');
    });

    it('accepts optional websocket URI', () => {
      const parsed = DisplaySessionSchema.parse({
        ...validSession,
        websocketUri: 'ws://127.0.0.1:5960/spice/test',
      });
      expect(parsed.websocketUri).toBe('ws://127.0.0.1:5960/spice/test');
    });

    it('rejects invalid websocket URI', () => {
      const result = DisplaySessionSchema.safeParse({
        ...validSession,
        websocketUri: 'not-a-uri',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid connectedAt timestamp', () => {
      const result = DisplaySessionSchema.safeParse({
        ...validSession,
        connectedAt: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid port', () => {
      const result = DisplaySessionSchema.safeParse({ ...validSession, port: 70000 });
      expect(result.success).toBe(false);
    });

    it('rejects negative reconnect attempts', () => {
      const result = DisplaySessionSchema.safeParse({ ...validSession, reconnectAttempts: -1 });
      expect(result.success).toBe(false);
    });
  });
});
