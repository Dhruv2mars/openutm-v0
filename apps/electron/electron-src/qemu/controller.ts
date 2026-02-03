import { ChildProcess, spawn } from 'child_process';
import { getVMConfig } from '../config';
import { connectQMP } from './qmp';

interface VMProcess {
  id: string;
  process: ChildProcess;
  qmpSocket?: string;
}

const runningVMs = new Map<string, VMProcess>();

export async function startVM(vmId: string): Promise<{ vmId: string; pid: number }> {
  try {
    const vmConfig = await getVMConfig(vmId);
    if (!vmConfig) {
      throw new Error(`VM ${vmId} not found`);
    }

    const args = buildQemuArgs(vmConfig);
    const qemuProcess = spawn('qemu-system-x86_64', args);

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
      const qmp = await connectQMP(vm.qmpSocket);
      await qmp.executeCommand('quit');
    } else {
      vm.process.kill('SIGTERM');
    }

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

    const qmp = await connectQMP(vm.qmpSocket);
    await qmp.executeCommand('stop');

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

    const qmp = await connectQMP(vm.qmpSocket);
    await qmp.executeCommand('cont');

    return { vmId, success: true };
  } catch (err) {
    throw new Error(`Failed to resume VM: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
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
