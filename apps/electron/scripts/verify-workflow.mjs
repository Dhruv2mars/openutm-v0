import {
  mkdirSync,
  writeFileSync,
  createWriteStream,
  rmSync,
  existsSync,
} from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import http from 'http';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');
const verificationDir = path.join(appDir, 'verification');
const cycleCount = Number(process.env.OPENUTM_VERIFY_CYCLES || '2');
const basePort = Number(process.env.OPENUTM_VERIFY_CDP_BASE_PORT || '9330');
const FALLBACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

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
      // retry
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for CDP target on :${port}`);
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function buildManagedRuntimePayload() {
  const body = `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "QEMU emulator version 10.2.0-openutm-managed"
  exit 0
fi
if [ "$1" = "-spice" ] && [ "$2" = "help" ]; then
  echo "SPICE options:"
  exit 0
fi
if [ "$1" = "--help" ]; then
  echo "-accel hvf"
  echo "-accel tcg"
  exit 0
fi
trap 'exit 0' TERM INT
while true; do
  sleep 60
done
`;
  return Buffer.from(body, 'utf8');
}

async function startRuntimeFixtureServer() {
  const payload = buildManagedRuntimePayload();
  const checksum = sha256Hex(payload);

  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('missing url');
      return;
    }

    if (req.url === '/runtime.bin') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/octet-stream');
      res.end(payload);
      return;
    }

    if (req.url === '/manifest.json') {
      const manifest = {
        version: '10.2.0-openutm-managed',
        assets: {
          'darwin-arm64': {
            url: `http://127.0.0.1:${addressPort}/runtime.bin`,
            sha256: checksum,
            binaryPath: 'bin/qemu-system-x86_64',
            archiveType: 'binary',
          },
          'darwin-x64': {
            url: `http://127.0.0.1:${addressPort}/runtime.bin`,
            sha256: checksum,
            binaryPath: 'bin/qemu-system-x86_64',
            archiveType: 'binary',
          },
        },
      };
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(manifest));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  let addressPort = 0;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('failed to resolve fixture server address'));
        return;
      }
      addressPort = addr.port;
      resolve();
    });
  });

  return {
    manifestUrl: `http://127.0.0.1:${addressPort}/manifest.json`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
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
      const text =
        result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        'runtime exception';
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

async function captureCycleScreenshot(cdp, cycleDir, cycle) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await withTimeout(cdp.send('Page.bringToFront'), `cycle ${cycle} bring-to-front`, 5000);
      const screenshot = await withTimeout(
        cdp.send('Page.captureScreenshot', { format: 'png' }),
        `cycle ${cycle} capture-screenshot attempt-${attempt}`,
        10000,
      );
      const screenshotPath = path.join(cycleDir, 'display.png');
      writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      return { screenshotPath, fallback: false };
    } catch {
      await sleep(1000);
    }
  }

  const screenshotPath = path.join(cycleDir, 'display.png');
  writeFileSync(screenshotPath, Buffer.from(FALLBACK_PNG_BASE64, 'base64'));
  return { screenshotPath, fallback: true };
}

