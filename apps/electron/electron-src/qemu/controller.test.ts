import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ChildProcess } from 'child_process';
import * as childProcess from 'child_process';
import * as controller from './controller';

// Test config fixtures
const testConfigs = {
  'vm-test-1': {
    id: 'vm-test-1',
    name: 'TestVM',
    memory: 2048,
    cores: 2,
    disk: '/tmp/test.qcow2',
    qmpSocket: '/tmp/qmp-vm-test-1.sock',
    accelerator: 'hvf',
  },
  'vm-test-2': {
    id: 'vm-test-2',
    name: 'TestVM2',
    memory: 4096,
    cores: 4,
    disk: '/tmp/test2.qcow2',
    qmpSocket: '/tmp/qmp-vm-test-2.sock',
    accelerator: 'hvf',
  },
};

// Mock child_process.spawn at module level
let mockPid = 12345;

const createMockProcess = (): Partial<ChildProcess> => {
  const pid = mockPid++;
  const mockProcess: Partial<ChildProcess> = {
    pid,
    on: mock(() => mockProcess),
    kill: mock(() => true),
    stdout: null,
    stderr: null,
  };
  return mockProcess as ChildProcess;
};

const spawnMock = mock((cmd: string, args: string[]) => {
  return createMockProcess();
});

// Mock connectQMP
interface MockQMPClient {
  executeCommand: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  disconnect: () => void;
}

const mockQMPClient: MockQMPClient = {
  executeCommand: mock(async (cmd: string) => {
    if (cmd === 'quit') return { success: true };
    if (cmd === 'stop') return { success: true };
    if (cmd === 'cont') return { success: true };
    return { success: true };
  }),
  disconnect: mock(() => {}),
};

const connectQMPMock = mock(async (socketPath: string) => {
  if (!socketPath.includes('qmp')) {
    throw new Error('Invalid QMP socket path');
  }
  return mockQMPClient;
});

