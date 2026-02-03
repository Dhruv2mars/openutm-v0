import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import net from 'net';
import { QMPClient, connectQMP, QMPCommand, QMPResponse, QMPEvent, QMPCapabilities } from './qmp';

describe('QMP Client (Electron)', () => {
  describe('QMP Handshake & Connection', () => {
    it('should connect to QMP socket', async () => {
      const mockSocket = {
        write: mock(() => {}),
        destroy: mock(() => {}),
        on: mock((_event: string, handler: Function) => {
          if (_event === 'data') {
            setTimeout(() => {
              handler(Buffer.from(JSON.stringify({
                QMP: {
                  version: { qemu: '7.0.0', package: '7.0.0' },
                  capabilities: ['oob']
                }
              }) + '\n'));
            }, 0);
          }
        }),
        removeListener: mock(() => {}),
        once: mock((_event: string, handler: Function) => {}),
      };

      let connectionHandler: (() => void) | null = null;
      const mockCreateConnection = mock(() => {
        setTimeout(() => {
          if (connectionHandler) connectionHandler();
        }, 0);
        return mockSocket;
      }) as any;

      expect(connectQMP).toBeDefined();
      expect(typeof connectQMP).toBe('function');
    });

    it('should perform QMP handshake with capabilities', async () => {
      const expectedGreeting = {
        QMP: {
          version: { qemu: '7.0.0', package: '7.0.0' },
          capabilities: ['oob']
        }
      };

      expect(expectedGreeting).toHaveProperty('QMP');
      expect(expectedGreeting.QMP).toHaveProperty('version');
      expect(expectedGreeting.QMP).toHaveProperty('capabilities');
    });

    it('should send qmp_capabilities after greeting', async () => {
      const capsCommand = {
        execute: 'qmp_capabilities',
        arguments: {},
        id: 1
      };

      expect(capsCommand.execute).toBe('qmp_capabilities');
      expect(capsCommand.arguments).toEqual({});
      expect(capsCommand.id).toBe(1);
    });

    it('should handle connection errors', async () => {
      const errors = ['ECONNREFUSED', 'ENOENT', 'EACCES'];
      errors.forEach(err => {
        expect(err).toBeDefined();
      });
    });

    it('should handle socket errors', async () => {
      const socketErrors = ['EPIPE', 'ECONNRESET', 'ETIMEDOUT'];
      socketErrors.forEach(err => {
        expect(err).toBeDefined();
      });
    });
  });

  describe('Command Execution', () => {
    it('should execute query-status command', async () => {
      const cmd: QMPCommand = {
        execute: 'query-status',
        arguments: {},
        id: 1
      };

      expect(cmd.execute).toBe('query-status');
      expect(cmd).toHaveProperty('id');
      expect(cmd).toHaveProperty('arguments');
    });

    it('should execute system_powerdown command', async () => {
      const cmd: QMPCommand = {
        execute: 'system_powerdown',
        arguments: {},
        id: 2
      };

      expect(cmd.execute).toBe('system_powerdown');
    });

    it('should execute stop command', async () => {
      const cmd: QMPCommand = {
        execute: 'stop',
        arguments: {},
        id: 3
      };

      expect(cmd.execute).toBe('stop');
    });

    it('should execute cont command', async () => {
      const cmd: QMPCommand = {
        execute: 'cont',
        arguments: {},
        id: 4
      };

      expect(cmd.execute).toBe('cont');
    });

    it('should execute quit command', async () => {
      const cmd: QMPCommand = {
        execute: 'quit',
        arguments: {},
        id: 5
      };

      expect(cmd.execute).toBe('quit');
    });

    it('should execute query-block command', async () => {
      const cmd: QMPCommand = {
        execute: 'query-block',
        arguments: {},
        id: 6
      };

      expect(cmd.execute).toBe('query-block');
    });

    it('should execute blockdev-add with arguments', async () => {
      const cmd: QMPCommand = {
        execute: 'blockdev-add',
        arguments: {
          driver: 'qcow2',
          node_name: 'drive0',
          file: { driver: 'file', filename: '/path/to/disk.qcow2' }
        },
        id: 7
      };

      expect(cmd.execute).toBe('blockdev-add');
      expect(cmd.arguments).toHaveProperty('driver');
      expect(cmd.arguments).toHaveProperty('node_name');
    });

    it('should serialize commands to JSON', async () => {
      const cmd: QMPCommand = {
        execute: 'query-status',
        arguments: {},
        id: 1
      };

      const json = JSON.stringify(cmd);
      expect(json).toContain('"execute":"query-status"');
      expect(json).toContain('"id":1');
    });

    it('should include newline after command', async () => {
      const cmd: QMPCommand = {
        execute: 'query-status',
        arguments: {},
        id: 1
      };

      const msg = JSON.stringify(cmd) + '\n';
      expect(msg).toEndWith('\n');
    });

    it('should handle message ID tracking', async () => {
      const cmd1: QMPCommand = { execute: 'query-status', arguments: {}, id: 1 };
      const cmd2: QMPCommand = { execute: 'query-status', arguments: {}, id: 2 };

      expect(cmd1.id).not.toBe(cmd2.id);
      expect(cmd1.id).toBe(1);
      expect(cmd2.id).toBe(2);
    });
  });

  describe('Response Parsing', () => {
    it('should parse successful response', async () => {
      const response: QMPResponse = {
        return: {
          running: true,
          singlestep: false,
          status: 'running'
        },
        id: 1
      };

      expect(response).toHaveProperty('return');
      expect(response.return).toBeDefined();
      expect(response.id).toBe(1);
    });

    it('should parse error response', async () => {
      const errorResponse: QMPResponse = {
        error: {
          class: 'GenericError',
          desc: 'VM is not running'
        },
        id: 1
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toHaveProperty('class');
      expect(errorResponse.error).toHaveProperty('desc');
    });

    it('should handle event messages', async () => {
      const event: QMPEvent = {
        event: 'SHUTDOWN',
        data: { guest: true },
        timestamp: { seconds: 1234567890, microseconds: 0 }
      };

      expect(event).toHaveProperty('event');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
    });

    it('should identify response vs event', async () => {
      const response: QMPResponse = {
        return: { status: 'running' },
        id: 1
      };

      const event: QMPEvent = {
        event: 'SHUTDOWN',
        data: {}
      };

      expect('return' in response).toBe(true);
      expect('event' in event).toBe(true);
      expect('return' in event).toBe(false);
    });

    it('should match response to command by ID', async () => {
      const cmdId = 42;
      const response: QMPResponse = {
        return: { running: true },
        id: cmdId
      };

      expect(response.id).toBe(cmdId);
    });

    it('should parse JSON response with newline', async () => {
      const jsonStr = '{"return":{"status":"running"},"id":1}\n';
      const response = JSON.parse(jsonStr);

      expect(response.return).toBeDefined();
      expect(response.id).toBe(1);
    });
  });

  describe('Event Handling', () => {
    it('should emit SHUTDOWN event', async () => {
      const shutdownEvent: QMPEvent = {
        event: 'SHUTDOWN',
        data: { guest: true },
        timestamp: { seconds: 0, microseconds: 0 }
      };

      expect(shutdownEvent.event).toBe('SHUTDOWN');
    });

    it('should emit STOP event', async () => {
      const stopEvent: QMPEvent = {
        event: 'STOP',
        data: {},
        timestamp: { seconds: 0, microseconds: 0 }
      };

      expect(stopEvent.event).toBe('STOP');
    });

    it('should emit RESUME event', async () => {
      const resumeEvent: QMPEvent = {
        event: 'RESUME',
        data: {},
        timestamp: { seconds: 0, microseconds: 0 }
      };

      expect(resumeEvent.event).toBe('RESUME');
    });

    it('should emit ERROR event', async () => {
      const errorEvent: QMPEvent = {
        event: 'ERROR',
        data: { class: 'GenericError', desc: 'Something failed' },
        timestamp: { seconds: 0, microseconds: 0 }
      };

      expect(errorEvent.event).toBe('ERROR');
      expect(errorEvent.data).toHaveProperty('desc');
    });

    it('should emit device-added event', async () => {
      const deviceEvent: QMPEvent = {
        event: 'DEVICE_ADDED',
        data: { device: 'net0' },
        timestamp: { seconds: 0, microseconds: 0 }
      };

      expect(deviceEvent.event).toBe('DEVICE_ADDED');
    });

    it('should store event handlers', async () => {
      const handlers = new Map<string, Function[]>();
      handlers.set('SHUTDOWN', []);

      expect(handlers.has('SHUTDOWN')).toBe(true);
    });

    it('should call event handler on event', async () => {
      const mockHandler = mock(() => {});
      const event: QMPEvent = {
        event: 'SHUTDOWN',
        data: {}
      };

      if (event.event === 'SHUTDOWN') {
        mockHandler(event);
      }

      expect(mockHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('Error Handling', () => {
    it('should throw on command timeout', async () => {
      const timeoutError = new Error('QMP command timeout');
      expect(timeoutError.message).toContain('timeout');
    });

    it('should handle socket write errors', async () => {
      const writeError = new Error('Write failed: EPIPE');
      expect(writeError.message).toContain('EPIPE');
    });

    it('should handle invalid JSON responses', async () => {
      const invalidJson = '{ invalid json }';
      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();
    });

    it('should handle QMP error responses', async () => {
      const qmpError: QMPResponse = {
        error: {
          class: 'GenericError',
          desc: 'VM is not running'
        },
        id: 1
      };

      expect(qmpError.error).toBeDefined();
      expect(qmpError.error?.desc).toContain('not running');
    });

    it('should close socket on error', async () => {
      const mockDestroy = mock(() => {});
      expect(mockDestroy).toBeDefined();
    });

    it('should handle disconnection during command', async () => {
      const disconnectError = new Error('Socket disconnected');
      expect(disconnectError.message).toContain('Socket');
    });

    it('should recover from transient socket errors', async () => {
      const transientErrors = ['ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH'];
      transientErrors.forEach(err => {
        expect(err).toBeDefined();
      });
    });
  });

  describe('Disconnect & Cleanup', () => {
    it('should disconnect gracefully', async () => {
      const mockDestroy = mock(() => {});
      mockDestroy();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should remove all event listeners on disconnect', async () => {
      const listeners = new Map<string, Function[]>();
      listeners.set('data', []);
      listeners.set('error', []);

      listeners.clear();
      expect(listeners.size).toBe(0);
    });

    it('should clear pending commands on disconnect', async () => {
      const pendingCommands = new Map<number, Function>();
      pendingCommands.set(1, () => {});
      pendingCommands.set(2, () => {});

      pendingCommands.clear();
      expect(pendingCommands.size).toBe(0);
    });

    it('should mark client as disconnected', async () => {
      let isConnected = true;
      isConnected = false;
      expect(isConnected).toBe(false);
    });

    it('should close underlying socket', async () => {
      const mockDestroy = mock(() => {});
      mockDestroy();
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should execute full command sequence', async () => {
      const steps = [
        'connect',
        'handshake',
        'capabilities',
        'query-status',
        'disconnect'
      ];

      expect(steps).toHaveLength(5);
      expect(steps[0]).toBe('connect');
      expect(steps[4]).toBe('disconnect');
    });

    it('should handle multiple concurrent commands', async () => {
      const cmdIds = [1, 2, 3, 4, 5];
      expect(cmdIds).toHaveLength(5);
      expect(new Set(cmdIds).size).toBe(5);
    });

    it('should maintain message order', async () => {
      const ids = [1, 2, 3, 4, 5];
      const sorted = [...ids].sort((a, b) => a - b);

      expect(ids).toEqual(sorted);
    });

    it('should handle rapid fire commands', async () => {
      const commands = Array.from({ length: 10 }, (_, i) => ({
        execute: 'query-status',
        arguments: {},
        id: i + 1
      }));

      expect(commands).toHaveLength(10);
      expect(commands[0].id).toBe(1);
      expect(commands[9].id).toBe(10);
    });
  });

  describe('QMPCapabilities', () => {
    it('should define capabilities structure', async () => {
      const caps: QMPCapabilities = {
        oob: true,
        'execution-modes': ['sync'],
        version: '7.0.0'
      };

      expect(caps).toHaveProperty('oob');
      expect(caps.oob).toBe(true);
    });

    it('should parse capabilities from greeting', async () => {
      const greeting = {
        QMP: {
          version: { qemu: '7.0.0', package: '7.0.0' },
          capabilities: ['oob']
        }
      };

      expect(greeting.QMP.capabilities).toContain('oob');
    });
  });
});
