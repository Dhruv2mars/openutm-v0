import { ChildProcess, spawn as defaultSpawn } from 'child_process';
import { DisplayProtocol, DisplaySessionStatus, type DisplaySession } from '@openutm/shared-types';
import { getVMConfig } from '../config';
import { connectQMP as defaultConnectQMP } from './qmp';
import { detectQemu as defaultDetectQemu } from './detector';
import {
  closeAllSpiceProxies as defaultCloseAllSpiceProxies,
  closeSpiceProxy as defaultCloseSpiceProxy,
  ensureSpiceProxy as defaultEnsureSpiceProxy,
} from './spice-proxy';

interface VMProcess {
  id: string;
  process: ChildProcess;
  qmpSocket?: string;
  spicePort?: number;
}

interface VMConfig {
  id: string;
  name: string;
  memory: number;
  cores: number;
  disk: string;
  qmpSocket?: string;
  accelerator?: string;
  installMediaPath?: string;
  bootOrder?: 'disk-first' | 'cdrom-first';
  networkType?: 'nat' | 'bridge';
}

const runningVMs = new Map<string, VMProcess>();
const pausedVMs = new Set<string>();
const displaySessions = new Map<string, DisplaySession>();
let spawnFn = defaultSpawn;
let connectQMPFn = defaultConnectQMP;
let detectQemuFn = defaultDetectQemu;
let ensureSpiceProxyFn = defaultEnsureSpiceProxy;
let closeSpiceProxyFn = defaultCloseSpiceProxy;
let closeAllSpiceProxiesFn = defaultCloseAllSpiceProxies;

export function setSpawnFn(fn: typeof defaultSpawn): void {
  spawnFn = fn;
}

export function setConnectQMPFn(fn: typeof defaultConnectQMP): void {
  connectQMPFn = fn;
}

export function setDetectQemuFn(fn: typeof defaultDetectQemu): void {
  detectQemuFn = fn;
}

export function setSpiceProxyFnsForTests(
  fns: Partial<{
    ensure: typeof defaultEnsureSpiceProxy;
    close: typeof defaultCloseSpiceProxy;
    closeAll: typeof defaultCloseAllSpiceProxies;
  }>,
): void {
  if (fns.ensure) {
    ensureSpiceProxyFn = fns.ensure;
  }
  if (fns.close) {
    closeSpiceProxyFn = fns.close;
  }
  if (fns.closeAll) {
    closeAllSpiceProxiesFn = fns.closeAll;
  }
}

export function resetRuntimeStateForTests(): void {
  runningVMs.clear();
  pausedVMs.clear();
  displaySessions.clear();
  void closeAllSpiceProxiesFn();
  ensureSpiceProxyFn = defaultEnsureSpiceProxy;
  closeSpiceProxyFn = defaultCloseSpiceProxy;
  closeAllSpiceProxiesFn = defaultCloseAllSpiceProxies;
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
  void closeSpiceProxyFn(vmId);
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

    const detection = await detectQemuFn();
    if (!detection.spiceSupported) {
      throw new Error('SPICE runtime unavailable. Install OpenUTM Runtime to continue.');
    }

    const detectedAccelerators = detection.accelerators.length > 0 ? detection.accelerators : ['tcg'];
    const accelerator =
      vmConfig.accelerator && detectedAccelerators.includes(vmConfig.accelerator)
        ? vmConfig.accelerator
        : detectedAccelerators[0];
    const runtimeConfig: VMConfig = {
      ...vmConfig,
      accelerator,
    };

    const args = buildQemuArgs(runtimeConfig);
    const qemuProcess = spawnFn(detection.path, args, { stdio: 'ignore' });

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
      void closeSpiceProxyFn(vmId);
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
    await closeSpiceProxyFn(vmId);
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
    '-drive', `file=${config.disk},if=virtio,format=qcow2`,
    '-display', 'none',
    '-spice', `port=${spicePort},addr=127.0.0.1,disable-ticketing=on`,
  ];

  if (config.installMediaPath) {
    args.push('-drive', `file=${config.installMediaPath},media=cdrom,readonly=on`);
  }

  const bootOrder = config.bootOrder || 'disk-first';
  if (bootOrder === 'cdrom-first' && config.installMediaPath) {
    args.push('-boot', 'order=dc,menu=on');
  } else {
    args.push('-boot', 'order=cd,menu=on');
  }

  args.push(
    '-netdev',
    `user,id=net0${config.networkType === 'bridge' ? ',ipv6=on' : ''}`,
    '-device',
    'virtio-net-pci,netdev=net0',
  );

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
  if (!vm.spicePort) {
    throw new Error('SPICE display unavailable: active runtime is not SPICE-capable');
  }

  const existing = displaySessions.get(vmId);
  if (existing) {
    if (existing.status === DisplaySessionStatus.Disconnected || existing.status === DisplaySessionStatus.Error) {
      const websocketUri = await ensureSpiceProxyFn(vmId, '127.0.0.1', vm.spicePort);
      const next: DisplaySession = {
        ...existing,
        websocketUri,
        status: DisplaySessionStatus.Connected,
        reconnectAttempts: existing.reconnectAttempts + 1,
        lastError: undefined,
      };
      displaySessions.set(vmId, next);
      return next;
    }
    return existing;
  }

  const websocketUri = await ensureSpiceProxyFn(vmId, '127.0.0.1', vm.spicePort);
  const session: DisplaySession = {
    vmId,
    protocol: DisplayProtocol.Spice,
    host: '127.0.0.1',
    port: vm.spicePort,
    uri: `spice://127.0.0.1:${vm.spicePort}`,
    websocketUri,
    status: DisplaySessionStatus.Connected,
    reconnectAttempts: 0,
  };

  displaySessions.set(vmId, session);
  return session;
}

export function getDisplaySession(vmId: string): DisplaySession | null {
  return displaySessions.get(vmId) || null;
}

export async function closeDisplaySession(vmId: string): Promise<{ success: boolean }> {
  const existing = displaySessions.get(vmId);
  if (!existing) {
    return { success: true };
  }

  displaySessions.set(vmId, {
    ...existing,
    status: DisplaySessionStatus.Disconnected,
    lastError: 'Display session closed',
  });
  await closeSpiceProxyFn(vmId);
  return { success: true };
}
