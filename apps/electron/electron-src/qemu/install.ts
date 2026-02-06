import { spawnSync } from 'child_process';

const BREW_CHECK_COMMAND = 'command -v brew >/dev/null 2>&1';
const INSTALL_COMMAND = 'brew update && brew install qemu';
let spawnSyncFn = spawnSync;

function escapeAppleScriptString(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function getQemuInstallCommand(): string {
  return `${BREW_CHECK_COMMAND} && ${INSTALL_COMMAND} || echo "Homebrew missing. Install from https://brew.sh then rerun."`;
}

export function setSpawnSyncFnForTests(fn: typeof spawnSync): void {
  spawnSyncFn = fn;
}

export function openQemuInstallInTerminal(command: string = getQemuInstallCommand()): { success: boolean } {
  const script = `tell application "Terminal" to do script "${escapeAppleScriptString(command)}"`;
  const result = spawnSyncFn('osascript', ['-e', script], { encoding: 'utf-8' });
  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim() || 'Failed to launch Terminal';
    throw new Error(message);
  }
  return { success: true };
}
