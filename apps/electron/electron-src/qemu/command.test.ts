import { describe, it, expect } from 'bun:test';
import { QemuCommand, Accelerator, MachineType } from './command';

describe('QEMU Command Builder', () => {
  it('creates command with correct accelerator', () => {
    const cmd = new QemuCommand().accel(Accelerator.Hvf);
    const args = cmd.build();
    expect(args).toContain('-accel');
    expect(args).toContain('hvf');
  });

  it('sets CPU count correctly', () => {
    const cmd = new QemuCommand().cpu(4);
    const args = cmd.build();
    expect(args).toContain('-smp');
    expect(args).toContain('4');
  });

  it('sets memory correctly', () => {
    const cmd = new QemuCommand().memory(4096);
    const args = cmd.build();
    expect(args).toContain('-m');
    expect(args).toContain('4096');
  });

  it('adds drive with virtio interface', () => {
    const cmd = new QemuCommand().drive({
      id: 'disk0',
      file: '/path/to/disk.qcow2',
      format: 'qcow2',
      interface: 'virtio',
    });
    const argsStr = cmd.build().join(' ');
    expect(argsStr).toContain('file=/path/to/disk.qcow2');
    expect(argsStr).toContain('format=qcow2');
    expect(argsStr).toContain('if=virtio');
  });

  it('adds network with user mode', () => {
    const cmd = new QemuCommand().netdev({
      id: 'net0',
      kind: 'user',
      options: { hostfwd: 'tcp::2222-:22' },
    });
    const argsStr = cmd.build().join(' ');
    expect(argsStr).toContain('-netdev');
    expect(argsStr).toContain('user,id=net0');
    expect(argsStr).toContain('hostfwd=tcp::2222-:22');
  });

  it('adds SPICE display', () => {
    const cmd = new QemuCommand().display({
      kind: 'spice',
      port: 5900,
      options: { 'disable-ticketing': '' },
    });
    const args = cmd.build();
    expect(args).toContain('-spice');
    const argsStr = args.join(' ');
    expect(argsStr).toContain('port=5900');
  });

  it('ignores non-SPICE display kind', () => {
    const cmd = new QemuCommand().display({
      kind: 'vnc',
      options: { listen: '127.0.0.1' },
    });

    const args = cmd.build();
    expect(args).not.toContain('-spice');
  });

  it('adds USB tablet', () => {
    const cmd = new QemuCommand().usbTablet();
    const args = cmd.build();
    expect(args).toContain('-device');
    expect(args).toContain('usb-tablet');
  });

  it('validates memory is positive integer', () => {
    expect(() => new QemuCommand().memory(0)).toThrow('Memory must be > 0 MB');
    expect(() => new QemuCommand().memory(-100)).toThrow('Memory must be > 0 MB');
  });

  it('validates CPU count is positive integer', () => {
    expect(() => new QemuCommand().cpu(0)).toThrow('CPU count must be > 0');
    expect(() => new QemuCommand().cpu(-4)).toThrow('CPU count must be > 0');
  });

  it('auto-selects machine type', () => {
    const cmd = new QemuCommand().machine(MachineType.Q35);
    const args = cmd.build();
    expect(args).toContain('-machine');
    expect(args).toContain('q35');
  });

  it('generates complete valid command string', () => {
    const cmd = new QemuCommand()
      .machine(MachineType.Q35)
      .accel(Accelerator.Hvf)
      .cpu(4)
      .memory(4096)
      .drive({
        id: 'disk0',
        file: '/path/to/disk.qcow2',
        format: 'qcow2',
        interface: 'virtio',
      })
      .netdev({
        id: 'net0',
        kind: 'user',
        options: { hostfwd: 'tcp::2222-:22' },
      })
      .display({
        kind: 'spice',
        port: 5900,
        options: {},
      })
      .usbTablet();

    const args = cmd.build();
    
    expect(args).toContain('-machine');
    expect(args).toContain('-accel');
    expect(args).toContain('-smp');
    expect(args).toContain('-m');
    expect(args).toContain('-drive');
    expect(args).toContain('-netdev');
    expect(args).toContain('-spice');
    expect(args).toContain('-device');

    const cmdStr = cmd.buildString();
    expect(cmdStr).not.toBe('');
    expect(cmdStr).toContain('qemu-system-x86_64');
  });

  it('returns args array starting with qemu-system-x86_64', () => {
    const cmd = new QemuCommand();
    const args = cmd.build();
    expect(args[0]).toBe('qemu-system-x86_64');
  });

  it('supports chaining methods', () => {
    const cmd = new QemuCommand()
      .accel(Accelerator.Kvm)
      .cpu(2)
      .memory(2048);
    
    const args = cmd.build();
    expect(args).toContain('kvm');
    expect(args).toContain('2');
    expect(args).toContain('2048');
  });

  it('builds multiple drives', () => {
    const cmd = new QemuCommand()
      .drive({
        id: 'disk0',
        file: '/path/to/disk1.qcow2',
        format: 'qcow2',
        interface: 'virtio',
      })
      .drive({
        id: 'disk1',
        file: '/path/to/disk2.qcow2',
        format: 'qcow2',
        interface: 'virtio',
      });

    const argsStr = cmd.build().join(' ');
    expect(argsStr).toContain('file=/path/to/disk1.qcow2');
    expect(argsStr).toContain('file=/path/to/disk2.qcow2');
  });
});
