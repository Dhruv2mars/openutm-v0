/**
 * Zod validation schemas for OpenUTM types
 * Used for runtime validation of API responses and configuration
 */

import { z } from 'zod';
import { DisplayProtocol, DisplaySessionStatus, Platform, Accelerator, VMStatus } from './types.js';

export const PlatformSchema = z.enum([
  Platform.macOS,
  Platform.Linux,
  Platform.Windows,
]);

export const AcceleratorSchema = z.enum([
  Accelerator.HVF,
  Accelerator.KVM,
  Accelerator.WHPX,
  Accelerator.TCG,
]);

export const VMStatusSchema = z.enum([
  VMStatus.Stopped,
  VMStatus.Running,
  VMStatus.Paused,
  VMStatus.Error,
]);

export const DisplayProtocolSchema = z.enum([
  DisplayProtocol.Spice,
]);

export const DisplaySessionStatusSchema = z.enum([
  DisplaySessionStatus.Connecting,
  DisplaySessionStatus.Connected,
  DisplaySessionStatus.Disconnected,
  DisplaySessionStatus.Error,
]);

export const DiskSchema = z.object({
  path: z.string().min(1, 'Disk path cannot be empty'),
  size: z.number().int().positive('Disk size must be positive'),
  format: z.enum(['qcow2', 'raw']),
});

export const NetworkConfigSchema = z.object({
  type: z.enum(['nat', 'bridge']),
  config: z.record(z.unknown()).optional(),
});

export const VMConfigSchema = z.object({
  cpu: z.number().int().positive('CPU count must be positive'),
  memory: z.number().int().positive('Memory must be positive'),
  disks: z.array(DiskSchema).min(1, 'At least one disk is required'),
  network: NetworkConfigSchema,
  installMediaPath: z.string().min(1).optional(),
  bootOrder: z.enum(['disk-first', 'cdrom-first']).default('disk-first'),
  networkType: z.enum(['nat', 'bridge']).default('nat'),
});

export const VMSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
  name: z.string().min(1, 'VM name cannot be empty'),
  status: VMStatusSchema,
  config: VMConfigSchema,
});

export const DisplaySessionSchema = z.object({
  vmId: z.string().uuid('VM ID must be a valid UUID'),
  protocol: DisplayProtocolSchema,
  host: z.string().min(1, 'Display host cannot be empty'),
  port: z.number().int().positive('Display port must be positive').max(65535, 'Display port out of range'),
  uri: z.string().min(1, 'Display URI cannot be empty'),
  websocketUri: z.string().url().optional(),
  status: DisplaySessionStatusSchema,
  reconnectAttempts: z.number().int().nonnegative('Reconnect attempts cannot be negative'),
  lastError: z.string().min(1).optional(),
  connectedAt: z.string().datetime().optional(),
});

export const SystemInfoSchema = z.object({
  platform: PlatformSchema,
  accelerator: AcceleratorSchema,
  cpuCount: z.number().int().positive('CPU count must be positive'),
  totalMemory: z.number().int().positive('Total memory must be positive'),
});

// Type inference from schemas (useful for type-safe schema validation)
export type ValidatedVM = z.infer<typeof VMSchema>;
export type ValidatedDisplaySession = z.infer<typeof DisplaySessionSchema>;
export type ValidatedVMConfig = z.infer<typeof VMConfigSchema>;
export type ValidatedDisk = z.infer<typeof DiskSchema>;
export type ValidatedNetworkConfig = z.infer<typeof NetworkConfigSchema>;
export type ValidatedSystemInfo = z.infer<typeof SystemInfoSchema>;
