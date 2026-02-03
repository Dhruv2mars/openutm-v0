import net from 'net';

interface QMPClient {
  executeCommand(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  disconnect(): void;
}

class QMP implements QMPClient {
  private socket: net.Socket;
  private messageId = 0;

  constructor(socket: net.Socket) {
    this.socket = socket;
  }

  async executeCommand(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.messageId++;
      const request = {
        execute: cmd,
        arguments: args || {},
        id: this.messageId
      };

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === this.messageId) {
            this.socket.removeListener('data', responseHandler);
            if (response.error) {
              reject(new Error(response.error.desc));
            } else {
              resolve(response.return);
            }
          }
        } catch (err) {
          reject(err);
        }
      };

      this.socket.on('data', responseHandler);
      this.socket.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        this.socket.removeListener('data', responseHandler);
        reject(new Error('QMP command timeout'));
      }, 5000);
    });
  }

  disconnect(): void {
    this.socket.destroy();
  }
}

export async function connectQMP(socketPath: string): Promise<QMPClient> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      const qmp = new QMP(socket);
      resolve(qmp);
    });

    socket.on('error', reject);
  });
}
