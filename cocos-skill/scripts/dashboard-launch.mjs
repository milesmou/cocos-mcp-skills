import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, isAbsolute, join, normalize } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import WebSocket from 'ws';

import { findDashboardRelay } from './dashboard-relay.mjs';

const execFileAsync = promisify(execFile);
const supportedVersion = '2.2.2';
const powershell = ['-NoProfile', '-NonInteractive', '-Command'];

async function dashboardInfo(executable) {
  if (executable && (!isAbsolute(executable) || basename(executable).toLowerCase() !== 'cocosdashboard.exe')) {
    throw new Error('--dashboard must be an absolute CocosDashboard.exe path');
  }
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$dashboards = @(Get-CimInstance Win32_Process -Filter "Name = 'CocosDashboard.exe'" | Where-Object { $_.CommandLine -notmatch '\\s--type=' })
if ($dashboards.Count -gt 1) { throw 'More than one Dashboard instance is running.' }
$running = $dashboards | Select-Object -First 1
$creators = @(Get-Process -Name CocosCreator,CocosCreator3D -ErrorAction SilentlyContinue).Count
$exe = $env:COCOS_SKILL_DASHBOARD_EXE
if ($running) {
  if (-not $running.ExecutablePath) { throw 'Cannot verify the running Dashboard executable.' }
  if ($exe -and $exe -ne $running.ExecutablePath) { throw 'The running Dashboard uses a different executable.' }
  $exe = $running.ExecutablePath
}
if (-not $running -and -not $exe) {
  $command = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\\cocos-dashboard\\shell\\open\\command' -ErrorAction SilentlyContinue
  if ($command.'(default)' -match '^"([^"]+)"\\s+"%1"\\s*$') { $exe = $Matches[1] }
}
$version = if ($exe) { (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion }
ConvertTo-Json -InputObject @{ pid = $running.ProcessId; executable = $exe; version = $version; creators = $creators } -Compress`;
  const { stdout } = await execFileAsync('powershell.exe', [...powershell, script], {
    env: { ...process.env, COCOS_SKILL_DASHBOARD_EXE: executable ? normalize(executable) : '' },
    windowsHide: true,
    timeout: 10000
  });
  return JSON.parse(stdout);
}

export function hasDashboardWork(projects, editors) {
  const projectBusy = Object.values(projects.map ?? {}).some(({ progress, state }) =>
    (progress !== 'open' && state === 'executing') || ['create', 'download', 'unzip', 'install', 'upgrade'].includes(progress));
  const editorBusy = Object.values(editors.editor ?? {}).flat().some(({ progress, state, upgrading }) =>
    upgrading || state === 'executing' || (progress && progress !== 'finish'));
  return projectBusy || editorBusy;
}

async function closeIdleDashboard(dashboard, profiles) {
  const [projects, editors] = await Promise.all(['project.json', 'editor.json'].map(async (name) =>
    JSON.parse((await readFile(join(profiles, name), 'utf8')).replace(/^\uFEFF/, ''))));
  if (hasDashboardWork(projects, editors)) throw new Error('Dashboard has unfinished work and was left running');

  // Send the normal close request. A refusal or an active Creator leaves the Dashboard in place.
  const script = `
$ErrorActionPreference = 'Stop'
$id = [int]$env:COCOS_SKILL_DASHBOARD_PID
$app = Get-Process -Id $id -ErrorAction SilentlyContinue
if (-not $app) { exit 0 }
if ($app.ProcessName -ne 'CocosDashboard' -or $app.Path -ne $env:COCOS_SKILL_DASHBOARD_EXE) { throw 'Dashboard identity changed.' }
if (Get-Process -Name CocosCreator,CocosCreator3D -ErrorAction SilentlyContinue) { throw 'A Creator session is active.' }
if ($app.MainWindowHandle -eq 0) {
  Start-Process -FilePath $app.Path -ArgumentList 'cocos-dashboard://panel/MAIN.project' -WindowStyle Hidden
  for ($i = 0; $i -lt 12 -and $app.MainWindowHandle -eq 0 -and -not $app.HasExited; $i++) {
    Start-Sleep -Milliseconds 150
    $app.Refresh()
  }
}
if ($app.HasExited) { exit 0 }
if (Get-Process -Name CocosCreator,CocosCreator3D -ErrorAction SilentlyContinue) { throw 'A Creator session started during the close check.' }
if (-not $app.CloseMainWindow() -or -not $app.WaitForExit(6000)) { throw 'Dashboard did not exit normally; it was left running.' }`;
  try {
    await execFileAsync('powershell.exe', [...powershell, script], {
      env: { ...process.env, COCOS_SKILL_DASHBOARD_PID: String(dashboard.pid), COCOS_SKILL_DASHBOARD_EXE: dashboard.executable },
      windowsHide: true,
      timeout: 12000
    });
  } catch (error) {
    throw new Error(error.stderr?.trim() || error.message, { cause: error });
  }
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

async function startDashboard(dashboard, project) {
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
  return child.pid;
}

export async function launchDashboardProject(project, executable, readState, { profiles, registered }) {
  const dashboard = await dashboardInfo(executable);
  if (!dashboard.executable) throw new Error('Dashboard protocol is not registered. Supply --dashboard with the executable path.');
  if (dashboard.version !== supportedVersion) throw new Error(`Command-line launch requires Dashboard ${supportedVersion}, found ${dashboard.version ?? 'unknown'}`);

  let dashboardPid;
  let mode = 'cold';
  if (dashboard.pid && dashboard.creators) {
    const relay = await findDashboardRelay(registered, dashboard.pid);
    if (!relay) throw new Error('Dashboard has a running Creator session, but no verified Funplay relay is available. Existing sessions were preserved.');
    if (await relay(project.path) !== true) throw new Error('Creator did not acknowledge sending the Dashboard request');
    dashboardPid = dashboard.pid;
    mode = 'relay';
  } else {
    if (dashboard.pid) {
      await closeIdleDashboard(dashboard, profiles);
      mode = 'restarted';
    }
    dashboardPid = await startDashboard(dashboard, project);
  }

  const deadline = Date.now() + 35000;
  let creator;
  while (Date.now() < deadline) {
    const state = await readState();
    creator = state.processes.find(({ parentPid }) => parentPid === dashboardPid);
    if (creator && state.registration?.progress === 'open' && state.registration.state === 'success') {
      const expectedEditor = creator.executable && project.editors.some(({ file, installed }) =>
        installed && normalize(file).toLowerCase() === normalize(creator.executable).toLowerCase());
      if (!expectedEditor) throw new Error('Dashboard started the target, but the Creator executable did not match the requested version');
      return { status: 'opened', mode, path: project.path, version: project.configuredVersion, dashboardPid, creator };
    }
    await delay(700);
  }
  return { status: creator ? 'started' : 'requested', mode, path: project.path, version: project.configuredVersion,
    dashboardPid, ...(creator && { creator }) };
}
