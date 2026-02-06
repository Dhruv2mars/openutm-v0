// Core type definitions
export { Platform, Accelerator, VMStatus, DisplayProtocol, DisplaySessionStatus } from './types.js';
export type { Disk, NetworkConfig, VMConfig, VM, SystemInfo, DisplaySession } from './types.js';

// Zod validation schemas
export {
  PlatformSchema,
  AcceleratorSchema,
  VMStatusSchema,
  DisplayProtocolSchema,
  DisplaySessionStatusSchema,
  DiskSchema,
  NetworkConfigSchema,
  VMConfigSchema,
  VMSchema,
  DisplaySessionSchema,
  SystemInfoSchema,
} from './schemas.js';
export type {
  ValidatedVM,
  ValidatedDisplaySession,
  ValidatedVMConfig,
  ValidatedDisk,
  ValidatedNetworkConfig,
  ValidatedSystemInfo,
} from './schemas.js';