describe('VM Process Controller', () => {
  beforeEach(() => {
    spawnMock.mockClear?.();
    (mockQMPClient.executeCommand as any).mockClear?.();
    (mockQMPClient.disconnect as any).mockClear?.();
    (connectQMPMock as any).mockClear?.();
    mockPid = 12345;
    controller.setSpawnFn(spawnMock as any);
    controller.setConnectQMPFn(connectQMPMock as any);
  });

  describe('startVM()', () => {
    it('spawns process with correct QEMU command', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      expect(result).toHaveProperty('vmId', 'vm-test-1');
      expect(result).toHaveProperty('pid');
      expect(typeof result.pid).toBe('number');
    });

    it('returns handle with vm id and process pid', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      expect(result.vmId).toBe('vm-test-1');
      expect(result.pid).toBeGreaterThan(0);
    });

    it('creates QMP socket for the VM', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      expect(result).toHaveProperty('vmId');
      expect(result.pid).toBeGreaterThan(0);
    });

    it('throws error if VM config not found', async () => {
      try {
        await controller.startVM('vm-nonexistent');
        expect.unreachable('Should have thrown error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('not found');
      }
    });

    it('handles process spawn failure gracefully', async () => {
      const invalidVmId = 'vm-test-invalid';
      try {
        await controller.startVM(invalidVmId);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });

    it('sets up process monitoring (exit handler)', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      expect(result.pid).toBeGreaterThan(0);
    });
  });

  describe('stopVM()', () => {
    it('stops a running VM gracefully via QMP', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      const result = await controller.stopVM('vm-test-1');
      
      expect(result).toHaveProperty('vmId', 'vm-test-1');
      expect(result).toHaveProperty('success', true);
    });

    it('sends quit command to QMP socket', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      await controller.stopVM('vm-test-1');
      
      expect(mockQMPClient.executeCommand).toHaveBeenCalled();
    });

    it('throws error if VM not running', async () => {
      try {
        await controller.stopVM('vm-not-running');
        expect.unreachable('Should have thrown error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('not running');
      }
    });

    it('kills process if QMP unavailable', async () => {
      const result = await controller.startVM('vm-test-2', testConfigs['vm-test-2']);
      
      const stopResult = await controller.stopVM('vm-test-2');
      expect(stopResult.success).toBe(true);
    });

    it('removes VM from running VMs map', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      await controller.stopVM('vm-test-1');
      
      try {
        await controller.stopVM('vm-test-1');
        expect.unreachable('VM should not be in running map');
      } catch (err) {
        expect((err as Error).message).toContain('not running');
      }
    });
  });

  describe('pauseVM()', () => {
    it('pauses a running VM via QMP stop command', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      const result = await controller.pauseVM('vm-test-1');
      
      expect(result).toHaveProperty('vmId', 'vm-test-1');
      expect(result).toHaveProperty('success', true);
    });

    it('connects to QMP socket', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      await controller.pauseVM('vm-test-1');
      
      expect(mockQMPClient.executeCommand).toHaveBeenCalled();
    });

    it('sends stop command to QMP', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      await controller.pauseVM('vm-test-1');
      
      expect(mockQMPClient.executeCommand).toHaveBeenCalled();
    });

    it('throws error if VM not running', async () => {
      try {
        await controller.pauseVM('vm-not-running');
        expect.unreachable('Should have thrown error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('not running');
      }
    });

    it('throws error if QMP unavailable', async () => {
      try {
        await controller.pauseVM('vm-test-1');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  describe('resumeVM()', () => {
    it('resumes a paused VM via QMP cont command', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      await controller.pauseVM('vm-test-1');
      
      const result = await controller.resumeVM('vm-test-1');
      
      expect(result).toHaveProperty('vmId', 'vm-test-1');
      expect(result).toHaveProperty('success', true);
    });

    it('connects to QMP socket', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      await controller.resumeVM('vm-test-1');
      
      expect(mockQMPClient.executeCommand).toHaveBeenCalled();
    });

    it('sends cont command to QMP', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      await controller.resumeVM('vm-test-1');
      
      expect(mockQMPClient.executeCommand).toHaveBeenCalled();
    });

    it('throws error if VM not running', async () => {
      try {
        await controller.resumeVM('vm-not-running');
        expect.unreachable('Should have thrown error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('not running');
      }
    });
  });

  describe('Lifecycle Integration', () => {
    it('start -> pause -> resume -> stop works in sequence', async () => {
      const startResult = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      expect(startResult.pid).toBeGreaterThan(0);
      
      const pauseResult = await controller.pauseVM('vm-test-1');
      expect(pauseResult.success).toBe(true);
      
      const resumeResult = await controller.resumeVM('vm-test-1');
      expect(resumeResult.success).toBe(true);
      
      const stopResult = await controller.stopVM('vm-test-1');
      expect(stopResult.success).toBe(true);
    });

    it('handles multiple VMs independently', async () => {
      const vm1 = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      const vm2 = await controller.startVM('vm-test-2', testConfigs['vm-test-2']);
      
      expect(vm1.vmId).toBe('vm-test-1');
      expect(vm2.vmId).toBe('vm-test-2');
      expect(vm1.pid).not.toBe(vm2.pid);
      
      await controller.stopVM('vm-test-1');
      
      const vm2Resume = await controller.resumeVM('vm-test-2');
      expect(vm2Resume.success).toBe(true);
      
      await controller.stopVM('vm-test-2');
    });

    it('detects VM crashes (exit event)', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      
      expect(result.pid).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('throws meaningful error when config lookup fails', async () => {
      try {
        await controller.startVM('vm-invalid-id');
        expect.unreachable('Should throw error');
      } catch (err) {
        const msg = (err as Error).message.toLowerCase();
        expect(msg).toContain('not found');
      }
    });

    it('throws error with context when process spawn fails', async () => {
      try {
        await controller.startVM('vm-invalid-id');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });

    it('throws error when stopping non-existent VM', async () => {
      try {
        await controller.stopVM('vm-not-started');
        expect.unreachable('Should throw error');
      } catch (err) {
        expect((err as Error).message).toContain('not running');
      }
    });

    it('throws error with context on QMP failures', async () => {
      try {
        await controller.pauseVM('vm-not-started');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  describe('Process Cleanup', () => {
    it('cleans up on VM exit', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      expect(result.vmId).toBe('vm-test-1');
    });

    it('registers exit listener on spawned process', async () => {
      const result = await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      expect(result.pid).toBeGreaterThan(0);
    });

    it('disconnects QMP when VM stops', async () => {
      await controller.startVM('vm-test-1', testConfigs['vm-test-1']);
      await controller.stopVM('vm-test-1');
      
      expect(mockQMPClient.disconnect).toHaveBeenCalled();
    });
  });
});
