import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getQemuInstallCommand, openQemuInstallInTerminal, setSpawnSyncFnForTests } from './install';

const spawnSyncMock = mock(() => ({ status: 0, stdout: '', stderr: '' }));

describe('qemu install helper', () => {
  beforeEach(() => {
    spawnSyncMock.mockClear?.();
    setSpawnSyncFnForTests(spawnSyncMock as any);
  });

  it('returns brew-based install command', () => {
    const command = getQemuInstallCommand();
    expect(command).toContain('brew update');
    expect(command).toContain('brew install qemu');
  });

  it('opens terminal command via osascript', () => {
    const result = openQemuInstallInTerminal('echo test');
    expect(result.success).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'osascript',
      [ '-e', 'tell application "Terminal" to do script "echo test"' ],
      { encoding: 'utf-8' },
    );
  });

  it('throws when osascript exits non-zero', () => {
    spawnSyncMock.mockImplementationOnce(() => ({
      status: 1,
      stderr: 'boom',
      stdout: '',
    }) as any);

    expect(() => openQemuInstallInTerminal()).toThrow('boom');
  });
});
