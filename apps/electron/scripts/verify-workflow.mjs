import { mkdirSync, writeFileSync, createWriteStream, rmSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');
const verificationDir = path.join(appDir, 'verification');
const appBinary = path.join(
  appDir,
  'release',
  'mac-universal',
  'OpenUTM (Electron).app',
  'Contents',
  'MacOS',
  'OpenUTM (Electron)',
);

const isoPath =
  process.env.OPENUTM_VERIFY_ISO || path.join(process.env.HOME || '/tmp', 'Downloads', 'ubuntu-24.04.3-live-server-amd64.iso');
const cycleCount = Number(process.env.OPENUTM_VERIFY_CYCLES || '2');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, label, timeoutMs = 30000) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`http ${res.status} for ${url}`);
  }
  return res.json();
}

async function waitForTarget(port, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = list.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
      if (page) {
        return page;
      }
    } catch {
      // wait/retry
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for CDP target on :${port}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (event) => reject(event.error || new Error('websocket connection failed'));
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        if (!data.id) return;
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) {
          pending.reject(new Error(data.error.message || 'cdp error'));
          return;
        }
        pending.resolve(data.result || {});
      };
      ws.onclose = () => {
        for (const [, pending] of this.pending) {
          pending.reject(new Error('cdp websocket closed'));
        }
        this.pending.clear();
      };
    });
  }

  async close() {
    if (!this.ws) return;
    await new Promise((resolve) => {
      this.ws.onclose = () => resolve();
      this.ws.close();
    });
  }

  async send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('cdp websocket is not open');
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'runtime exception';
      throw new Error(text);
    }
    const remote = result.result || {};
    if (remote.subtype === 'error') {
      throw new Error(remote.description || 'runtime error');
    }
    return remote.value;
  }
}

function unwrapIpc(result, label) {
  if (!result?.success) {
    throw new Error(result?.error || `${label} failed`);
  }
  return result.data;
}

async function bridgeCall(cdp, method, args, label, timeoutMs = 30000) {
  const argSource = args.map((arg) => JSON.stringify(arg)).join(', ');
  const expr = `window.openutm.${method}(${argSource})`;
  return withTimeout(cdp.evaluate(expr), label, timeoutMs);
}

async function bridgeFireAndForget(cdp, method, args, label, timeoutMs = 5000) {
  const argSource = args.map((arg) => JSON.stringify(arg)).join(', ');
  const expr = `(() => { window.openutm.${method}(${argSource}).catch(() => undefined); return true; })()`;
  return withTimeout(cdp.evaluate(expr), label, timeoutMs);
}

async function waitForVmStatus(cdp, vmId, status, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const list = unwrapIpc(await bridgeCall(cdp, 'listVms', [], `${label} list-vms`), 'list-vms');
    const vm = (list || []).find((entry) => entry.id === vmId);
    if (vm && vm.status === status) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`${label} timed out waiting for vm status '${status}'`);
}

async function waitForVmDeleted(cdp, vmId, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const list = unwrapIpc(await bridgeCall(cdp, 'listVms', [], `${label} list-vms`), 'list-vms');
    if (!(list || []).some((entry) => entry.id === vmId)) {
      return list || [];
    }
    await sleep(500);
  }
  throw new Error(`${label} timed out waiting for vm deletion`);
}

