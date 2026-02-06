import path from 'path';

export function resolveAssetBasePath(appPath: string): string {
  return path.basename(appPath) === 'dist' ? appPath : path.join(appPath, 'dist');
}
