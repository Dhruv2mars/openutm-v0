export enum Accelerator {
  Hvf = 'hvf',
  Kvm = 'kvm',
  Whpx = 'whpx',
  Tcg = 'tcg',
}

export enum MachineType {
  Q35 = 'q35',
  I440fx = 'i440fx',
  Virt = 'virt',
}

export interface DriveConfig {
  id: string;
  file: string;
  format: string;
  interface: string;
}

export interface NetdevConfig {
  id: string;
  kind: string;
  options: Record<string, string>;
}

export interface DisplayConfig {
  kind: string;
  port?: number;
  options: Record<string, string>;
}

export class QemuCommand {
  private machineType?: MachineType;
  private accelerator?: Accelerator;
  private cpuCount?: number;
  private memoryMb?: number;
  private drives: DriveConfig[] = [];
  private netdevs: NetdevConfig[] = [];
  private displayConfig?: DisplayConfig;
  private hasUsbTablet = false;

  machine(type: MachineType): this {
    this.machineType = type;
    return this;
  }

  accel(accel: Accelerator): this {
    this.accelerator = accel;
    return this;
  }

  cpu(count: number): this {
    if (count <= 0) {
      throw new Error('CPU count must be > 0');
    }
    this.cpuCount = count;
    return this;
  }

  memory(mb: number): this {
    if (mb <= 0) {
      throw new Error('Memory must be > 0 MB');
    }
    this.memoryMb = mb;
    return this;
  }

  drive(drive: DriveConfig): this {
    this.drives.push(drive);
    return this;
  }

  netdev(netdev: NetdevConfig): this {
    this.netdevs.push(netdev);
    return this;
  }

  display(config: DisplayConfig): this {
    this.displayConfig = config;
    return this;
  }

  usbTablet(): this {
    this.hasUsbTablet = true;
    return this;
  }

  build(): string[] {
    const args = ['qemu-system-x86_64'];

    if (this.machineType) {
      args.push('-machine', this.machineType);
    }

    if (this.accelerator) {
      args.push('-accel', this.accelerator);
    }

    if (this.cpuCount !== undefined) {
      args.push('-smp', this.cpuCount.toString());
    }

    if (this.memoryMb !== undefined) {
      args.push('-m', this.memoryMb.toString());
    }

    for (const drive of this.drives) {
      const driveStr = `file=${drive.file},format=${drive.format},if=${drive.interface}`;
      args.push('-drive', driveStr);
    }

    for (const netdev of this.netdevs) {
      let netdevStr = `${netdev.kind},id=${netdev.id}`;
      for (const [key, value] of Object.entries(netdev.options)) {
        netdevStr += `,${key}=${value}`;
      }
      args.push('-netdev', netdevStr);
    }

    if (this.displayConfig) {
      if (this.displayConfig.kind === 'spice') {
        let spiceStr = '';
        if (this.displayConfig.port !== undefined) {
          spiceStr += `port=${this.displayConfig.port}`;
        }
        for (const [key, value] of Object.entries(this.displayConfig.options)) {
          if (spiceStr) spiceStr += ',';
          spiceStr += `${key}=${value}`;
        }
        args.push('-spice', spiceStr);
      }
    }

    if (this.hasUsbTablet) {
      args.push('-device', 'usb-tablet');
    }

    return args;
  }

  buildString(): string {
    return this.build().join(' ');
  }
}
