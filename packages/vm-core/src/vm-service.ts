import { EventEmitter } from 'eventemitter3';
import { VM, VMStatus, VMConfig } from '@openutm/shared-types';
import { v4 as uuidv4 } from 'uuid';

export interface CreateVMConfig {
  name: string;
  cpu: number;
  memory: number;
  diskSize: number;
}

export interface UpdateVMConfig {
  cpu?: number;
  memory?: number;
  name?: string;
}

export class VMService extends EventEmitter {
  private vms: Map<string, VM> = new Map();

  async create(config: CreateVMConfig): Promise<VM> {
    if (config.cpu <= 0) {
      throw new Error('CPU count must be positive');
    }
    if (config.memory <= 0) {
      throw new Error('Memory must be positive');
    }

    const vmConfig: VMConfig = {
      cpu: config.cpu,
      memory: config.memory,
      disks: [
        {
          path: `/vms/${config.name}/disk.qcow2`,
          size: config.diskSize * 1024 * 1024 * 1024,
          format: 'qcow2',
        },
      ],
      network: { type: 'nat' },
    };

    const vm: VM = {
      id: uuidv4(),
      name: config.name,
      status: VMStatus.Stopped,
      config: vmConfig,
    };

    this.vms.set(vm.id, vm);
    this.emit('vm:created', vm);

    return vm;
  }

  async start(vmId: string): Promise<VM> {
    const vm = this.getVMSync(vmId);

    if (vm.status !== VMStatus.Stopped) {
      throw new Error(`Cannot start VM in ${vm.status} state`);
    }

    vm.status = VMStatus.Running;
    this.emit('vm:started', vm);
    return vm;
  }

  async stop(vmId: string): Promise<VM> {
    const vm = this.getVMSync(vmId);

    if (vm.status !== VMStatus.Running && vm.status !== VMStatus.Paused) {
      throw new Error(`Cannot stop VM in ${vm.status} state`);
    }

    vm.status = VMStatus.Stopped;
    this.emit('vm:stopped', vm);
    return vm;
  }

  async pause(vmId: string): Promise<VM> {
    const vm = this.getVMSync(vmId);

    if (vm.status !== VMStatus.Running) {
      throw new Error(`Cannot pause VM in ${vm.status} state`);
    }

    vm.status = VMStatus.Paused;
    this.emit('vm:paused', vm);
    return vm;
  }

  async resume(vmId: string): Promise<VM> {
    const vm = this.getVMSync(vmId);

    if (vm.status !== VMStatus.Paused) {
      throw new Error(`Cannot resume VM in ${vm.status} state`);
    }

    vm.status = VMStatus.Running;
    this.emit('vm:resumed', vm);
    return vm;
  }

  async delete(vmId: string): Promise<void> {
    const vm = this.getVMSync(vmId);

    if (vm.status !== VMStatus.Stopped) {
      throw new Error('Cannot delete running VM');
    }

    this.vms.delete(vmId);
    this.emit('vm:deleted', vm);
  }

  async getVM(vmId: string): Promise<VM> {
    const vm = this.vms.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }
    return vm;
  }

  async updateVM(vmId: string, update: UpdateVMConfig): Promise<VM> {
    const vm = this.getVMSync(vmId);

    if (vm.status === VMStatus.Running) {
      throw new Error('Cannot update configuration of running VM');
    }

    if (update.cpu !== undefined) {
      if (update.cpu <= 0) {
        throw new Error('CPU count must be positive');
      }
      vm.config.cpu = update.cpu;
    }

    if (update.memory !== undefined) {
      if (update.memory <= 0) {
        throw new Error('Memory must be positive');
      }
      vm.config.memory = update.memory;
    }

    if (update.name !== undefined) {
      vm.name = update.name;
    }

    this.emit('vm:updated', vm);
    return vm;
  }

  listVMs(): VM[] {
    return Array.from(this.vms.values());
  }

  private getVMSync(vmId: string): VM {
    const vm = this.vms.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }
    return vm;
  }
}
