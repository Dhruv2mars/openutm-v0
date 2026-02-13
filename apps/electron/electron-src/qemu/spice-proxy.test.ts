import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  closeAllSpiceProxies,
  closeSpiceProxy,
  ensureSpiceProxy,
  getSpiceProxyUri,
  resetSpiceProxyDepsForTests,
  setSpiceProxyDepsForTests,
} from './spice-proxy';

function createMockServer(port: number) {
  const events = new Map<string, Function[]>();
  return {
    clients: new Set<{ close: () => void }>(),
    once(event: string, cb: Function) {
      const handlers = events.get(event) || [];
      handlers.push(cb);
      events.set(event, handlers);
      if (event === 'listening') {
        queueMicrotask(() => cb());
      }
      return this;
    },
    on(event: string, cb: Function) {
      const handlers = events.get(event) || [];
      handlers.push(cb);
      events.set(event, handlers);
      return this;
    },
    address() {
      return { address: '127.0.0.1', family: 'IPv4', port };
    },
    close(cb?: () => void) {
      cb?.();
    },
  } as any;
}

describe('spice websocket proxy', () => {
  beforeEach(() => {
    setSpiceProxyDepsForTests({
      createWebSocketServer: (() => createMockServer(17345)) as any,
    });
  });

  afterEach(async () => {
    await closeAllSpiceProxies();
    resetSpiceProxyDepsForTests();
  });

  it('creates and reuses proxy URI for same VM', async () => {
    const uri1 = await ensureSpiceProxy('vm-1', '127.0.0.1', 5901);
    const uri2 = await ensureSpiceProxy('vm-1', '127.0.0.1', 5901);
    expect(uri1).toBe(uri2);
    expect(getSpiceProxyUri('vm-1')).toBe(uri1);
  });

  it('closes proxy URI for VM when asked', async () => {
    await ensureSpiceProxy('vm-2', '127.0.0.1', 5902);
    expect(getSpiceProxyUri('vm-2')).toContain('/spice/vm-2');
    await closeSpiceProxy('vm-2');
    expect(getSpiceProxyUri('vm-2')).toBeNull();
  });

  it('returns null for unknown VM', () => {
    expect(getSpiceProxyUri('missing-vm')).toBeNull();
  });

  it('throws when websocket address cannot be resolved', async () => {
    setSpiceProxyDepsForTests({
      createWebSocketServer: (() => {
        const server = createMockServer(0);
        server.address = () => null;
        return server;
      }) as any,
    });

    await expect(ensureSpiceProxy('vm-fail', '127.0.0.1', 5903)).rejects.toThrow(
      'Failed to resolve SPICE websocket proxy address',
    );
  });
});
