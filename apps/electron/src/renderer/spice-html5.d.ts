declare module '@spice-project/spice-html5/src/main.js' {
  export class SpiceMainConn {
    constructor(config: {
      uri: string;
      screen_id?: string;
      dump_id?: string;
      message_id?: string;
      password?: string;
      onerror?: (event: unknown) => void;
      onagent?: (event: unknown) => void;
      onsuccess?: (event: unknown) => void;
    });
    stop(): void;
  }
}
