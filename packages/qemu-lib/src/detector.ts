import { execSync } from 'child_process';
import { Accelerator } from '@openutm/shared-types';

export interface QemuDetectionResult {
  available: boolean;
  path: string | null;
  version: string | null;
  accelerators: Accelerator[];
  minimumVersionMet: boolean;
}

const MINIMUM_QEMU_VERSION = 6;

function parseVersion(versionString: string): number | null {
  const match = versionString.match(/version\s+([\d]+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

function detectPlatform(): 'darwin' | 'linux' | 'win32' {
  return process.platform as 'darwin' | 'linux' | 'win32';
}

async function detectAccelerators(): Promise<Accelerator[]> {
  const accelerators: Accelerator[] = [Accelerator.TCG];
  const platform = detectPlatform();

  try {
    if (platform === 'darwin') {
      const result = execSync('sysctl kern.hv_support', { encoding: 'utf-8' });
      if (result.includes('1')) {
        accelerators.unshift(Accelerator.HVF);
      }
    } else if (platform === 'linux') {
      try {
        execSync('test -e /dev/kvm', { stdio: 'pipe' });
        accelerators.unshift(Accelerator.KVM);
      } catch {
      }
    } else if (platform === 'win32') {
      try {
        execSync('Get-WindowsOptionalFeature -Online -FeatureName Hyper-V', { shell: 'powershell', stdio: 'pipe' });
        accelerators.unshift(Accelerator.WHPX);
      } catch {
      }
    }
  } catch {
  }

  return accelerators;
}

async function safeDetectAccelerators(): Promise<Accelerator[]> {
  try {
    return await detectAccelerators();
  } catch {
    return [Accelerator.TCG];
  }
}

export async function detectQemu(): Promise<QemuDetectionResult> {
  try {
    const path = await getQemuPath();
    if (!path) {
      return {
        available: false,
        path: null,
        version: null,
        accelerators: await safeDetectAccelerators(),
        minimumVersionMet: false,
      };
    }

    let version: string | null = null;
    try {
      version = execSync(`${path} --version`, { encoding: 'utf-8' });
    } catch {
      version = null;
    }

    const accelerators = await detectAccelerators();
    const versionNum = version ? parseVersion(version) : null;
    const minimumVersionMet = versionNum ? versionNum >= MINIMUM_QEMU_VERSION : false;

    return {
      available: true,
      path,
      version,
      accelerators,
      minimumVersionMet,
    };
  } catch {
    return {
      available: false,
      path: null,
      version: null,
      accelerators: await safeDetectAccelerators(),
      minimumVersionMet: false,
    };
  }
}

export async function getQemuPath(): Promise<string | null> {
  const candidates = [
    'qemu-system-aarch64',
    'qemu-system-x86_64',
    'qemu-system-arm',
    'qemu-system-i386',
  ];

  for (const candidate of candidates) {
    try {
      const path = execSync(`which ${candidate}`, { encoding: 'utf-8' }).trim();
      if (path) {
        return path;
      }
    } catch {
    }
  }

  return null;
}

export async function checkVersion(minimumVersion: string = `${MINIMUM_QEMU_VERSION}.0`): Promise<boolean> {
  try {
    const path = await getQemuPath();
    if (!path) {
      return false;
    }

    const version = execSync(`${path} --version`, { encoding: 'utf-8' });
    const versionNum = parseVersion(version);
    const minVersionNum = parseVersion(`version ${minimumVersion}`);

    if (versionNum === null || minVersionNum === null) {
      return false;
    }

    return versionNum >= minVersionNum;
  } catch {
    return false;
  }
}

export async function getInstallSuggestion(): Promise<string> {
  const platform = detectPlatform();

  if (platform === 'darwin') {
    return 'macOS: Install QEMU using Homebrew:\n  brew install qemu\n\nAlternatively, download from: https://www.qemu.org/download/#macos';
  } else if (platform === 'linux') {
    return 'Linux: Install QEMU using your package manager:\n  Ubuntu/Debian: sudo apt install qemu-system-x86_64\n  Fedora/RHEL: sudo dnf install qemu-system-x86_64\n  Arch: sudo pacman -S qemu-full';
  } else if (platform === 'win32') {
    return 'Windows: Download QEMU installer from:\n  https://www.qemu.org/download/#windows\n\nOr use Chocolatey:\n  choco install qemu';
  }

  return 'Please install QEMU from https://www.qemu.org/download/';
}
