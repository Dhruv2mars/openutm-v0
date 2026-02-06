import { describe, expect, it } from 'bun:test';
import { resolveAssetBasePath } from './asset-path';

describe('resolveAssetBasePath', () => {
  it('returns appPath when appPath already points at dist', () => {
    const value = resolveAssetBasePath('/Users/test/openutm/apps/electron/dist');
    expect(value).toBe('/Users/test/openutm/apps/electron/dist');
  });

  it('appends dist for packaged app path', () => {
    const value = resolveAssetBasePath('/Applications/OpenUTM (Electron).app/Contents/Resources/app.asar');
    expect(value).toBe('/Applications/OpenUTM (Electron).app/Contents/Resources/app.asar/dist');
  });
});
