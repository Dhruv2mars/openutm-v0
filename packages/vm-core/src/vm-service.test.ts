import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VMService } from './vm-service';
import { VMStatus } from '@openutm/shared-types';

describe('VMService', () => {
  let service: VMService;

  beforeEach(() => {
    service = new VMService();
  });

  describe('initialization', () => {
    it('should create a new VMService instance', () => {
      expect(service).toBeDefined();
      expect(service.listVMs()).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a new VM with required config', async () => {
      const config = {
        name: 'Test VM',
        cpu: 2,
        memory: 2048,
        diskSize: 50,
      };

      const vm = await service.create(config);

      expect(vm).toBeDefined();
      expect(vm.name).toBe('Test VM');
      expect(vm.config.cpu).toBe(2);
      expect(vm.config.memory).toBe(2048);
      expect(vm.status).toBe(VMStatus.Stopped);
    });

    it('should assign unique VM ID', async () => {
      const config = { name: 'VM 1', cpu: 2, memory: 2048, diskSize: 50 };
      const vm1 = await service.create(config);
      const vm2 = await service.create(config);

      expect(vm1.id).not.toBe(vm2.id);
    });

    it('should emit create event', async () => {
      const createHandler = vi.fn();
      service.on('vm:created', createHandler);

      const config = { name: 'Test VM', cpu: 2, memory: 2048, diskSize: 50 };
      await service.create(config);

      expect(createHandler).toHaveBeenCalledOnce();
    });

    it('should validate CPU count', async () => {
      const config = { name: 'Test', cpu: 0, memory: 2048, diskSize: 50 };
      
      await expect(service.create(config)).rejects.toThrow('CPU count must be positive');
    });

    it('should validate memory amount', async () => {
      const config = { name: 'Test', cpu: 2, memory: 0, diskSize: 50 };
      
      await expect(service.create(config)).rejects.toThrow('Memory must be positive');
    });
  });

  describe('start', () => {
    it('should start a stopped VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      const started = await service.start(vm.id);

      expect(started.status).toBe(VMStatus.Running);
    });

    it('should emit start event', async () => {
      const startHandler = vi.fn();
      service.on('vm:started', startHandler);

      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      expect(startHandler).toHaveBeenCalledOnce();
    });

    it('should throw for non-existent VM', async () => {
      await expect(service.start('nonexistent-id')).rejects.toThrow();
    });

    it('should not start already running VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      await expect(service.start(vm.id)).rejects.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop a running VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      const stopped = await service.stop(vm.id);

      expect(stopped.status).toBe(VMStatus.Stopped);
    });

    it('should emit stop event', async () => {
      const stopHandler = vi.fn();
      service.on('vm:stopped', stopHandler);

      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);
      await service.stop(vm.id);

      expect(stopHandler).toHaveBeenCalledOnce();
    });

    it('should not stop already stopped VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      await expect(service.stop(vm.id)).rejects.toThrow();
    });
  });

  describe('pause', () => {
    it('should pause a running VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      const paused = await service.pause(vm.id);

      expect(paused.status).toBe(VMStatus.Paused);
    });

    it('should emit pause event', async () => {
      const pauseHandler = vi.fn();
      service.on('vm:paused', pauseHandler);

      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);
      await service.pause(vm.id);

      expect(pauseHandler).toHaveBeenCalledOnce();
    });

    it('should not pause stopped VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      await expect(service.pause(vm.id)).rejects.toThrow('Cannot pause VM in stopped state');
    });
  });

  describe('resume', () => {
    it('should resume a paused VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);
      await service.pause(vm.id);

      const resumed = await service.resume(vm.id);

      expect(resumed.status).toBe(VMStatus.Running);
    });

    it('should emit resume event', async () => {
      const resumeHandler = vi.fn();
      service.on('vm:resumed', resumeHandler);

      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);
      await service.pause(vm.id);
      await service.resume(vm.id);

      expect(resumeHandler).toHaveBeenCalledOnce();
    });

    it('should not resume running VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      await expect(service.resume(vm.id)).rejects.toThrow('Cannot resume VM in running state');
    });
  });

  describe('delete', () => {
    it('should delete a stopped VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      await service.delete(vm.id);

      await expect(service.getVM(vm.id)).rejects.toThrow();
    });

    it('should not delete a running VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      await expect(service.delete(vm.id)).rejects.toThrow('Cannot delete running VM');
    });

    it('should emit delete event', async () => {
      const deleteHandler = vi.fn();
      service.on('vm:deleted', deleteHandler);

      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.delete(vm.id);

      expect(deleteHandler).toHaveBeenCalledOnce();
    });
  });

  describe('getVM', () => {
    it('should retrieve an existing VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const created = await service.create(config);

      const vm = await service.getVM(created.id);

      expect(vm.id).toBe(created.id);
      expect(vm.name).toBe('Test');
    });

    it('should throw for non-existent VM', async () => {
      await expect(service.getVM('nonexistent-id')).rejects.toThrow();
    });
  });

  describe('listVMs', () => {
    it('should list all VMs', async () => {
      const config1 = { name: 'VM 1', cpu: 2, memory: 2048, diskSize: 50 };
      const config2 = { name: 'VM 2', cpu: 4, memory: 4096, diskSize: 100 };

      await service.create(config1);
      await service.create(config2);

      const vms = service.listVMs();

      expect(vms).toHaveLength(2);
      expect(vms[0].name).toBe('VM 1');
      expect(vms[1].name).toBe('VM 2');
    });

    it('should list empty array when no VMs', () => {
      const vms = service.listVMs();
      expect(vms).toEqual([]);
    });
  });

  describe('updateVM', () => {
    it('should update VM configuration', async () => {
      const config = { name: 'Original', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      const updated = await service.updateVM(vm.id, { cpu: 4, memory: 4096 });

      expect(updated.config.cpu).toBe(4);
      expect(updated.config.memory).toBe(4096);
      expect(updated.name).toBe('Original');
    });

    it('should not update running VM', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);
      await service.start(vm.id);

      await expect(service.updateVM(vm.id, { cpu: 4 })).rejects.toThrow();
    });

    it('should validate updated CPU count', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      await expect(service.updateVM(vm.id, { cpu: 0 })).rejects.toThrow('CPU count must be positive');
    });

    it('should validate updated memory amount', async () => {
      const config = { name: 'Test', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      await expect(service.updateVM(vm.id, { memory: 0 })).rejects.toThrow('Memory must be positive');
    });

    it('should update VM name', async () => {
      const config = { name: 'Original', cpu: 2, memory: 2048, diskSize: 50 };
      const vm = await service.create(config);

      const updated = await service.updateVM(vm.id, { name: 'Renamed' });

      expect(updated.name).toBe('Renamed');
    });
  });
});
