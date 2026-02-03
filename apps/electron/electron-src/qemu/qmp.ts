import net from 'net';

export interface QMPCommand {
  execute: string;
  arguments: Record<string, unknown>;
  id: number;
}

export interface QMPResponse {
  return?: Record<string, unknown>;
  error?: {
    class: string;
    desc: string;
  };
  id?: number;
}

export interface QMPEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp?: {
    seconds: number;
    microseconds: number;
  };
}

export interface QMPCapabilities {
  oob?: boolean;
  'execution-modes'?: string[];
  version?: string;
  [key: string]: unknown;
}

export interface QMPClient {
  executeCommand(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  disconnect(): void;
  onEvent(event: string, handler: (event: QMPEvent) => void): void;
}

class QMP implements QMPClient {
  private socket: net.Socket;
  private messageId = 0;
  private isConnected = false;
  private eventHandlers = new Map<string, Function[]>();
  private pendingCommands = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private responseBuffer = '';

  constructor(socket: net.Socket) {
    this.socket = socket;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.socket.on('data', this.handleData.bind(this));
    this.socket.on('error', this.handleSocketError.bind(this));
    this.socket.on('close', this.handleSocketClose.bind(this));
  }

  private handleData(data: Buffer): void {
    this.responseBuffer += data.toString();
    
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const json = JSON.parse(line);
        this.processMessage(json);
      } catch (err) {
        console.error('Failed to parse QMP message:', err);
      }
    }
  }

  private processMessage(json: any): void {
    if (json.QMP) {
      this.handleGreeting(json);
    } else if (json.event) {
      this.emitEvent(json as QMPEvent);
    } else if (json.id && this.pendingCommands.has(json.id)) {
      const pending = this.pendingCommands.get(json.id)!;
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(json.id);
      
      if (json.error) {
        pending.reject(new Error(json.error.desc || 'QMP Error'));
      } else {
        pending.resolve(json.return);
      }
    }
  }

  private handleGreeting(greeting: any): void {
    this.isConnected = true;
    this.performHandshake();
  }

  private async performHandshake(): Promise<void> {
    try {
      await this.executeCommand('qmp_capabilities', {});
    } catch (err) {
      console.error('QMP handshake failed:', err);
      this.disconnect();
    }
  }

  private emitEvent(event: QMPEvent): void {
    const handlers = this.eventHandlers.get(event.event);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  private handleSocketError(err: Error): void {
    console.error('QMP socket error:', err);
    const pending = this.pendingCommands.values();
    for (const p of pending) {
      p.reject(err);
    }
    this.pendingCommands.clear();
  }

  private handleSocketClose(): void {
    this.isConnected = false;
    const pending = this.pendingCommands.values();
    for (const p of pending) {
      clearTimeout(p.timeout);
      p.reject(new Error('Socket disconnected'));
    }
    this.pendingCommands.clear();
    this.eventHandlers.clear();
  }

  async executeCommand(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected && cmd !== 'qmp_capabilities') {
      throw new Error('Not connected to QMP');
    }

    return new Promise((resolve, reject) => {
      this.messageId++;
      const id = this.messageId;
      
      const request: QMPCommand = {
        execute: cmd,
        arguments: args || {},
        id
      };

      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error('QMP command timeout'));
      }, 5000);

      this.pendingCommands.set(id, { resolve, reject, timeout });

      try {
        this.socket.write(JSON.stringify(request) + '\n');
      } catch (err) {
        clearTimeout(timeout);
        this.pendingCommands.delete(id);
        reject(err);
      }
    });
  }

  onEvent(event: string, handler: (event: QMPEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  disconnect(): void {
    this.isConnected = false;
    const pending = this.pendingCommands.values();
    for (const p of pending) {
      clearTimeout(p.timeout);
      p.reject(new Error('Disconnected'));
    }
    this.pendingCommands.clear();
    this.eventHandlers.clear();
    this.socket.destroy();
  }
}

export async function connectQMP(socketPath: string): Promise<QMPClient> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      const qmp = new QMP(socket);
      const checkConnected = setInterval(() => {
        if ((qmp as any).isConnected) {
          clearInterval(checkConnected);
          resolve(qmp);
        }
      }, 10);
      
      setTimeout(() => {
        clearInterval(checkConnected);
        reject(new Error('QMP handshake timeout'));
      }, 5000);
    });

    socket.on('error', reject);
  });
}
