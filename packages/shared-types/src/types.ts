/**
 * Core type definitions for OpenUTM
 */

/**
 * Supported platforms for VM execution
 */
export enum Platform {
  macOS = 'macos',
  Linux = 'linux',
  Windows = 'windows',
}

/**
 * Supported CPU accelerators per platform
 */
export enum Accelerator {
  HVF = 'hvf', // macOS Hypervisor Framework
  KVM = 'kvm', // Linux KVM
  WHPX = 'whpx', // Windows Hyper-V
  TCG = 'tcg', // Tiny Code Generator (fallback)
}

/**
 * Virtual machine execution status
 */
export enum VMStatus {
  Stopped = 'stopped',
  Running = 'running',
  Paused = 'paused',
  Error = 'error',
}

/**
 * Display protocol used for VM graphics session
 */
export enum DisplayProtocol {
  Spice = 'spice',
}

/**
 * Display session lifecycle state
 */
export enum DisplaySessionStatus {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

/**
 * Virtual disk configuration
 */
export interface Disk {
  path: string;
  size: number; // in bytes
  format: 'qcow2' | 'raw';
}

/**
 * Network configuration for VMs
 */
export interface NetworkConfig {
  type: 'nat' | 'bridge';
  config?: Record<string, unknown>;
}

/**
 * Virtual machine configuration
 */
export interface VMConfig {
  cpu: number;
  memory: number; // in MB
  disks: Disk[];
  network: NetworkConfig;
  installMediaPath?: string;
  bootOrder: 'disk-first' | 'cdrom-first';
  networkType: 'nat' | 'bridge';
}

/**
 * Virtual machine definition
 */
export interface VM {
  id: string;
  name: string;
  status: VMStatus;
  config: VMConfig;
}

/**
 * Display session descriptor for a running VM
 */
export interface DisplaySession {
  vmId: string;
  protocol: DisplayProtocol;
  host: string;
  port: number;
  uri: string;
  websocketUri?: string;
  status: DisplaySessionStatus;
  reconnectAttempts: number;
  lastError?: string;
  connectedAt?: string;
}

/**
 * System capabilities and platform info
 */
export interface SystemInfo {
  platform: Platform;
  accelerator: Accelerator;
  cpuCount: number;
  totalMemory: number; // in MB
}
