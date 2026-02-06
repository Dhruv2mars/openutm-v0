import { ChildProcess, spawn as defaultSpawn } from 'child_process';
import { DisplayProtocol, DisplaySessionStatus, type DisplaySession } from '@openutm/shared-types';
import { getVMConfig } from '../config';
import { connectQMP as defaultConnectQMP } from './qmp';

interface VMProcess {
  id: string;
  process: ChildProcess;
  qmpSocket?: string;
  spicePort: number;
}

interface VMConfig {
  id: string;
  name: string;
  memory: number;
  cores: number;
  disk: string;
  qmpSocket?: string;
  accelerator?: string;
}

const runningVMs = new Map<string, VMProcess>();
const pausedVMs = new Set<string>();
const displaySessions = new Map<string, DisplaySession>();
let spawnFn = defaultSpawn;
let connectQMPFn = defaultConnectQMP;

export function setSpawnFn(fn: typeof defaultSpawn): void {
  spawnFn = fn;
}

export function setConnectQMPFn(fn: typeof defaultConnectQMP): void {
  connectQMPFn = fn;
}

export function resetRuntimeStateForTests(): void {
  runningVMs.clear();
  pausedVMs.clear();
  displaySessions.clear();
}

export function resolveSpicePort(vmId: string): number {
  let hash = 0;
  for (const ch of vmId) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 1000;
  }
  return 5900 + hash;
}

function markDisplayDisconnected(vmId: string, reason: string): void {
  const existing = displaySessions.get(vmId);
  if (!existing) return;
  displaySessions.set(vmId, {
    ...existing,
    status: DisplaySessionStatus.Disconnected,
    lastError: reason,
  });
}

// For testing: allow passing config directly
export async function startVM(vmId: string, config?: VMConfig): Promise<{ vmId: string; pid: number }> {
  try {
    let vmConfig: VMConfig | null | undefined = config;
    if (!vmConfig) {
      vmConfig = await getVMConfig(vmId);
      if (!vmConfig) {
        throw new Error(`VM ${vmId} not found`);
      }
    }

    const args = buildQemuArgs(vmConfig);
    const qemuProcess = spawnFn('qemu-system-x86_64', args);

    if (!qemuProcess.pid) {
      throw new Error('Failed to spawn QEMU process');
    }

    const spicePort = resolveSpicePort(vmId);
    runningVMs.set(vmId, {
      id: vmId,
      process: qemuProcess,
      qmpSocket: vmConfig.qmpSocket,
      spicePort,
    });
    pausedVMs.delete(vmId);

    qemuProcess.on('exit', () => {
      markDisplayDisconnected(vmId, 'VM exited');
      runningVMs.delete(vmId);
      pausedVMs.delete(vmId);
    });

    return { vmId, pid: qemuProcess.pid };
  } catch (err) {
    throw new Error(`Failed to start VM: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function stopVM(vmId: string): Promise<{ vmId: string; success: boolean }> {
  try {
    const vm = runningVMs.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not running`);
    }

    if (vm.qmpSocket) {
      try {
        const qmp = await connectQMPFn(vm.qmpSocket);
        await qmp.executeCommand('quit');
        qmp.disconnect();
      } catch (err) {
        vm.process.kill('SIGTERM');
      }
    } else {
      vm.process.kill('SIGTERM');
    }

    runningVMs.delete(vmId);
    pausedVMs.delete(vmId);
    markDisplayDisconnected(vmId, 'VM stopped');
    return { vmId, success: true };
  } catch (err) {
    throw new Error(`Failed to stop VM: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function pauseVM(vmId: string): Promise<{ vmId: string; success: boolean }> {
  try {
    const vm = runningVMs.get(vmId);
    if (!vm || !vm.qmpSocket) {
      throw new Error(`VM ${vmId} not running or QMP unavailable`);
    }

    const qmp = await connectQMPFn(vm.qmpSocket);
    await qmp.executeCommand('stop');
    qmp.disconnect();
    pausedVMs.add(vmId);

    return { vmId, success: true };
  } catch (err) {
    throw new Error(`Failed to pause VM: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function resumeVM(vmId: string): Promise<{ vmId: string; success: boolean }> {
  try {
    const vm = runningVMs.get(vmId);
    if (!vm || !vm.qmpSocket) {
      throw new Error(`VM ${vmId} not running or QMP unavailable`);
    }

    const qmp = await connectQMPFn(vm.qmpSocket);
    await qmp.executeCommand('cont');
    qmp.disconnect();
    pausedVMs.delete(vmId);

    return { vmId, success: true };
  } catch (err) {
    throw new Error(`Failed to resume VM: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function buildQemuArgs(config: VMConfig): string[] {
  const spicePort = resolveSpicePort(config.id);
  const args: string[] = [
    '-m', config.memory.toString(),
    '-smp', `cores=${config.cores}`,
    '-hda', config.disk,
    '-spice', `port=${spicePort},addr=127.0.0.1,disable-ticketing=on`,
  ];

  if (config.accelerator) {
    args.push('-accel', config.accelerator);
  }

  if (config.qmpSocket) {
    args.push('-qmp', `unix:${config.qmpSocket},server=on,wait=off`);
  }

  args.push('-name', config.name);

  return args;
}

export function getRunningVMs(): string[] {
  return Array.from(runningVMs.keys());
}

export function isVMRunning(vmId: string): boolean {
  return runningVMs.has(vmId);
}

export function getVmRuntimeStatus(vmId: string): 'running' | 'paused' | 'stopped' {
  if (!runningVMs.has(vmId)) {
    return 'stopped';
  }
  if (pausedVMs.has(vmId)) {
    return 'paused';
  }
  return 'running';
}

export async function openDisplaySession(vmId: string): Promise<DisplaySession> {
  const vm = runningVMs.get(vmId);
  if (!vm) {
    throw new Error(`VM ${vmId} not running`);
  }

  const existing = displaySessions.get(vmId);
  if (existing) {
    if (existing.status === DisplaySessionStatus.Disconnected || existing.status === DisplaySessionStatus.Error) {
      const next: DisplaySession = {
        ...existing,
        status: DisplaySessionStatus.Connected,
        reconnectAttempts: existing.reconnectAttempts + 1,
        lastError: undefined,
      };
      displaySessions.set(vmId, next);
      return next;
    }
    return existing;
  }

  const session: DisplaySession = {
    vmId,
    protocol: DisplayProtocol.Spice,
    host: '127.0.0.1',
    port: vm.spicePort,
    uri: `spice://127.0.0.1:${vm.spicePort}`,
    status: DisplaySessionStatus.Connected,
    reconnectAttempts: 0,
  };

  displaySessions.set(vmId, session);
  return session;
}

export function getDisplaySession(vmId: string): DisplaySession | null {
  return displaySessions.get(vmId) || null;
}

export function closeDisplaySession(vmId: string): { success: boolean } {
  const existing = displaySessions.get(vmId);
  if (!existing) {
    return { success: true };
  }

  displaySessions.set(vmId, {
    ...existing,
    status: DisplaySessionStatus.Disconnected,
    lastError: 'Display session closed',
  });
  return { success: true };
}