async function runCycle(cycle) {
  const cycleStartedAt = new Date().toISOString();
  const cycleDir = path.join(verificationDir, `cycle-${cycle}`);
  const cycleConfigDir = path.join(cycleDir, 'config');
  rmSync(cycleDir, { recursive: true, force: true });
  mkdirSync(cycleDir, { recursive: true });
  mkdirSync(cycleConfigDir, { recursive: true });

  const logPath = path.join(cycleDir, 'app.log');
  const out = createWriteStream(logPath, { flags: 'w' });
  const port = 9330 + cycle;
  const app = spawn(appBinary, [`--remote-debugging-port=${port}`], {
    env: {
      ...process.env,
      OPENUTM_CONFIG_DIR: cycleConfigDir,
      ELECTRON_ENABLE_LOGGING: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  app.stdout.pipe(out);
  app.stderr.pipe(out);

  let cdp;
  let startResult;
  let endResult;
  try {
    console.log(`cycle ${cycle}: waiting for app target`);
    const target = await waitForTarget(port);
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    await withTimeout(cdp.evaluate(`(async () => {
      for (let i = 0; i < 100; i++) {
        if (window.openutm) return true;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error('window.openutm bridge not ready');
    })()`), `cycle ${cycle} bridge-ready`, 30000);

    const vmName = `verification-cycle-${cycle}-${Date.now()}`;
    console.log(`cycle ${cycle}: start flow`);
    console.log(`cycle ${cycle}: detect-qemu`);
    const detect = unwrapIpc(await bridgeCall(cdp, 'detectQemu', [], `cycle ${cycle} detect-qemu`), 'detect-qemu');
    if (!detect?.path) {
      throw new Error('qemu path missing');
    }
    const spiceSupported = Boolean(detect.spiceSupported);

    console.log(`cycle ${cycle}: create-vm`);
    const created = unwrapIpc(
      await bridgeCall(
        cdp,
        'createVm',
        [
          {
            name: vmName,
            cpu: 2,
            memory: 2048,
            diskSizeGb: 25,
            installMediaPath: undefined,
            bootOrder: 'disk-first',
            networkType: 'nat',
            os: 'linux',
          },
        ],
        `cycle ${cycle} create-vm`,
      ),
      'create-vm',
    );
    const vmId = created?.id;
    if (!vmId) {
      throw new Error('vm id missing');
    }

    console.log(`cycle ${cycle}: set-install-media`);
    unwrapIpc(
      await bridgeCall(cdp, 'setInstallMedia', [vmId, isoPath], `cycle ${cycle} set-install-media`),
      'set-install-media',
    );
    console.log(`cycle ${cycle}: set-boot-order-cdrom`);
    unwrapIpc(
      await bridgeCall(cdp, 'setBootOrder', [vmId, 'cdrom-first'], `cycle ${cycle} boot-order-iso`),
      'set-boot-order cdrom-first',
    );
    console.log(`cycle ${cycle}: start-vm`);
    await bridgeFireAndForget(cdp, 'startVm', [vmId], `cycle ${cycle} start-vm-dispatch`);
    await waitForVmStatus(cdp, vmId, 'running', `cycle ${cycle} wait-running`);
    await sleep(7000);

    let websocketUri = null;
    if (spiceSupported) {
      unwrapIpc(await bridgeCall(cdp, 'openDisplay', [vmId], `cycle ${cycle} open-display`), 'open-display');
      const display = unwrapIpc(await bridgeCall(cdp, 'getDisplay', [vmId], `cycle ${cycle} get-display`), 'get-display');
      if (!display?.websocketUri?.startsWith('ws://')) {
        throw new Error('websocketUri missing');
      }
      websocketUri = display.websocketUri;

      await withTimeout(
        cdp.evaluate(`(() => {
          const displayTab = [...document.querySelectorAll('button')].find((btn) => btn.textContent?.trim() === 'Display');
          if (displayTab) {
            displayTab.click();
          }
          return true;
        })()`),
        `cycle ${cycle} open-display-tab`,
      );
      await sleep(1200);
    }

    startResult = {
      vmId,
      vmName,
      qemuPath: detect.path,
      qemuVersion: detect.version,
      spiceSupported,
      websocketUri,
    };

    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(cycleDir, 'display.png');
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    console.log(`cycle ${cycle}: finish flow`);
    if (startResult.spiceSupported) {
      unwrapIpc(await bridgeCall(cdp, 'closeDisplay', [startResult.vmId], `cycle ${cycle} close-display-1`), 'close-display');
    }
    await bridgeFireAndForget(cdp, 'stopVm', [startResult.vmId], `cycle ${cycle} stop-vm-1-dispatch`);
    await waitForVmStatus(cdp, startResult.vmId, 'stopped', `cycle ${cycle} wait-stopped-1`);
    await sleep(2000);

    unwrapIpc(
      await bridgeCall(cdp, 'setBootOrder', [startResult.vmId, 'disk-first'], `cycle ${cycle} boot-order-disk`),
      'set-boot-order disk-first',
    );
    unwrapIpc(await bridgeCall(cdp, 'ejectInstallMedia', [startResult.vmId], `cycle ${cycle} eject-media`), 'eject-install-media');
    await bridgeFireAndForget(cdp, 'startVm', [startResult.vmId], `cycle ${cycle} start-vm-2-dispatch`);
    await waitForVmStatus(cdp, startResult.vmId, 'running', `cycle ${cycle} wait-running-2`);
    await sleep(5000);

    if (startResult.spiceSupported) {
      unwrapIpc(await bridgeCall(cdp, 'openDisplay', [startResult.vmId], `cycle ${cycle} open-display-2`), 'open-display (second)');
      unwrapIpc(await bridgeCall(cdp, 'closeDisplay', [startResult.vmId], `cycle ${cycle} close-display-2`), 'close-display (second)');
    }

    await bridgeFireAndForget(cdp, 'stopVm', [startResult.vmId], `cycle ${cycle} stop-vm-2-dispatch`);
    await waitForVmStatus(cdp, startResult.vmId, 'stopped', `cycle ${cycle} wait-stopped-2`);
    await bridgeFireAndForget(cdp, 'deleteVm', [startResult.vmId], `cycle ${cycle} delete-vm-dispatch`);
    const list = await waitForVmDeleted(cdp, startResult.vmId, `cycle ${cycle} wait-delete`);

    endResult = {
      vmId: startResult.vmId,
      remainingVms: (list || []).length,
    };

    const cycleSummary = {
      cycle,
      status: 'PASSED',
      startedAt: cycleStartedAt,
      vmId: startResult.vmId,
      vmName: startResult.vmName,
      qemuPath: startResult.qemuPath,
      qemuVersion: startResult.qemuVersion,
      spiceSupported: startResult.spiceSupported,
      websocketUri: startResult.websocketUri,
      screenshotPath: path.join(cycleDir, 'display.png'),
      logPath,
      endResult,
      completedAt: new Date().toISOString(),
    };

    writeFileSync(path.join(cycleDir, 'result.json'), JSON.stringify(cycleSummary, null, 2));
    console.log(`cycle ${cycle}: passed`);
    return cycleSummary;
  } catch (error) {
    if (cdp) {
      try {
        await withTimeout(cdp.evaluate(`(async () => {
          const list = await window.openutm.listVms();
          if (!list?.success) return;
          for (const vm of list.data || []) {
            if (!vm.name.startsWith('verification-cycle-')) continue;
            try { await window.openutm.stopVm(vm.id); } catch {}
            try { await window.openutm.deleteVm(vm.id); } catch {}
          }
        })()`), `cycle ${cycle} cleanup`, 5000);
      } catch {
        // best effort cleanup
      }
    }

    const failure = {
      cycle,
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
      logPath,
      partialStartResult: startResult || null,
      partialEndResult: endResult || null,
      failedAt: new Date().toISOString(),
    };
    writeFileSync(path.join(cycleDir, 'result.json'), JSON.stringify(failure, null, 2));
    throw new Error(`cycle ${cycle} failed: ${failure.error}`);
  } finally {
    if (cdp) {
      try {
        await withTimeout(cdp.close(), `cycle ${cycle} cdp-close`, 3000);
      } catch {
        // ignore
      }
    }
    if (!app.killed) {
      app.kill('SIGTERM');
      await sleep(1200);
      if (!app.killed) {
        app.kill('SIGKILL');
      }
    }
    out.end();
  }
}

function buildReport(results) {
  const now = new Date().toISOString();
  const status = results.every((entry) => entry.status === 'PASSED') ? 'PASSED' : 'FAILED';

  const lines = [
    '# Electron Manual Verification Report',
    '',
    `- generated_at: ${now}`,
    `- verification_status: ${status}`,
    `- iso_path: ${isoPath}`,
    `- cycles_requested: ${cycleCount}`,
    `- cycles_passed: ${results.filter((entry) => entry.status === 'PASSED').length}`,
    '',
    '## Cycle Results',
    '',
  ];

  for (const entry of results) {
    lines.push(`### Cycle ${entry.cycle}`);
    lines.push(`- status: ${entry.status}`);
    if (entry.status === 'PASSED') {
      lines.push(`- vm_id: ${entry.vmId}`);
      lines.push(`- vm_name: ${entry.vmName}`);
      lines.push(`- qemu_path: ${entry.qemuPath}`);
      lines.push(`- qemu_version: ${entry.qemuVersion}`);
      lines.push(`- spice_supported: ${entry.spiceSupported}`);
      lines.push(`- websocket_uri: ${entry.websocketUri}`);
      lines.push(`- screenshot: ${entry.screenshotPath}`);
      lines.push(`- log: ${entry.logPath}`);
      lines.push(`- completed_at: ${entry.completedAt}`);
    } else {
      lines.push(`- error: ${entry.error}`);
      lines.push(`- log: ${entry.logPath}`);
      lines.push(`- failed_at: ${entry.failedAt}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  mkdirSync(verificationDir, { recursive: true });

  const results = [];
  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    const cycleResult = await runCycle(cycle);
    results.push(cycleResult);
  }

  const report = buildReport(results);
  const reportPath = path.join(verificationDir, 'report.md');
  writeFileSync(reportPath, report);
  console.log(`workflow verification passed: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