function spawnApp(port, cycleConfigDir, logPath, manifestUrl) {
  const out = createWriteStream(logPath, { flags: 'w' });
  const packagedBinary = path.join(
    appDir,
    'release',
    'mac-universal',
    'OpenUTM (Electron).app',
    'Contents',
    'MacOS',
    'OpenUTM (Electron)',
  );

  const configuredBinary = process.env.OPENUTM_VERIFY_APP_BINARY;
  const usePackaged = process.env.OPENUTM_VERIFY_USE_PACKAGED === '1';

  let cmd;
  let args;
  if (configuredBinary) {
    cmd = configuredBinary;
    args = [`--remote-debugging-port=${port}`];
  } else if (usePackaged && existsSync(packagedBinary)) {
    cmd = packagedBinary;
    args = [`--remote-debugging-port=${port}`];
  } else {
    cmd = 'bun';
    args = ['x', 'electron', '.', `--remote-debugging-port=${port}`];
  }

  const child = spawn(cmd, args, {
    cwd: appDir,
    env: {
      ...process.env,
      OPENUTM_CONFIG_DIR: cycleConfigDir,
      OPENUTM_RUNTIME_MANIFEST_URL: manifestUrl,
      ELECTRON_ENABLE_LOGGING: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.pipe(out);
  child.stderr.pipe(out);
  return { child, out };
}

async function runCycle(cycle, manifestUrl) {
  const startedAt = new Date().toISOString();
  const cycleDir = path.join(verificationDir, `cycle-${cycle}`);
  const configDir = path.join(cycleDir, 'config');
  rmSync(cycleDir, { recursive: true, force: true });
  mkdirSync(configDir, { recursive: true });

  const logPath = path.join(cycleDir, 'app.log');
  const port = basePort + cycle;
  const { child, out } = spawnApp(port, configDir, logPath, manifestUrl);

  let cdp;
  let vmId = null;
  try {
    console.log(`cycle ${cycle}: waiting-for-target`);
    const target = await waitForTarget(port);
    console.log(`cycle ${cycle}: target-ready`);
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    console.log(`cycle ${cycle}: cdp-ready`);

    await withTimeout(
      cdp.evaluate(`(async () => {
        for (let i = 0; i < 100; i++) {
          if (window.openutm) return true
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
        throw new Error('window.openutm bridge not ready')
      })()`),
      `cycle ${cycle} bridge-ready`,
      30000,
    );

    let detect = unwrapIpc(await bridgeCall(cdp, 'detectQemu', [], `cycle ${cycle} detect-qemu`), 'detect-qemu');
    console.log(`cycle ${cycle}: detect source=${detect.source} spice=${detect.spiceSupported}`);
    if (!detect.spiceSupported) {
      console.log(`cycle ${cycle}: install-managed-runtime start`);
      unwrapIpc(
        await bridgeCall(cdp, 'installManagedRuntime', [], `cycle ${cycle} install-managed-runtime`, 180000),
        'install-managed-runtime',
      );
      detect = unwrapIpc(await bridgeCall(cdp, 'detectQemu', [], `cycle ${cycle} detect-qemu-2`), 'detect-qemu');
      console.log(`cycle ${cycle}: detect-after-install source=${detect.source} spice=${detect.spiceSupported}`);
    }
    if (!detect.spiceSupported) {
      throw new Error('SPICE still unavailable after managed runtime install');
    }

    const created = unwrapIpc(
      await bridgeCall(
        cdp,
        'createVm',
        [
          {
            name: `verification-cycle-${cycle}-${Date.now()}`,
            cpu: 2,
            memory: 2048,
            diskSizeGb: 25,
            networkType: 'nat',
            os: 'linux',
          },
        ],
        `cycle ${cycle} create-vm`,
      ),
      'create-vm',
    );
    vmId = created?.id;
    if (!vmId) {
      throw new Error('vm id missing');
    }
    console.log(`cycle ${cycle}: vm-created ${vmId}`);

    unwrapIpc(await bridgeCall(cdp, 'startVm', [vmId], `cycle ${cycle} start-vm`), 'start-vm');
    console.log(`cycle ${cycle}: vm-start requested`);
    await waitForVmStatus(cdp, vmId, 'running', `cycle ${cycle} wait-running`);
    console.log(`cycle ${cycle}: vm-running`);
    await sleep(3000);

    unwrapIpc(await bridgeCall(cdp, 'openDisplay', [vmId], `cycle ${cycle} open-display`), 'open-display');
    console.log(`cycle ${cycle}: display-opened`);
    const display = unwrapIpc(await bridgeCall(cdp, 'getDisplay', [vmId], `cycle ${cycle} get-display`), 'get-display');
    if (!display?.uri?.startsWith('spice://')) {
      throw new Error('display uri missing');
    }
    unwrapIpc(await bridgeCall(cdp, 'closeDisplay', [vmId], `cycle ${cycle} close-display`), 'close-display');
    console.log(`cycle ${cycle}: display-closed`);

    const screenshotCapture = await captureCycleScreenshot(cdp, cycleDir, cycle);
    const screenshotPath = screenshotCapture.screenshotPath;
    console.log(`cycle ${cycle}: screenshot-captured`);

    unwrapIpc(await bridgeCall(cdp, 'stopVm', [vmId], `cycle ${cycle} stop-vm`), 'stop-vm');
    console.log(`cycle ${cycle}: vm-stop requested`);
    await waitForVmStatus(cdp, vmId, 'stopped', `cycle ${cycle} wait-stopped`);
    console.log(`cycle ${cycle}: vm-stopped`);
    unwrapIpc(await bridgeCall(cdp, 'deleteVm', [vmId], `cycle ${cycle} delete-vm`), 'delete-vm');
    const remaining = await waitForVmDeleted(cdp, vmId, `cycle ${cycle} wait-delete`);
    console.log(`cycle ${cycle}: vm-deleted`);

    const result = {
      cycle,
      status: 'PASSED',
      startedAt,
      completedAt: new Date().toISOString(),
      vmId,
      qemuPath: detect.path,
      qemuVersion: detect.version,
      runtimeSource: detect.source,
      spiceSupported: detect.spiceSupported,
      screenshotPath,
      screenshotFallback: screenshotCapture.fallback,
      logPath,
      remainingVms: remaining.length,
    };
    writeFileSync(path.join(cycleDir, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const failed = {
      cycle,
      status: 'FAILED',
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      logPath,
      vmId,
    };
    writeFileSync(path.join(cycleDir, 'result.json'), JSON.stringify(failed, null, 2));
    throw error;
  } finally {
    if (cdp) {
      try {
        await withTimeout(cdp.close(), `cycle ${cycle} cdp-close`, 3000);
      } catch {
        // noop
      }
    }
    if (!child.killed) {
      child.kill('SIGTERM');
      await sleep(1200);
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    out.end();
  }
}

function buildReport(results) {
  const status = results.every((entry) => entry.status === 'PASSED') ? 'PASSED' : 'FAILED';
  const lines = [
    '# Electron Runtime Verification Report',
    '',
    `- generated_at: ${new Date().toISOString()}`,
    `- verification_status: ${status}`,
    `- cycles_requested: ${cycleCount}`,
    `- cycles_passed: ${results.filter((entry) => entry.status === 'PASSED').length}`,
    '',
    '## Cycle Results',
    '',
  ];

  for (const entry of results) {
    lines.push(`### Cycle ${entry.cycle}`);
    lines.push(`- status: ${entry.status}`);
    if (entry.error) {
      lines.push(`- error: ${entry.error}`);
    } else {
      lines.push(`- vm_id: ${entry.vmId}`);
      lines.push(`- qemu_path: ${entry.qemuPath}`);
      lines.push(`- runtime_source: ${entry.runtimeSource}`);
      lines.push(`- spice_supported: ${entry.spiceSupported}`);
      lines.push(`- screenshot: ${entry.screenshotPath}`);
      lines.push(`- screenshot_fallback: ${entry.screenshotFallback ? 'yes' : 'no'}`);
    }
    lines.push(`- log: ${entry.logPath}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  mkdirSync(verificationDir, { recursive: true });
  const runtimeFixture = await startRuntimeFixtureServer();
  const results = [];

  try {
    for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
      console.log(`cycle ${cycle}: starting`);
      try {
        const result = await runCycle(cycle, runtimeFixture.manifestUrl);
        console.log(`cycle ${cycle}: passed`);
        results.push(result);
      } catch (error) {
        console.error(`cycle ${cycle}: failed`, error);
        results.push({
          cycle,
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
          logPath: path.join(verificationDir, `cycle-${cycle}`, 'app.log'),
        });
        break;
      }
    }
  } finally {
    await runtimeFixture.close();
  }

  const report = buildReport(results);
  const reportPath = path.join(verificationDir, 'report.md');
  writeFileSync(reportPath, report);
  console.log(`verification report: ${reportPath}`);

  if (!results.every((entry) => entry.status === 'PASSED')) {
    process.exitCode = 1;
  }
}

await main();
