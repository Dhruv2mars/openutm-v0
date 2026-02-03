import { execSync } from 'child_process';

interface QemuInfo {
  path: string;
  version: string;
  accelerators: string[];
}

export async function detectQemu(): Promise<QemuInfo> {
  try {
    // Try to find qemu-system-* binary in PATH
    const versionOutput = execSync('qemu-system-x86_64 --version', { encoding: 'utf-8' });
    const versionMatch = versionOutput.match(/QEMU emulator version ([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    const accelerators = await detectAccelerators();

    return {
      path: '/usr/bin/qemu-system-x86_64',
      version,
      accelerators
    };
  } catch (err) {
    throw new Error('QEMU not found in PATH. Please install QEMU.');
  }
}

async function detectAccelerators(): Promise<string[]> {
  const accelerators: string[] = [];

  try {
    const helpOutput = execSync('qemu-system-x86_64 --help', { encoding: 'utf-8' });

    if (helpOutput.includes('-accel hvf')) {
      accelerators.push('hvf'); // macOS
    }
    if (helpOutput.includes('-accel kvm')) {
      accelerators.push('kvm'); // Linux
    }
    if (helpOutput.includes('-accel whpx')) {
      accelerators.push('whpx'); // Windows
    }
    if (helpOutput.includes('-accel tcg')) {
      accelerators.push('tcg'); // Software fallback
    }
  } catch (err) {
    // If help fails, default to tcg
    accelerators.push('tcg');
  }

  return accelerators;
}
