import { ChildProcess, spawn as defaultSpawn } from 'child_process';
import { getVMConfig } from '../config';
import { connectQMP as defaultConnectQMP } from './qmp';

interface VMProcess {
  id: string;
  process: ChildProcess;
  qmpSocket?: string;
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
let spawnFn = defaultSpawn;
let connectQMPFn = defaultConnectQMP;

export function setSpawnFn(fn: typeof defaultSpawn): void {
  spawnFn = fn;
}

export function setConnectQMPFn(fn: typeof defaultConnectQMP): void {
  connectQMPFn = fn;
}

// For testing: allow passing config directly
export async function startVM(vmId: string, config?: VMConfig): Promise<{ vmId: string; pid: number }> {
  try {
    let vmConfig = config;
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

    runningVMs.set(vmId, {
      id: vmId,
      process: qemuProcess,
      qmpSocket: vmConfig.qmpSocket
    });

    qemuProcess.on('exit', () => {
      runningVMs.delete(vmId);
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

    return { vmId, success: true };
  } catch (err) {
    throw new Error(`Failed to resume VM: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function buildQemuArgs(config: VMConfig): string[] {
  const args: string[] = [
    '-m', config.memory.toString(),
    '-smp', `cores=${config.cores}`,
    '-hda', config.disk
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
