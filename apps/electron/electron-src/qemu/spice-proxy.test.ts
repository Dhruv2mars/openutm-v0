import { afterEach, describe, expect, it } from 'bun:test';
import net from 'net';
import { closeAllSpiceProxies, closeSpiceProxy, ensureSpiceProxy, getSpiceProxyUri } from './spice-proxy';

async function startEchoServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      socket.write(chunk);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind echo server');
  }

  return {
    port: address.port,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe('spice websocket proxy', () => {
  afterEach(async () => {
    await closeAllSpiceProxies();
  });

  it('creates and reuses proxy URI for same VM', async () => {
    const echo = await startEchoServer();
    const uri1 = await ensureSpiceProxy('vm-1', '127.0.0.1', echo.port);
    const uri2 = await ensureSpiceProxy('vm-1', '127.0.0.1', echo.port);
    expect(uri1).toBe(uri2);
    expect(getSpiceProxyUri('vm-1')).toBe(uri1);
    await echo.close();
  });

  it('closes proxy URI for VM when asked', async () => {
    const echo = await startEchoServer();
    await ensureSpiceProxy('vm-2', '127.0.0.1', echo.port);
    expect(getSpiceProxyUri('vm-2')).toContain('/spice/vm-2');
    await closeSpiceProxy('vm-2');
    expect(getSpiceProxyUri('vm-2')).toBeNull();
    await echo.close();
  });

  it('returns null for unknown VM', () => {
    expect(getSpiceProxyUri('missing-vm')).toBeNull();
  });
});
