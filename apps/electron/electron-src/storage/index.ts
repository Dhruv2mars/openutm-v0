import { execSync } from 'child_process';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

interface DiskConfig {
  name: string;
  size: string;
  format?: string;
  path?: string;
}

interface DiskInfo {
  name: string;
  path: string;
  size: string;
  format: string;
}

const DEFAULT_DISK_DIR = path.join(process.env.HOME || '/tmp', '.openutm/disks');

export async function createDiskImage(config: DiskConfig): Promise<DiskInfo> {
  try {
    const diskDir = config.path || DEFAULT_DISK_DIR;
    const format = config.format || 'qcow2';
    const diskPath = path.join(diskDir, `${config.name}.${format}`);

    if (!existsSync(diskDir)) {
      mkdirSync(diskDir, { recursive: true });
    }

    if (existsSync(diskPath)) {
      throw new Error(`Disk ${config.name} already exists`);
    }

    execSync(`qemu-img create -f ${format} "${diskPath}" ${config.size}`);

    return {
      name: config.name,
      path: diskPath,
      size: config.size,
      format
    };
  } catch (err) {
    throw new Error(`Failed to create disk: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function deleteDiskImage(diskPath: string): Promise<{ success: boolean }> {
  try {
    if (!existsSync(diskPath)) {
      throw new Error(`Disk ${diskPath} not found`);
    }

    execSync(`rm "${diskPath}"`);

    return { success: true };
  } catch (err) {
    throw new Error(`Failed to delete disk: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function resizeDiskImage(diskPath: string, newSize: string): Promise<DiskInfo> {
  try {
    if (!existsSync(diskPath)) {
      throw new Error(`Disk ${diskPath} not found`);
    }

    execSync(`qemu-img resize "${diskPath}" ${newSize}`);

    const info = execSync(`qemu-img info "${diskPath}" --output=json`, { encoding: 'utf-8' });
    const diskInfo = JSON.parse(info);

    return {
      name: path.basename(diskPath),
      path: diskPath,
      size: newSize,
      format: diskInfo.format
    };
  } catch (err) {
    throw new Error(`Failed to resize disk: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function getDiskInfo(diskPath: string): Promise<DiskInfo> {
  try {
    const info = execSync(`qemu-img info "${diskPath}" --output=json`, { encoding: 'utf-8' });
    const diskInfo = JSON.parse(info);

    return {
      name: path.basename(diskPath),
      path: diskPath,
      size: `${diskInfo['virtual-size']}`,
      format: diskInfo.format
    };
  } catch (err) {
    throw new Error(`Failed to get disk info: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
