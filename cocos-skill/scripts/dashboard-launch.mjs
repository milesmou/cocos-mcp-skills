import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { basename, isAbsolute, normalize } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import WebSocket from 'ws';

const execFileAsync = promisify(execFile);
const supportedVersion = '2.2.2';

async function dashboardInfo(executable) {
  if (executable && (!isAbsolute(executable) || basename(executable).toLowerCase() !== 'cocosdashboard.exe')) {
    throw new Error('--dashboard must be an absolute CocosDashboard.exe path');
  }
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$running = @(Get-Process -Name CocosDashboard -ErrorAction SilentlyContinue).Count -gt 0
$exe = $env:COCOS_SKILL_DASHBOARD_EXE
if (-not $running -and -not $exe) {
  $command = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\\cocos-dashboard\\shell\\open\\command' -ErrorAction SilentlyContinue
  if ($command.'(default)' -match '^"([^"]+)"\\s+"%1"\\s*$') { $exe = $Matches[1] }
}
$version = if (-not $running -and $exe) { (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion }
ConvertTo-Json -InputObject @{ running = $running; executable = $exe; version = $version } -Compress`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, COCOS_SKILL_DASHBOARD_EXE: executable ?? '' },
    windowsHide: true,
    timeout: 10000
  });
  return JSON.parse(stdout);
}

async function reserveLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function findInspector(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    redirect: 'error',
    signal: AbortSignal.timeout(800)
  }).catch(() => null);
  if (!response?.ok) return null;
  const [target] = await response.json();
  if (!target?.webSocketDebuggerUrl) return null;
  const address = new URL(target.webSocketDebuggerUrl);
  if (address.protocol !== 'ws:' || address.hostname !== '127.0.0.1' || Number(address.port) !== port ||
      address.username || address.password) throw new Error('Unexpected Dashboard inspector address');
  return address;
}

async function connectInspector(port, child) {
  const deadline = Date.now() + 10000;
  let address;
  while (!address && Date.now() < deadline && child.exitCode === null) {
    address = await findInspector(port);
    if (!address) await delay(200);
  }
  if (!address) throw new Error('Dashboard inspector did not start. Check whether Dashboard opened in another process.');

  const socket = new WebSocket(address, { handshakeTimeout: 3000 });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.on('error', () => {});
  let sequence = 0;
  const pending = new Map();
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    pending.get(message.id)?.(message);
  });
  socket.on('close', () => {
    for (const complete of pending.values()) complete({ error: { message: 'Dashboard inspector disconnected' } });
  });
  return {
    disconnect: () => socket.close(),
    async evaluate(expression) {
      const id = ++sequence;
      const message = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Dashboard inspector request timed out'));
        }, 5000);
        pending.set(id, (result) => {
          clearTimeout(timeout);
          pending.delete(id);
          resolve(result);
        });
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      });
      const exception = message.result?.exceptionDetails;
      if (message.error || exception) throw new Error(message.error?.message || exception.exception?.description || exception.text);
      return message.result.result.value;
    }
  };
}

const dashboardRuntime = `
  const main = process.mainModule;
  const app = main?.require('electron').app;
  const cache = main?.require('node:module')._cache ?? {};
  const suffix = '/cocos.asar/dashboard-browser/dist/lib/project/index.js';
  const module = Object.entries(cache).find(([file]) => file.replaceAll(String.fromCharCode(92), '/').toLowerCase().endsWith(suffix));
  const projects = module?.[1]?.exports;
`;

async function requestOpen(session, pid, project) {
  const target = JSON.stringify(project.path);
  const version = JSON.stringify(project.configuredVersion);
  const deadline = Date.now() + 25000;
  do {
    const state = await session.evaluate(`(() => {
      ${dashboardRuntime}
      const ready = app?.isReady() && app.listenerCount('second-instance') >= 2 && typeof projects?.open === 'function';
      return { ready: Boolean(ready), version: ready ? projects.projectMap[${target}]?.version : null };
    })()`);
    if (state.ready) {
      if (state.version !== project.configuredVersion) throw new Error('Dashboard target registration changed during startup');
      const key = `Symbol.for('cocos-skill-open:${pid}')`;
      await session.evaluate(`(() => {
        ${dashboardRuntime}
        if (process.pid !== ${pid} || projects.projectMap[${target}]?.version !== ${version}) throw Error('Dashboard target changed');
        const state = { done: false };
        globalThis[${key}] = state;
        state.promise = projects.open(${target}).then(
          accepted => Object.assign(state, { done: true, accepted }),
          error => Object.assign(state, { done: true, error: String(error) })
        );
        return true;
      })()`);
      const until = Date.now() + 12000;
      do {
        const receipt = await session.evaluate(`(() => {
          const state = globalThis[${key}];
          if (!state?.done) return null;
          delete globalThis[${key}];
          return { accepted: state.accepted, error: state.error };
        })()`);
        if (receipt?.error) throw new Error(receipt.error);
        if (receipt) return receipt.accepted;
        await delay(250);
      } while (Date.now() < until);
      return null;
    }
    await delay(500);
  } while (Date.now() < deadline);
  throw new Error('Dashboard did not finish initializing its project launcher');
}

export async function launchDashboardProject(project, executable, readState) {
  const dashboard = await dashboardInfo(executable);
  if (dashboard.running) return { status: 'dashboard-running', path: project.path };
  if (!dashboard.executable) throw new Error('Dashboard protocol is not registered. Supply --dashboard with the executable path.');
  if (dashboard.version !== supportedVersion) throw new Error(`Cold launch requires Dashboard ${supportedVersion}, found ${dashboard.version ?? 'unknown'}`);

  const port = await reserveLoopbackPort();
  const child = spawn(dashboard.executable, [`--inspect=127.0.0.1:${port}`], {
    detached: true, stdio: 'ignore', windowsHide: true
  });
  await new Promise((resolve, reject) => child.once('spawn', resolve).once('error', reject));
  child.unref();
  let session;
  let verified = false;
  let accepted;
  try {
    session = await connectInspector(port, child);
    if (await session.evaluate('process.pid') !== child.pid) throw new Error('Unexpected Dashboard inspector process');
    verified = true;
    accepted = await requestOpen(session, child.pid, project);
  } finally {
    try {
      if (verified) {
        await session.evaluate(`(() => {
          delete globalThis[Symbol.for('cocos-skill-open:${child.pid}')];
          const inspector = process.mainModule?.require('node:inspector') ?? process.getBuiltinModule('node:inspector');
          setTimeout(() => inspector.close(), 500);
          return true;
        })()`);
      }
    } finally {
      session?.disconnect();
      if (!verified && child.exitCode === null) child.kill();
    }
    if (verified) {
      const deadline = Date.now() + 4000;
      while (await findInspector(port)) {
        if (Date.now() >= deadline) throw new Error('Dashboard inspector did not close');
        await delay(200);
      }
    }
  }

  if (accepted === false) throw new Error('Dashboard declined the open request. Check the Dashboard window.');
  const deadline = Date.now() + 35000;
  let creator;
  while (Date.now() < deadline) {
    const state = await readState();
    creator = state.processes.find(({ parentPid }) => parentPid === child.pid);
    if (creator && state.registration?.progress === 'open' && state.registration.state === 'success') {
      const expectedEditor = creator.executable && project.editors.some(({ file, installed }) =>
        installed && normalize(file).toLowerCase() === normalize(creator.executable).toLowerCase());
      if (!expectedEditor) throw new Error('Dashboard started the target, but the Creator executable did not match the requested version');
      return { status: 'opened', path: project.path, version: project.configuredVersion, dashboardPid: child.pid, creator };
    }
    await delay(700);
  }
  return { status: creator ? 'started' : 'requested', path: project.path, version: project.configuredVersion,
    dashboardPid: child.pid, ...(creator && { creator }) };
}
