// Core type definitions
export { Platform, Accelerator, VMStatus } from './types.js';
export type { Disk, NetworkConfig, VMConfig, VM, SystemInfo } from './types.js';

// Zod validation schemas
export {
  PlatformSchema,
  AcceleratorSchema,
  VMStatusSchema,
  DiskSchema,
  NetworkConfigSchema,
  VMConfigSchema,
  VMSchema,
  SystemInfoSchema,
} from './schemas.js';
export type {
  ValidatedVM,
  ValidatedVMConfig,
  ValidatedDisk,
  ValidatedNetworkConfig,
  ValidatedSystemInfo,
} from './schemas.js';
