import net from 'net';
import { WebSocket, WebSocketServer } from 'ws';

interface SpiceProxySession {
  vmId: string;
  host: string;
  port: number;
  path: string;
  wss: WebSocketServer;
}

const sessions = new Map<string, SpiceProxySession>();
type WebSocketServerFactory = (options: ConstructorParameters<typeof WebSocketServer>[0]) => WebSocketServer;
let createWebSocketServer: WebSocketServerFactory = (options) => new WebSocketServer(options);

export function setSpiceProxyDepsForTests(overrides: {
  createWebSocketServer?: WebSocketServerFactory;
}): void {
  if (overrides.createWebSocketServer) {
    createWebSocketServer = overrides.createWebSocketServer;
  }
}

export function resetSpiceProxyDepsForTests(): void {
  createWebSocketServer = (options) => new WebSocketServer(options);
}

function connectTcpSocket(ws: WebSocket, host: string, port: number): void {
  const tcp = net.createConnection({ host, port });

  tcp.on('data', (chunk) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk, { binary: true });
    }
  });

  tcp.on('close', () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  tcp.on('error', () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  ws.on('message', (raw) => {
    if (typeof raw === 'string') {
      tcp.write(Buffer.from(raw));
      return;
    }
    tcp.write(Buffer.from(raw as ArrayBuffer));
  });

  ws.on('close', () => {
    tcp.destroy();
  });

  ws.on('error', () => {
    tcp.destroy();
  });
}

function resolveWebsocketUri(port: number, path: string): string {
  return `ws://127.0.0.1:${port}${path}`;
}

export async function ensureSpiceProxy(vmId: string, host: string, port: number): Promise<string> {
  const existing = sessions.get(vmId);
  if (existing) {
    return resolveWebsocketUri(existing.port, existing.path);
  }

  const path = `/spice/${vmId}`;
  const wss = createWebSocketServer({
    host: '127.0.0.1',
    port: 0,
    path,
  });

  await new Promise<void>((resolve, reject) => {
    wss.once('listening', () => resolve());
    wss.once('error', (error) => reject(error));
  });

  wss.on('connection', (ws) => connectTcpSocket(ws, host, port));

  const address = wss.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    throw new Error('Failed to resolve SPICE websocket proxy address');
  }

  sessions.set(vmId, {
    vmId,
    host,
    port: address.port,
    path,
    wss,
  });

  return resolveWebsocketUri(address.port, path);
}

export function getSpiceProxyUri(vmId: string): string | null {
  const session = sessions.get(vmId);
  if (!session) {
    return null;
  }
  return resolveWebsocketUri(session.port, session.path);
}

export async function closeSpiceProxy(vmId: string): Promise<void> {
  const session = sessions.get(vmId);
  if (!session) {
    return;
  }

  sessions.delete(vmId);
  await new Promise<void>((resolve) => {
    session.wss.clients.forEach((client) => client.close());
    session.wss.close(() => resolve());
  });
}

export async function closeAllSpiceProxies(): Promise<void> {
  const vmIds = Array.from(sessions.keys());
  for (const vmId of vmIds) {
    await closeSpiceProxy(vmId);
  }
}
